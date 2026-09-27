import assert from 'node:assert/strict';
import {test,beforeEach,afterEach} from 'node:test';
import {fixture,loadTerminal,accounts,locations,setAnnouncementContent,provider} from './helpers/terminal-harness.mjs';
const m=await loadTerminal();let db:ReturnType<typeof fixture>;
const auth={companyId:1,staffId:7};
const content={approved:true,version:'test-v1',title:'Test approved content',body:'Fake local preview content',reviewReference:'test-only'};
beforeEach(async()=>{db=fixture();process.env.TAP_TO_PAY_ENABLED='true';process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED='true';setAnnouncementContent(content);await m.schema.installTerminalSchema(db.db);});
afterEach(()=>{db.close();delete process.env.TAP_TO_PAY_ENABLED;delete process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED;});
test('announcement needs independent exact enablement, approved content and fresh merchant eligibility',async()=>{
  assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement.version,'test-v1');
  for(const flag of [undefined,'false','TRUE','1']){if(flag===undefined)delete process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED;else process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED=flag;assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);}
  process.env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED='true';process.env.TAP_TO_PAY_ENABLED='false';assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  process.env.TAP_TO_PAY_ENABLED='true';setAnnouncementContent(null);assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  setAnnouncementContent({...content,approved:false});assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  setAnnouncementContent(content);accounts.charges=false;assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  accounts.charges=true;locations.data=[];assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  assert.equal(provider.creates.length,0);assert.equal(provider.updates.length,0);
});
test('acknowledgment is scoped to current staff, company and displayed content version',async()=>{
  await m.announcements.acknowledgeTerminalAnnouncement(auth,'test-v1');await m.announcements.acknowledgeTerminalAnnouncement(auth,'test-v1');
  assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  assert.ok((await m.announcements.getTerminalAnnouncement({companyId:1,staffId:8})).announcement);
  assert.equal((await m.announcements.getTerminalAnnouncement({companyId:2,staffId:7})).announcement,null);
  await assert.rejects(m.announcements.acknowledgeTerminalAnnouncement(auth,'forged-future'));
  setAnnouncementContent({...content,version:'test-v2'});assert.ok((await m.announcements.getTerminalAnnouncement(auth)).announcement);
  db.sqlite.exec('DELETE FROM staff WHERE id=7');assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM terminal_announcement_acknowledgments').get().n,0);
});
test('announcement acknowledgment rejects cross-origin requests and repeat migrations preserve choices',async()=>{
  const req=(origin:string)=>new Request('https://www.forgecrm.app/api/stripe/terminal/announcement/ack',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({version:'test-v1'})});
  assert.equal((await m.announcementAck.POST(req('https://foreign.invalid'))).status,403);
  assert.equal((await m.announcementAck.POST(req('https://www.forgecrm.app'))).status,200);
  await Promise.all([m.schema.installTerminalSchema(db.db),m.schema.installTerminalSchema(db.db)]);
  assert.equal((await m.announcements.getTerminalAnnouncement(auth)).announcement,null);
  db.sqlite.exec('PRAGMA foreign_keys=ON; DELETE FROM company WHERE id=1');
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM terminal_announcement_acknowledgments').get().n,0);
});
