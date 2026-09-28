/* FNOP 1.29.0: presentation only. The native transaction owns inventory and saving. */
(function () {
  'use strict';
  if (window.FNOPMoodUI) return;
  var mounted = [], MAX_QUANTITY = 1000000;
  function el(tag, css, text) { var n=document.createElement(tag); if(css)n.className=css; if(text!=null)n.textContent=text;return n; }
  function button(text, fn) {var b=el('button','mood-chip',text);b.type='button';b.onclick=fn;return b;}
  function guid() {var b=new Uint8Array(16);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(b);else for(var i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return Array.prototype.map.call(b,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
  function mount(root, data, send) {
    if(!root)return;
    var c=root.__fnopMood;
    if(!c) {
      c={root:root,state:{},emotion:0,sign:1,item:'',pending:false,send:send};root.__fnopMood=c;mounted.push(c);
      c.header=el('header','mood-editor-head');c.heading=el('h3');c.bank=el('strong','mood-bank');c.header.appendChild(c.heading);c.header.appendChild(c.bank);root.appendChild(c.header);
      c.bars=el('div','mood-emotions');root.appendChild(c.bars);
      c.ops=el('div','mood-options');c.add=button('',function(){c.sign=1;c.item='';update(c);});c.remove=button('',function(){c.sign=-1;c.item='';update(c);});c.ops.appendChild(c.add);c.ops.appendChild(c.remove);root.appendChild(c.ops);
      c.sources=el('div','mood-sources');root.appendChild(c.sources);
      c.row=el('div','mood-quantity');c.label=el('label');c.input=el('input');c.input.type='number';c.input.min='1';c.input.max=String(MAX_QUANTITY);c.input.step='1';c.input.value='1';c.input.inputMode='numeric';c.input.setAttribute('aria-label','Amount');c.input.oninput=function(){preview(c);};
      c.label.appendChild(c.input);c.minus=button('\u2212',function(){c.input.value=String(Math.max(1,Number(c.input.value)-1));preview(c);});c.plus=button('+',function(){c.input.value=String(Math.min(MAX_QUANTITY,Number(c.input.value)+1));preview(c);});c.five=button('+5',function(){c.input.value=String(Math.min(MAX_QUANTITY,Number(c.input.value)+5));preview(c);});c.max=button('',function(){c.input.value=String(Math.max(1,available(c)));preview(c);});
      [c.minus,c.label,c.plus,c.five,c.max].forEach(function(n){c.row.appendChild(n);});root.appendChild(c.row);
      c.preview=el('p','mood-preview');root.appendChild(c.preview);c.confirm=button('',function(){submit(c);});c.confirm.classList.add('mood-apply');root.appendChild(c.confirm);
      c.feedback=el('p','mood-feedback');c.feedback.setAttribute('role','status');c.feedback.setAttribute('aria-live','polite');root.appendChild(c.feedback);
    }
    if(c.state.characterId&&c.state.characterId!==(data||{}).characterId){c.emotion=0;c.item='';c.feedback.textContent='';}
    c.state=data||{};c.send=send;update(c);
  }
  function text(c){
    var I=window.FNOPI18n,t=(k,f)=>I?I.t(k,f):f;
    if(I&&c.state.language)I.setCulture(c.state.language);
    return {title:t('mood.title','Mood'),bank:t('mood.bank','Available points'),add:t('mood.add','Add'),remove:t('mood.remove','Recover'),source:t('mood.source','Resource'),free:t('mood.inventory','Inventory'),quantity:t('mood.quantity','Amount'),apply:t('mood.apply','Apply'),pending:t('mood.pending','Saving…'),choose:t('mood.choose','Select a character'),disabled:t('mood.disabled','The economy requires a local session.'),returns:t('mood.returns','Returned to inventory'),cost:t('mood.cost','Spent from inventory'),charges:t('mood.charges','Consumable charges'),no:t('mood.no','Amount unavailable'),missing:t('mood.missing','No confirmation from Unreal. Check the current state before retrying.'),status:t('mood.status','Choose an emotion and amount, then confirm.'),max:t('mood.max','Maximum'),ideal:t('mood.ideal','Ideal'),emotions:[t('emotion.anger','Anger'),t('emotion.sadness','Sadness'),t('emotion.happiness','Happiness'),t('emotion.fear','Fear'),t('emotion.curiosity','Curiosity')]};
  }
  function selected(c){return (c.state.moods||[]).find(function(m){return Number(m.id)===c.emotion;});}
  function item(c){return (c.state.items||[]).find(function(i){return i.id===c.item;});}
  function available(c){var m=selected(c);if(!m)return 0;var i=item(c);var range=Math.floor(c.sign<0?Number(m.raw):Number(m.max)-Number(m.raw));var stock=i?Number(i.points):(c.sign<0?MAX_QUANTITY:Number(c.state.points||0));return Math.max(0,Math.min(range,stock,MAX_QUANTITY));}
  function update(c){
    var t=text(c);c.heading.textContent=t.title;c.bank.textContent=String(c.state.points||0)+' \u00b7 '+t.bank;c.add.textContent=t.add;c.remove.textContent=t.remove;c.add.classList.toggle('selected',c.sign>0);c.remove.classList.toggle('selected',c.sign<0);c.max.textContent=t.max;c.input.setAttribute('aria-label',t.quantity);
    c.bars.textContent='';var palette=[['#ff536a','#ff8c78'],['#478cff','#70d4ff'],['#ffd052','#ffef8a'],['#9b62ff','#d09cff'],['#36cbb1','#74f0cf']];(c.state.moods||[]).forEach(function(m){var id=Number(m.id),b=button('',function(){c.emotion=id;update(c);});b.classList.add('mood-emotion');b.classList.toggle('selected',id===c.emotion);b.setAttribute('aria-pressed',id===c.emotion?'true':'false');var label=el('span','mood-label',t.emotions[id]||m.name);var value=el('b','',Number(m.raw).toLocaleString(undefined,{maximumFractionDigits:1})+' / '+m.max);var vessel=el('span','mood-vessel');var fill=el('span','mood-liquid');var ratio=Math.max(0,Math.min(1,Number(m.raw)/Math.max(1,Number(m.max))));var idealRatio=Math.max(0,Math.min(1,Number(m.ideal==null?50:m.ideal)/Math.max(1,Number(m.max))));fill.style.height=(ratio*100)+'%';var colors=palette[id]||palette[0];fill.style.setProperty('--liquid',colors[0]);fill.style.setProperty('--liquid2',colors[1]);var wave=el('i','mood-wave');fill.appendChild(wave);for(var k=1;k<=4;k++)fill.appendChild(el('i','mood-bubble b'+k));vessel.appendChild(fill);var ideal=el('span','mood-ideal-marker');ideal.style.bottom=(idealRatio*100)+'%';ideal.title=t.ideal+': '+Number(m.ideal==null?50:m.ideal).toLocaleString(undefined,{maximumFractionDigits:1});vessel.appendChild(ideal);b.title=t.ideal+': '+Number(m.ideal==null?50:m.ideal).toLocaleString(undefined,{maximumFractionDigits:1})+' '+(window.FNOPI18n?window.FNOPI18n.t('mood.points','Mood'):'Mood');b.appendChild(label);b.appendChild(value);b.appendChild(vessel);c.bars.appendChild(b);});
    c.sources.textContent='';var label=el('span','mood-source-label',t.source);c.sources.appendChild(label);var base=button(t.free,function(){c.item='';update(c);});base.classList.toggle('selected',!c.item);c.sources.appendChild(base);
    var candidates=(c.state.items||[]).filter(function(i){return !!i.reduce===(c.sign<0)&&i.points>0;});if(c.item&&!candidates.some(function(i){return i.id===c.item;}))c.item='';
    candidates.forEach(function(i){var b=button((i.name||i.id)+' \u00b7 '+i.points,function(){c.item=i.id;update(c);});b.classList.toggle('selected',c.item===i.id);c.sources.appendChild(b);});
    if(!c.feedback.textContent)c.feedback.textContent=t.status;preview(c);
  }
  function preview(c){var t=text(c),m=selected(c),n=Number(c.input.value),i=item(c);var valid=!!m&&c.state.editable===true&&Number.isInteger(n)&&n>0&&n<=available(c)&&!c.pending;
    c.confirm.textContent=c.pending?t.pending:t.apply;c.confirm.disabled=!valid;
    c.root.querySelectorAll('input,button').forEach(function(b){if(b!==c.confirm)b.disabled=c.pending;});
    if(!m){c.preview.textContent=t.choose;return;}if(!c.state.editable){c.preview.textContent=t.disabled;return;}
    if(!Number.isInteger(n)||n<1||n>available(c)){c.preview.textContent=t.no+' \u00b7 '+t.max+': '+available(c);return;}
    c.preview.textContent=(t.emotions[c.emotion]||m.name)+': '+m.raw+' \u2192 '+(Number(m.raw)+c.sign*n)+' \u00b7 '+(c.sign<0?t.returns:(i?t.charges:t.cost))+': '+n;
  }
  function submit(c){preview(c);if(c.confirm.disabled)return;var p={requestId:guid(),characterId:c.state.characterId,emotion:c.emotion,delta:c.sign*Number(c.input.value),revision:Number(c.state.revision),consumableId:c.item};c.pending=true;c.requestId=p.requestId;c.feedback.textContent=text(c).pending;preview(c);
    clearTimeout(c.timeout);c.timeout=setTimeout(function(){c.pending=false;c.feedback.textContent=text(c).missing;preview(c);},10000);
    try{c.send(p);}catch(e){clearTimeout(c.timeout);c.pending=false;c.feedback.textContent=text(c).missing;preview(c);}
  }
  window.addEventListener('pagehide',function(){mounted.forEach(function(c){clearTimeout(c.timeout);c.pending=false;});mounted=[];});
  window.FNOPMoodUI={mount:mount};
  window.fnopMoodReceipt=function(r){mounted=mounted.filter(function(c){return c.root.isConnected;});mounted.forEach(function(c){if(!c.pending||(r.requestId&&r.requestId!==c.requestId))return;clearTimeout(c.timeout);c.pending=false;c.feedback.textContent=r.message||'';c.feedback.dataset.result=r.applied?'success':'notice';preview(c);});};
})();
