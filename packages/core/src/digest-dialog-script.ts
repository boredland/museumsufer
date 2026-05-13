/**
 * Inline IIFE that binds the Web Push subscribe / save / unsubscribe state
 * machine to a server-rendered <DigestDialog/> instance. Both konzert.haus
 * and landau.today wire identical UX off the same DOM hooks (#digest-dialog,
 * #digest-form, #digest-submit, #digest-unsubscribe-all, [data-digest-open],
 * [data-digest-close]); only the filter-chip semantics + button labels
 * differ.
 *
 *   buildDigestDialogScript({
 *     labels: { subscribe: "Subscribe", save: "Save", … },
 *     filterField: "categories",       // landau (push filter shape)
 *     filterName: "filter-category",   // matches DigestDialog `filterName` prop
 *   })
 *
 * The returned string is meant to be inlined inside `<script>…</script>`.
 */

export interface DigestDialogScriptLabels {
  /** Idle subscribe-action button text. */
  subscribe: string;
  /** Save-changes button text once the visitor already has a subscription. */
  save: string;
  /** Cancel-all-schedules button text. */
  unsubscribe: string;
  /** In-flight "saving…" placeholder. */
  saving: string;
  /** In-flight "unsubscribing…" placeholder. */
  unsubscribing: string;
  /** Success toast after subscribe / save. */
  saved: string;
  /** Success toast after unsubscribe. */
  unsubscribed: string;
  /** Error toast for save/subscribe failures. */
  saveFailed: string;
  /** Error toast when the browser refused notification permission. */
  permissionDenied: string;
}

export interface DigestDialogScriptOptions {
  labels: DigestDialogScriptLabels;
  /**
   * Body field used to pass filter chips to /api/push/subscribe.
   * Maps to e.g. `{ filters: { genres: [...] } }` (konzert)
   * or `{ filters: { categories: [...] } }` (landau).
   */
  filterField: string;
  /**
   * `name` attribute on the filter-chip inputs. Matches the
   * `filterName` prop passed to <DigestDialog />.
   */
  filterName: string;
}

export function buildDigestDialogScript({ labels: L, filterField, filterName }: DigestDialogScriptOptions): string {
  const j = (s: string) => JSON.stringify(s);
  return `(function(){
  var dlg = document.getElementById('digest-dialog');
  if (!dlg) return;
  var form = document.getElementById('digest-form');
  var submit = document.getElementById('digest-submit');
  var unsubBtn = document.getElementById('digest-unsubscribe-all');
  var status = document.getElementById('digest-status');
  var iosHint = document.getElementById('digest-ios-hint');
  var unsupported = document.getElementById('digest-unsupported');
  if (!form || !submit || !unsubBtn || !status) return;

  function setStatus(text, kind){
    status.textContent = text;
    status.hidden = !text;
    status.removeAttribute('data-kind');
    if (kind) status.setAttribute('data-kind', kind);
  }
  function checked(){
    return Array.prototype.slice.call(form.querySelectorAll('input[name="schedule"]:checked'))
      .map(function(el){ return el.value; });
  }
  function setChecked(values){
    var set = new Set(values || []);
    Array.prototype.forEach.call(form.querySelectorAll('input[name="schedule"]'), function(el){
      el.checked = set.has(el.value);
    });
  }
  function checkedFilter(){
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + ${j(filterName)} + '"]:checked'))
      .map(function(el){ return el.value; });
  }
  function setFilter(values){
    var set = new Set(values || []);
    Array.prototype.forEach.call(form.querySelectorAll('input[name="' + ${j(filterName)} + '"]'), function(el){
      el.checked = set.has(el.value);
    });
  }
  function b64ToBytes(b64){
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function iosNonStandalone(){
    var ua = navigator.userAgent || '';
    var isIos = /iP(hone|od|ad)/.test(ua) || (ua.indexOf('Mac') >= 0 && 'ontouchend' in document);
    if (!isIos) return false;
    var standalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    return !standalone;
  }
  function supports(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function currentSub(){
    return navigator.serviceWorker.ready.then(function(reg){ return reg.pushManager.getSubscription(); });
  }
  function openDialog(){
    setStatus('');
    submit.disabled = false;
    submit.textContent = ${j(L.subscribe)};
    unsubBtn.hidden = true;
    setChecked([]);
    setFilter([]);
    if (iosHint) iosHint.hidden = true;
    if (unsupported) unsupported.hidden = true;

    if (!supports()){
      if (iosNonStandalone() && iosHint) iosHint.hidden = false;
      else if (unsupported) unsupported.hidden = false;
      submit.disabled = true;
    } else if (iosNonStandalone()){
      if (iosHint) iosHint.hidden = false;
      submit.disabled = true;
    } else {
      currentSub().then(function(existing){
        if (!existing) return;
        return fetch('/api/push/me?endpoint=' + encodeURIComponent(existing.endpoint))
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(me){
            if (me && me.schedules && me.schedules.length){
              setChecked(me.schedules);
              if (me.filters && Array.isArray(me.filters[${j(filterField)}])) setFilter(me.filters[${j(filterField)}]);
              submit.textContent = ${j(L.save)};
              unsubBtn.hidden = false;
            }
          });
      }).catch(function(){});
    }

    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }
  function closeDialog(){
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }
  function submitFlow(){
    var sched = checked();
    submit.disabled = true;
    submit.textContent = sched.length === 0 ? ${j(L.unsubscribing)} : ${j(L.saving)};
    setStatus('');

    currentSub().then(function(existing){
      if (sched.length === 0){
        if (!existing) return null;
        return fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint })
        }).then(function(){ return existing.unsubscribe().catch(function(){}); })
          .then(function(){ return 'unsubscribed'; });
      }

      function withSub(sub){
        var json = sub.toJSON();
        var f = checkedFilter();
        var filters = null;
        if (f.length > 0){ filters = {}; filters[${j(filterField)}] = f; }
        return fetch('/api/push/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, schedules: sched, filters: filters })
        }).then(function(r){ if (!r.ok) throw new Error('save-failed'); return 'saved'; });
      }
      if (existing) return withSub(existing);
      if (Notification.permission === 'denied') throw new Error('permission-denied');
      var permP = Notification.permission === 'granted'
        ? Promise.resolve('granted')
        : Notification.requestPermission();
      return permP.then(function(p){
        if (p !== 'granted') throw new Error('permission-denied');
        return fetch('/api/push/key').then(function(r){ if (!r.ok) throw new Error('key-failed'); return r.json(); });
      }).then(function(data){
        return navigator.serviceWorker.ready.then(function(reg){
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
        });
      }).then(withSub);
    }).then(function(outcome){
      setStatus(outcome === 'unsubscribed' ? ${j(L.unsubscribed)} : ${j(L.saved)}, 'ok');
      if (outcome === 'saved'){ submit.textContent = ${j(L.save)}; unsubBtn.hidden = false; }
      setTimeout(closeDialog, 1200);
    }).catch(function(err){
      var msg = ${j(L.saveFailed)};
      if (err && err.message === 'permission-denied') msg = ${j(L.permissionDenied)};
      setStatus(msg, 'err');
      submit.disabled = false;
      var resched = checked();
      submit.textContent = resched.length === 0
        ? ${j(L.unsubscribe)}
        : (unsubBtn.hidden ? ${j(L.subscribe)} : ${j(L.save)});
    });
  }

  document.addEventListener('click', function(e){
    var openBtn = e.target.closest && e.target.closest('[data-digest-open]');
    if (openBtn){ e.preventDefault(); openDialog(); return; }
    var closeBtn = e.target.closest && e.target.closest('[data-digest-close]');
    if (closeBtn){ e.preventDefault(); closeDialog(); return; }
  });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) closeDialog(); });
  form.addEventListener('submit', function(e){ e.preventDefault(); submitFlow(); });
  unsubBtn.addEventListener('click', function(e){ e.preventDefault(); setChecked([]); submitFlow(); });
  form.addEventListener('change', function(){
    if (submit.disabled) return;
    var sched = checked();
    if (sched.length === 0 && !unsubBtn.hidden) submit.textContent = ${j(L.unsubscribe)};
    else submit.textContent = unsubBtn.hidden ? ${j(L.subscribe)} : ${j(L.save)};
  });
})();`;
}
