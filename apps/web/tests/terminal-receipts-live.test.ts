import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture,loadTerminal,provider} from './helpers/terminal-harness.mjs';

test('fake live-mode receipt transport returns requested without claiming delivery',async()=>{
  // Separate test process pins its fake client to live-format credentials. No real SDK/network.
  const db=fixture();
  try {
    process.env.TAP_TO_PAY_MODE='live';process.env.STRIPE_SECRET_KEY='sk_live_fake';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_live_fake';process.env.TAP_TO_PAY_ENABLED='true';
    const m=await loadTerminal({receipts:true});await m.schema.installTerminalSchema(db.db);
    const a=await m.service.startTerminalAttempt({companyId:1,staffId:7},'live-receipt',{operation:'payment',job_id:12,save_card:false});
    const pi=provider.intents[0];Object.assign(pi,{status:'succeeded',livemode:true,latest_charge:{id:'ch_live_fake',payment_intent:pi.id,status:'succeeded',paid:true,captured:true,amount:22500,amount_captured:22500,amount_refunded:0,currency:'usd',livemode:true,created:1790000000,receipt_url:null,payment_method_details:{type:'card_present',card_present:{}}}});
    await m.service.reconcileTerminalAttempt(1,a.attempt_id);
    const req=new Request(`https://www.forgecrm.app/api/stripe/terminal/attempts/${a.attempt_id}/receipt`,{method:'POST',headers:{Origin:'https://www.forgecrm.app','Content-Type':'application/json'},body:JSON.stringify({email:'fake@example.com'})});
    const res=await m.receipt!.POST(req,{params:{id:a.attempt_id}});
    assert.equal(res.status,200);assert.deepEqual(await res.json(),{status:'requested'});
    assert.deepEqual((provider.updates[0] as any).body,{receipt_email:'fake@example.com'});
  } finally {db.close();}
});
