export function renderPage(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museumsufer Frankfurt</title>
  <meta name="description" content="Aktuelle Ausstellungen und Veranstaltungen am Frankfurter Museumsufer">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #f5f0eb;
      --surface: #ffffff;
      --text: #1c1917;
      --text-secondary: #78716c;
      --text-tertiary: #a8a29e;
      --accent: #b45309;
      --accent-light: #fef3c7;
      --border: #e7e5e4;
      --border-light: #f5f5f4;
      --radius: 12px;
      --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
      --shadow-lg: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 3rem 1.25rem 4rem;
    }

    header {
      margin-bottom: 2.5rem;
      text-align: center;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .logo-icon {
      width: 28px;
      height: 28px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-icon svg { width: 16px; height: 16px; fill: white; }

    header h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }

    header .subtitle {
      color: var(--text-secondary);
      margin-top: 0.375rem;
      font-size: 0.9375rem;
    }

    .date-label {
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 1.25rem;
    }

    .date-nav {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 2rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .date-nav button {
      padding: 0.5rem 1.125rem;
      border: 1.5px solid var(--border);
      background: var(--surface);
      border-radius: 100px;
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }

    .date-nav button:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .date-nav button.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .date-nav input[type="date"] {
      padding: 0.5rem 0.875rem;
      border: 1.5px solid var(--border);
      border-radius: 100px;
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--text-secondary);
      background: var(--surface);
      cursor: pointer;
    }

    .date-nav input[type="date"]:focus {
      outline: none;
      border-color: var(--accent);
    }

    .section { margin-bottom: 2.5rem; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .section-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .section-title {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-tertiary);
    }

    .section-count {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--text-tertiary);
      background: var(--border-light);
      padding: 0.125rem 0.5rem;
      border-radius: 100px;
    }

    .card-list {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .card {
      display: flex;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--border-light);
      transition: background 0.15s;
    }

    .card:last-child { border-bottom: none; }
    .card:hover { background: #fafaf9; }

    .card-img {
      width: 72px;
      height: 54px;
      object-fit: cover;
      border-radius: 8px;
      flex-shrink: 0;
      background: var(--border-light);
    }

    .card-body {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .card-title {
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.3;
      margin-bottom: 0.125rem;
    }

    .card-title a {
      color: inherit;
      text-decoration: none;
    }

    .card-title a:hover {
      color: var(--accent);
    }

    .card-museum {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.125rem;
    }

    .card-dates {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
    }

    .card-time {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--accent);
      background: var(--accent-light);
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
    }

    .empty {
      color: var(--text-tertiary);
      font-size: 0.875rem;
      padding: 2rem 1rem;
      text-align: center;
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .loading {
      color: var(--text-tertiary);
      padding: 3rem 1rem;
      text-align: center;
      font-size: 0.875rem;
    }

    .loading::after {
      content: '';
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-left: 0.5rem;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .github-corner:hover .octo-arm {
      animation: octocat-wave 560ms ease-in-out;
    }

    @keyframes octocat-wave {
      0%, 100% { transform: rotate(0); }
      20%, 60% { transform: rotate(-25deg); }
      40%, 80% { transform: rotate(10deg); }
    }

    .github-corner svg {
      fill: var(--accent);
      color: var(--bg);
      position: fixed;
      top: 0;
      right: 0;
      border: 0;
      z-index: 100;
    }

    @media (max-width: 480px) {
      .container { padding: 2rem 0.875rem 3rem; }
      header h1 { font-size: 1.625rem; }
      .card-img { width: 56px; height: 42px; }
      .github-corner svg { width: 60px; height: 60px; }
    }
  </style>
</head>
<body>
  <a href="https://github.com/boredland/museumsufer" class="github-corner" aria-label="View source on GitHub" target="_blank" rel="noopener"><svg width="72" height="72" viewBox="0 0 250 250" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin:130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg></a>

  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v2h20V7L12 2zm0 2.26L18.47 7H5.53L12 4.26zM2 19v2h20v-2H2zm2-8v8h2v-8H6zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg>
        </div>
      </div>
      <h1>Museumsufer Frankfurt</h1>
      <p class="subtitle">Ausstellungen &amp; Veranstaltungen</p>
    </header>

    <nav class="date-nav">
      <button id="btn-today" class="active">Heute</button>
      <button id="btn-tomorrow">Morgen</button>
      <button id="btn-weekend">Sa</button>
      <button id="btn-sunday">So</button>
      <input type="date" id="date-picker">
    </nav>

    <p class="date-label" id="date-label"></p>

    <div id="content">
      <div class="loading">Laden</div>
    </div>
  </div>

  <script>
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
      const weekday = d.toLocaleDateString('de-DE', { weekday: 'long' });
      const rest = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
      return weekday + ', ' + rest;
    }

    function formatDateShort(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    }

    function setActive(btn) {
      allBtns.forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    async function loadDay(date, btn) {
      setActive(btn);
      dateLabel.textContent = formatDateFull(date);
      content.innerHTML = '<div class="loading">Laden</div>';
      try {
        const res = await fetch('/api/day?date=' + date);
        const data = await res.json();
        render(data);
      } catch (e) {
        content.innerHTML = '<div class="empty">Fehler beim Laden.</div>';
      }
    }

    function render(data) {
      let html = '';

      if (data.events.length > 0) {
        html += '<div class="section">';
        html += '<div class="section-header">'
          + '<svg class="section-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="' + 'var(--text-tertiary)' + '" stroke-width="1.5" stroke-linecap="round"/></svg>'
          + '<h2 class="section-title">Veranstaltungen</h2>'
          + '<span class="section-count">' + data.events.length + '</span>'
          + '</div>';
        html += '<div class="card-list">';
        for (const ev of data.events) {
          html += renderEvent(ev);
        }
        html += '</div></div>';
      }

      html += '<div class="section">';
      html += '<div class="section-header">'
        + '<svg class="section-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 16V4h12v12H4zM7 4v12M13 4v12M4 10h12" stroke="' + 'var(--text-tertiary)' + '" stroke-width="1.5" stroke-linecap="round"/></svg>'
        + '<h2 class="section-title">Ausstellungen</h2>'
        + '<span class="section-count">' + data.exhibitions.length + '</span>'
        + '</div>';
      if (data.exhibitions.length === 0) {
        html += '<div class="empty">Keine Ausstellungen gefunden.</div>';
      } else {
        html += '<div class="card-list">';
        for (const ex of data.exhibitions) {
          html += renderExhibition(ex);
        }
        html += '</div>';
      }
      html += '</div>';

      content.innerHTML = html;
    }

    function renderExhibition(ex) {
      const img = ex.image_url
        ? '<img class="card-img" src="' + escHtml(ex.image_url) + '" alt="" loading="lazy">'
        : '';
      const dates = [
        ex.start_date ? formatDateShort(ex.start_date) : '',
        ex.end_date ? formatDateShort(ex.end_date) : ''
      ].filter(Boolean).join(' – ');

      const titleHtml = ex.detail_url
        ? '<a href="' + escHtml(ex.detail_url) + '" target="_blank" rel="noopener">' + escHtml(ex.title) + '</a>'
        : escHtml(ex.title);

      return '<div class="card">'
        + img
        + '<div class="card-body">'
        + '<div class="card-title">' + titleHtml + '</div>'
        + '<div class="card-museum">' + escHtml(ex.museum_name || '') + '</div>'
        + (dates ? '<div class="card-meta"><span class="card-dates">' + dates + '</span></div>' : '')
        + '</div></div>';
    }

    function renderEvent(ev) {
      const timeTag = ev.time
        ? '<span class="card-time">' + escHtml(ev.time) + '</span>'
        : '';

      return '<div class="card">'
        + '<div class="card-body">'
        + '<div class="card-title">' + escHtml(ev.title) + '</div>'
        + '<div class="card-museum">' + escHtml(ev.museum_name || '') + '</div>'
        + (timeTag ? '<div class="card-meta">' + timeTag + '</div>' : '')
        + '</div></div>';
    }

    function escHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    btnToday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(today()), btnToday); });
    btnTomorrow.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(tomorrow()), btnTomorrow); });
    btnWeekend.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(6)), btnWeekend); });
    btnSunday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(0)), btnSunday); });
    datePicker.addEventListener('change', (e) => { loadDay(e.target.value, null); });

    loadDay(toIso(today()), btnToday);
  </script>
</body>
</html>`;
}
