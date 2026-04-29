export const CLIENT_SCRIPT = `
    var htmxReady = false;
    document.body.addEventListener('htmx:load', function() {
      if (!htmxReady) { htmxReady = true; htmx.config.globalViewTransitions = true; }
    });

    var cachedPos = sessionStorage.getItem('userPos');
    let userPos = cachedPos ? JSON.parse(cachedPos) : null;
    let sortByDistance = false;

    var transitTimes = {};

    function fetchTransitTimes() {
      if (!userPos) return Promise.resolve();
      var dlat = (userPos.lat - 50.1092) * 111.32;
      var dlng = (userPos.lng - 8.6819) * 111.32 * Math.cos(50.1092 * Math.PI / 180);
      if (Math.sqrt(dlat * dlat + dlng * dlng) > 20) return Promise.resolve();
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
        btn.querySelector('svg').innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
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
        + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
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
      btn.querySelector('svg').innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
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

    function updateLangLinks() {
      document.querySelectorAll('a[data-lang]').forEach(function(a) {
        var u = new URLSearchParams(location.search);
        u.set('lang', a.dataset.lang);
        a.href = '?' + u.toString();
      });
    }

    function pushStateToUrl(date, near) {
      var url = new URL(location.href);
      if (date === BERLIN_TODAY) url.searchParams.delete('date');
      else url.searchParams.set('date', date);
      if (near) url.searchParams.set('sort', 'near');
      else url.searchParams.delete('sort');
      history.replaceState(null, '', url.toString());
      updateLangLinks();
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
      hydrateVisited(); hydrateMyLikes();
      hydrateSectionStates();
      document.body.classList.add('hydrated');
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

    var pinSvg = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;flex-shrink:0"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>';

    function injectDistanceBadges() {
      document.querySelectorAll('[data-museum-slug]').forEach(function(el) {
        var slug = el.dataset.museumSlug;
        var min = travelMin(slug);
        if (min === null) return;
        var navBtn = el.querySelector('button[popovertarget^="nav-"]');
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
        var colors, reachLabel;
        if (margin < 0) { colors = timeStarted; reachLabel = T.started; }
        else if (margin < TIGHT_MARGIN_MIN) { colors = timeTight; reachLabel = T.tight; }
        else { colors = timeReachable; reachLabel = T.reachable; }
        timeEl.classList.add.apply(timeEl.classList, colors.split(' '));
        timeEl.title = '~' + travel + ' ' + T.minWalk + ' — ' + reachLabel;
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

    function sortCardsByDate() {
      var lists = content.querySelectorAll('.card-list');
      lists.forEach(function(list) {
        var items = Array.from(list.querySelectorAll(':scope > li'));
        items.sort(function(a, b) {
          var cardA = a.querySelector('[data-event-date]');
          var cardB = b.querySelector('[data-event-date]');
          var dateA = cardA ? cardA.dataset.eventDate : '';
          var dateB = cardB ? cardB.dataset.eventDate : '';
          if (dateA === dateB) return 0;
          return dateA < dateB ? -1 : 1;
        });
        items.forEach(function(item) { list.appendChild(item); });
      });
    }

    var btnNear = document.getElementById('btn-near');

    var nearClickCount = 0;
    var nearGen = 0;

    function deactivateNear() {
      nearGen++;
      nearClickCount = 0;
      sortByDistance = false;
      btnNear.classList.remove('loading', 'active');
      btnNear.removeAttribute('aria-busy');
      btnNear.setAttribute('aria-pressed', 'false');
      removeDistanceBadges();
      sortCardsByDate();
      pushStateToUrl(currentDate, false);
    }

    btnNear.addEventListener('click', function() {
      if (btnNear.classList.contains('loading')) {
        deactivateNear();
        return;
      }
      if (sortByDistance) {
        nearClickCount++;
        if (nearClickCount === 1 && 'geolocation' in navigator) {
          var gen = ++nearGen;
          btnNear.classList.add('loading');
          btnNear.setAttribute('aria-busy', 'true');
          navigator.geolocation.getCurrentPosition(
            function(pos) {
              if (gen !== nearGen) return;
              userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              try { sessionStorage.setItem('userPos', JSON.stringify(userPos)); } catch(e) {}
              sessionStorage.removeItem('transit_' + Math.round(userPos.lat * 500) / 500 + '_' + Math.round(userPos.lng * 500) / 500);
              fetchTransitTimes().then(function() {
                if (gen !== nearGen) return;
                btnNear.classList.remove('loading');
                btnNear.removeAttribute('aria-busy');
                removeDistanceBadges(); removeReachabilityBadges();
                injectDistanceBadges(); injectReachability();
                sortCardsByDistance();
              });
            },
            function() {
              if (gen !== nearGen) return;
              btnNear.classList.remove('loading');
              btnNear.removeAttribute('aria-busy');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          );
          return;
        }
        deactivateNear();
        return;
      }
      nearClickCount = 0;
      var gen = ++nearGen;
      function activateNearMe() {
        sortByDistance = true;
        btnNear.classList.add('active');
        btnNear.setAttribute('aria-pressed', 'true');
        btnNear.classList.add('loading');
        btnNear.setAttribute('aria-busy', 'true');
        fetchTransitTimes().then(function() {
          if (gen !== nearGen) return;
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
            if (gen !== nearGen) return;
            userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            try { sessionStorage.setItem('userPos', JSON.stringify(userPos)); } catch(e) {}
            activateNearMe();
          },
          function() {
            if (gen !== nearGen) return;
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
          if (svg) svg.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
        }
        visitedList.appendChild(li);
        count++;
      });

      if (count > 0) {
        visitedCount.textContent = count;
        visitedSection.removeAttribute('hidden');
      }
    }

    function hydrateMyLikes() {
      var likes = getMyLikes();
      document.querySelectorAll('.card-likes').forEach(function(badge) {
        var card = badge.closest('article[data-item-id]');
        if (!card) return;
        var id = card.getAttribute('data-item-id');
        if (likes[id]) {
          badge.classList.add('!text-red-500', '!border-red-200');
        }
      });
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
      var url = new URL(location);
      url.search = '';
      url.searchParams.set('lang', CURRENT_LANG);
      url.searchParams.set('_r', '1');
      if (currentDate !== clientToday) url.searchParams.set('date', currentDate);
      location.replace(url.toString());
    } else if (__INITIAL_DATA__) {
      lastRenderData = __INITIAL_DATA__;
      hydrateVisited(); hydrateMyLikes();
      hydrateSectionStates();
      updateLangLinks();
      document.body.classList.add('hydrated');
    } else {
      loadDay(clientToday);
    }

    var urlSort = new URLSearchParams(location.search).get('sort');
    if (urlSort === 'near') btnNear.click();

    setTimeout(function() {
      var btns = document.querySelectorAll('[data-date]');
      for (var i = 0; i < Math.min(btns.length, 3); i++) {
        var d = btns[i].dataset.date;
        if (d && d !== currentDate) {
          var link = document.createElement('link');
          link.rel = 'prefetch';
          link.as = 'fetch';
          link.href = '/partial/content?date=' + d + '&lang=' + CURRENT_LANG;
          document.head.appendChild(link);
          break;
        }
      }
    }, 2000);

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
