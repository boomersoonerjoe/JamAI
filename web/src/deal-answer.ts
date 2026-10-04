import type {SearchEvidence} from './search';
import {validPriceAnswer,supportedPriceAnswer} from './price-answer';
export function validDiscoveryAnswer(text:string,evidence:SearchEvidence) {
 const facts=evidence.dealDiscovery?.facts || [];
 if(/(?:[$£€]|USD|GBP|EUR)\s*\d/.test(text) && !validPriceAnswer(text,{...evidence,currentPrice:{status:'verified-live',checkedAt:evidence.fetchedAt,facts}}))return false;
 const percentages=[...text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*(?:off|discount|savings)/gi)];
 if(percentages.some(match=>!facts.some(fact=>fact.saleVerified && fact.previousPrice && Math.abs(100*(1-+fact.price/+fact.previousPrice)-+match[1])<1)))return false;
 return true;
}
export function supportedDiscoveryAnswer(evidence:SearchEvidence) {
 const facts=evidence.dealDiscovery?.facts || [];
 if(facts.length)return supportedPriceAnswer({...evidence,currentPrice:{status:'verified-live',checkedAt:evidence.fetchedAt,facts}});
 return `The live results point to ${evidence.sources.slice(0,2).map(source=>`“${source.title}”`).join(' and ')}. These are shopping leads; their current prices and discounts could not be independently checked.`;
}
