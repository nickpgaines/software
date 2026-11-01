import http from 'node:http';
import {timingSafeEqual,createHmac} from 'node:crypto';
import {validateOrigin} from './config.mjs';

// Local recording-only gateway; never deploy this as a production auth layer.
export function createGateway({origin,accessToken,sessionSecret,upstreamPort}) {
  const host=new URL(validateOrigin(origin)).host;
  if(!/^[a-f0-9]{64}$/.test(accessToken))throw new Error('A random 32-byte access token is required.');
  if(!sessionSecret)throw new Error('Disposable session secret required.');
  const matches=value=>typeof value==='string'&&value.length===accessToken.length&&timingSafeEqual(Buffer.from(value),Buffer.from(accessToken));
  return http.createServer(async(req,res)=>{
    const deny=(status,message)=>{res.writeHead(status,{'content-type':'text/plain','cache-control':'no-store','referrer-policy':'no-referrer'});res.end(message);};
    try {
      if(req.headers.host!==host)return deny(400,'Wrong recording host');
      if(!['GET','HEAD','POST','PATCH','PUT','DELETE'].includes(req.method))return deny(405,'Method not allowed');
      if(!req.url.startsWith('/')||req.url.startsWith('//')||/%2f|%5c|\\/i.test(req.url))return deny(400,'Invalid path');
      const url=new URL(req.url,origin);
      if(url.pathname==='/__review/access') {
        if(req.method!=='GET'||!matches(url.searchParams.get('token')))return deny(401,'Private recording environment');
        res.writeHead(303,{'location':'/login','set-cookie':`forge_review_access=${accessToken}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800`,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;
      }
      const cookies=(req.headers.cookie||'').split(';').map(value=>value.trim());
      let nativeSession=false;
      if(req.method==='POST'&&url.pathname==='/api/stripe/terminal/connection-token') {
        const [encoded,signature,extra]=(cookies.find(value=>value.startsWith('crm_session='))?.slice(12)||'').split('.');
        if(encoded&&/^[a-f0-9]{64}$/.test(signature||'')&&!extra) {
          const payload=Buffer.from(encoded,'base64url').toString();
          const [,timestamp,staff,company]=payload.split(':');
          const age=Date.now()-Number(timestamp);
          nativeSession=age>=0&&age<28800000&&/^\d+$/.test(staff||'')&&/^\d+$/.test(company||'')&&timingSafeEqual(Buffer.from(signature,'hex'),createHmac('sha256',sessionSecret).update(payload).digest());
        }
      }
      if(!nativeSession&&!matches(cookies.find(value=>value.startsWith('forge_review_access='))?.slice(20)))return deny(401,'Open the private recording entry link first.');
      if(url.pathname.startsWith('/api/cron')||url.pathname.includes('/webhook')||url.pathname.startsWith('/api/auth/')||url.pathname.includes('/oauth'))return deny(404,'Not available in this recording environment');
      if(!['GET','HEAD'].includes(req.method)&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))return deny(403,'Same-origin required');
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>1048576)return deny(413,'Request too large');chunks.push(chunk);}
      const localOrigin=`http://localhost:${upstreamPort}`;
      const headers={...req.headers};
      for(const name of Object.keys(headers))if(name.startsWith('x-forwarded-')||['forwarded','connection','transfer-encoding','accept-encoding'].includes(name))delete headers[name];
      headers.host=`localhost:${upstreamPort}`;
      headers.cookie=cookies.filter(value=>!value.startsWith('forge_review_access=')).join('; ');
      if(headers.origin)headers.origin=localOrigin;
      const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers},reply=>{
        const responseHeaders={...reply.headers,'cache-control':'private, no-store','referrer-policy':'no-referrer'};
        if(responseHeaders['set-cookie'])responseHeaders['set-cookie']=responseHeaders['set-cookie'].map(cookie=>/;\s*secure(?:;|$)/i.test(cookie)?cookie:cookie+'; Secure');
        if(responseHeaders.location) {
          const redirect=new URL(responseHeaders.location,origin);
          if(['localhost','127.0.0.1'].includes(redirect.hostname)&&redirect.port===String(upstreamPort))responseHeaders.location=origin+redirect.pathname+redirect.search+redirect.hash;
        }
        res.writeHead(reply.statusCode,responseHeaders);reply.pipe(res);
      });
      upstream.on('error',()=>{if(!res.headersSent)deny(502,'Recording server unavailable');else res.end();});
      res.on('close',()=>upstream.destroy());upstream.end(Buffer.concat(chunks));
    } catch {if(!res.headersSent)deny(500,'Recording gateway error');else res.end();}
  });
}
