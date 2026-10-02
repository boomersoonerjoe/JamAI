import { request as http } from 'node:http';
import { request as https } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { load } from 'cheerio';
import { publicLink } from './search-service.mjs';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return a > 0 && a < 224 && ![10,127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 && [0,2].includes(c))) && !(a === 198 && [18,19].includes(b));
  }
  return isIP(address) === 6 && /^[23]/.test(address) && !/^2001:db8:/i.test(address);
}
export function articleURL(value) {
  const safe = publicLink(value); if (!safe) throw new Error('Invalid article URL');
  const url = new URL(safe);
  if (url.port && !['80','443'].includes(url.port)) throw new Error('Unsupported article port');
  if (isIP(url.hostname) && !publicAddress(url.hostname)) throw new Error('Private article address');
  return url;
}
export function extractArticle(html) {
  const $ = load(html);
  const restricted = $('[class*="paywall"], [id*="paywall"], [class*="subscription-required"]').length > 0 || /subscribe to (?:continue|read)|sign in to read (?:this|the) (?:article|story)/i.test($.text());
  $('script,style,nav,header,footer,aside,form,noscript,iframe').remove();
  const body = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  const text = body.text().replace(/\s+/g,' ').trim().slice(0,12000);
  return {status:restricted ? 'restricted' : text.length >= 300 ? 'retrieved' : 'unavailable',...(text.length >= 300 ? {text} : {})};
}
// Resolve and pin a public address at connection time; redirects receive the same checks.
function getPage(url, signal) {
  return new Promise((resolve,reject) => {
    const req = (url.protocol === 'https:' ? https : http)(url,{signal,method:'GET',headers:{'User-Agent':'NhomeAI/1.0','Accept':'text/html'},lookup(host,options,callback) {
      lookup(host,{all:true},(error,addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return callback(new Error('Private article address'));
        const selected = addresses[0]; callback(null,options.all ? [selected] : selected.address,selected.family);
      });
    }},response => {
      if ([301,302,303,307,308].includes(response.statusCode)) { response.resume(); resolve({redirect:response.headers.location}); return; }
      if ([401,403].includes(response.statusCode)) {response.resume();resolve({restricted:true});return;}
      if (response.statusCode !== 200 || !/text\/html/i.test(response.headers['content-type'] || '')) {response.resume();reject(new Error('Article unavailable'));return;}
      const chunks=[];let size=0;
      response.on('data',chunk => {size+=chunk.length;if(size > 1024*1024) {response.destroy(new Error('Article too large'));return;} chunks.push(chunk);});
      response.on('error',reject);response.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}));
    });req.on('error',reject);req.end();
  });
}
export async function retrieveArticle(value, signal, get = getPage) {
  let url = articleURL(value);
  const deadline = AbortSignal.any([signal,AbortSignal.timeout(10000)]);
  const fetchedAt = new Date().toISOString();
  try {
    for(let i=0;i<4;i++) {
      const result = await get(url,deadline);
      if(result.redirect) {url=articleURL(new URL(result.redirect,url).href);continue;}
      if(result.restricted) return {status:'restricted',fetchedAt,url:url.href};
      return {...extractArticle(result.html),fetchedAt,url:url.href};
    }
  } catch { signal.throwIfAborted(); }
  return {status:'unavailable',fetchedAt,url:url.href};
}
