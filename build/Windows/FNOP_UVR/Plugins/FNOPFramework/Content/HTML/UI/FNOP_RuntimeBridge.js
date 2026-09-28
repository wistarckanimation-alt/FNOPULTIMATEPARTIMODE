/* FNOP runtime protocol 1.36.43. One command, one id, one native dispatcher.
 * A receipt confirms C++ received the command; settings are confirmed separately
 * by the state snapshot read from Unreal. Browser previews never grant currency.
 */
(function () {
  'use strict';
  if (window.FNOPRuntime) return;
  /* FIX 5T GLOBAL HTML READY REPLAY
   * Shipping/CEF can notify native code before a page-specific fnopSet* setter exists.
   * Keep the last state per setter and replay it when the real page finishes mounting.
   */
  var __fnopDeferredState = Object.create(null);
  var __fnopDeferredPlaceholders = Object.create(null);
  var __fnopNativeStateNames = [
    'fnopAgarNovaNativeState','fnopApplyPauseSettingsState','fnopApplyRuntimeShopState','fnopApplyState',
    'fnopInventoryMessage','fnopResetRewardReveal','fnopSetArcade','fnopSetChallenge','fnopSetChallengeGames',
    'fnopSetChallengeHub','fnopSetCharacter','fnopSetChestPresentationActive','fnopSetCredits','fnopSetEffects',
    'fnopSetGuide','fnopSetHud','fnopSetInventory','fnopSetMenuChests','fnopSetMenuShop','fnopSetMicLevel',
    'fnopSetMicStatus','fnopSetMinigames','fnopSetNews','fnopSetPauseLabels','fnopSetPoses','fnopSetRadial',
    'fnopSetRestaurant','fnopSetResult','fnopSetReward','fnopSetRuntime','fnopSetSandboxEditor','fnopSetSandboxLabel',
    'fnopSetSandboxMotion','fnopSetSelfActions','fnopSetSettingsOnly','fnopSetShop','fnopSetTrade','fnopSetUpdateState',
    'fnopShowChestOpen','fnopShowPurchaseById','fnopShowReward','fnopShowRewardReveal','fnopSpawnResult','fnopVRCalibrationSet'
  ];
  function __fnopInstallDeferred(name) {
    if (typeof window[name] === 'function') return;
    var placeholder = function () { __fnopDeferredState[name] = Array.prototype.slice.call(arguments); };
    placeholder.__fnopDeferredPlaceholder = true;
    __fnopDeferredPlaceholders[name] = placeholder;
    window[name] = placeholder;
  }
  function __fnopFlushDeferred() {
    Object.keys(__fnopDeferredState).forEach(function (name) {
      var fn = window[name], placeholder = __fnopDeferredPlaceholders[name];
      if (typeof fn !== 'function' || fn === placeholder || fn.__fnopDeferredPlaceholder) return;
      var args = __fnopDeferredState[name];
      delete __fnopDeferredState[name];
      try { fn.apply(window, args); }
      catch (error) { console.warn('[FNOP 5T] replay '+name+' failed: '+String(error&&error.message||error)); }
    });
  }
  __fnopNativeStateNames.forEach(__fnopInstallDeferred);

  function __fnopShippingCompatibility() {
    if (window.__FNOP_EDITOR_DEV__ === true) return;
    var root = document.documentElement;
    if (root) root.classList.add('fnop-shipping-safe');
    if (!document.getElementById('fnop-shipping-safe-css')) {
      var style = document.createElement('style');
      style.id = 'fnop-shipping-safe-css';
      style.textContent = 'html.fnop-shipping-safe .fnop-screen,html.fnop-shipping-safe .fnop-panel,html.fnop-shipping-safe .fnop-scroll,html.fnop-shipping-safe .shop-panel,html.fnop-shipping-safe .commerce-panel{contain:none!important}html.fnop-shipping-safe .category-section{content-visibility:visible!important;contain-intrinsic-size:auto!important}';
      (document.head || root).appendChild(style);
    }
  }
  function __fnopVisibilityFailsafe() {
    if (window.__FNOP_EDITOR_DEV__ === true) return;
    document.querySelectorAll('.fnop-screen').forEach(function (el) {
      var opacity = parseFloat(getComputedStyle(el).opacity || '1');
      if (opacity < 0.05) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });
  }
  function __fnopReadySweep() {
    __fnopShippingCompatibility();
    __fnopFlushDeferred();
    [0,25,75,150,300,600,1200].forEach(function (ms) {
      setTimeout(function () { __fnopShippingCompatibility(); __fnopFlushDeferred(); if (ms >= 300) __fnopVisibilityFailsafe(); }, ms);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __fnopReadySweep, {once:true});
  else __fnopReadySweep();
  window.addEventListener('load', __fnopReadySweep, {once:true});
  var kind = window.__FNOP_BRIDGE_KIND__ || 'ui', sequence = 0;
  var session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  var pending = Object.create(null), pendingOrder = [], active = false, connected = false, fatalError = "";
  var fallbackFrame = null, MAX_PENDING = 64;
  var master = Math.max(0, Math.min(1, Number(window.__FNOP_MASTER_VOLUME__ == null ? 1 : window.__FNOP_MASTER_VOLUME__)));
  var mediaBase = new WeakMap();
  function status(text, error) {
    // Runtime/bridge diagnostics must never become player-facing UI.
    // Keep the bridge receipts and native logging intact, but remove any
    // legacy overlay that an older document may have created.
    var el = document.getElementById('fnopRuntimeStatus');
    if (el) el.remove();
    if (error && window.console && typeof console.warn === 'function')
      console.warn('[FNOP Runtime] ' + String(text || ''));
  }
  function applyMedia(el) {
    if (!(el instanceof HTMLMediaElement)) return;
    if (!mediaBase.has(el)) mediaBase.set(el, el.volume);
    el.volume = master * mediaBase.get(el);
  }
  function setMaster(value) {
    master = Math.max(0, Math.min(1, Number(value)));
    document.querySelectorAll('audio,video').forEach(applyMedia);
  }
  var originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { applyMedia(this); return originalPlay.apply(this, arguments); };
  document.addEventListener('play', function (e) { applyMedia(e.target); }, true);
  document.addEventListener('loadedmetadata', function (e) { applyMedia(e.target); }, true);

  // FIX16 HTML STABILITY: a cached browser may stay alive for instant reopening, but
  // a collapsed page must not keep burning CPU/CEF time. RuntimeBootstrap is injected
  // before page scripts, so wrapping RAF/interval here also covers timers created later.
  var pageActive = true;
  var nativeRAF = window.requestAnimationFrame.bind(window);
  var nativeCAF = window.cancelAnimationFrame.bind(window);
  var nativeSetInterval = window.setInterval.bind(window);
  var nativeClearInterval = window.clearInterval.bind(window);
  var rafSerial = 0, rafEntries = Object.create(null);
  window.requestAnimationFrame = function (cb) {
    var id = ++rafSerial, entry = { cb: cb, nativeId: 0 }; rafEntries[id] = entry;
    if (pageActive) entry.nativeId = nativeRAF(function (ts) { if (!rafEntries[id]) return; delete rafEntries[id]; cb(ts); });
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    var entry = rafEntries[id]; if (!entry) return;
    if (entry.nativeId) nativeCAF(entry.nativeId); delete rafEntries[id];
  };
  var intervalEntries = Object.create(null), intervalSerial = 0;
  window.setInterval = function (cb, delay) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = ++intervalSerial;
    var nativeId = nativeSetInterval(function () { if (!pageActive) return; if (typeof cb === 'function') cb.apply(window, args); else try { (0,eval)(String(cb)); } catch (_) {} }, Math.max(16, Number(delay) || 0));
    intervalEntries[id] = nativeId; return id;
  };
  window.clearInterval = function (id) {
    var nativeId = intervalEntries[id]; if (nativeId == null) return;
    nativeClearInterval(nativeId); delete intervalEntries[id];
  };
  function setPageActive(value) {
    var next = !!value; if (pageActive === next) return; pageActive = next;
    if (!pageActive) {
      Object.keys(rafEntries).forEach(function (key) { var e = rafEntries[key]; if (e && e.nativeId) { nativeCAF(e.nativeId); e.nativeId = 0; } });
      if (document.documentElement) document.documentElement.classList.add('fnop-page-suspended');
      document.querySelectorAll('video,audio').forEach(function (m) { if (!m.paused) { m.dataset.fnopResumeMedia = '1'; try { m.pause(); } catch (_) {} } });
    } else {
      if (document.documentElement) document.documentElement.classList.remove('fnop-page-suspended');
      Object.keys(rafEntries).forEach(function (key) { var e = rafEntries[key]; if (e && !e.nativeId) e.nativeId = nativeRAF(function (ts) { var cur=rafEntries[key]; if (!cur) return; delete rafEntries[key]; cur.cb(ts); }); });
      document.querySelectorAll('[data-fnop-resume-media="1"]').forEach(function (m) { delete m.dataset.fnopResumeMedia; try { var pr=m.play(); if(pr&&pr.catch) pr.catch(function(){}); } catch (_) {} });
    }
    window.dispatchEvent(new CustomEvent('fnop:page-active', { detail: { active: pageActive } }));
  }
  var suspendStyle = document.createElement('style');
  suspendStyle.textContent = '.fnop-page-suspended *, .fnop-page-suspended *::before, .fnop-page-suspended *::after{animation-play-state:paused!important;transition:none!important}';
  (document.head || document.documentElement).appendChild(suspendStyle);
  function host() {
    var ue = window.ue || {};
    return kind === 'menu' ? (ue.fnopmenu || ue.FNOPMenu || ue.fnopMenu) : (ue.fnopui || ue.FNOPUI || ue.fnopUI);
  }
  function audioAction(a) { return a === 'playuiaudio' || a === '__audio_hover' || a === '__audio_press'; }
  function consoleSendRaw(action, wrapped) {
    var prefix = kind === 'menu' ? '__FNOP_MENU_ACTION__' : '__FNOP_ACTION__';
    console.info(prefix + encodeURIComponent(action) + '|' + encodeURIComponent(wrapped));
  }
  function consoleSend(m) { consoleSendRaw(m.action, m.wrapped); }
  function clearPending(id) {
    var m = pending[id]; if (!m) return;
    (m.timers || []).forEach(function (t) { clearTimeout(t); });
    delete pending[id];
    var at = pendingOrder.indexOf(id); if (at >= 0) pendingOrder.splice(at, 1);
  }
  function trimPending() {
    while (pendingOrder.length > MAX_PENDING) clearPending(pendingOrder[0]);
  }
  function sendAudioFast(a, value) {
    // FIX16: UI hover/press is cosmetic and idempotent. It must never allocate a
    // receipt, retry chain or fallback iframe. This removes the hottest bridge path.
    var h = host(), fn = h && (h.action || h.Action), direct = false;
    try { if (typeof fn === 'function') { direct = true; fn.call(h, a, value); } } catch (_) { direct = false; }
    if (!direct) consoleSendRaw(a, value);
    return true;
  }
  function send(name, payload) {
    var a = String(name || '').trim().toLowerCase(); if (!a) return false;
    if (a === 'dev_reset_save' && !window.confirm('Esto reinicia el progreso local y las compras de prueba. Se guarda una copia del progreso antes del reinicio. Continuar?')) return false;
    var value = String(payload == null ? '' : payload);
    if (audioAction(a)) return sendAudioFast(a, value);

    var id = session + '-' + (++sequence).toString(36);
    var m = { id: id, action: a, value: value, wrapped: '__fnopmsg:' + id + '__' + value, timers: [] };
    pending[id] = m; pendingOrder.push(id); trimPending();
    var h = host(), fn = h && (h.action || h.Action), direct = false;
    try {
      if (typeof fn === 'function') {
        direct = true;
        var result = fn.call(h, a, m.wrapped);
        if (result && typeof result.catch === 'function') result.catch(function () { if (pending[id]) consoleSend(m); });
      }
    } catch (_) { direct = false; }
    if (!direct) consoleSend(m);

    // FIX16: timers live on the message and are CANCELLED by ack(), rather than
    // waking up seconds later for every click. Fallback latency is also shorter.
    m.timers.push(setTimeout(function () { if (pending[id]) consoleSend(m); }, 40));
    m.timers.push(setTimeout(function () {
      if (!pending[id]) return;
      var prefix = kind === 'menu' ? '__FNOP_MENU_ACTION__' : '__FNOP_ACTION__';
      document.title = prefix + encodeURIComponent(a) + '|' + encodeURIComponent(m.wrapped);
    }, 180));
    m.timers.push(setTimeout(function () {
      if (!pending[id] || !document.body) return;
      if (fallbackFrame) { try { fallbackFrame.remove(); } catch (_) {} fallbackFrame = null; }
      var endpoint = kind === 'menu' ? 'fnop-action/' : 'fnop-ui-action/';
      var key = kind === 'menu' ? 'value' : 'payload';
      var frame = document.createElement('iframe'); frame.hidden = true; frame.setAttribute('aria-hidden', 'true');
      frame.src = 'https://fnop.local/' + endpoint + encodeURIComponent(a) + '?' + key + '=' + encodeURIComponent(m.wrapped) + '&n=' + encodeURIComponent(id);
      document.body.appendChild(frame); fallbackFrame = frame;
      m.timers.push(setTimeout(function () { if (fallbackFrame === frame) fallbackFrame = null; frame.remove(); }, 500));
    }, 700));
    m.timers.push(setTimeout(function () {
      if (!pending[id]) return;
      clearPending(id);
      status('SIN CONFIRMACION DE UNREAL: ' + a + ' (1.36.43). Revisa Saved/Logs.', true);
    }, 1800));
    return id;
  }
  function ack(receipt) {
    if (!receipt || !receipt.id) return;
    clearPending(receipt.id); connected = true;
    if (receipt.masterVolume != null) setMaster(receipt.masterVolume);
    if (fatalError) status(fatalError, true);
    else status('UNREAL ' + receipt.version + ' CONECTADO | recibido: ' + (receipt.action || ''), false);
    window.dispatchEvent(new CustomEvent('fnop:native-receipt', { detail: receipt }));
  }
  function bindAudio() {
    if (window.__FNOP_RUNTIME_AUDIO_BOUND__) return;
    window.__FNOP_RUNTIME_AUDIO_BOUND__ = true;
    var selector = 'button,[role="button"],a,input,select,[onclick],[data-action],[data-mode],[data-close]';
    var last = null, lastHoverAt = 0;
    function nearest(e) { return e.target && e.target.closest ? e.target.closest(selector) : null; }
    document.addEventListener('pointerover', function (e) {
      var el = nearest(e); if (!el || el.disabled || el === last) return; last = el;
      var now = performance.now();
      // FIX16: cap de hover para puntero fisico/gaze. El feedback sigue instantaneo,
      // pero no puede inundar CEF/UE al cruzar muchos nodos en un solo frame.
      if (now - lastHoverAt < 45) return; lastHoverAt = now;
      if (master > 0) send(kind === 'menu' ? 'playuiaudio' : '__audio_hover', kind === 'menu' ? 'hover' : '');
    }, true);
    document.addEventListener('pointerout', function (e) { var el = nearest(e); if (el && el === last && (!e.relatedTarget || !el.contains(e.relatedTarget))) last = null; }, true);
    document.addEventListener('click', function (e) {
      var el = nearest(e); if (!el || el.disabled) return;
      if (master > 0) send(kind === 'menu' ? 'playuiaudio' : '__audio_press', kind === 'menu' ? 'press' : '');
    }, true);
  }
  function activate() {
    if (active) return; active = true;
    var start = function () { bindAudio(); setMaster(master); status('CONECTANDO CON UNREAL 1.36.43...', false); send('__bridge_ready', '1.36.43'); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
  }
  window.FNOPRuntime = Object.freeze({ send: send, ack: ack, activate: activate, setMaster: setMaster, setActive: setPageActive,
    error: function (text) { status(String(text), true); }, isConnected: function () { return connected; }, isActive: function () { return pageActive; } });
  // Stable aliases. No alias ever calls another alias: no ueCall/native recursion.
  window.fnopAction = send;
  window.fnopNativeAction = send;
  window.addEventListener('error', function (e) {
    fatalError = 'ERROR DE INTERFAZ: ' + (e.message || 'JavaScript') + ' (consulta Saved/Logs)';
    status(fatalError, true);
  });
  window.addEventListener('unhandledrejection', function (e) {
    fatalError = 'ERROR DE INTERFAZ: ' + String(e.reason && e.reason.message || e.reason || 'Promise');
    status(fatalError, true);
  });
  window.addEventListener('beforeunload', function () {
    pendingOrder.slice().forEach(clearPending);
    if (fallbackFrame) { try { fallbackFrame.remove(); } catch (_) {} fallbackFrame = null; }
  }, {once:true});
  // FIX 5T TAB RELAY: CEF can retain TAB in Shipping.
  if (!window.__FNOP_TAB_RELAY_BOUND__) {
    window.__FNOP_TAB_RELAY_BOUND__ = true;
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
      var a = document.activeElement, tag = a && a.tagName ? a.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault(); e.stopPropagation();
      try { send('__toggle_inventory', ''); } catch (_) {}
    }, true);
  }
  // This no longer depends on optional shop/news initializers reaching the end.
  activate();
}());
