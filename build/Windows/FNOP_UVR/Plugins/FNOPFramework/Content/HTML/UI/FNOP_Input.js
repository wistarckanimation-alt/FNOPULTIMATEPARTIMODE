/* FNOP 1.28.9: pair real Slate down/up with the normal DOM gesture.
 * Recovery runs only if CEF did NOT deliver that gesture's click. It invokes the
 * EXISTING DOM handlers, never a second hard-coded table of gameplay actions.
 * No global 450 ms click blocker. A new physical gesture clears its own guard.
 */
(function () {
  'use strict';
  if (window.FNOPInput) return;
  var current = null, recentDown = null, downSerial = 0, menu = null;
  var stats = {begins:0, ends:0, trusted:0, recovered:0, cancelled:0, duplicates:0};
  var selector = 'button,input,select,textarea,a,[role="button"],[onclick],[data-mode],[data-close]';
  function clock() { return performance.now(); }
  function control(raw) {
    if (!raw || !raw.closest) return null;
    var label = raw.closest('label');
    if (label && label.control) return label.control;
    return raw.closest(selector) || (raw.classList.contains('overlay') && raw.classList.contains('open') ? raw : null);
  }
  function at(x,y) { return control(document.elementFromPoint(x * innerWidth, y * innerHeight)); }
  function usable(el) {
    return el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled') !== 'true'
      && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function same(a,b) { return !!a && a === b; }
  function describe(el) { return el ? el.id || el.getAttribute('data-action') || el.getAttribute('data-mode') || el.tagName : 'background'; }
  function note(g, result) {
    if (window.__FNOP_DEBUG_INPUT__) console.info('[FNOP Input 1.28.9] ' + result + ' ' + g.id + ' target=' + describe(g.el));
  }
  function suppress(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function closeChoices() { if (menu) { menu.remove(); menu=null; } }
  function choices(el) {
    closeChoices();
    var box=document.createElement('div');box.id='fnopSelectChoices';box.setAttribute('role','listbox');
    box.setAttribute('aria-label',el.getAttribute('aria-label')||el.id||'Seleccionar');
    var r=el.getBoundingClientRect();
    box.style.cssText='position:fixed;z-index:100020;overflow:auto;max-height:260px;padding:6px;border:1px solid #c7b9cc;border-radius:10px;background:#191321;box-shadow:0 12px 40px #0009;';
    box.style.width=Math.min(innerWidth-16,Math.max(180,r.width))+'px';
    box.style.left=Math.max(8,Math.min(r.left,innerWidth-Math.max(180,r.width)-8))+'px';
    box.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-280))+'px';
    Array.from(el.options).forEach(function (option,index) {
      if (option.hidden) return;
      var button=document.createElement('button');button.type='button';button.setAttribute('role','option');
      button.dataset.fnopOption=String(index);button.textContent=option.textContent;
      button.disabled=option.disabled||(option.parentElement.tagName==='OPTGROUP'&&option.parentElement.disabled);
      button.setAttribute('aria-selected',option.selected?'true':'false');
      button.style.cssText='display:block;width:100%;text-align:left;padding:10px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer';
      if(option.selected)button.style.background='#493252';
      button.onclick=function(){
        if(!usable(el)||button.disabled)return;
        var changed=el.selectedIndex!==index;el.selectedIndex=index;closeChoices();el.focus();
        if(changed){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
      };
      box.appendChild(button);
    });
    document.body.appendChild(box);menu=box;
    var selected=box.querySelector('[aria-selected="true"]')||box.querySelector('button:not(:disabled)');
    if(selected)selected.focus();
  }
  function range(g,x,commit) {
    var el=g.el,r=el.getBoundingClientRect(),min=Number(el.min||0),max=Number(el.max||100);
    var t=Math.max(0,Math.min(1,(x*innerWidth-r.left)/Math.max(1,r.width)));
    if(getComputedStyle(el).direction==='rtl')t=1-t;
    var value=min+(max-min)*t,step=el.step==='any'?0:Number(el.step||1);
    if(step>0)value=min+Math.round((value-min)/step)*step;
    value=Math.max(min,Math.min(max,value));
    var before=el.value;el.value=String(value);g.lastValue=el.value;
    if(before!==el.value){g.rangeChanged=true;el.dispatchEvent(new Event('input',{bubbles:true}));}
    if(commit&&g.rangeChanged)el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function finish(g) {
    if(!g||g.done||!g.ended)return;
    g.done=true;clearTimeout(g.timer);
    if(g.clicked){note(g,'DOM');return;}
    if(!usable(g.el)){stats.cancelled++;note(g,'CANCELLED');return;}
    if(g.el.matches('input[type="range"]')) {
      if(g.nativeChange){note(g,'DOM_RANGE');return;}
      g.recovered=true;range(g,g.x,true);stats.recovered++;note(g,'RECOVERED_RANGE');return;
    }
    // Release outside the original button cancels, rather than activating at down.
    if(!same(g.el,at(g.x,g.y))){stats.cancelled++;note(g,'RELEASE_OUTSIDE');return;}
    if(g.el.tagName==='SELECT') {
      // Native selects use their own popup and may not emit click until it closes.
      // Do not cover that popup when its trusted mousedown did arrive.
      if(g.nativeDown){note(g,'DOM_SELECT');return;}
      g.recovered=true;choices(g.el);stats.recovered++;note(g,'RECOVERED_SELECT');return;
    }
    g.recovered=true;stats.recovered++;
    if(g.el.matches('input,textarea'))g.el.focus();
    g.el.click(); // One ordinary click, existing menu/settings/commerce handlers.
    note(g,'RECOVERED_CLICK');
  }
  function begin(id,x,y) {
    if(current){if(current.ended)finish(current);else {current.done=true;clearTimeout(current.timer);}}
    var now=clock(),el=at(x,y),early=recentDown&&!recentDown.claimed&&now-recentDown.time<250
      &&Math.abs(recentDown.x-x*innerWidth)<5&&Math.abs(recentDown.y-y*innerHeight)<5;
    if(early)el=recentDown.el;
    var g={id:String(id),el:el,x:x,y:y,started:now,ended:false,done:false,clicked:false,nativeDown:false,nativeChange:false,recovered:false};
    if(early){recentDown.claimed=true;g.nativeDown=true;g.clicked=!!recentDown.clicked;g.nativeChange=!!recentDown.changed;}
    current=g;stats.begins++;
  }
  function move(id,x,y) {
    var g=current;if(!g||g.id!==String(id)||g.ended||g.done)return;g.x=x;g.y=y;
    if(usable(g.el)&&g.el.matches('input[type="range"]')&&!g.nativeDown&&!g.nativeChange&&clock()-g.started>100)range(g,x,false);
  }
  function end(id,x,y) {
    var g=current;if(!g||g.id!==String(id)||g.done)return;g.x=x;g.y=y;g.ended=true;stats.ends++;
    // CEF gets the complete normal event cycle first. Timeouts run in the browser,
    // not in the paused Unreal world. One pending result per physical gesture.
    g.timer=setTimeout(function(){finish(g);},120);
  }
  function cancel() {
    if(current){current.done=true;clearTimeout(current.timer);stats.cancelled++;}current=null;recentDown=null;closeChoices();
  }
  window.addEventListener('mousedown',function(e){
    if(!e.isTrusted||e.button!==0)return;
    var el=control(e.target);recentDown={el:el,x:e.clientX,y:e.clientY,time:clock(),serial:++downSerial,claimed:false};
    if(current&&!current.done&&same(current.el,el)){current.nativeDown=true;recentDown.claimed=true;}
  },true);
  // Installed before the runtime audio listener. A late duplicate is filtered for
  // this target/gesture only; keyboard clicks and the next physical press survive.
  window.addEventListener('click',function(e){
    if(!e.isTrusted)return;
    var el=control(e.target),g=current;
    if(recentDown&&same(recentDown.el,el))recentDown.clicked=true;
    if(!g||!same(g.el,el))return;
    if(g.recovered&&e.detail!==0){stats.duplicates++;suppress(e);return;}
    g.clicked=true;stats.trusted++;
  },true);
  ['input','change'].forEach(function(type){window.addEventListener(type,function(e){
    if(!e.isTrusted)return;
    var g=current;if(recentDown&&same(recentDown.el,e.target))recentDown.changed=true;
    if(!g||!same(g.el,e.target))return;
    if(g.recovered&&g.el.matches('input[type="range"]')){if(g.lastValue!=null)g.el.value=g.lastValue;suppress(e);return;}
    g.nativeChange=true;
  },true);});
  document.addEventListener('click',function(e){if(menu&&!menu.contains(e.target)&&e.target.tagName!=='SELECT')closeChoices();});
  window.addEventListener('keydown',function(e){if(e.key==='Escape')cancel();});
  window.addEventListener('blur',cancel);
  window.FNOPInput=Object.freeze({begin:begin,move:move,end:end,cancel:cancel,stats:stats});

  /* 1.29.9 gaze DOM lane.
   * World-space SWebBrowser can render correctly while a synthetic Slate pointer never reaches
   * Chromium. The player still has an exact normalized hit from the physical WidgetComponent,
   * so expose a tiny DOM pointer that drives the SAME buttons/handlers/audio already in the page.
   *
   * Synthetic pointer events do not set CSS :hover by themselves. At first use we clone the
   * document's :hover/:active rules to private classes and toggle those classes on the element
   * under the gaze. This preserves the authored HTML reaction instead of inventing a second look.
   */
  (function installGaze(){
    if(window.FNOPGaze)return;
    var hovered=null,pressed=null,lastX=.5,lastY=.5,stylesReady=false;
    function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
    function ensureStateStyles(){
      if(stylesReady)return;stylesReady=true;
      try{
        var chunks=[];
        Array.from(document.styleSheets||[]).forEach(function(sheet){
          var rules;try{rules=sheet.cssRules||[];}catch(_){return;}
          Array.from(rules).forEach(function(rule){
            var sel=rule&&rule.selectorText;if(!sel||!rule.style)return;
            if(sel.indexOf(':hover')>=0)chunks.push(sel.replace(/:hover/g,'.__fnop_gaze_hover')+'{'+rule.style.cssText+'}');
            if(sel.indexOf(':active')>=0)chunks.push(sel.replace(/:active/g,'.__fnop_gaze_active')+'{'+rule.style.cssText+'}');
          });
        });
        if(chunks.length){var st=document.createElement('style');st.id='fnop-gaze-state-css';st.textContent=chunks.join('\n');(document.head||document.documentElement).appendChild(st);}
      }catch(_){ }
    }
    function point(x,y){return {x:clamp(x),y:clamp(y)};}
    function targetAt(x,y){return control(document.elementFromPoint(x*innerWidth,y*innerHeight));}
    function pointer(type,el,x,y,related,buttons){
      if(!el)return;var cx=x*innerWidth,cy=y*innerHeight;
      var init={bubbles:true,cancelable:true,composed:true,clientX:cx,clientY:cy,screenX:cx,screenY:cy,button:0,buttons:buttons||0,relatedTarget:related||null,pointerId:79,pointerType:'mouse',isPrimary:true};
      try{el.dispatchEvent(new PointerEvent(type,init));}catch(_){ }
    }
    function mouse(type,el,x,y,related,buttons){
      if(!el)return;var cx=x*innerWidth,cy=y*innerHeight;
      try{el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,composed:true,clientX:cx,clientY:cy,screenX:cx,screenY:cy,button:0,buttons:buttons||0,relatedTarget:related||null}));}catch(_){ }
    }
    function setHover(next,x,y){
      ensureStateStyles();
      if(next!==hovered){
        var old=hovered;
        if(old){old.classList.remove('__fnop_gaze_hover');pointer('pointerout',old,x,y,next,pressed?1:0);mouse('mouseout',old,x,y,next,pressed?1:0);}
        hovered=next;
        if(hovered){hovered.classList.add('__fnop_gaze_hover');pointer('pointerover',hovered,x,y,old,pressed?1:0);mouse('mouseover',hovered,x,y,old,pressed?1:0);}
      }
      if(hovered){pointer('pointermove',hovered,x,y,null,pressed?1:0);mouse('mousemove',hovered,x,y,null,pressed?1:0);}
    }
    function move(x,y){var p=point(x,y);lastX=p.x;lastY=p.y;setHover(targetAt(lastX,lastY),lastX,lastY);return !!hovered;}
    function leave(){setHover(null,lastX,lastY);}
    function down(){
      move(lastX,lastY);pressed=usable(hovered)?hovered:null;
      if(!pressed)return false;
      pressed.classList.add('__fnop_gaze_active');pointer('pointerdown',pressed,lastX,lastY,null,1);mouse('mousedown',pressed,lastX,lastY,null,1);return true;
    }
    function up(){
      move(lastX,lastY);var original=pressed;pressed=null;
      if(!original)return false;
      original.classList.remove('__fnop_gaze_active');pointer('pointerup',original,lastX,lastY,null,0);mouse('mouseup',original,lastX,lastY,null,0);
      if(original===hovered&&usable(original)){original.click();return true;}return false;
    }
    function cancelGaze(){
      if(pressed){pressed.classList.remove('__fnop_gaze_active');pressed=null;}
      leave();
    }
    function wheel(delta){
      delta=Number(delta)||0;if(!delta)return false;
      move(lastX,lastY);
      var node=hovered||document.elementFromPoint(lastX*innerWidth,lastY*innerHeight),scroll=null;
      for(var p=node;p&&p!==document.body;p=p.parentElement){
        try{var cs=getComputedStyle(p),oy=cs.overflowY;if(p.scrollHeight>p.clientHeight+2&&(oy==='auto'||oy==='scroll'||oy==='overlay')){scroll=p;break;}}catch(_){ }
      }
      if(!scroll)scroll=document.querySelector('.char-content')||document.querySelector('.fnop-scroll')||document.scrollingElement||document.documentElement;
      if(!scroll)return false;
      var before=scroll.scrollTop,amount=140*Math.max(1,Math.abs(delta));
      scroll.scrollTop += delta>0 ? -amount : amount;
      setHover(targetAt(lastX,lastY),lastX,lastY);
      return scroll.scrollTop!==before;
    }
    window.FNOPGaze=Object.freeze({move:move,leave:leave,down:down,up:up,cancel:cancelGaze,wheel:wheel});
  }());
  console.info('[FNOP Input 1.29.9] installed; browser='+navigator.userAgent);
}());
