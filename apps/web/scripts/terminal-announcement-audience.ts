import {DatabaseSync} from 'node:sqlite';
import {isAbsolute,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export type ReadonlyAudienceDb={select<T>(sql:string,params:ReadonlyArray<string|number|null>):Promise<T[]>};
export async function countTerminalAnnouncementAudience(db:ReadonlyAudienceDb):Promise<{eligibleCompanies:number;eligibleStaff:number;missingContact:number}> {
  const [counts]=await db.select<{eligibleCompanies:number;eligibleStaff:number;missingContact:number}>(`SELECT COUNT(DISTINCT company_id) AS eligibleCompanies,COUNT(*) AS eligibleStaff,COALESCE(SUM(CASE WHEN has_contact=0 THEN 1 ELSE 0 END),0) AS missingContact FROM (
    SELECT c.id AS company_id,s.id AS staff_id,MAX(CASE WHEN TRIM(COALESCE(s.email,'')) LIKE '%_@_%._%' THEN 1 ELSE 0 END) AS has_contact
    FROM company c JOIN staff s ON s.company_id=c.id JOIN stripe_terminal_locations l ON l.company_id=c.id
    WHERE s.id>0 AND c.stripe_charges_enabled=1
      AND c.stripe_account_id GLOB 'acct_*' AND LENGTH(c.stripe_account_id)>5 AND c.stripe_account_id NOT GLOB '*[^A-Za-z0-9_]*'
      AND l.stripe_terminal_location_id GLOB 'tml_*' AND LENGTH(l.stripe_terminal_location_id)>4 AND l.stripe_terminal_location_id NOT GLOB '*[^A-Za-z0-9_]*'
    GROUP BY c.id,s.id
  )`,[]);
  return {eligibleCompanies:counts.eligibleCompanies,eligibleStaff:counts.eligibleStaff,missingContact:counts.missingContact};
}
export function readonlyAudienceAdapter(database:DatabaseSync):ReadonlyAudienceDb {
  database.exec('PRAGMA query_only=ON');
  return {async select<T>(sql:string,params:ReadonlyArray<string|number|null>) {
    if(!/^SELECT\b/i.test(sql.trim())||sql.includes(';'))throw Error('Only a single SELECT is permitted.');
    return database.prepare(sql).all(...params) as T[];
  }};
}
async function main(args:string[]) {
  let database:DatabaseSync;
  if(args.length===0||args.length===1&&args[0]==='--fixture') {
    database=new DatabaseSync(':memory:');
    database.exec(`CREATE TABLE company(id INTEGER,stripe_account_id TEXT,stripe_charges_enabled INTEGER);
      CREATE TABLE staff(id INTEGER,company_id INTEGER,email TEXT);
      CREATE TABLE stripe_terminal_locations(company_id INTEGER,stripe_terminal_location_id TEXT);
      INSERT INTO company VALUES (1,'acct_fake',1);
      INSERT INTO staff VALUES (1,1,'fixture@example.invalid'),(2,1,NULL);
      INSERT INTO stripe_terminal_locations VALUES (1,'tml_fake');`);
  } else {
    if(args.length!==2||args[0]!=='--db'||!isAbsolute(args[1]))throw Error('Use --fixture or --db with an explicit absolute local SQLite path.');
    database=new DatabaseSync(args[1],{readOnly:true});
  }
  try {console.log(JSON.stringify(await countTerminalAnnouncementAudience(readonlyAudienceAdapter(database))));}
  finally{database.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(()=>{console.error('Read-only audience preview failed. Use --fixture or an explicitly authorized local SQLite database.');process.exitCode=1;});
}
