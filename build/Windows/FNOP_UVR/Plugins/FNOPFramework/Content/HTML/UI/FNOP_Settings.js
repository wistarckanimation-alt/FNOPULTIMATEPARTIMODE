/* Same control IDs, handlers and engine snapshots in menu and pause. */
(function(){'use strict';
  var bound=false;
  function send(a,v){return window.FNOPRuntime?window.FNOPRuntime.send(a,v):false;}
  function q(s){return document.querySelector(s);}
  function all(s){return Array.from(document.querySelectorAll(s));}
  function bind(){
    if(bound)return;bound=true;window.__FNOP_STOCK_NATIVE_SETTINGS_BOUND__=true;
    all('.settings-tab').forEach(function(tab){tab.onclick=function(){all('.settings-tab').forEach(t=>t.classList.toggle('active',t===tab));all('.settings-section').forEach(s=>s.classList.toggle('active',s.dataset.section===tab.dataset.tab));};});
    function change(id,action,map){var el=document.getElementById(id);if(el)el.addEventListener('change',function(){if(!el.disabled)send(action,map?map(el):el.value);});}
    change('displayMode','setdisplaymode');change('resolution','setresolution');change('fpsLimit','setfpslimit');
    change('microphoneDeviceSelect','setmicrophonedevice');change('voiceMode','setvoicemode');change('voicePttKey','setvoicepttkey');
    var micTest=q('#microphoneTestBtn');if(micTest)micTest.addEventListener('click',()=>send('testmicrophone','5'));
    [['vsyncToggle','setvsync'],['censorshipToggle','setcensorship'],['lumenToggle','setlumen'],['rayTracingToggle','setraytracing'],['microphoneToggle','setmicrophoneenabled']].forEach(x=>change(x[0],x[1],e=>e.checked?'1':'0'));
    all('[data-graphics-key]').forEach(el=>el.addEventListener('change',function(){if(!el.disabled)send(el.dataset.graphicsKey==='antialiasing'?'setantialiasing':'setgraphicssetting',el.dataset.graphicsKey==='antialiasing'?el.value:el.dataset.graphicsKey+'|'+el.value);}));
    all('.preset-btn').forEach(b=>b.addEventListener('click',()=>send('setgraphicspreset',b.dataset.preset)));
    all('.lang-card').forEach(b=>b.addEventListener('click',()=>send('setlanguage',b.dataset.lang)));
    var controlModeButton=q('#controlModeSwitchBtn');if(controlModeButton)controlModeButton.addEventListener('click',()=>send('switchcontrolmode',controlModeButton.dataset.target||'vr'));
    ['#vrRecalibrateBtn','#vrRecalibrateQuickBtn'].forEach(sel=>{var el=q(sel);if(el)el.addEventListener('click',()=>send('recalibratevr',''));});
    var slider=q('input[data-value-target="masterValue"]'),timer;
    if(slider){const push=()=>{send('setmastervolume',Number(slider.value)/100);};
      slider.addEventListener('input',()=>{q('#masterValue').textContent=slider.value+'%';clearTimeout(timer);timer=setTimeout(push,45);});
      slider.addEventListener('change',()=>{clearTimeout(timer);push();});}
    var mic=q('#microphoneSensitivity'),mt;if(mic){const pushMic=()=>send('setmicrophonesensitivity',Number(mic.value)/100);mic.addEventListener('input',()=>{if(q('#microphoneSensitivityValue'))q('#microphoneSensitivityValue').textContent=mic.value+'%';clearTimeout(mt);mt=setTimeout(pushMic,45)});mic.addEventListener('change',()=>{clearTimeout(mt);pushMic()});}
    var vt=q('#voiceThreshold'),vtt;if(vt){const pushVoiceThreshold=()=>send('setvoicethreshold',Number(vt.value)/100);vt.addEventListener('input',()=>{if(q('#voiceThresholdValue'))q('#voiceThresholdValue').textContent=vt.value+'%';clearTimeout(vtt);vtt=setTimeout(pushVoiceThreshold,45)});vt.addEventListener('change',()=>{clearTimeout(vtt);pushVoiceThreshold()});}
    var panelBrightness=q('#characterPanelBrightness'),pbt;if(panelBrightness){const pushPanelBrightness=()=>send('setcharacterpanelbrightness',Number(panelBrightness.value)/100);panelBrightness.addEventListener('input',()=>{if(q('#characterPanelBrightnessValue'))q('#characterPanelBrightnessValue').textContent=panelBrightness.value+'%';clearTimeout(pbt);pbt=setTimeout(pushPanelBrightness,45)});panelBrightness.addEventListener('change',()=>{clearTimeout(pbt);pushPanelBrightness()});}
    // The saved engine culture is authoritative, never a browser-local preference.
  }
  function apply(state){
    if(!state)return;
    function value(selector,v){var el=q(selector);if(!el||v==null)return;var text=String(v);
      if(el.tagName==='SELECT'&&!Array.from(el.options).some(o=>o.value===text)){var option=document.createElement('option');option.value=text;option.textContent=text;el.appendChild(option);}
      el.value=text;}
    value('#displayMode',state.displayMode);value('#resolution',state.resolution);value('#fpsLimit',Math.round(state.fpsLimit||0));
    ['textures','shadows','globalillumination','antialiasing','effects','reflections','viewdistance'].forEach(k=>value('[data-graphics-key="'+k+'"]',state[k]));
    [['vsyncToggle',state.vsync],['censorshipToggle',state.censorship],['lumenToggle',state.lumen],['rayTracingToggle',state.rayTracing],['microphoneToggle',state.microphoneEnabled]].forEach(x=>{var el=document.getElementById(x[0]);if(el)el.checked=!!x[1];});
    ['#lumenToggle','#rayTracingToggle','[data-graphics-key="globalillumination"]'].forEach(sel=>{var el=q(sel);if(el)el.disabled=!!state.mobileXR;});
    var preset=state.preset||state.quality;all('.preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.preset===(preset==='cinematic'?'ultra':preset)));
    if(state.masterVolume!=null){value('input[data-value-target="masterValue"]',Math.round(state.masterVolume*100));if(q('#masterValue'))q('#masterValue').textContent=Math.round(state.masterVolume*100)+'%';window.FNOPRuntime?.setMaster(state.masterVolume);}
    if(state.characterPanelBrightness!=null){value('#characterPanelBrightness',Math.round(state.characterPanelBrightness*100));if(q('#characterPanelBrightnessValue'))q('#characterPanelBrightnessValue').textContent=Math.round(state.characterPanelBrightness*100)+'%';}
    if(state.microphoneSensitivity!=null){value('#microphoneSensitivity',Math.round(state.microphoneSensitivity*100));if(q('#microphoneSensitivityValue'))q('#microphoneSensitivityValue').textContent=Math.round(state.microphoneSensitivity*100)+'%';}
    var dev=q('#microphoneDeviceSelect');if(dev&&Array.isArray(state.microphoneDevices)){while(dev.options.length>1)dev.remove(1);state.microphoneDevices.forEach((name,index)=>{var o=document.createElement('option');o.value=String(index);o.textContent=name;dev.appendChild(o);});value('#microphoneDeviceSelect',state.microphoneDeviceIndex==null?-1:state.microphoneDeviceIndex);}
    if(q('#microphoneDevice')&&state.microphoneDevice)q('#microphoneDevice').textContent=state.microphoneDevice;
    value('#voiceMode',state.voiceMode||'vad');value('#voicePttKey',state.voicePttKey||'V');
    if(state.voiceThreshold!=null){value('#voiceThreshold',Math.round(state.voiceThreshold*100));if(q('#voiceThresholdValue'))q('#voiceThresholdValue').textContent=Math.round(state.voiceThreshold*100)+'%';}
    var vm=state.voiceMode||'vad';if(q('#voiceThresholdRow'))q('#voiceThresholdRow').hidden=vm!=='vad';if(q('#voicePttRow'))q('#voicePttRow').hidden=vm!=='ptt';
    window.fnopSetMicLevel(state.microphoneLevel||0);
    window.fnopSetMicStatus({state:state.microphoneCaptureState||'disabled',detail:state.microphoneCaptureDetail||state.microphoneActiveDevice||'',test:!!state.microphoneTestActive});
    if(state.language&&typeof window.applyLanguage==='function')window.applyLanguage(String(state.language).split('-')[0].toLowerCase());
    if(q('#renderProfileValue')&&state.renderProfile)q('#renderProfileValue').textContent=state.renderProfile;
    if(q('#renderProfileNotice')&&state.renderNotice)q('#renderProfileNotice').textContent=state.renderNotice;
    if(q('#controlModeTitle'))q('#controlModeTitle').textContent=state.controlModeTitle||'MODO DE CONTROL';
    if(q('#controlModeDesc'))q('#controlModeDesc').textContent=state.controlModeDesc||'Cambia entre PC y realidad virtual durante la partida.';
    if(q('#controlModeStatus'))q('#controlModeStatus').textContent='ACTUAL: '+(state.controlModeStatus||'PC');
    if(q('#controlModeSwitchBtn')){q('#controlModeSwitchBtn').textContent=state.controlModeButton||(state.vrActive?'CAMBIAR A PC':'CAMBIAR A VR');q('#controlModeSwitchBtn').dataset.target=state.controlModeTarget||(state.vrActive?'pc':'vr');}
    var vrRow=q('#vrCalibrationRow');if(vrRow)vrRow.hidden=!state.vrActive;
    var vrQuick=q('#vrCalibrationQuickRow');if(vrQuick)vrQuick.hidden=!state.vrActive;
    if(q('#vrCalibrationTitle'))q('#vrCalibrationTitle').textContent=state.vrCalibrationTitle||'';
    if(q('#vrCalibrationDesc'))q('#vrCalibrationDesc').textContent=state.vrCalibrationDesc||'';
    if(q('#vrCalibrationStatus'))q('#vrCalibrationStatus').textContent=state.vrCalibrationStatus||'';
    if(q('#vrRecalibrateBtn'))q('#vrRecalibrateBtn').textContent=state.vrCalibrationButton||'';
    if(q('#vrCalibrationQuickTitle'))q('#vrCalibrationQuickTitle').textContent=state.vrCalibrationTitle||'';
    if(q('#vrCalibrationQuickDesc'))q('#vrCalibrationQuickDesc').textContent=state.vrCalibrationDesc||'';
    if(q('#vrCalibrationQuickStatus'))q('#vrCalibrationQuickStatus').textContent=state.vrCalibrationStatus||'';
    if(q('#vrRecalibrateQuickBtn'))q('#vrRecalibrateQuickBtn').textContent=state.vrCalibrationButton||'';
    var note=q('#fnopSettingsReadback');if(!note&&q('#settingsOverlay .panel')){note=document.createElement('div');note.id='fnopSettingsReadback';note.className='fnop-settings-confirmed';q('#settingsOverlay .panel').appendChild(note);}
    if(note){note.hidden=!window.__FNOP_EDITOR_DEV__;note.textContent='UNREAL: '+preset+' | GI='+state.sgGI+' | Lumen='+state.lumenMethod+' | volumen='+Math.round(state.masterVolume*100)+'% | '+state.language;}
    window.dispatchEvent(new CustomEvent('fnop:settings-state',{detail:state}));
  }
  window.fnopSetMicLevel=function(v){v=Math.max(0,Math.min(1,Number(v)||0));var bar=q('#microphoneMeterFill'),txt=q('#microphoneMeterValue');if(bar)bar.style.transform='scaleX('+v.toFixed(3)+')';if(txt)txt.textContent=Math.round(v*100)+'%';};
  window.fnopSetMicStatus=function(info){info=info||{};var el=q('#microphoneCaptureStatus'),btn=q('#microphoneTestBtn');var key='mic.status.'+(info.state||'disabled'),fallback={disabled:'Micrófono desactivado',starting:'Abriendo micrófono…',capturing:'Capturando: habla para comprobar nivel',signal:'Señal detectada correctamente',silent:'El stream está abierto pero no llegan muestras. Revisa privacidad de Windows y el dispositivo de entrada.',error:'No se pudo abrir el micrófono'}[info.state]||String(info.state||'');var text=(window.FNOPI18n?window.FNOPI18n.t(key,fallback):fallback);if(info.detail)text+=' · '+info.detail;if(info.test)text='TEST · '+text;if(el)el.textContent=text;if(btn){btn.disabled=!!info.test;btn.textContent=info.test?(window.FNOPI18n?window.FNOPI18n.t('mic.testing','PROBANDO…'):'PROBANDO…'):(window.FNOPI18n?window.FNOPI18n.t('mic.test','PROBAR MICRÓFONO'):'PROBAR MICRÓFONO');}};
  window.FNOPSettingsUI=Object.freeze({bind:bind,apply:apply});
  window.fnopApplyState=apply;window.fnopApplyPauseSettingsState=apply;
})();
