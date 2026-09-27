import 'server-only';
import {getDb} from '@/lib/db';
import {getStripe} from '@/lib/stripe';
import {getTerminalEligibility} from '@/lib/terminal-eligibility';
import {validTerminalLocation} from '@/lib/terminal-location';
import {isTapToPayEnabled} from '@/lib/terminal-rollout';
import {TerminalError} from '@/lib/terminal-http';
import {approvedTerminalAnnouncement} from '@/lib/terminal-announcement-content';
type Auth={companyId:number;staffId:number|null};
export type TerminalAnnouncementView={version:string;title:string;body:string};
function approvedContent() {
  const content=approvedTerminalAnnouncement;
  return content?.approved===true&&/^[a-zA-Z0-9._-]{1,64}$/.test(content.version)&&content.reviewReference.trim()
    &&content.title.trim()&&content.title.length<=160&&content.body.trim()&&content.body.length<=2000?content:null;
}
export async function getTerminalAnnouncement(auth:Auth):Promise<{announcement:TerminalAnnouncementView|null}> {
  const content=approvedContent();
  if(!isTapToPayEnabled()||process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED!=='true'||!content||!auth.staffId)return {announcement:null};
  const db=await getDb();
  if(!await db.prepare('SELECT id FROM staff WHERE id=? AND company_id=?').get(auth.staffId,auth.companyId))return {announcement:null};
  if(await db.prepare('SELECT version FROM terminal_announcement_acknowledgments WHERE company_id=? AND staff_id=? AND version=?').get(auth.companyId,auth.staffId,content.version))return {announcement:null};
  const eligible=await getTerminalEligibility(auth.companyId);
  if(!eligible.eligible||!eligible.stripe_account)return {announcement:null};
  const saved=await db.prepare('SELECT stripe_terminal_location_id FROM stripe_terminal_locations WHERE company_id=?').get<{stripe_terminal_location_id:string}>(auth.companyId);
  if(!saved)return {announcement:null};
  try {
    const location=await getStripe().terminal.locations.retrieve(saved.stripe_terminal_location_id,{}, {stripeAccount:eligible.stripe_account});
    if(location.id!==saved.stripe_terminal_location_id||!validTerminalLocation(location))return {announcement:null};
  } catch(error) {if((error as {code?:string}).code==='resource_missing')return {announcement:null};throw error;}
  const stillValid=await db.prepare(`SELECT s.id FROM staff s JOIN company c ON c.id=s.company_id JOIN stripe_terminal_locations l ON l.company_id=c.id
    WHERE s.id=? AND s.company_id=? AND c.stripe_account_id=? AND l.stripe_terminal_location_id=?`).get(auth.staffId,auth.companyId,eligible.stripe_account,saved.stripe_terminal_location_id);
  if(!stillValid||!isTapToPayEnabled()||process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED!=='true')return {announcement:null};
  return {announcement:{version:content.version,title:content.title,body:content.body}};
}
export async function acknowledgeTerminalAnnouncement(auth:Auth,version:string):Promise<void> {
  const content=approvedContent();
  if(!content||version!==content.version||!auth.staffId)throw new TerminalError('Announcement not available.',404);
  await (await getDb()).transaction(async tx=>{
    if(!await tx.prepare('SELECT id FROM staff WHERE id=? AND company_id=?').get(auth.staffId,auth.companyId))throw new TerminalError('Announcement not available.',404);
    await tx.prepare('INSERT OR IGNORE INTO terminal_announcement_acknowledgments (company_id,staff_id,version) VALUES (?,?,?)').run(auth.companyId,auth.staffId,version);
  });
}
