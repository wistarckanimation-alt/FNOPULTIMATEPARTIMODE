/* Presentation only: never cancel input, synthesize gameplay, or replace native handlers. */
(function(){'use strict';if(window.FNOPPolish)return;
var selector='button,[role=button],.menu-btn,.mode-card,.fnop-btn,.commerce-buy,.settings-tab,.lang-card,.char-card,.mood-chip,.game-card,.fnop-card.slot,.fnop-card.chest,.close,.fnop-close,.reward-close';
var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,hover=null,canvas=null,ctx=null,particles=[],rings=[],frameId=0,last=0,w=1,h=1;
function excluded(){return document.body&&document.body.hasAttribute('data-fnop-no-polish');}
function target(event){var n=event.target;return n&&n.closest?n.closest(selector):null;}
function usable(n){return n&&!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&!n.classList.contains('disabled');}
function prepare(n){if(n)n.classList.add('fnop-spring-target');}
function resize(){if(!canvas)return;w=innerWidth;h=innerHeight;var d=Math.min(1.5,devicePixelRatio||1);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);}
function ensure(){if(canvas)return;canvas=document.createElement('canvas');canvas.className='fnop-ui-particles';canvas.setAttribute('aria-hidden','true');document.body.appendChild(canvas);ctx=canvas.getContext('2d');resize();}
function burst(x,y){if(reduced||excluded())return;ensure();rings.push({x:x,y:y,t:0});if(rings.length>8)rings.shift();for(var i=0;i<16;i++){var a=i*Math.PI*2/16+(Math.random()-.5)*.2,s=40+Math.random()*125;particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:.45+Math.random()*.35,r:1.3+Math.random()*1.5,warm:Math.random()<.65});}if(particles.length>180)particles.splice(0,particles.length-180);if(!frameId)frameId=requestAnimationFrame(draw);}
function draw(ms){frameId=0;var dt=Math.min(.04,last?(ms-last)/1000:.016);last=ms;ctx.clearRect(0,0,w,h);rings=rings.filter(function(r){r.t+=dt;var p=r.t/.68;if(p>=1)return false;ctx.beginPath();ctx.arc(r.x,r.y,7+(1-Math.pow(1-p,3))*78,0,Math.PI*2);ctx.strokeStyle='rgba(247,203,232,'+((1-p)*.65)+')';ctx.lineWidth=1.4*(1-p)+.3;ctx.stroke();return true;});particles=particles.filter(function(p){p.t+=dt;if(p.t>=p.life)return false;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*3);p.vy*=Math.exp(-dt*3);var a=1-p.t/p.life;ctx.fillStyle=p.warm?'rgba(251,210,235,'+a+')':'rgba(192,180,239,'+a+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*Math.max(.2,a),0,Math.PI*2);ctx.fill();return true;});if(particles.length||rings.length)frameId=requestAnimationFrame(draw);else {last=0;ctx.clearRect(0,0,w,h);}}
function boot(){if(excluded())return;document.documentElement.classList.add('fnop-polish');document.querySelectorAll(selector).forEach(prepare);document.querySelectorAll('.mode-card[data-mode]').forEach(function(n){n.setAttribute('role','button');n.tabIndex=0;n.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click();}});});}
document.addEventListener('pointerover',function(e){if(excluded())return;var n=target(e);if(!usable(n))return;prepare(n);n.classList.add('fnop-over');hover=n;},{passive:true});
document.addEventListener('pointermove',function(e){if(!hover||reduced)return;var r=hover.getBoundingClientRect();var x=Math.max(-1,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width)*2-1)),y=Math.max(-1,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)*2-1));hover.style.setProperty('--fnop-x',(x*4.0).toFixed(2)+'px');hover.style.setProperty('--fnop-y',(y*2.8-2.2).toFixed(2)+'px');hover.style.setProperty('--fnop-r',(x*.45).toFixed(3)+'deg');},{passive:true});
document.addEventListener('pointerout',function(e){var n=target(e);if(!n||n.contains(e.relatedTarget))return;n.classList.remove('fnop-over');n.style.setProperty('--fnop-x','0px');n.style.setProperty('--fnop-y','0px');n.style.setProperty('--fnop-r','0deg');if(hover===n)hover=null;},{passive:true});
document.addEventListener('click',function(e){if(excluded())return;var n=target(e);if(!usable(n))return;prepare(n);if(!reduced){n.classList.remove('fnop-pressed');void n.offsetWidth;n.classList.add('fnop-pressed');clearTimeout(n.__fnopPressTimer);n.__fnopPressTimer=setTimeout(function(){n.classList.remove('fnop-pressed');},510);}var r=n.getBoundingClientRect();burst(e.clientX||r.left+r.width/2,e.clientY||r.top+r.height/2);},{passive:true});
addEventListener('resize',resize,{passive:true});addEventListener('pagehide',function(){if(frameId)cancelAnimationFrame(frameId);frameId=0;particles=[];rings=[];});
window.FNOPPolish={version:'1.30.0',burst:burst,animateOut:function(ms){ms=Math.max(0,Number(ms)||160);return new Promise(function(resolve){if(!document.body){resolve();return;}document.body.classList.add('fnop-page-exit');setTimeout(resolve,ms);});},debug:function(){return {particles:particles.length,rings:rings.length,reduced:reduced};}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* FNOP 1.29.1: an independent DEV dialog. Never participates in the shop grid. */
(function(){'use strict';
var active=null;
function hide(restore){if(!active)return;var d=active;active=null;d.panel.classList.remove('open');d.panel.hidden=true;d.button.setAttribute('aria-expanded','false');d.shop.style.removeProperty('--fnop-shop-shift');if(restore&&d.button.isConnected)d.button.focus();}
function layout(){if(!active)return;var d=active,p=d.panel,r=d.shop.getBoundingClientRect(),width=d.shop.offsetWidth,currentLeft=parseFloat(getComputedStyle(d.shop).left)||0,baseLeft=r.left+r.width/2-currentLeft-width/2,w=Math.min(344,innerWidth-32),gap=18,combined=width+w+gap;
p.style.width=w+'px';p.style.top='24px';p.style.bottom='24px';p.style.left='auto';p.style.right='16px';
if(innerWidth>=combined+48){var left=(innerWidth-combined)/2,shift=left-baseLeft;d.shop.style.setProperty('--fnop-shop-shift',shift.toFixed(2)+'px');p.style.left=(left+width+gap)+'px';p.style.right='auto';p.dataset.layout='side-by-side';}
else {d.shop.style.removeProperty('--fnop-shop-shift');p.dataset.layout='drawer';}}
function toggle(button,panel,shop){if(!button||!panel||!shop||window.__FNOP_EDITOR_DEV__!==true)return;if(active&&active.panel===panel){hide(true);return;}hide(false);
if(!panel.__fnopDock){panel.__fnopDock=true;panel.classList.add('fnop-dev-dock');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Herramientas de desarrollo');panel.tabIndex=-1;
var close=document.createElement('button');close.type='button';close.className='fnop-dev-close';close.textContent='\u00d7';close.setAttribute('aria-label','Cerrar herramientas');close.onclick=function(){hide(true);};panel.insertBefore(close,panel.firstChild);document.body.appendChild(panel);}
button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',panel.id);panel.hidden=false;panel.classList.add('open');active={button:button,panel:panel,shop:shop};layout();panel.focus();}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();hide(true);}},true);
// Closing the store also closes its detached tools, including modal cross/backdrop paths.
var observer=new MutationObserver(function(){if(!active)return;var owner=active.shop.closest('.overlay');if(!active.shop.isConnected||!active.panel.isConnected||!active.button.isConnected||(owner&&!owner.classList.contains('open'))||getComputedStyle(active.shop).display==='none')hide(false);});
function observe(){observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','style'],childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
addEventListener('resize',layout,{passive:true});window.FNOPDevDock={toggle:toggle,close:hide,layout:layout};
})();
