export const CLIENT_SCRIPT = `
    const RIVER_LAT = 50.107;
    const BRIDGE_PENALTY = 0.8;

    let userPos = null;
    let sortByDistance = false;

    function haversine(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function walkKm(slug) {
      if (!userPos || !MUSEUM_GEO[slug]) return null;
      const m = MUSEUM_GEO[slug];
      let km = haversine(userPos.lat, userPos.lng, m.lat, m.lng);
      if ((userPos.lat < RIVER_LAT) !== (m.lat < RIVER_LAT)) km += BRIDGE_PENALTY;
      return km;
    }

    function walkMin(slug) {
      const km = walkKm(slug);
      return km !== null ? Math.round(km / 5 * 60) : null;
    }

    function translatedBadge(item) {
      if (!item.translated) return '';
      return '<span class="card-translated" title="Translated by DeepL"><svg viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/></svg>DeepL</span>';
    }

    function buildCalendarUrl(ev) {
      const date = ev.date.replace(/-/g, '');
      let startDt, endDt;
      if (ev.time) {
        startDt = date + 'T' + ev.time.replace(':', '') + '00';
        if (ev.end_time) {
          const endDate = ev.end_date ? ev.end_date.replace(/-/g, '') : date;
          endDt = endDate + 'T' + ev.end_time.replace(':', '') + '00';
        } else {
          const h = (parseInt(ev.time.split(':')[0]) + 1) % 24;
          endDt = date + 'T' + h.toString().padStart(2, '0') + ev.time.split(':')[1] + '00';
        }
      } else {
        startDt = date;
        endDt = date;
      }
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: ev.title,
        dates: startDt + '/' + endDt,
        location: ev.museum_name || '',
        details: (ev.description || '') + (ev.detail_url ? '\\n' + ev.detail_url : ''),
      });
      if (ev.time) params.set('ctz', 'Europe/Berlin');
      return 'https://calendar.google.com/calendar/render?' + params.toString();
    }

    function distanceBadge(slug) {
      const min = walkMin(slug);
      if (min === null) return '';
      return '<span class="card-distance" title="~' + min + ' ' + T.minWalk + ' ' + T.nearMe + '">' + min + ' ' + T.minWalk + '</span>';
    }

    function navButton(slug) {
      if (!MUSEUM_GEO[slug]) return '';
      const m = MUSEUM_GEO[slug];
      return '<a class="card-ical" href="https://www.google.com/maps/dir/?api=1&destination=' + m.lat + ',' + m.lng + '&travelmode=walking" target="_blank" rel="noopener" aria-label="' + escAttr(T.navigate) + '" title="' + escAttr(T.navigate) + '">'
        + '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1a5 5 0 015 5c0 3.5-5 9-5 9s-5-5.5-5-9a5 5 0 015-5zm0 3a2 2 0 100 4 2 2 0 000-4z" stroke="currentColor" stroke-width="1.5"/></svg>'
        + '</a>';
    }

    function likeBadge(item) {
      const count = item.like_count || 0;
      if (count <= 0) return '';
      return '<span class="card-likes"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>' + count + '</span>';
    }

    function museumPopularity(items) {
      const pop = {};
      for (const item of items) {
        const slug = item.museum_slug;
        if (!slug) continue;
        const count = item.like_count || 0;
        if (!pop[slug] || count > pop[slug]) pop[slug] = count;
      }
      return pop;
    }

    function sortByPopularity(items) {
      const pop = museumPopularity(items);
      return [...items].sort((a, b) => {
        const pa = pop[a.museum_slug] || 0;
        const pb = pop[b.museum_slug] || 0;
        if (pa !== pb) return pb - pa;
        return (a.museum_name || '').localeCompare(b.museum_name || '');
      });
    }

    function sortItemsByDistance(items) {
      if (!userPos || !sortByDistance) return items;
      return [...items].sort((a, b) => {
        const da = walkKm(a.museum_slug) ?? 999;
        const db = walkKm(b.museum_slug) ?? 999;
        return da - db;
      });
    }

    function sortItems(items) {
      if (userPos && sortByDistance) return sortItemsByDistance(items);
      return sortByPopularity(items);
    }

    let lastRenderData = null;

    function onToggleVisited(id, itemType) {
      if (isVisited(id)) {
        toggleVisited(id);
        if (lastRenderData) render(lastRenderData);
        return;
      }
      toggleVisited(id);
      showHeartPrompt(id, itemType);
    }

    function showHeartPrompt(id, itemType) {
      const card = document.querySelector('[data-item-id="' + id + '"]');
      if (!card) { if (lastRenderData) render(lastRenderData); return; }
      const existing = card.querySelector('.heart-prompt');
      if (existing) return;
      const prompt = document.createElement('div');
      prompt.className = 'heart-prompt';
      prompt.innerHTML = '<span class="heart-prompt-text">' + escHtml(T.heartPrompt) + '</span>'
        + '<button class="heart-prompt-btn heart" data-action="like">'
        + '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>'
        + escHtml(T.heartYes) + '</button>'
        + '<button class="heart-prompt-btn" data-action="dismiss">' + escHtml(T.heartDismiss) + '</button>';
      prompt.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'like') {
          submitLike(id, itemType);
        }
        if (lastRenderData) render(lastRenderData);
      });
      card.querySelector('.card-body').appendChild(prompt);
    }

    function getMyLikes() {
      try { return JSON.parse(localStorage.getItem('my_likes') || '{}'); } catch { return {}; }
    }

    function isLikedByMe(id) { return !!getMyLikes()[id]; }

    function submitLike(id, itemType) {
      const likes = getMyLikes();
      likes[id] = true;
      try { localStorage.setItem('my_likes', JSON.stringify(likes)); } catch {}
      if (lastRenderData) {
        const all = [...(lastRenderData.exhibitions || []), ...(lastRenderData.events || [])];
        const item = all.find(i => i.id === id);
        if (item) item.like_count = (item.like_count || 0) + 1;
      }
      fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: itemType, item_id: id }),
      }).catch(() => {});
    }

    function getVisited() {
      try { return JSON.parse(localStorage.getItem('visited') || '[]'); } catch { return []; }
    }
    function isVisited(id) { return getVisited().includes(id); }
    function toggleVisited(id) {
      const v = getVisited();
      const idx = v.indexOf(id);
      if (idx >= 0) v.splice(idx, 1); else v.push(id);
      try { localStorage.setItem('visited', JSON.stringify(v)); } catch {}
    }

    const content = document.getElementById('content');
    const dateLabel = document.getElementById('date-label');
    const btnToday = document.getElementById('btn-today');
    const btnTomorrow = document.getElementById('btn-tomorrow');
    const btnWeekend = document.getElementById('btn-weekend');
    const btnSunday = document.getElementById('btn-sunday');
    const datePicker = document.getElementById('date-picker');
    const allBtns = [btnToday, btnTomorrow, btnWeekend, btnSunday];

    function toIso(d) { return d.toISOString().slice(0, 10); }
    function today() { return new Date(); }
    function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
    function nextDay(dayOfWeek) {
      const d = new Date();
      const current = d.getDay();
      const diff = current <= dayOfWeek ? dayOfWeek - current : 7 - current + dayOfWeek;
      d.setDate(d.getDate() + (diff === 0 ? 0 : diff));
      return d;
    }

    function formatDateFull(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      const weekday = d.toLocaleDateString(DATE_LOCALE, { weekday: 'long' });
      const rest = d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
      return weekday + ', ' + rest;
    }

    function formatDateShort(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });
    }

    function setActive(btn) {
      allBtns.forEach(b => b.classList.remove('active'));
      datePicker.parentElement.classList.remove('active');
      if (btn) btn.classList.add('active');
      else datePicker.parentElement.classList.add('active');
    }

    function updateNavVisibility() {
      const todayDay = today().getDay();
      btnWeekend.style.display = (todayDay === 6) ? 'none' : '';
      btnSunday.style.display = (todayDay === 0) ? 'none' : '';
      datePicker.min = toIso(today());
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 7);
      datePicker.max = toIso(maxDate);
    }

    let loadSeq = 0;

    function pushDateToUrl(date) {
      const url = new URL(location.href);
      if (date === toIso(today())) url.searchParams.delete('date');
      else url.searchParams.set('date', date);
      history.replaceState(null, '', url.toString());
    }

    async function loadDay(date, btn) {
      const seq = ++loadSeq;
      setActive(btn);
      dateLabel.textContent = formatDateFull(date);
      pushDateToUrl(date);
      content.innerHTML = '<div class="loading">' + escHtml(T.loading) + '</div>';
      try {
        const langParam = CURRENT_LANG !== 'de' ? '&lang=' + CURRENT_LANG : '';
        const res = await fetch('/api/day?date=' + date + langParam);
        if (seq !== loadSeq) return;
        const data = await res.json();
        if (seq !== loadSeq) return;
        render(data);
      } catch (e) {
        if (seq !== loadSeq) return;
        content.innerHTML = '<div class="empty">' + escHtml(T.loadError) + '</div>';
      }
    }

    function isSectionOpen(key) {
      try { return localStorage.getItem('section-' + key) !== 'closed'; } catch { return true; }
    }

    function persistSectionState(el) {
      const key = el.dataset.section;
      try { localStorage.setItem('section-' + key, el.open ? 'open' : 'closed'); } catch {}
    }

    function renderSection(key, title, count, iconPath, innerHtml) {
      const open = isSectionOpen(key);
      return '<details class="section" data-section="' + key + '"' + (open ? ' open' : '') + '>'
        + '<summary class="section-header">'
        + '<svg class="section-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="' + iconPath + '" stroke-width="1.5" stroke-linecap="round"/></svg>'
        + '<h2 class="section-title">' + escHtml(title) + '</h2>'
        + '<span class="section-count" aria-label="' + count + ' ' + title + '">' + count + '</span>'
        + '<svg class="section-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '</summary>'
        + innerHtml
        + '</details>';
    }

    function render(data) {
      lastRenderData = data;
      let html = '';

      const sortedEvents = sortItems(data.events).map((e, i) => ({...e, _idx: i}));
      let eventsInner;
      if (sortedEvents.length === 0) {
        eventsInner = '<div class="empty">' + escHtml(T.noEvents) + '</div>';
      } else {
        eventsInner = '<ul class="card-list">';
        for (const ev of sortedEvents) eventsInner += renderEvent(ev);
        eventsInner += '</ul>';
      }
      html += renderSection('events', T.events, data.events.length, 'M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', eventsInner);

      const sortedExhibitions = sortItems(data.exhibitions).map((e, i) => ({...e, _idx: i}));
      const museumsWithExhibitions = new Set(sortedExhibitions.map(ex => ex.museum_slug));
      const museumsWithout = Object.keys(MUSEUMS)
        .filter(slug => !museumsWithExhibitions.has(slug))
        .sort((a, b) => MUSEUMS[a].name.localeCompare(MUSEUMS[b].name));

      let exhInner;
      if (sortedExhibitions.length === 0 && museumsWithout.length === 0) {
        exhInner = '<div class="empty">' + escHtml(T.noExhibitions) + '</div>';
      } else {
        exhInner = '<ul class="card-list">';
        exhInner += renderExhibitionsGrouped(sortedExhibitions);
        for (const slug of museumsWithout) {
          const m = MUSEUMS[slug];
          exhInner += '<li><h3 class="museum-group-header museum-no-exhibition">'
            + museumHeader(m.name, slug)
            + '<span class="museum-permanent">' + escHtml(T.permanentCollection) + '</span>'
            + '</h3></li>';
        }
        exhInner += '</ul>';
      }
      html += renderSection('exhibitions', T.exhibitions, data.exhibitions.length, 'M4 16V4h12v12H4zM7 4v12M13 4v12M4 10h12', exhInner);

      content.innerHTML = html;
      content.querySelectorAll('details.section').forEach(d => {
        d.addEventListener('toggle', () => persistSectionState(d));
      });
      content.classList.remove('fade-in');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { content.classList.add('fade-in'); });
      });
    }


    function renderExhibitionsGrouped(exhibitions) {
      const active = exhibitions.filter(ex => !isVisited(ex.id));
      const visited = exhibitions.filter(ex => isVisited(ex.id));

      let html = renderExhibitionList(active);

      if (visited.length > 0) {
        html += '<li><details class="visited-section"><summary>'
          + '<span aria-hidden="true" class="disclosure-icon"></span>'
          + escHtml(T.alreadyVisited) + ' <span class="section-count">' + visited.length + '</span>'
          + '</summary><ul class="card-list">'
          + renderExhibitionList(visited)
          + '</ul></details></li>';
      }

      return html;
    }

    function museumHeader(name, slug) {
      const info = slug && MUSEUMS[slug];
      const url = info && info.website;
      let html = escHtml(name);
      if (url) html += ' <a class="museum-link" href="' + escHtml(url) + '" target="_blank" rel="noopener" aria-label="' + escAttr(name) + '"><svg viewBox="0 0 16 16" fill="none" width="11" height="11"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
      if (info && info.museumsufer === false) html += ' <span class="not-museumsufer" title="' + escAttr(T.notMuseumsufer) + '"><svg viewBox="0 0 16 16" fill="none" width="12" height="12"><path d="M8 2L2 6v1h12V6L8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 9v4M8 9v4M12 9v4M3 13h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M2 2l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>';
      return html;
    }

    function renderExhibitionList(exhibitions) {
      let html = '';
      let currentMuseum = '';
      for (const ex of exhibitions) {
        const museum = ex.museum_name || '';
        if (museum !== currentMuseum) {
          currentMuseum = museum;
          html += '<li><h3 class="museum-group-header">' + museumHeader(museum, ex.museum_slug) + '</h3></li>';
        }
        html += renderExhibition(ex);
      }
      return html;
    }

    function renderExhibition(ex) {
      const imgTag = ex.image_url
        ? '<img class="card-img" src="' + escHtml(ex.image_url + '?w=120') + '" srcset="' + escHtml(ex.image_url + '?w=120') + ' 120w, ' + escHtml(ex.image_url + '?w=200') + ' 200w" sizes="(max-width: 480px) 56px, 72px" alt="' + escHtml(ex.title) + '"' + (ex._idx > 2 ? ' loading="lazy"' : '') + '>'
        : '<div class="card-img-placeholder" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>';
      const img = ex.detail_url
        ? '<a href="' + escHtml(ex.detail_url) + '" target="_blank" rel="noopener" tabindex="-1">' + imgTag + '</a>'
        : imgTag;
      const dates = [
        ex.start_date ? formatDateShort(ex.start_date) : '',
        ex.end_date ? formatDateShort(ex.end_date) : ''
      ].filter(Boolean).join(' – ');

      const titleHtml = ex.detail_url
        ? '<a href="' + escHtml(ex.detail_url) + '" target="_blank" rel="noopener">' + escHtml(ex.title) + '</a>'
        : escHtml(ex.title);

      let endingTag = '';
      if (ex.end_date) {
        const daysLeft = Math.ceil((new Date(ex.end_date + 'T00:00:00') - new Date(toIso(today()) + 'T00:00:00')) / 86400000);
        const daysUnit = daysLeft === 1 ? T.daysSingular : T.daysPlural;
        if (daysLeft <= 3) endingTag = '<span class="card-ending-soon" title="' + daysLeft + ' ' + escAttr(daysUnit) + '">' + escHtml(T.lastDays) + '</span>';
        else if (daysLeft <= 14) endingTag = '<span class="card-ending-soon" title="' + daysLeft + ' ' + escAttr(daysUnit) + '">' + escHtml(T.endingSoon) + '</span>';
      }

      const desc = ex.description
        ? '<details><summary><span aria-hidden="true" class="disclosure-icon"></span>' + escHtml(T.details) + '</summary><div class="card-desc">' + escHtml(ex.description) + '</div></details>'
        : '';

      const v = isVisited(ex.id);
      const visitedBtn = v
        ? '<button class="card-visited-btn is-visited" aria-pressed="true" aria-label="' + escAttr(T.unmarkVisited) + '" title="' + escAttr(T.unmarkVisited) + '" data-item-type="exhibition" onclick="onToggleVisited(' + ex.id + ',this.dataset.itemType)">'
          + '<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
          + '</button>'
        : '<button class="card-visited-btn" aria-pressed="false" aria-label="' + escAttr(T.markVisited) + '" title="' + escAttr(T.markVisited) + '" data-item-type="exhibition" onclick="onToggleVisited(' + ex.id + ',this.dataset.itemType)">'
          + '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          + '</button>';

      return '<li><article class="card" data-item-id="' + ex.id + '">'
        + img
        + '<div class="card-body">'
        + '<p class="card-title">' + titleHtml + ' ' + translatedBadge(ex) + '</p>'
        + '<div class="card-meta">'
        + (dates ? '<span class="card-dates">' + dates + '</span>' : '')
        + endingTag
        + likeBadge(ex)
        + distanceBadge(ex.museum_slug)
        + navButton(ex.museum_slug)
        + visitedBtn
        + '</div>'
        + desc
        + '</div></article></li>';
    }

    function renderEvent(ev) {
      const imgTag = ev.image_url
        ? '<img class="card-img" src="' + escHtml(ev.image_url + '?w=120') + '" srcset="' + escHtml(ev.image_url + '?w=120') + ' 120w, ' + escHtml(ev.image_url + '?w=200') + ' 200w" sizes="(max-width: 480px) 56px, 72px" alt="' + escHtml(ev.title) + '"' + (ev._idx > 2 ? ' loading="lazy"' : '') + '>'
        : '<div class="card-img-placeholder" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>';
      const imgLink = ev.detail_url || ev.url;
      const img = imgLink
        ? '<a href="' + escHtml(imgLink) + '" target="_blank" rel="noopener" tabindex="-1">' + imgTag + '</a>'
        : imgTag;
      const timeStr = ev.time
        ? (ev.end_time ? ev.time + '–' + ev.end_time : ev.time)
        : '';
      const timeTag = timeStr
        ? '<span class="card-time">' + escHtml(timeStr) + '</span>'
        : '';
      const priceTag = ev.price
        ? '<span class="card-price">' + escHtml(ev.price) + '</span>'
        : '';

      const titleText = escHtml(ev.title);
      const linkUrl = ev.detail_url || ev.url;
      const titleHtml = linkUrl
        ? '<a href="' + escHtml(linkUrl) + '" target="_blank" rel="noopener">' + titleText + '</a>'
        : titleText;

      const calUrl = buildCalendarUrl(ev);
      const calBtn = '<a class="card-ical" href="' + escAttr(calUrl) + '" target="_blank" rel="noopener" '
        + 'aria-label="' + escAttr(T.addToCalendar) + '" title="' + escAttr(T.addToCalendar) + '">'
        + '<svg viewBox="0 0 16 16" fill="none"><path d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 9h2v2H5z" fill="currentColor"/></svg>'
        + '</a>'
        + '<a class="card-ical" href="/api/event/' + ev.id + '.ics" download="event.ics" '
        + 'aria-label="iCal" title="iCal (.ics)">'
        + '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '</a>';

      const meta = [timeTag, priceTag, likeBadge(ev), distanceBadge(ev.museum_slug), navButton(ev.museum_slug), calBtn].filter(Boolean).join(' ');

      const desc = ev.description
        ? '<details><summary><span aria-hidden="true" class="disclosure-icon"></span>' + escHtml(T.details) + '</summary><div class="card-desc">' + escHtml(ev.description) + '</div></details>'
        : '';

      return '<li><article class="card" data-item-id="' + ev.id + '">'
        + img
        + '<div class="card-body">'
        + '<p class="card-title">' + titleHtml + ' ' + translatedBadge(ev) + '</p>'
        + '<p class="card-museum">' + escHtml(ev.museum_name || '') + '</p>'
        + '<div class="card-meta">' + meta + '</div>'
        + desc
        + '</div></article></li>';
    }

    function copyPrompt() {
      const el = document.getElementById('llm-prompt');
      navigator.clipboard.writeText(el.dataset.prompt).then(() => {
        const btn = document.querySelector('.llm-tip-copy');
        const orig = btn.textContent;
        btn.textContent = T.llmCopied;
        setTimeout(() => { btn.textContent = orig; }, 1500);
      });
    }

    function escAttr(s) {
      return escHtml(s).replace(/"/g, '&quot;');
    }

    function escHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    const btnNear = document.getElementById('btn-near');

    btnToday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(today()), btnToday); });
    btnTomorrow.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(tomorrow()), btnTomorrow); });
    btnWeekend.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(6)), btnWeekend); });
    btnSunday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(0)), btnSunday); });
    datePicker.addEventListener('change', (e) => { loadDay(e.target.value, null); });

    btnNear.addEventListener('click', () => {
      if (sortByDistance) {
        sortByDistance = false;
        btnNear.classList.remove('active');
        btnNear.classList.remove('loading');
        btnNear.setAttribute('aria-pressed', 'false');
        btnNear.removeAttribute('aria-busy');
        if (lastRenderData) render(lastRenderData);
        return;
      }
      if (userPos) {
        sortByDistance = true;
        btnNear.classList.add('active');
        btnNear.setAttribute('aria-pressed', 'true');
        if (lastRenderData) render(lastRenderData);
      } else if ('geolocation' in navigator) {
        btnNear.classList.add('loading');
        btnNear.setAttribute('aria-busy', 'true');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            sortByDistance = true;
            btnNear.classList.remove('loading');
            btnNear.removeAttribute('aria-busy');
            btnNear.classList.add('active');
            btnNear.setAttribute('aria-pressed', 'true');
            if (lastRenderData) render(lastRenderData);
          },
          () => {
            btnNear.classList.remove('loading');
            btnNear.removeAttribute('aria-busy');
            btnNear.style.display = 'none';
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      }
    });

    if (!('geolocation' in navigator)) btnNear.style.display = 'none';

    updateNavVisibility();
    const urlDate = new URLSearchParams(location.search).get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) && urlDate !== toIso(today())) {
      loadDay(urlDate, null);
    } else if (__INITIAL_DATA__) {
      dateLabel.textContent = formatDateFull(__INITIAL_DATA__.date);
      render(__INITIAL_DATA__);
    } else {
      loadDay(toIso(today()), btnToday);
    }

    // Search
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchIdx = -1;
    let fuse = null;

    function buildSearchIndex() {
      if (!lastRenderData || typeof Fuse === 'undefined') return;
      const items = [];
      for (const ev of lastRenderData.events) {
        items.push({ type: T.events, title: ev.title, museum: ev.museum_name || '', desc: ev.description || '', url: ev.detail_url || ev.url || null, time: ev.time || '' });
      }
      for (const ex of lastRenderData.exhibitions) {
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
      const m = matches.find(m => m.key === key);
      if (!m || !m.indices.length) return escHtml(text);
      let result = '';
      let last = 0;
      for (const [start, end] of m.indices) {
        result += escHtml(text.slice(last, start));
        result += '<mark>' + escHtml(text.slice(start, end + 1)) + '</mark>';
        last = end + 1;
      }
      result += escHtml(text.slice(last));
      return result;
    }

    function updateSearch() {
      const q = searchInput.value.trim();
      searchIdx = -1;
      let results;

      if (!fuse || q.length === 0) {
        const items = [];
        if (lastRenderData) {
          for (const ev of lastRenderData.events) items.push({ item: { type: T.events, title: ev.title, museum: ev.museum_name || '', desc: ev.description || '', url: ev.detail_url || ev.url || null, time: ev.time || '' }, matches: null });
          for (const ex of lastRenderData.exhibitions) items.push({ item: { type: T.exhibitions, title: ex.title, museum: ex.museum_name || '', desc: ex.description || '', url: ex.detail_url || null, time: '' }, matches: null });
        }
        results = items.slice(0, 15);
      } else {
        results = fuse.search(q).slice(0, 15);
      }

      if (results.length === 0) {
        searchResults.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-tertiary);font-size:0.8125rem">' + escHtml(T.noResults) + '</div>';
        return;
      }

      searchResults.innerHTML = results.map((r, i) => {
        const item = r.item;
        const titleHtml = highlight(item.title, r.matches, 'title');
        const museumHtml = highlight(item.museum, r.matches, 'museum');
        const descSnippet = item.desc && r.matches && r.matches.some(m => m.key === 'desc')
          ? '<div class="search-result-desc">' + highlight(item.desc.slice(0, 120), r.matches, 'desc') + '</div>'
          : '';
        const timeStr = item.time ? '<span class="search-result-time">' + escHtml(item.time) + '</span>' : '';

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

    searchResults.addEventListener('click', (e) => {
      const row = e.target.closest('.search-result');
      if (row && row.dataset.url) {
        window.open(row.dataset.url, '_blank');
        closeSearch();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      const rows = searchResults.querySelectorAll('.search-result');
      if (e.key === 'ArrowDown') { e.preventDefault(); searchIdx = Math.min(searchIdx + 1, rows.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); searchIdx = Math.max(searchIdx - 1, -1); }
      else if (e.key === 'Enter' && searchIdx >= 0 && rows[searchIdx]) {
        const url = rows[searchIdx].dataset.url;
        if (url) { window.open(url, '_blank'); closeSearch(); }
      }
      else if (e.key === 'Escape') { closeSearch(); return; }
      else return;
      rows.forEach((r, i) => r.classList.toggle('active', i === searchIdx));
      searchInput.setAttribute('aria-activedescendant', searchIdx >= 0 ? 'search-opt-' + searchIdx : '');
      if (searchIdx >= 0 && rows[searchIdx]) rows[searchIdx].scrollIntoView({ block: 'nearest' });
    });

    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) closeSearch();
    });
    searchOverlay.addEventListener('cancel', () => {
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.setAttribute('aria-activedescendant', '');
      searchIdx = -1;
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
`;
