// Invoked only by the recording workspace preparer with a clean environment.
import {registerHooks} from 'node:module';
import {randomBytes} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [directory]=process.argv.slice(2);
if(!directory||process.env.TURSO_DATABASE_URL!==`file:${join(directory,'terminal.sqlite')}`||existsSync(join(directory,'terminal.sqlite')))throw new Error('Seeding requires a fresh disposable database.');
const source=join(directory,'apps/web/src');
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('@/'))return next(pathToFileURL(join(source,`${specifier.slice(2)}.ts`)).href,context);
  if(specifier.startsWith('.')&&!specifier.endsWith('.ts')&&context.parentURL?.includes('/src/'))return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {getDb}=await import(pathToFileURL(join(source,'lib/db.ts')));
const {hashPassword}=await import(pathToFileURL(join(source,'lib/password.ts')));
hook.deregister();
const db=await getDb();
if((await db.prepare('SELECT COUNT(*) n FROM staff').get()).n!==0)throw new Error('Database is not empty.');
const password=randomBytes(24).toString('base64url');
const accounts=[];const jobs=[];
await db.transaction(async tx=>{
  const company=await tx.prepare('INSERT INTO company(name,time_zone,access_status,email) VALUES(?,?,?,?)').run('Forge Recording Test Merchant','America/Chicago','active','merchant@example.invalid');
  for(const role of ['admin','technician']) {
    const email=`recording-${role}@example.invalid`;
    const staff=await tx.prepare('INSERT INTO staff(company_id,name,first_name,last_name,email,password_hash,permission_level) VALUES(?,?,?,?,?,?,?)').run(company.lastInsertRowid,`Recording ${role}`,'Recording',role,email,hashPassword(password),role);
    accounts.push({email,role,companyId:company.lastInsertRowid,staffId:staff.lastInsertRowid});
  }
  const customer=await tx.prepare('INSERT INTO customers(company_id,name,email) VALUES(?,?,?)').run(company.lastInsertRowid,'Fake Homeowner','homeowner@example.invalid');
  for(const [purpose,amount]of [['Job payment',22500],['Payment and save',12500],['Decline and recovery',5000]]) {
    const job=await tx.prepare('INSERT INTO jobs(company_id,customer_id,scheduled_at,price_cents,status,notes) VALUES(?,?,?,?,?,?)').run(company.lastInsertRowid,customer.lastInsertRowid,new Date().toISOString(),amount,'scheduled',`RECORDING TEST ONLY: ${purpose}`);
    jobs.push({id:job.lastInsertRowid,amountCents:amount,purpose});
  }
});
writeFileSync(join(directory,'fixtures.json'),JSON.stringify({accounts,jobs,password},null,2),{mode:0o600,flag:'wx'});
console.log('Created one fake merchant, two staff, one fake customer and three unpaid jobs. No Stripe requests made.');
