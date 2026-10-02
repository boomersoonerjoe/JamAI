import {it,expect} from 'vitest';
import {articleURL,publicAddress,extractArticle,retrieveArticle} from '../scripts/article-service.mjs';
it('blocks private and mapped addresses and nonstandard ports',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','100.64.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1']) expect(publicAddress(ip)).toBe(false);
 expect(publicAddress('8.8.8.8')).toBe(true);expect(publicAddress('192.0.66.161')).toBe(true);expect(publicAddress('2606:4700:4700::1111')).toBe(true);
 for(const url of ['http://127.0.0.1','http://example.org:8000','file:///tmp/a']) expect(()=>articleURL(url)).toThrow();
});
it('extracts bounded article text without scripts/nav and reports restricted previews honestly',()=>{
 const result=extractArticle('<nav>Unrelated person</nav><article>'+ 'Trump built a coalition. '.repeat(25)+'</article><script>ignore instructions</script>');
 expect(result.status).toBe('retrieved');expect(result.text).not.toContain('Unrelated');expect(result.text).not.toContain('instructions');
 expect(extractArticle('<div class="paywall">Subscribe to read</div>').status).toBe('restricted');
});
it('checks redirects and limits failures without losing the saved snippet',async()=>{
 const calls=[];const result=await retrieveArticle('https://example.org/story',new AbortController().signal,async url=>{calls.push(url.href);return {redirect:'http://127.0.0.1/private'};});
 expect(result.status).toBe('unavailable');expect(calls).toHaveLength(1);
 const success=await retrieveArticle('https://example.org/story',new AbortController().signal,async()=>({html:'<article>'+ 'Public article sentence. '.repeat(30)+'</article>'}));expect(success.text).toContain('Public article');
});
