export const CLIENT_SCRIPT = `
    if (typeof htmx !== 'undefined') htmx.config.globalViewTransitions = true;

    let userPos = null;
    let sortByDistance = false;

    var transitTimes = {};

    function fetchTransitTimes() {
      if (!userPos) return Promise.resolve();
      var snapLat = Math.round(userPos.lat * 500) / 500;
      var snapLng = Math.round(userPos.lng * 500) / 500;
      var cacheKey = 'transit_' + snapLat + '_' + snapLng;
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) { transitTimes = JSON.parse(cached); return Promise.resolve(); }

      return fetch('/api/transit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: userPos.lat, lng: userPos.lng })
      }).then(function(r) { return r.json(); }).then(function(data) {
        transitTimes = data;
        try { sessionStorage.setItem(cacheKey, JSON.stringify(transitTimes)); } catch(e) {}
      }).catch(function() {});
    }

    function travelMin(slug) {
      return transitTimes[slug] !== undefined ? transitTimes[slug] : null;
    }

    let lastRenderData = null;

    function onToggleVisited(id, itemType) {
      const card = document.querySelector('[data-item-id="' + id + '"]');
      if (!card) return;
      const btn = card.querySelector('.card-visited-btn');
      const li = card.parentElement;

      if (isVisited(id)) {
        toggleVisited(id);
        btn.classList.remove('is-visited');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', T.markVisited);
        btn.setAttribute('title', T.markVisited);
        btn.querySelector('svg').innerHTML = '<path d="M3 8.5l3.5 3.5 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        var activeList = content.querySelector('[data-section="exhibitions"] .card-list');
        if (activeList && li) activeList.appendChild(li);
        updateVisitedCount();
        return;
      }

      toggleVisited(id);
      if (getMyLikes()[id]) {
        moveToVisited(card);
      } else {
        showHeartPrompt(id, itemType, card);
      }
    }

    function showHeartPrompt(id, itemType, card) {
      var existing = card.querySelector('.heart-prompt');
      if (existing) return;
      var prompt = document.createElement('div');
      prompt.className = 'heart-prompt';
      prompt.innerHTML = '<span class="heart-prompt-text">' + escHtml(T.heartPrompt) + '</span>'
        + '<button type="button" class="heart-prompt-btn heart" data-action="like">'
        + '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>'
        + escHtml(T.heartYes) + '</button>'
        + '<button type="button" class="heart-prompt-btn" data-action="dismiss">' + escHtml(T.heartDismiss) + '</button>';
      prompt.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'like') submitLike(id, itemType);
        prompt.remove();
        moveToVisited(card);
      });
      card.querySelector('.card-body').appendChild(prompt);
    }

    function moveToVisited(card) {
      var btn = card.querySelector('.card-visited-btn');
      btn.classList.add('is-visited');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', T.unmarkVisited);
      btn.setAttribute('title', T.unmarkVisited);
      btn.querySelector('svg').innerHTML = '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
      var visitedList = document.getElementById('visited-list');
      var visitedSection = document.getElementById('visited-section');
      var li = card.parentElement;
      if (visitedList && li) visitedList.appendChild(li);
      if (visitedSection) visitedSection.removeAttribute('hidden');
      updateVisitedCount();
    }

    function updateVisitedCount() {
      var visitedList = document.getElementById('visited-list');
      var visitedCount = document.getElementById('visited-count');
      if (visitedList && visitedCount) {
        visitedCount.textContent = visitedList.children.length;
      }
    }

    function getMyLikes() {
      try { return JSON.parse(localStorage.getItem('my_likes') || '{}'); } catch { return {}; }
    }

    function submitLike(id, itemType) {
      var likes = getMyLikes();
      likes[id] = true;
      try { localStorage.setItem('my_likes', JSON.stringify(likes)); } catch {}
      var badge = document.querySelector('[data-item-id="' + id + '"] .card-likes');
      if (badge) {
        var count = parseInt(badge.textContent) || 0;
        badge.lastChild.textContent = count + 1;
      }
      fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: itemType, item_id: id }),
      }).catch(function() {});
    }

    function getVisited() {
      try { return JSON.parse(localStorage.getItem('visited') || '[]'); } catch { return []; }
    }
    function isVisited(id) { return getVisited().includes(id); }
    function toggleVisited(id) {
      var v = getVisited();
      var idx = v.indexOf(id);
      if (idx >= 0) v.splice(idx, 1); else v.push(id);
      try { localStorage.setItem('visited', JSON.stringify(v)); } catch {}
    }

    var content = document.getElementById('content');
    var dateLabel = document.getElementById('date-label');

    function pushStateToUrl(date, near) {
      var url = new URL(location.href);
      if (date === BERLIN_TODAY) url.searchParams.delete('date');
      else url.searchParams.set('date', date);
      if (near) url.searchParams.set('sort', 'near');
      else url.searchParams.delete('sort');
      history.replaceState(null, '', url.toString());
    }

    function setActiveDate(date) {
      document.querySelectorAll('[data-date]').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.date === date);
      });
    }

    function loadDay(date) {
      currentDate = date;
      setActiveDate(date);
      htmx.ajax('GET', '/partial/content?date=' + date + '&lang=' + CURRENT_LANG, {
        target: '#content',
        swap: 'innerHTML',
      });
    }

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-date]');
      if (btn) loadDay(btn.dataset.date);
    });

    document.body.addEventListener('htmx:afterSwap', function(e) {
      if (e.detail.target.id !== 'content') return;
      pushStateToUrl(currentDate, sortByDistance);
      var xhr = e.detail.xhr;
      var label = xhr.getResponseHeader('X-Date-Label');
      if (label) dateLabel.textContent = label;
      var dataEl = content.querySelector('#partial-data');
      if (dataEl) {
        lastRenderData = JSON.parse(dataEl.textContent);
        dataEl.remove();
        buildSearchIndex();
      }
      hydrateVisited();
      hydrateSectionStates();
      if (sortByDistance && userPos) { injectDistanceBadges(); injectReachability(); }
    });

    function persistSectionState(el) {
      var key = el.dataset.section;
      try { localStorage.setItem('section-' + key, el.open ? 'open' : 'closed'); } catch {}
    }

    function copyPrompt() {
      var el = document.getElementById('llm-prompt');
      navigator.clipboard.writeText(el.dataset.prompt).then(function() {
        var btn = document.querySelector('.llm-tip-copy');
        var orig = btn.textContent;
        btn.textContent = T.llmCopied;
        setTimeout(function() { btn.textContent = orig; }, 1500);
      });
    }

    function escAttr(s) {
      return escHtml(s).replace(/"/g, '&quot;');
    }

    function escHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    var pinSvg = '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" style="width:12px;height:12px;flex-shrink:0"><path d="M8 1a5 5 0 015 5c0 3.5-5 9-5 9s-5-5.5-5-9a5 5 0 015-5zm0 3a2 2 0 100 4 2 2 0 000-4z" stroke="currentColor" stroke-width="1.5"/></svg>';

    function injectDistanceBadges() {
      document.querySelectorAll('[data-museum-slug]').forEach(function(el) {
        var slug = el.dataset.museumSlug;
        var min = travelMin(slug);
        if (min === null) return;
        var navBtn = el.querySelector('a[href*="rmv.de/c/"]');
        if (navBtn && !navBtn.dataset.distanced) {
          navBtn.dataset.distanced = '1';
          navBtn.innerHTML = pinSvg + ' ' + min + ' ' + escHtml(T.minWalk);
          navBtn.style.padding = '1px 6px';
          navBtn.style.gap = '4px';
          navBtn.title = '~' + min + ' ' + T.minWalk + ' – ' + T.navigate;
        }
      });
    }

    var TIGHT_MARGIN_MIN = 10;
    var timeDefault = 'text-accent bg-accent-light';
    var timeReachable = 'text-green-700 bg-green-50';
    var timeTight = 'text-amber-700 bg-amber-50';
    var timeStarted = 'text-text-tertiary bg-border-light opacity-60';

    function injectReachability() {
      var now = new Date();
      var todayStr = BERLIN_TODAY;
      var nowMin = now.getHours() * 60 + now.getMinutes();

      content.querySelectorAll('article.card[data-event-time][data-event-date]').forEach(function(card) {
        var timeEl = card.querySelector('.card-time');
        if (!timeEl || timeEl.dataset.reachColored) return;
        var eventDate = card.dataset.eventDate;
        if (eventDate !== todayStr) return;
        var eventTime = card.dataset.eventTime;
        if (!eventTime) return;
        var slug = card.dataset.museumSlug;
        var travel = travelMin(slug);
        if (travel === null) return;

        var parts = eventTime.split(':');
        var eventMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        var margin = eventMin - nowMin - travel;

        timeEl.dataset.reachColored = '1';
        timeEl.classList.remove.apply(timeEl.classList, timeDefault.split(' '));
        var colors = margin < 0 ? timeStarted : margin < TIGHT_MARGIN_MIN ? timeTight : timeReachable;
        timeEl.classList.add.apply(timeEl.classList, colors.split(' '));
      });
    }

    function removeReachabilityBadges() {
      content.querySelectorAll('.card-time[data-reach-colored]').forEach(function(el) {
        delete el.dataset.reachColored;
        [timeReachable, timeTight, timeStarted].forEach(function(cls) {
          el.classList.remove.apply(el.classList, cls.split(' '));
        });
        el.classList.add.apply(el.classList, timeDefault.split(' '));
      });
    }

    function removeDistanceBadges() {
      document.querySelectorAll('a[data-distanced]').forEach(function(btn) {
        delete btn.dataset.distanced;
        btn.innerHTML = pinSvg;
        btn.style.padding = '';
        btn.style.gap = '';
        btn.title = T.navigate;
      });
      removeReachabilityBadges();
    }

    function sortCardsByDistance() {
      var lists = content.querySelectorAll('.card-list');
      lists.forEach(function(list) {
        var items = Array.from(list.querySelectorAll(':scope > li'));
        items.sort(function(a, b) {
          var elA = a.querySelector('[data-museum-slug]');
          var elB = b.querySelector('[data-museum-slug]');
          var da = elA ? (travelMin(elA.dataset.museumSlug) || 999) : 999;
          var db = elB ? (travelMin(elB.dataset.museumSlug) || 999) : 999;
          return da - db;
        });
        items.forEach(function(item) { list.appendChild(item); });
      });
    }

    var btnNear = document.getElementById('btn-near');

    btnNear.addEventListener('click', function() {
      if (sortByDistance) {
        sortByDistance = false;
        btnNear.classList.remove('active');
        btnNear.setAttribute('aria-pressed', 'false');
        removeDistanceBadges();
        pushStateToUrl(currentDate, false);
        return;
      }
      function activateNearMe() {
        sortByDistance = true;
        btnNear.classList.add('active');
        btnNear.setAttribute('aria-pressed', 'true');
        btnNear.classList.add('loading');
        btnNear.setAttribute('aria-busy', 'true');
        fetchTransitTimes().then(function() {
          btnNear.classList.remove('loading');
          btnNear.removeAttribute('aria-busy');
          injectDistanceBadges(); injectReachability();
          sortCardsByDistance();
          pushStateToUrl(currentDate, true);
        });
      }
      if (userPos) {
        activateNearMe();
      } else if ('geolocation' in navigator) {
        btnNear.classList.add('loading');
        btnNear.setAttribute('aria-busy', 'true');
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            activateNearMe();
          },
          function() {
            btnNear.classList.remove('loading');
            btnNear.removeAttribute('aria-busy');
            btnNear.style.display = 'none';
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }
    });

    if (!('geolocation' in navigator)) btnNear.style.display = 'none';

    function hydrateVisited() {
      var visited = getVisited();
      if (visited.length === 0) return;
      var visitedSection = document.getElementById('visited-section');
      var visitedList = document.getElementById('visited-list');
      var visitedCount = document.getElementById('visited-count');
      if (!visitedSection || !visitedList || !visitedCount) return;

      var cards = content.querySelectorAll('article.card[data-item-id]');
      var count = 0;
      cards.forEach(function(card) {
        var id = parseInt(card.getAttribute('data-item-id'), 10);
        if (!visited.includes(id)) return;
        var li = card.parentElement;
        if (!li) return;
        var btn = card.querySelector('.card-visited-btn');
        if (btn) {
          btn.classList.add('is-visited');
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-label', T.unmarkVisited);
          btn.setAttribute('title', T.unmarkVisited);
          var svg = btn.querySelector('svg');
          if (svg) svg.innerHTML = '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
        }
        visitedList.appendChild(li);
        count++;
      });

      if (count > 0) {
        visitedCount.textContent = count;
        visitedSection.removeAttribute('hidden');
      }
    }

    function hydrateSectionStates() {
      content.querySelectorAll('details.section').forEach(function(d) {
        var key = d.dataset.section;
        if (key) {
          try {
            var state = localStorage.getItem('section-' + key);
            if (state === 'closed') d.removeAttribute('open');
          } catch (e) {}
        }
        d.addEventListener('toggle', function() { persistSectionState(d); });
      });
    }

    var clientToday = BERLIN_TODAY;
    var currentDate = __INITIAL_DATA__ ? __INITIAL_DATA__.date : clientToday;

    var firstBtn = document.querySelector('[data-date]');
    var alreadyRefreshed = new URLSearchParams(location.search).has('_r');
    var serverStale = !alreadyRefreshed && firstBtn && firstBtn.dataset.date !== clientToday;

    if (serverStale) {
      location.replace('/?lang=' + CURRENT_LANG + '&_r=1');
    } else if (__INITIAL_DATA__) {
      lastRenderData = __INITIAL_DATA__;
      hydrateVisited();
      hydrateSectionStates();
    } else {
      loadDay(clientToday);
    }

    var urlSort = new URLSearchParams(location.search).get('sort');
    if (urlSort === 'near') btnNear.click();

    // Search
    var searchOverlay = document.getElementById('search-overlay');
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    var searchIdx = -1;
    var fuse = null;

    function buildSearchIndex() {
      if (!lastRenderData || typeof Fuse === 'undefined') return;
      var items = [];
      for (var i = 0; i < lastRenderData.events.length; i++) {
        var ev = lastRenderData.events[i];
        items.push({ type: T.events, title: ev.title, museum: ev.museum_name || '', desc: ev.description || '', url: ev.detail_url || ev.url || null, time: ev.time || '' });
      }
      for (var j = 0; j < lastRenderData.exhibitions.length; j++) {
        var ex = lastRenderData.exhibitions[j];
        items.push({ type: T.exhibitions, title: ex.title, museum: ex.museum_name || '', desc: ex.description || '', url: ex.detail_url || null, time: '' });
      }
      fuse = new Fuse(items, {
        keys: [{ name: 'title', weight: 3 }, { name: 'museum', weight: 2 }, { name: 'desc', weight: 1 }],
        includeMatches: true,
        threshold: 0.4,
        minMatchCharLength: 2,
      });
    }

    function openSearch() {
      buildSearchIndex();
      searchOverlay.showModal();
      searchInput.value = '';
      searchInput.setAttribute('aria-expanded', 'true');
      searchInput.focus();
      updateSearch();
    }

    function closeSearch() {
      searchOverlay.close();
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.setAttribute('aria-activedescendant', '');
      searchIdx = -1;
      document.getElementById('search-trigger').focus();
    }

    function highlight(text, matches, key) {
      if (!matches) return escHtml(text);
      var m = matches.find(function(m) { return m.key === key; });
      if (!m || !m.indices.length) return escHtml(text);
      var result = '';
      var last = 0;
      for (var i = 0; i < m.indices.length; i++) {
        var start = m.indices[i][0], end = m.indices[i][1];
        result += escHtml(text.slice(last, start));
        result += '<mark>' + escHtml(text.slice(start, end + 1)) + '</mark>';
        last = end + 1;
      }
      result += escHtml(text.slice(last));
      return result;
    }

    function updateSearch() {
      var q = searchInput.value.trim();
      searchIdx = -1;
      var results;

      if (!fuse || q.length === 0) {
        var items = [];
        if (lastRenderData) {
          for (var i = 0; i < lastRenderData.events.length; i++) {
            var ev = lastRenderData.events[i];
            items.push({ item: { type: T.events, title: ev.title, museum: ev.museum_name || '', desc: ev.description || '', url: ev.detail_url || ev.url || null, time: ev.time || '' }, matches: null });
          }
          for (var j = 0; j < lastRenderData.exhibitions.length; j++) {
            var ex = lastRenderData.exhibitions[j];
            items.push({ item: { type: T.exhibitions, title: ex.title, museum: ex.museum_name || '', desc: ex.description || '', url: ex.detail_url || null, time: '' }, matches: null });
          }
        }
        results = items.slice(0, 15);
      } else {
        results = fuse.search(q).slice(0, 15);
      }

      if (results.length === 0) {
        searchResults.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-tertiary);font-size:0.8125rem">' + escHtml(T.noResults) + '</div>';
        return;
      }

      searchResults.innerHTML = results.map(function(r, i) {
        var item = r.item;
        var titleHtml = highlight(item.title, r.matches, 'title');
        var museumHtml = highlight(item.museum, r.matches, 'museum');
        var descSnippet = item.desc && r.matches && r.matches.some(function(m) { return m.key === 'desc'; })
          ? '<div class="search-result-desc">' + highlight(item.desc.slice(0, 120), r.matches, 'desc') + '</div>'
          : '';
        var timeStr = item.time ? '<span class="search-result-time">' + escHtml(item.time) + '</span>' : '';

        return '<div class="search-result" role="option" id="search-opt-' + i + '" data-idx="' + i + '"'
          + (item.url ? ' data-url="' + escAttr(item.url) + '"' : '')
          + '><div class="search-result-type">' + escHtml(item.type.slice(0, 6)) + '</div>'
          + '<div class="search-result-body">'
          + '<div class="search-result-title">' + titleHtml + ' ' + timeStr + '</div>'
          + '<div class="search-result-museum">' + museumHtml + '</div>'
          + descSnippet
          + '</div></div>';
      }).join('');
    }

    searchInput.addEventListener('input', updateSearch);

    searchResults.addEventListener('click', function(e) {
      var row = e.target.closest('.search-result');
      if (row && row.dataset.url) {
        window.open(row.dataset.url, '_blank');
        closeSearch();
      }
    });

    searchInput.addEventListener('keydown', function(e) {
      var rows = searchResults.querySelectorAll('.search-result');
      if (e.key === 'ArrowDown') { e.preventDefault(); searchIdx = Math.min(searchIdx + 1, rows.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); searchIdx = Math.max(searchIdx - 1, -1); }
      else if (e.key === 'Enter' && searchIdx >= 0 && rows[searchIdx]) {
        var url = rows[searchIdx].dataset.url;
        if (url) { window.open(url, '_blank'); closeSearch(); }
      }
      else if (e.key === 'Escape') { closeSearch(); return; }
      else return;
      rows.forEach(function(r, i) { r.classList.toggle('active', i === searchIdx); });
      searchInput.setAttribute('aria-activedescendant', searchIdx >= 0 ? 'search-opt-' + searchIdx : '');
      if (searchIdx >= 0 && rows[searchIdx]) rows[searchIdx].scrollIntoView({ block: 'nearest' });
    });

    searchOverlay.addEventListener('click', function(e) {
      if (e.target === searchOverlay) closeSearch();
    });
    searchOverlay.addEventListener('cancel', function() {
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.setAttribute('aria-activedescendant', '');
      searchIdx = -1;
    });

    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
`;
