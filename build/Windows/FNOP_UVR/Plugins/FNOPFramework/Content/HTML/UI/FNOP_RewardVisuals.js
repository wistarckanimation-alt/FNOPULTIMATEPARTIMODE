(function(){'use strict';
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function toHex(r,g,b){return '#'+[r,g,b].map(function(v){return clamp(Math.round(v),0,255).toString(16).padStart(2,'0')}).join('');}
function parseHex(c){var m=String(c||'').trim().match(/^#([0-9a-f]{6})$/i);if(!m)return [255,47,175];var n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255];}
function rgba(rgb,a){return 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+a+')';}
function vivid(rgb){var hi=Math.max(rgb[0],rgb[1],rgb[2]),lo=Math.min(rgb[0],rgb[1],rgb[2]);var mid=(hi+lo)*.5;var out=rgb.map(function(v){return mid+(v-mid)*1.72});var mx=Math.max(out[0],out[1],out[2]);var boost=mx>0?Math.min(1.24,252/mx):1;return out.map(function(v){return clamp(v*boost,0,255)});}
function towardWhite(rgb,t){return rgb.map(function(v){return Math.round(v+(255-v)*t)});}
function applyAccent(el,c){var rgb=vivid(parseHex(c)),hex=toHex(rgb[0],rgb[1],rgb[2]);el.style.setProperty('--fnop-reward-accent',hex);el.style.setProperty('--fnop-reward-glow',rgba(rgb,.88));el.style.setProperty('--fnop-reward-soft',rgba(rgb,.48));el.style.setProperty('--fnop-reward-faint',rgba(rgb,.24));el.style.setProperty('--fnop-reward-line',rgba(towardWhite(rgb,.28),1));}
function sampleAccent(img,fallback){
  try{
    if(!img||!img.complete||!img.naturalWidth)return fallback;
    var c=document.createElement('canvas');c.width=28;c.height=28;var x=c.getContext('2d');if(!x)return fallback;
    x.drawImage(img,0,0,28,28);var d=x.getImageData(0,0,28,28).data,r=0,g=0,b=0,w=0;
    for(var i=0;i<d.length;i+=4){var a=d[i+3]/255;if(a<.10)continue;var mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);var sat=(mx-mn)/Math.max(1,mx);var lum=(d[i]+d[i+1]+d[i+2])/765;if(lum<.035||lum>.985)continue;var weight=a*(.18+sat*1.9)*(.55+lum*.45);r+=d[i]*weight;g+=d[i+1]*weight;b+=d[i+2]*weight;w+=weight;}
    if(w<.01)return fallback;var vr=vivid([r/w,g/w,b/w]);return toHex(vr[0],vr[1],vr[2]);
  }catch(e){return fallback;}
}
function decorate(el,accent){
  if(!el)return;el.classList.add('fnop-reward-visual');var fallback=accent||el.dataset.fnopAccent||'#ff2faf';applyAccent(el,fallback);
  var old=el.querySelector(':scope > .fnop-reward-sparkles');if(old)old.remove();var layer=document.createElement('span');layer.className='fnop-reward-sparkles';
  var count=6;for(var i=0;i<count;i++){var s=document.createElement('i');s.style.left=(6+Math.random()*88)+'%';s.style.top=(7+Math.random()*86)+'%';s.style.setProperty('--spark-size',(3+Math.random()*5).toFixed(1)+'px');s.style.setProperty('--spark-speed',(1.9+Math.random()*2.2).toFixed(2)+'s');s.style.setProperty('--spark-delay',(-Math.random()*3.5).toFixed(2)+'s');layer.appendChild(s);}el.appendChild(layer);
  var img=el.querySelector('img');if(img){var apply=function(){applyAccent(el,sampleAccent(img,fallback)||fallback)};if(img.complete)requestAnimationFrame(apply);else img.addEventListener('load',apply,{once:true});}
}
function scan(root){(root||document).querySelectorAll('.fnop-reward-visual,[data-fnop-reward-visual]').forEach(function(el){if(!el.dataset.fnopDecorated){el.dataset.fnopDecorated='1';decorate(el,el.dataset.fnopAccent)}});}
window.FNOPRewardVisuals={decorate:decorate,scan:scan,sampleAccent:sampleAccent};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan(document)});else scan(document);
new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.matches&&n.matches('.fnop-reward-visual,[data-fnop-reward-visual]'))decorate(n,n.dataset.fnopAccent);scan(n);})})}).observe(document.documentElement,{childList:true,subtree:true});
})();
