import {mkdtempSync,chmodSync,mkdirSync,copyFileSync,symlinkSync,readFileSync,writeFileSync,existsSync,lstatSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {buildEnvironment} from './config.mjs';
import {createGateway} from './gateway.mjs';

const scriptDirectory=dirname(fileURLToPath(import.meta.url));
const root=resolve(scriptDirectory,'../../../..');
const [command,directory,origin]=process.argv.slice(2);
const gitEnvironment={...process.env,PATH:`/usr/bin:/bin:${process.env.PATH||''}`};
const offlineKeys={secretKey:'rk_test_OFFLINE',publishableKey:'pk_test_OFFLINE'};
function privateJSON(path){return JSON.parse(privateText(path));}
function privateText(path){
  const info=lstatSync(path);
  if(!info.isFile()||(info.mode&0o077)!==0)throw new Error(`Expected a private regular file (chmod 600): ${path}`);
  return readFileSync(path,'utf8').trim();
}
function runNode(args,options){
  const child=spawn(process.execPath,args,{...options,stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
  return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
}
try {
  if(command==='prepare') {
    if(directory)throw new Error('prepare creates its own private temporary directory; no destination argument is accepted.');
    const workspace=mkdtempSync(join(tmpdir(),'forge-tap-recording-'));chmodSync(workspace,0o700);
    const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,env:gitEnvironment,encoding:'utf8'}).trim();
    // Tracked files only: never copy dotenv credentials, databases or local output.
    const files=execFileSync('git',['ls-files','-z','apps/web'],{cwd:root,env:gitEnvironment,encoding:'utf8'}).split('\0').filter(Boolean);
    for(const file of files){
      if(file.split('/').some(part=>part.startsWith('.env')))continue;
      const source=join(root,file);
      if(!lstatSync(source).isFile())throw new Error(`Refusing non-regular source: ${file}`);
      const target=join(workspace,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);
    }
    symlinkSync(join(root,'apps/web/node_modules'),join(workspace,'apps/web/node_modules'),'dir');
    const metadata={purpose:'forge-tap-recording-v1',revision,sessionSecret:randomBytes(48).toString('hex'),accessToken:randomBytes(32).toString('hex')};
    writeFileSync(join(workspace,'recording.json'),JSON.stringify(metadata,null,2),{mode:0o600,flag:'wx'});
    const env=buildEnvironment({directory:workspace,origin:'https://unconfigured.example.invalid',sessionSecret:metadata.sessionSecret,...offlineKeys});
    const code=await runNode(['--no-warnings','--experimental-strip-types',join(scriptDirectory,'seed.mjs'),workspace],{cwd:workspace,env});
    if(code!==0)throw new Error(`Fixture creation failed. Inspect and discard only the newly created workspace: ${workspace}`);
    console.log(`Private recording workspace: ${workspace}\nCredentials: fixtures.json (private; do not commit or send to Apple).`);
  } else if(command==='build'||command==='serve') {
    if(!directory||!origin||resolve(directory)!==directory)throw new Error('Usage: review.mjs build|serve ABSOLUTE_WORKSPACE HTTPS_ORIGIN');
    const metadata=privateJSON(join(directory,'recording.json'));
    if(metadata.purpose!=='forge-tap-recording-v1')throw new Error('Not a prepared recording workspace.');
    const web=join(directory,'apps/web');
    if(readdirSync(web).some(name=>name.startsWith('.env')))throw new Error('Remove dotenv files from the isolated copy before continuing.');
    if(!lstatSync(join(directory,'terminal.sqlite')).isFile())throw new Error('Disposable local database missing or symlinked.');
    const secretPath=join(directory,'stripe-test-key');const publicPath=join(directory,'stripe-test-publishable');
    const offline=!existsSync(secretPath)&&!existsSync(publicPath);
    const keys=offline?offlineKeys:{secretKey:privateText(secretPath),publishableKey:privateText(publicPath)};
    const env=buildEnvironment({directory,origin,sessionSecret:metadata.sessionSecret,...keys});
    if(offline){env.TAP_TO_PAY_ENABLED='false';env.STRIPE_SECRET_KEY='';env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='';}
    const fingerprint=createHash('sha256').update(JSON.stringify(env)).digest('hex');
    const next=createRequire(join(web,'package.json')).resolve('next/dist/bin/next');
    if(command==='build') {
      const code=await runNode([next,'build'],{cwd:web,env});
      if(code===0)writeFileSync(join(directory,'built.json'),JSON.stringify({fingerprint}),{mode:0o600});
      process.exitCode=code;
    } else {
      if(privateJSON(join(directory,'built.json')).fingerprint!==fingerprint)throw new Error('Configuration changed: rebuild this workspace before serving.');
      const gateway=createGateway({origin,accessToken:metadata.accessToken,sessionSecret:metadata.sessionSecret,upstreamPort:3130});
      gateway.on('error',error=>{console.error(error.message);process.exit(1);});
      gateway.listen(3131,'127.0.0.1');
      writeFileSync(join(directory,'entry-url.txt'),`${origin}/__review/access?token=${metadata.accessToken}\n`,{mode:0o600});
      console.log(`Recording gateway: 127.0.0.1:3131; backend: 127.0.0.1:3130. ${offline?'OFFLINE: no Stripe credentials.':'STRIPE TEST ONLY.'}\nPrivate entry URL saved to entry-url.txt. Keep both terminal and HTTPS tunnel running.`);
      const code=await runNode([next,'start','-H','127.0.0.1','-p','3130'],{cwd:web,env});
      gateway.closeAllConnections();gateway.close();process.exitCode=code;
    }
  } else throw new Error('Usage: node apps/web/scripts/tap-review/review.mjs prepare | build WORKSPACE HTTPS_ORIGIN | serve WORKSPACE HTTPS_ORIGIN');
} catch(error){console.error(error.message);process.exitCode=1;}
