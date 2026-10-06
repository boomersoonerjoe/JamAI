import {verifiedMerchantFacts} from './price-evidence.mjs';
const removeMoney=text=>(text || '').replace(/(?:[$£€]|USD|GBP|EUR)\s*\d[\d,.]*/g,'[amount not independently verified]');
export function discoveryEvidence(evidence) {
 if(evidence.retrievalIntent!=='deal-discovery')return evidence;
 const {sources:verified,facts}=verifiedMerchantFacts(evidence);
 const byURL=new Map(verified.map(source=>[source.url,source]));
 const now=Date.parse(evidence.fetchedAt),year=new Date(now).getUTCFullYear();
 const sources=evidence.sources.flatMap(source=>{
  if(byURL.has(source.url))return [{...byURL.get(source.url),evidenceRole:'verified-offer'}];
  const published=Date.parse(source.article?.publishedAt || source.publishedAt || '');
  const ages=`${source.title} ${new URL(source.url).pathname}`.match(/\b20\d{2}\b/g) || [];
  if(ages.length && ages.every(value=>+value<year) || Number.isFinite(published) && (published>now+900000 || now-published>7*86400000))return [];
  const recent=Number.isFinite(published) && now-published<=7*86400000;
  const text=source.article?.status==='retrieved'?removeMoney(source.article.text):undefined;
  return [{...source,evidenceRole:recent?'recent-report':'search-lead',title:removeMoney(source.title),excerpt:removeMoney(source.excerpt),...(source.article?{article:{...source.article,offers:undefined,productLinks:undefined,text}}:{})}];
 });
 return {...evidence,sources,dealDiscovery:{status:facts.length?'verified-offers':sources.length?'leads-only':'insufficient',facts},...(sources.length?{}:{retrievalStatus:'insufficient'})};
}
