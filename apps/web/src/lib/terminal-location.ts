import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import type { SessionContext } from '@/lib/auth';
import { getDb, type Db } from '@/lib/db';
import { getStripe, getCompany, isStripeConfigured } from '@/lib/stripe';
import { assignedPermissions } from '@/lib/team-authorization';
import { TerminalError } from '@/lib/terminal-http';
import { requireTapToPayEnabled } from '@/lib/terminal-rollout';
import { requireTerminalEnvironment } from '@/lib/terminal-environment';

const states = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
type Address = {line1:string;line2?:string;city:string;state:string;postal_code:string;country:'US'};
type Location = Stripe.Terminal.Location;
const realText = (value:unknown): value is string => typeof value === 'string' && !!value.trim()
  && !/^(unspecified|unknown|n\/a|na)$/i.test(value.trim());

export function validTerminalLocation(value: Location | {deleted:true}): value is Location {
  if ('deleted' in value && value.deleted) return false;
  const address = (value as Location).address;
  return !!address && address.country === 'US' && realText(address.line1) && realText(address.city)
    && states.has(address.state ?? '') && /^\d{5}(-\d{4})?$/.test(address.postal_code ?? '')
    && !address.postal_code?.startsWith('00000');
}

export async function canManageTerminalSetup(db: Db, session: SessionContext) {
  if (session.isPlatformAdmin) return true;
  if (session.staffId == null) return false;
  const staff = await db.prepare('SELECT permission_level,custom_role_id FROM staff WHERE id=? AND company_id=?')
    .get<{permission_level:string|null;custom_role_id:number|null}>(session.staffId,session.companyId);
  return !!staff && !!(await assignedPermissions(db,session.companyId,staff))?.has('settings.view_all');
}

async function accountForSetup(companyId: number) {
  requireTerminalEnvironment();
  if (!isStripeConfigured()) throw new TerminalError('Payment setup is currently unavailable. Please try again later.',503);
  const company = await getCompany(companyId);
  if (!company.stripe_account_id || !company.stripe_charges_enabled) throw new TerminalError('Complete Stripe onboarding before setting up Tap to Pay.',409);
  return company.stripe_account_id;
}

async function retrieveLocation(id:string, account:string):Promise<Location|null> {
  try {
    const location = await getStripe().terminal.locations.retrieve(id,undefined,{stripeAccount:account});
    return validTerminalLocation(location) ? location : null;
  } catch(error) {
    if ((error as {code?:string})?.code === 'resource_missing') return null;
    throw error;
  }
}

async function readLocations(db:Db, companyId:number, account:string) {
  const cached = await db.prepare('SELECT stripe_terminal_location_id FROM stripe_terminal_locations WHERE company_id=?')
    .get<{stripe_terminal_location_id:string}>(companyId);
  const selected = cached ? await retrieveLocation(cached.stripe_terminal_location_id,account) : null;
  const list = await getStripe().terminal.locations.list({limit:100},{stripeAccount:account});
  const locations = list.data.filter(validTerminalLocation);
  if (selected && !locations.some(location => location.id === selected.id)) locations.unshift(selected);
  return {locations,has_more:list.has_more,selected: selected ?? (!list.has_more && locations.length === 1 ? locations[0] : null)};
}

async function persistLocation(db:Db,companyId:number,account:string,location:Location,session?:SessionContext) {
  await db.transaction(async tx => {
    const company = await tx.prepare('SELECT stripe_account_id,stripe_charges_enabled FROM company WHERE id=?')
      .get<{stripe_account_id:string|null;stripe_charges_enabled:number}>(companyId);
    if (!company || company.stripe_account_id !== account || !company.stripe_charges_enabled) throw new TerminalError('Stripe account changed. Reload setup before continuing.',409);
    if (session && !await canManageTerminalSetup(tx,session)) throw new TerminalError('Administrator permission is required to set up Tap to Pay.',403);
    await tx.prepare(`INSERT INTO stripe_terminal_locations (company_id,stripe_terminal_location_id,display_name) VALUES (?,?,?)
      ON CONFLICT(company_id) DO UPDATE SET stripe_terminal_location_id=excluded.stripe_terminal_location_id,display_name=excluded.display_name`)
      .run(companyId,location.id,location.display_name);
  });
}

/** Checkout never creates a location and never trusts a cached cross-account ID. */
export async function resolveTerminalLocation(db:Db, companyId:number, stripeAccount:string):Promise<Location> {
  requireTerminalEnvironment();
  const cached = await db.prepare('SELECT stripe_terminal_location_id FROM stripe_terminal_locations WHERE company_id=?')
    .get<{stripe_terminal_location_id:string}>(companyId);
  if (cached) {
    const location = await retrieveLocation(cached.stripe_terminal_location_id,stripeAccount);
    if (location) return location;
  }
  const result = await getStripe().terminal.locations.list({limit:100},{stripeAccount});
  const candidates = result.data.filter(validTerminalLocation);
  if (result.has_more || candidates.length !== 1) throw new TerminalError('Choose a valid US business location in Tap to Pay settings before continuing.',409,'setup_required');
  await persistLocation(db,companyId,stripeAccount,candidates[0]);
  return candidates[0];
}

export async function getTerminalLocationSetup(session:SessionContext) {
  const db = await getDb();
  const account = await accountForSetup(session.companyId);
  const result = await readLocations(db,session.companyId,account);
  if (await accountForSetup(session.companyId) !== account) throw new TerminalError('Stripe account changed. Reload setup.',409);
  return {stripe_account:account,can_manage:await canManageTerminalSetup(db,session),
    locations:result.locations.map(({id,display_name,address}) => ({id,display_name,address})),
    selected_location_id:result.selected?.id ?? null,has_more:result.has_more};
}

function locationInput(body:unknown): {location_id:string} | {display_name:string;address:Address} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TerminalError('Choose a business location or enter its complete address.');
  const value = body as Record<string,unknown>;
  if ('location_id' in value) {
    if (Object.keys(value).length !== 1 || typeof value.location_id !== 'string' || !/^tml_[A-Za-z0-9_]+$/.test(value.location_id)) throw new TerminalError('Choose a valid business location.');
    return {location_id:value.location_id};
  }
  if (Object.keys(value).some(key => !['display_name','address'].includes(key)) || !realText(value.display_name) || value.display_name.length > 100
    || !value.address || typeof value.address !== 'object' || Array.isArray(value.address)) throw new TerminalError('Enter your business name and complete US address.');
  const raw = value.address as Record<string,unknown>;
  if (Object.keys(raw).some(key => !['line1','line2','city','state','postal_code','country'].includes(key))
    || !realText(raw.line1) || !realText(raw.city) || typeof raw.state !== 'string' || typeof raw.postal_code !== 'string'
    || raw.country !== 'US' || (raw.line2 != null && typeof raw.line2 !== 'string')) throw new TerminalError('Enter a complete US business address.');
  const address:Address = {line1:raw.line1.trim(),city:raw.city.trim(),state:raw.state.trim().toUpperCase(),postal_code:raw.postal_code.trim(),country:'US',
    ...(typeof raw.line2 === 'string' && raw.line2.trim() ? {line2:raw.line2.trim()} : {})};
  if (Object.values(address).some(part => part.length > 200) || !validTerminalLocation({address} as Location)) throw new TerminalError('Enter a valid US business address, state and ZIP code.');
  return {display_name:value.display_name.trim(),address};
}

export async function saveTerminalLocationSetup(session:SessionContext,body:unknown) {
  requireTapToPayEnabled();
  const db = await getDb();
  if (!await canManageTerminalSetup(db,session)) throw new TerminalError('Administrator permission is required to set up Tap to Pay.',403);
  const input = locationInput(body);
  const account = await accountForSetup(session.companyId);
  const location = 'location_id' in input ? await retrieveLocation(input.location_id,account)
    : await getStripe().terminal.locations.create(input,{stripeAccount:account,
      idempotencyKey:`forge:terminal-location:${session.companyId}:${account}:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`});
  if (!location || !validTerminalLocation(location)) throw new TerminalError('Choose a valid US location from your connected Stripe account.');
  await persistLocation(db,session.companyId,account,location,session);
  return {location_id:location.id,display_name:location.display_name,stripe_account:account};
}
