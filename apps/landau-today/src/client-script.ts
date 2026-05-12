/**
 * Bundled client-side script — every interaction the page needs in one
 * blob, served as `/client.js`. Keeps frontend.tsx focused on markup
 * and lets the browser cache the JS separately from the HTML.
 *
 * Each section reads as its own IIFE so they don't share a closure;
 * ordering doesn't matter. Wire-up (DOM listeners, post-swap hooks)
 * lives at the bottom — it runs once on initial parse and the
 * delegated event handlers handle everything afterwards.
 *
 * Public surface (used by HTMX_AFTER_SWAP):
 *   window.__landauApplySearch()    — re-runs the search filter
 *   window.__landauPaintVisited()   — re-applies visited row marks
 */

import { buildWebMcpScript, type WebMcpToolDef } from "@museumsufer/core";
import { POPOVER_POSITIONING_SCRIPT } from "@museumsufer/core/calendar-popover";
import { CATEGORIES } from "./categories";

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

const WEBMCP_TOOLS: WebMcpToolDef[] = [
  {
    name: "get_events",
    description:
      "Get events for a specific date in Landau and the Südliche Weinstraße. Returns titles, times, venues, prices, and detail links.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        category: { type: "string", enum: CATEGORY_SLUGS, description: "Optional category slug to filter by." },
      },
    },
    executeBody: `var params = new URLSearchParams();
      if (input.date) params.set('date', input.date);
      if (input.category) params.set('category', input.category);
      return fetch('/api/day?' + params).then(function(r) { return r.json(); });`,
  },
  {
    name: "list_categories",
    description: "List the unified event categories used on landau.today (with slug and human label).",
    inputSchema: { type: "object", properties: {} },
    executeBody: `return Promise.resolve(${JSON.stringify(CATEGORIES.map((c) => ({ slug: c.slug, label: c.label })))});`,
  },
  {
    name: "search_events",
    description: "Search visible events on the page by keyword (title, venue, organizer). Returns matches.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
    executeBody: `var input2 = document.querySelector('.js-search');
      if (input2) {
        input2.value = input.query;
        input2.dispatchEvent(new Event('input'));
      }
      var rows = document.querySelectorAll('[data-search]:not([data-search-hidden])');
      var results = [];
      rows.forEach(function(el) {
        var title = el.querySelector('.evt-title, .event-title, h3, h2');
        var meta = el.querySelector('.evt-meta, .event-meta, .meta');
        results.push({
          id: el.dataset.id || '',
          title: title ? title.textContent.trim() : '',
          meta: meta ? meta.textContent.trim() : ''
        });
      });
      return Promise.resolve({ query: input.query, count: results.length, results: results.slice(0, 20) });`,
  },
];

const WEBMCP_SCRIPT = buildWebMcpScript(WEBMCP_TOOLS);

export const CLIENT_SCRIPT = `
${WEBMCP_SCRIPT}
${POPOVER_POSITIONING_SCRIPT}

// ─── service worker registration ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  });
}

// ─── theme toggle ──────────────────────────────────────────────────
document.addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('.js-theme');
  if (!btn) return;
  e.preventDefault();
  var root = document.documentElement;
  var dark = root.classList.contains('dark');
  if (dark) {
    root.classList.remove('dark');
    root.classList.add('light');
    try { localStorage.setItem('theme', 'light'); } catch(_) {}
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
    try { localStorage.setItem('theme', 'dark'); } catch(_) {}
  }
});

// ─── search ────────────────────────────────────────────────────────
(function(){
  function norm(s){ return s.toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, ' ').replace(/\\s+/g, ' ').trim(); }
  function tokens(s){ return norm(s).split(' ').filter(Boolean); }
  function apply(){
    var input = document.querySelector('.js-search');
    if (!input) return;
    var q = tokens(input.value);
    var rows = document.querySelectorAll('[data-search]');
    var anyVisible = false;
    rows.forEach(function(r){
      var hay = r.dataset.search || '';
      var match = q.length === 0 || q.every(function(t){ return hay.indexOf(t) !== -1; });
      if (match) { r.removeAttribute('data-search-hidden'); anyVisible = true; }
      else r.setAttribute('data-search-hidden', '');
    });
    var empty = document.querySelector('.search-empty');
    if (empty) empty.hidden = !(q.length > 0 && !anyVisible);
  }
  window.__landauApplySearch = apply;
  document.addEventListener('input', function(e){
    if (e.target && e.target.classList && e.target.classList.contains('js-search')) apply();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && e.target && e.target.classList && e.target.classList.contains('js-search')) {
      e.target.value = ''; apply(); e.target.blur();
    }
    if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
      var input = document.querySelector('.js-search');
      if (input) { e.preventDefault(); input.focus(); input.select(); }
    }
  });
})();

// ─── visited tracking ──────────────────────────────────────────────
(function(){
  var KEY = 'landau-today-visited';
  function load(){
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch(_) { return new Set(); }
  }
  function save(set){
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(set))); } catch(_) {}
  }
  var visited = load();
  function paint(){
    document.querySelectorAll('[data-id]').forEach(function(node){
      var id = node.dataset.id;
      if (visited.has(id)) node.setAttribute('data-visited', '');
      else node.removeAttribute('data-visited');
    });
  }
  window.__landauPaintVisited = paint;
  paint();
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.js-visited');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    var id = btn.dataset.id; if (!id) return;
    if (visited.has(id)) visited.delete(id); else visited.add(id);
    save(visited); paint();
  });
})();

// ─── per-row share + main share button ─────────────────────────────
(function(){
  function ensureToast(cls){
    var t = document.querySelector('.' + cls);
    if (t) return t;
    t = document.createElement('div');
    t.className = cls;
    t.hidden = true;
    document.body.appendChild(t);
    return t;
  }
  function flash(cls, msg){
    var t = ensureToast(cls);
    t.textContent = msg;
    t.hidden = false;
    setTimeout(function(){ t.hidden = true; }, 1800);
  }
  function shareOrCopy(payload, toastClass, msg){
    if (navigator.share) {
      navigator.share(payload).catch(function(){});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload.url).then(function(){ flash(toastClass, msg); }).catch(function(){});
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = payload.url;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash(toastClass, msg); } catch(_){}
    document.body.removeChild(ta);
  }
  document.addEventListener('click', function(e){
    var rowBtn = e.target.closest && e.target.closest('.js-share-row');
    if (rowBtn) {
      e.preventDefault(); e.stopPropagation();
      var url = location.origin + '/event/' + rowBtn.dataset.id;
      shareOrCopy({ title: rowBtn.dataset.title || 'Veranstaltung', url: url }, 'share-toast-row', 'Link kopiert');
      return;
    }
    var btn = e.target.closest && e.target.closest('.js-share');
    if (btn) {
      e.preventDefault();
      shareOrCopy({ title: btn.dataset.title, url: btn.dataset.url }, 'share-toast', 'Link kopiert');
    }
  });
})();

// ─── "In der Nähe" haversine sort ──────────────────────────────────
(function(){
  var R = 6371; // km
  function hav(a, b, c, d) {
    var dLat = (c - a) * Math.PI / 180;
    var dLng = (d - b) * Math.PI / 180;
    var s = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function fmt(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    if (km < 10) return km.toFixed(1).replace('.', ',') + ' km';
    return Math.round(km) + ' km';
  }
  function clearBadges() {
    document.querySelectorAll('.near-badge').forEach(function(n){ n.remove(); });
  }
  function restore() {
    document.querySelectorAll('[data-near-parent]').forEach(function(parent){
      var rows = Array.from(parent.querySelectorAll('[data-near-orig]'));
      rows.sort(function(a, b){ return Number(a.dataset.nearOrig) - Number(b.dataset.nearOrig); });
      rows.forEach(function(r){ parent.appendChild(r); });
    });
  }
  function stampOrder(){
    document.querySelectorAll('section').forEach(function(parent){
      var rows = parent.querySelectorAll('[data-lat][data-lng]');
      if (rows.length === 0) return;
      parent.setAttribute('data-near-parent', '');
      Array.from(rows).forEach(function(r, i){ r.setAttribute('data-near-orig', String(i)); });
    });
  }
  function activate(lat, lng) {
    document.querySelectorAll('[data-near-parent]').forEach(function(parent){
      var rows = Array.from(parent.querySelectorAll('[data-lat][data-lng]'));
      var withDist = rows.map(function(r){
        var d = hav(lat, lng, parseFloat(r.dataset.lat), parseFloat(r.dataset.lng));
        return { node: r, d: d };
      });
      withDist.sort(function(a, b){ return a.d - b.d; });
      withDist.forEach(function(item){
        parent.appendChild(item.node);
        var b = document.createElement('span');
        b.className = 'near-badge';
        b.textContent = fmt(item.d);
        var glyph = item.node.querySelector('.cat-glyph');
        if (glyph) glyph.parentNode.insertBefore(b, glyph);
        else item.node.appendChild(b);
      });
    });
  }
  stampOrder();
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.js-near');
    if (!btn) return;
    e.preventDefault();
    var pressed = btn.getAttribute('aria-pressed') === 'true';
    if (pressed) {
      btn.setAttribute('aria-pressed', 'false');
      clearBadges(); restore(); return;
    }
    if (!navigator.geolocation) return;
    btn.classList.add('chip--loading');
    navigator.geolocation.getCurrentPosition(function(pos){
      btn.classList.remove('chip--loading');
      btn.setAttribute('aria-pressed', 'true');
      clearBadges();
      activate(pos.coords.latitude, pos.coords.longitude);
    }, function(){
      btn.classList.remove('chip--loading');
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });
  // Re-stamp DOM order after htmx swap; the previous stamp's rows are
  // gone with the swapped-out nodes.
  document.body.addEventListener('htmx:afterSwap', stampOrder);
})();

// ─── htmx post-swap state replay ───────────────────────────────────
document.body.addEventListener('htmx:afterSwap', function(){
  if (window.__landauApplySearch) window.__landauApplySearch();
  if (window.__landauPaintVisited) window.__landauPaintVisited();
});

// ─── digest dialog ─────────────────────────────────────────────────
(function(){
  var dlg = document.getElementById('digest-dialog');
  if (!dlg) return;
  var form = document.getElementById('digest-form');
  var status = document.getElementById('digest-status');
  var submit = document.getElementById('digest-submit');
  var unsubBtn = document.getElementById('digest-unsubscribe-all');
  var iosHint = document.getElementById('digest-ios-hint');
  var unsupported = document.getElementById('digest-unsupported');
  var boxes = form.querySelectorAll('input[name="schedule"]');
  var catBoxes = form.querySelectorAll('input[name="filter-category"]');

  function checked(){
    var out = [];
    boxes.forEach(function(b){ if (b.checked) out.push(b.value); });
    return out;
  }
  function setChecked(values){
    boxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; });
  }
  function checkedCategories(){
    var out = [];
    catBoxes.forEach(function(b){ if (b.checked) out.push(b.value); });
    return out;
  }
  function setCategories(values){
    catBoxes.forEach(function(b){ b.checked = values.indexOf(b.value) !== -1; });
  }
  function setStatus(msg, kind){
    if (!msg){ status.hidden = true; status.textContent = ''; status.style.color = ''; return; }
    status.hidden = false;
    status.textContent = msg;
    status.style.color = kind === 'ok' ? 'var(--color-reblaus)' : kind === 'err' ? 'var(--color-rotwein)' : '';
  }
  function b64ToBytes(s){
    var pad = '='.repeat((4 - s.length % 4) % 4);
    var b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b64);
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
    submit.textContent = 'Abonnieren';
    unsubBtn.hidden = true;
    setChecked([]);
    setCategories([]);
    iosHint.hidden = true;
    unsupported.hidden = true;

    if (!supports()){
      if (iosNonStandalone()) iosHint.hidden = false;
      else unsupported.hidden = false;
      submit.disabled = true;
    } else if (iosNonStandalone()){
      iosHint.hidden = false;
      submit.disabled = true;
    } else {
      currentSub().then(function(existing){
        if (!existing) return;
        return fetch('/api/push/me?endpoint=' + encodeURIComponent(existing.endpoint))
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(me){
            if (me && me.schedules && me.schedules.length){
              setChecked(me.schedules);
              if (me.filters && Array.isArray(me.filters.categories)) setCategories(me.filters.categories);
              submit.textContent = 'Speichern';
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
    submit.textContent = sched.length === 0 ? 'Wird abbestellt…' : 'Wird gespeichert…';
    setStatus('');

    currentSub().then(function(existing){
      if (sched.length === 0){
        if (!existing) return null;
        return fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint })
        }).then(function(){ return existing.unsubscribe().catch(function(){}); })
          .then(function(){ return 'unsubscribed'; });
      }

      function withSub(sub){
        var json = sub.toJSON();
        var cats = checkedCategories();
        var filters = cats.length > 0 ? { categories: cats } : null;
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, schedules: sched, filters: filters })
        }).then(function(r){
          if (!r.ok) throw new Error('save-failed');
          return 'saved';
        });
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
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: b64ToBytes(data.publicKey)
          });
        });
      }).then(withSub);
    }).then(function(outcome){
      setStatus(outcome === 'unsubscribed' ? 'Abbestellt.' : 'Gespeichert.', 'ok');
      if (outcome === 'saved'){
        submit.textContent = 'Speichern';
        unsubBtn.hidden = false;
      }
      setTimeout(closeDialog, 1200);
    }).catch(function(err){
      var msg = 'Speichern fehlgeschlagen.';
      if (err && err.message === 'permission-denied') msg = 'Benachrichtigungen wurden blockiert. Erlaube sie in den Browser-Einstellungen.';
      setStatus(msg, 'err');
      submit.disabled = false;
      var resched = checked();
      submit.textContent = resched.length === 0
        ? 'Abbestellen'
        : (unsubBtn.hidden ? 'Abonnieren' : 'Speichern');
    });
  }

  document.addEventListener('click', function(e){
    var openBtn = e.target.closest && e.target.closest('[data-digest-open]');
    if (openBtn){ e.preventDefault(); openDialog(); return; }
    var closeBtn = e.target.closest && e.target.closest('[data-digest-close]');
    if (closeBtn){ e.preventDefault(); closeDialog(); return; }
  });
  dlg.addEventListener('click', function(e){
    if (e.target === dlg) closeDialog();
  });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    submitFlow();
  });
  unsubBtn.addEventListener('click', function(e){
    e.preventDefault();
    setChecked([]);
    submitFlow();
  });
  form.addEventListener('change', function(){
    if (submit.disabled) return;
    var sched = checked();
    if (sched.length === 0 && !unsubBtn.hidden) submit.textContent = 'Abbestellen';
    else submit.textContent = unsubBtn.hidden ? 'Abonnieren' : 'Speichern';
  });
})();

// Contact dialog — Problem melden form. Submits to /api/contact which
// verifies Turnstile and forwards to email.
(function(){
  var dlg = document.getElementById('contact-dialog');
  if (!dlg) return;
  var form = document.getElementById('contact-form');
  var category = document.getElementById('contact-category');
  var message = document.getElementById('contact-message');
  var context = document.getElementById('contact-context');
  var status = document.getElementById('contact-status');
  var submit = document.getElementById('contact-submit');

  function open(){
    status.hidden = true; status.textContent = ''; status.style.color = '';
    submit.disabled = false; submit.textContent = 'Senden';
    context.value = location.href;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    setTimeout(function(){ message.focus(); }, 50);
  }
  function close(){
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  document.addEventListener('click', function(e){
    var openBtn = e.target.closest && e.target.closest('[data-contact-open]');
    if (openBtn){
      e.preventDefault();
      if (window.__loadTurnstile) window.__loadTurnstile();
      open();
      return;
    }
    var closeBtn = e.target.closest && e.target.closest('[data-contact-close]');
    if (closeBtn){ e.preventDefault(); close(); return; }
  });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) close(); });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    submit.disabled = true; submit.textContent = 'Wird gesendet…';
    status.hidden = true;
    var data = new FormData(form);
    var payload = {};
    data.forEach(function(v, k){ payload[k] = v; });
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){
      if (!r.ok) throw new Error('submit failed');
      status.textContent = 'Danke — Hinweis ist angekommen.';
      status.style.color = '';
      status.hidden = false;
      form.reset();
      setTimeout(close, 1800);
    }).catch(function(){
      status.textContent = 'Senden fehlgeschlagen. Bitte schreib direkt an feedback@landau.today.';
      status.style.color = 'var(--color-rotwein)';
      status.hidden = false;
      submit.disabled = false; submit.textContent = 'Senden';
    });
  });
})();
`;
