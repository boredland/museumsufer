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
 *   window.__landauHighlight()      — replays a ?highlight=<id> pulse
 */

export const CLIENT_SCRIPT = `
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
      var u = new URL(location.href);
      u.searchParams.set('highlight', rowBtn.dataset.id);
      shareOrCopy({ title: rowBtn.dataset.title || 'Veranstaltung', url: u.toString() }, 'share-toast-row', 'Link kopiert');
      return;
    }
    var btn = e.target.closest && e.target.closest('.js-share');
    if (btn) {
      e.preventDefault();
      shareOrCopy({ title: btn.dataset.title, url: btn.dataset.url }, 'share-toast', 'Link kopiert');
    }
  });
})();

// ─── highlight-on-arrival pulse ────────────────────────────────────
(function(){
  function highlightFromUrl(){
    var params = new URLSearchParams(location.search);
    var id = params.get('highlight');
    if (!id) return;
    var node = document.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('highlight-pulse');
    setTimeout(function(){ node.classList.remove('highlight-pulse'); }, 2500);
    params.delete('highlight');
    var clean = location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', clean);
  }
  window.__landauHighlight = highlightFromUrl;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', highlightFromUrl);
  else highlightFromUrl();
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
  if (window.__landauHighlight) window.__landauHighlight();
});
`;
