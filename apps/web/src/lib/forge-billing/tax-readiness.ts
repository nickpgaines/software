import type Stripe from 'stripe';
import { validatePrices } from './catalog';
import { objectId } from './provider';
export type ApprovedTaxConfiguration = {
  headOfficeState: string;
  taxCode: string;
  taxBehavior: 'exclusive' | 'inclusive';
  states: string[];
};
export class TaxReadinessError extends Error {}
const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
/** Read-only operator check. Does not determine nexus, register, file, or authorize launch. */
export async function checkTaxReadiness(stripe: Stripe, live: boolean, approved: ApprovedTaxConfiguration, now = new Date()) {
  if (!US_STATES.has(approved.headOfficeState) || !/^txcd_\d{8}$/.test(approved.taxCode) ||
      !['exclusive','inclusive'].includes(approved.taxBehavior) || !approved.states.length ||
      approved.states.some(state => !US_STATES.has(state)) || !Number.isFinite(now.getTime())) {
    throw new TaxReadinessError('Supply approved tax configuration: US head office, tax code, inclusive/exclusive behavior, and registered states.');
  }
  const settings = await stripe.tax.settings.retrieve();
  if (settings.livemode !== live || settings.status !== 'active' || settings.defaults.provider !== 'stripe' ||
      settings.head_office?.address.country !== 'US' || settings.head_office.address.state !== approved.headOfficeState) {
    throw new TaxReadinessError('Stripe Tax settings are incomplete or do not match the approved head office and mode.');
  }
  const states = [...new Set(approved.states)].sort();
  const registered = new Set<string>();
  for await (const registration of stripe.tax.registrations.list({status:'active',limit:100})) {
    if (registration.livemode !== live) throw new TaxReadinessError('Tax registration mode mismatch.');
    const us = registration.country_options.us;
    if (registration.status !== 'active' || registration.active_from > now.getTime()/1000 ||
        (registration.expires_at !== null && registration.expires_at <= now.getTime()/1000)) continue;
    if (registration.country !== 'US' || us?.type !== 'state_sales_tax' || !states.includes(us.state)) {
      throw new TaxReadinessError('An active tax registration is outside the approved US state-sales-tax scope; review it before launch.');
    }
    registered.add(us.state);
  }
  if (states.some(state => !registered.has(state))) throw new TaxReadinessError('An approved tax registration is missing or not yet effective.');
  const prices = await validatePrices(stripe,live);
  for (const {id} of prices) {
    const price = await stripe.prices.retrieve(id);
    if (price.tax_behavior !== approved.taxBehavior) throw new TaxReadinessError('Each Forge price must explicitly match the approved tax behavior.');
    const productId = objectId(price.product);
    if (!productId) throw new TaxReadinessError('Forge price is missing its product.');
    const product = await stripe.products.retrieve(productId);
    if (product.deleted || !product.active || product.livemode !== live || objectId(product.tax_code) !== approved.taxCode) {
      throw new TaxReadinessError('Each Forge product must explicitly match the approved tax code and mode.');
    }
  }
  return {taxConfigurationReady:true,pricesChecked:prices.length,states,taxBehavior:approved.taxBehavior,launchAuthorized:false};
}
