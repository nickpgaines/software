import assert from 'node:assert/strict';
import {test} from 'node:test';
import http from 'node:http';
import {createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import {buildEnvironment, validateOrigin} from '../scripts/tap-review/config.mjs';
import {createGateway} from '../scripts/tap-review/gateway.mjs';

test('recording environment rejects production origins and live credentials',()=>{
  for(const origin of ['https://forgecrm.app','https://www.forgecrm.app','https://forgecrm.app.','https://www.forgecrm.app.','https://preview.forgecrm.app','http://review.example.com','https://review.example.com/path','https://user@review.example.com','https://review.example.com:444']) {
    assert.throws(()=>validateOrigin(origin));
  }
  assert.equal(validateOrigin('https://review.example.com'),'https://review.example.com');
  const base={directory:'/tmp/isolated',origin:'https://review.example.com',sessionSecret:'test-session',secretKey:'rk_test_fake',publishableKey:'pk_test_fake'};
  for(const keys of [{secretKey:'sk_live_fake'},{publishableKey:'pk_live_fake'},{secretKey:''}])assert.throws(()=>buildEnvironment({...base,...keys}));
  const env=buildEnvironment(base);
  assert.equal(env.TURSO_DATABASE_URL,'file:/tmp/isolated/terminal.sqlite');
  assert.equal(env.TAP_TO_PAY_MODE,'test');
  assert.equal(env.APP_URL,'https://review.example.com');
  assert.equal(env.TAP_TO_PAY_ENABLED,'true');
  assert.equal(env.FORGE_BILLING_ENABLED,'false');
  assert.equal(env.TAP_TO_PAY_ANNOUNCEMENT_ENABLED,'false');
  assert.equal(env.NODE_OPTIONS,undefined);
  assert.equal(env.TWILIO_AUTH_TOKEN,undefined);
});

test('prepare generates a private fresh database without inheriting provider or database credentials',()=>{
  const script=fileURLToPath(new URL('../scripts/tap-review/review.mjs',import.meta.url));
  const output=execFileSync(process.execPath,[script,'prepare'],{encoding:'utf8',env:{...process.env,TURSO_DATABASE_URL:'libsql://never-contact.example.invalid',TURSO_AUTH_TOKEN:'do-not-use',STRIPE_SECRET_KEY:'sk_live_DO_NOT_USE'}});
  const directory=/Private recording workspace: (.+)/.exec(output)?.[1];
  assert(directory);assert.match(basename(directory),/^forge-tap-recording-/);
  try {
    assert.equal(statSync(directory).mode&0o077,0);
    assert.equal(statSync(join(directory,'fixtures.json')).mode&0o077,0);
    const fixtures=JSON.parse(readFileSync(join(directory,'fixtures.json'),'utf8'));
    assert.equal(fixtures.accounts.length,2);assert.equal(fixtures.jobs.length,3);
    assert(fixtures.password.length>=24);assert(!output.includes(fixtures.password));
    assert(!readdirSync(join(directory,'apps/web')).some(name=>name.startsWith('.env')));
    const database=new DatabaseSync(join(directory,'terminal.sqlite'),{readOnly:true});
    try {
      assert.equal(database.prepare('SELECT COUNT(*) n FROM staff').get()!.n,2);
      assert.equal(database.prepare('SELECT COUNT(*) n FROM jobs').get()!.n,3);
      assert.equal(database.prepare('SELECT COUNT(*) n FROM company WHERE stripe_account_id IS NOT NULL').get()!.n,0);
      assert.equal(database.prepare('SELECT COUNT(*) n FROM terminal_attempts').get()!.n,0);
    } finally {database.close();}
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('private gateway gates signup, preserves onboarding return, and rejects cross-origin writes',async()=>{
  const upstream=http.createServer((req,res)=>{
    if(req.url==='/redirect'){res.writeHead(307,{location:`https://localhost:${(upstream.address() as import('node:net').AddressInfo).port}/login`});res.end();return;}
    if(req.url==='/set-cookie'){res.setHeader('set-cookie','crm_session=fake; HttpOnly; Path=/');}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({path:req.url,origin:req.headers.origin,forwarded:req.headers['x-forwarded-host'],cookie:req.headers.cookie}));
  });
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const address=upstream.address();assert(address&&typeof address!=='string');
  const gateway=createGateway({origin:'https://review.example.com',accessToken:'a'.repeat(64),sessionSecret:'isolated-session',upstreamPort:address.port});
  await new Promise<void>(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  const gateAddress=gateway.address();assert(gateAddress&&typeof gateAddress!=='string');
  async function request(path:string,headers:Record<string,string>={},method='GET') {
    return new Promise<{status:number;headers:http.IncomingHttpHeaders;body:string}>((resolve,reject)=>{
      const req=http.request({hostname:'127.0.0.1',port:gateAddress.port,path,method,headers:{host:'review.example.com',...headers}},res=>{
        let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body}));
      });req.on('error',reject);req.end();
    });
  }
  try {
    assert.equal((await request('/signup')).status,401);
    assert.equal((await request('/__review/access?token=wrong')).status,401);
    const entry=await request('/__review/access?token='+'a'.repeat(64));
    assert.equal(entry.status,303);assert.equal(entry.headers.location,'/login');
    assert.match(entry.headers['set-cookie']![0],/HttpOnly/);
    assert.match(entry.headers['set-cookie']![0],/Secure/);
    assert.equal(entry.headers['referrer-policy'],'no-referrer');
    const cookie=entry.headers['set-cookie']![0].split(';')[0]+'; crm_session=fake-test-session';
    assert.equal((await request('/signup',{cookie})).status,200);
    assert.equal((await request('/redirect',{cookie})).headers.location,'https://review.example.com/login');
    assert.match((await request('/set-cookie',{cookie})).headers['set-cookie']![0],/; Secure/);
    assert.equal((await request('/api/stripe/connect/return',{cookie})).status,200);
    assert.equal((await request('/api/signup',{cookie,origin:'https://evil.example'},'POST')).status,403);
    assert.equal((await request('/api/signup',{cookie,origin:'https://review.example.com',host:'evil.example'},'POST')).status,400);
    assert.equal((await request('/api/cron/jobs',{cookie})).status,404);
    assert.equal((await request('/api/stripe/webhook',{cookie})).status,404);
    const signup=await request('/api/signup',{cookie,origin:'https://review.example.com','x-forwarded-host':'evil.example'},'POST');
    assert.equal(signup.status,200);
    const observed=JSON.parse(signup.body);
    assert.equal(observed.forwarded,undefined);
    assert.equal(observed.origin,`http://localhost:${address.port}`);
    assert.equal(observed.cookie,'crm_session=fake-test-session');
    // Native deliberately sends only crm_session, not the browser gate cookie.
    const payload=`recording-admin@example.invalid:${Date.now()}:1:2`;
    const signature=createHmac('sha256','isolated-session').update(payload).digest('hex');
    const nativeCookie=`crm_session=${Buffer.from(payload).toString('base64url')}.${signature}`;
    assert.equal((await request('/api/stripe/terminal/connection-token',{cookie:nativeCookie,origin:'https://review.example.com'},'POST')).status,200);
    assert.equal((await request('/api/signup',{cookie:nativeCookie,origin:'https://review.example.com'},'POST')).status,401);
    assert.equal((await request('/api/stripe/terminal/connection-token',{cookie:'crm_session=forged',origin:'https://review.example.com'},'POST')).status,401);
  } finally {
    gateway.closeAllConnections();upstream.closeAllConnections();
    await Promise.all([new Promise<void>(resolve=>gateway.close(()=>resolve())),new Promise<void>(resolve=>upstream.close(()=>resolve()))]);
  }
});
