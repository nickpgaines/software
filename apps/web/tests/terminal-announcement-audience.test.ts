import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {countTerminalAnnouncementAudience,readonlyAudienceAdapter} from '../scripts/terminal-announcement-audience.ts';
test('audience preview counts unique current memberships and never exposes contacts or writes',async()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE company(id INTEGER,stripe_account_id TEXT,stripe_charges_enabled INTEGER);
      CREATE TABLE staff(id INTEGER,company_id INTEGER,email TEXT); CREATE TABLE stripe_terminal_locations(company_id INTEGER,stripe_terminal_location_id TEXT);
      INSERT INTO company VALUES (1,'acct_valid',1),(2,'acct_disabled',0),(3,'acct_no_location',1);
      INSERT INTO staff VALUES (7,1,'private@example.com'),(7,1,'private@example.com'),(8,1,NULL),(9,2,'disabled@example.com'),(10,99,'orphan@example.com'),(11,3,'missing-location@example.com');
      INSERT INTO stripe_terminal_locations VALUES (1,'tml_valid'),(1,'tml_valid'),(2,'tml_disabled');PRAGMA query_only=ON;`);
    const statements:string[]=[];
    const result=await countTerminalAnnouncementAudience({select:async<T>(sql:string,params:ReadonlyArray<any>)=>{statements.push(sql);return db.prepare(sql).all(...params) as T[];}});
    assert.deepEqual(result,{eligibleCompanies:1,eligibleStaff:2,missingContact:1});
    assert.ok(statements.every(sql=>/^SELECT\b/i.test(sql.trim())));
    assert.doesNotMatch(JSON.stringify(result),/@|acct_|tml_|private/);
  } finally {db.close();}
});
test('default CLI operates on fake data and outputs only aggregate counts',()=>{
  const output=execFileSync(process.execPath,['--no-warnings','--experimental-strip-types','scripts/terminal-announcement-audience.ts'],{encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),{eligibleCompanies:1,eligibleStaff:2,missingContact:1});
  assert.doesNotMatch(output,/@|acct_|tml_|SELECT/i);
});
test('readonly adapter rejects mutations and multi-statement input',async()=>{
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE example(id INTEGER)');
  try {
    const adapter=readonlyAudienceAdapter(db);
    for(const sql of ['DELETE FROM example','PRAGMA writable_schema=ON','SELECT 1; DELETE FROM example'])await assert.rejects(adapter.select(sql,[]));
    assert.throws(()=>db.exec('INSERT INTO example VALUES (1)'),/readonly/i);
  } finally {db.close();}
});
