import { type Locale, SUPPORTED_LOCALES, getTranslations, dateLocale } from "./i18n";

export interface InitialData {
  date: string;
  exhibitions: unknown[];
  events: unknown[];
}

export function renderPage(locale: Locale, initialData?: InitialData): string {
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);
  const initialDataJson = initialData ? JSON.stringify(initialData) : "null";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museumsufer Frankfurt</title>
  <meta name="description" content="${escHtml(tr.meta)}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>">
  <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>">
  <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#f5f0eb">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap" rel="stylesheet">
  <style>
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
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      background: var(--accent);
      color: white;
      padding: 0.5rem 1rem;
      z-index: 200;
      border-radius: 0 0 var(--radius) 0;
      font-size: 0.875rem;
    }

    .skip-link:focus { left: 0; }

    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 3rem 1rem 4rem;
    }

    header {
      margin-bottom: 2rem;
      text-align: center;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: var(--accent);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-icon svg { width: 18px; height: 18px; fill: white; }

    header h1 {
      font-size: 1.875rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }

    header .subtitle {
      color: var(--text-secondary);
      margin-top: 0.25rem;
      font-size: 0.875rem;
      letter-spacing: 0.01em;
    }

    .lang-switch {
      display: flex;
      justify-content: center;
      gap: 0.25rem;
      margin-top: 0.75rem;
    }

    .lang-switch a {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-tertiary);
      text-decoration: none;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      transition: color 0.15s;
    }

    .lang-switch a:hover { color: var(--accent); }
    .lang-switch a.active { color: var(--text); font-weight: 700; }
    .lang-switch a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .date-label {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 1.5rem;
      text-align: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    .date-nav {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 1.5rem;
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
      transition: border-color 0.2s, background 0.2s, color 0.2s;
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

    .date-nav button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .date-picker-label {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 0.875rem;
      border: 1.5px solid var(--border);
      background: var(--surface);
      border-radius: 100px;
      cursor: pointer;
      color: var(--text-secondary);
      transition: border-color 0.2s, background 0.2s, color 0.2s;
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      position: relative;
    }

    .date-picker-label:hover { border-color: var(--accent); color: var(--accent); }

    .date-picker-label input {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      cursor: pointer;
      -webkit-appearance: none;
    }

    .date-picker-label.active {
      border-color: var(--accent);
      background: var(--accent-light);
      color: var(--accent);
    }

    .date-picker-label:focus-within {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    #content { min-height: 60vh; }

    .fade-in { animation: fadeIn 0.25s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

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

    .section-icon path { stroke: var(--text-tertiary); }

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

    .museum-group-header {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      padding: 0.625rem 1rem 0.375rem;
      border-bottom: 1px solid var(--border-light);
      border-left: 3px solid var(--accent);
      background: var(--border-light);
    }

    .museum-group-header:first-child { border-top: none; }

    .card {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--border-light);
      transition: background 0.2s ease;
    }

    .card:last-child { border-bottom: none; }
    .card:hover { background: #fdf8f0; }

    .card-img {
      width: 72px;
      height: 54px;
      object-fit: cover;
      border-radius: 8px;
      flex-shrink: 0;
      background: var(--border-light);
    }

    .card-img-placeholder {
      width: 72px;
      height: 54px;
      border-radius: 8px;
      flex-shrink: 0;
      background: var(--border-light);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--border);
    }

    .card-body {
      min-width: 0;
      display: flex;
      flex-direction: column;
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
      display: block;
    }

    .card-title a:hover { color: var(--accent); }
    .card-title a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }

    .card-museum {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.125rem;
      flex-wrap: wrap;
    }

    .card-ending-soon {
      font-size: 0.6875rem;
      font-weight: 500;
      color: #b91c1c;
      background: #fef2f2;
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
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

    .card-price {
      font-size: 0.6875rem;
      font-weight: 500;
      color: #166534;
      background: #dcfce7;
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
    }

    .card-ical {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--text-tertiary);
      background: none;
      border: 1px solid var(--border);
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s;
      text-decoration: none;
    }

    .card-ical:hover { border-color: var(--accent); color: var(--accent); }
    .card-ical:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .card-ical svg { width: 12px; height: 12px; flex-shrink: 0; }

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

    .github-corner:hover .octo-arm { animation: octocat-wave 560ms ease-in-out; }

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

    .github-corner:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }

    .card-desc {
      font-size: 0.75rem;
      line-height: 1.5;
      color: var(--text-secondary);
      margin-top: 0.375rem;
      padding-top: 0.375rem;
      border-top: 1px solid var(--border-light);
    }

    .card details summary {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      cursor: pointer;
      list-style: none;
      margin-top: 0.25rem;
    }

    .card details summary::-webkit-details-marker { display: none; }
    .card details summary::before { content: '+ '; }
    .card details[open] summary::before { content: '- '; }
    .card details summary:hover { color: var(--accent); }

    .site-footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.75rem;
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .site-footer a {
      color: var(--text-tertiary);
      text-decoration: none;
    }

    .site-footer a:hover { color: var(--accent); text-decoration: underline; }

    .llm-tip {
      margin-bottom: 1.5rem;
      padding: 0.625rem 1rem;
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .llm-tip summary {
      cursor: pointer;
      font-weight: 500;
      color: var(--text-tertiary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .llm-tip summary::-webkit-details-marker { display: none; }

    .llm-tip summary svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .llm-tip[open] summary { margin-bottom: 0.75rem; }

    .llm-tip-prompt {
      position: relative;
      background: var(--border-light);
      border-radius: 8px;
      padding: 0.75rem;
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .llm-tip-copy {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.25rem 0.5rem;
      font-size: 0.6875rem;
      font-family: inherit;
      cursor: pointer;
      color: var(--text-secondary);
      transition: border-color 0.15s, color 0.15s;
    }

    .llm-tip-copy:hover { border-color: var(--accent); color: var(--accent); }

    @media (prefers-reduced-motion: reduce) {
      .loading::after, .octo-arm, .fade-in { animation: none !important; }
    }

    @media (max-width: 480px) {
      .container { padding: 2rem 1rem 3rem; }
      header h1 { font-size: 1.625rem; }
      .card-img, .card-img-placeholder { width: 56px; height: 42px; }
      .github-corner svg { width: 60px; height: 60px; }
      .date-label { font-size: 1.0625rem; }
    }
  </style>
</head>
<body>
  <a href="#content" class="skip-link">${escHtml(tr.skipLink)}</a>

  <a href="https://github.com/boredland/museumsufer" class="github-corner" aria-label="${escHtml(tr.githubAria)}" target="_blank" rel="noopener"><svg width="72" height="72" viewBox="0 0 250 250" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin:130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg></a>

  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v2h20V7L12 2zm0 2.26L18.47 7H5.53L12 4.26zM2 19v2h20v-2H2zm2-8v8h2v-8H6zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg>
        </div>
      </div>
      <h1>Museumsufer Frankfurt</h1>
      <p class="subtitle">${escHtml(tr.subtitle)}</p>
      <div class="lang-switch" role="navigation" aria-label="Language">${SUPPORTED_LOCALES.map(
        (l) => `<a href="?lang=${l}" ${l === locale ? 'class="active" aria-current="true"' : ""}>${l.toUpperCase()}</a>`
      ).join("")}</div>
    </header>

    <details class="llm-tip">
      <summary>
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${escHtml(tr.llmTip)}
      </summary>
      <div class="llm-tip-prompt" id="llm-prompt" data-prompt="${escHtml(tr.llmPrompt)}">${escHtml(tr.llmPrompt)}<button class="llm-tip-copy" onclick="copyPrompt()">Copy</button></div>
    </details>

    <nav class="date-nav" aria-label="${escHtml(tr.dateNav)}">
      <button id="btn-today" class="active">${escHtml(tr.today)}</button>
      <button id="btn-tomorrow">${escHtml(tr.tomorrow)}</button>
      <button id="btn-weekend">${escHtml(tr.saturday)}</button>
      <button id="btn-sunday">${escHtml(tr.sunday)}</button>
      <label class="date-picker-label" aria-label="${escHtml(tr.pickDate)}">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input type="date" id="date-picker" min="" max="">
      </label>
    </nav>

    <p class="date-label" id="date-label" aria-live="polite"></p>

    <main id="content">
      ${initialData ? "" : `<div class="loading">${escHtml(tr.loading)}</div>`}
    </main>

    <footer class="site-footer">
      <a href="/feed.ics">${escHtml(tr.subscribeCal)}</a>
      <a href="/feed.xml">${escHtml(tr.rssFeed)}</a>
      <a href="https://github.com/boredland/museumsufer/issues/new?template=missing-event.yml" target="_blank" rel="noopener">${escHtml(tr.missingEvent)}</a>
    </footer>
  </div>

  <script>
    const T = ${trJson};
    const DATE_LOCALE = ${dlJson};
    const LOCALES = ${localesJson};
    const CURRENT_LANG = '${locale}';
    const __INITIAL_DATA__ = ${initialDataJson};

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

    async function loadDay(date, btn) {
      setActive(btn);
      dateLabel.textContent = formatDateFull(date);
      content.innerHTML = '<div class="loading">' + escHtml(T.loading) + '</div>';
      try {
        const res = await fetch('/api/day?date=' + date);
        const data = await res.json();
        render(data);
      } catch (e) {
        content.innerHTML = '<div class="empty">' + escHtml(T.loadError) + '</div>';
      }
    }

    function render(data) {
      let html = '';

      html += '<div class="section">';
      html += sectionHeader(T.events, data.events.length, 'M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z');
      if (data.events.length === 0) {
        html += '<div class="empty">' + escHtml(T.noEvents) + '</div>';
      } else {
        html += '<div class="card-list">';
        for (const ev of data.events) {
          html += renderEvent(ev);
        }
        html += '</div>';
      }
      html += '</div>';

      html += '<div class="section">';
      html += sectionHeader(T.exhibitions, data.exhibitions.length, 'M4 16V4h12v12H4zM7 4v12M13 4v12M4 10h12');
      if (data.exhibitions.length === 0) {
        html += '<div class="empty">' + escHtml(T.noExhibitions) + '</div>';
      } else {
        html += '<div class="card-list">';
        html += renderExhibitionsGrouped(data.exhibitions);
        html += '</div>';
      }
      html += '</div>';

      content.innerHTML = html;
      content.classList.remove('fade-in');
      void content.offsetWidth;
      content.classList.add('fade-in');
    }

    function sectionHeader(title, count, iconPath) {
      return '<div class="section-header">'
        + '<svg class="section-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="' + iconPath + '" stroke-width="1.5" stroke-linecap="round"/></svg>'
        + '<h2 class="section-title">' + escHtml(title) + '</h2>'
        + '<span class="section-count">' + count + '</span>'
        + '</div>';
    }

    function renderExhibitionsGrouped(exhibitions) {
      let html = '';
      let currentMuseum = '';
      for (const ex of exhibitions) {
        const museum = ex.museum_name || '';
        if (museum !== currentMuseum) {
          currentMuseum = museum;
          html += '<div class="museum-group-header">' + escHtml(museum) + '</div>';
        }
        html += renderExhibition(ex);
      }
      return html;
    }

    function renderExhibition(ex) {
      const img = ex.image_url
        ? '<img class="card-img" src="' + escHtml(ex.image_url) + '" alt="' + escHtml(ex.title) + '" loading="lazy">'
        : '<div class="card-img-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>';
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
        if (daysLeft <= 3) endingTag = '<span class="card-ending-soon">' + escHtml(T.lastDays) + '</span>';
        else if (daysLeft <= 14) endingTag = '<span class="card-ending-soon">' + escHtml(T.endingSoon) + '</span>';
      }

      const desc = ex.description
        ? '<details><summary>Details</summary><div class="card-desc">' + escHtml(ex.description) + '</div></details>'
        : '';

      return '<div class="card">'
        + img
        + '<div class="card-body">'
        + '<div class="card-title">' + titleHtml + '</div>'
        + '<div class="card-meta">'
        + (dates ? '<span class="card-dates">' + dates + '</span>' : '')
        + endingTag
        + '</div>'
        + desc
        + '</div></div>';
    }

    function renderEvent(ev) {
      const img = ev.image_url
        ? '<img class="card-img" src="' + escHtml(ev.image_url) + '" alt="' + escHtml(ev.title) + '" loading="lazy">'
        : '';
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

      const calBtn = '<a class="card-ical" href="/api/event/' + ev.id + '.ics" '
        + 'aria-label="' + escAttr(T.calendarAria) + '">'
        + '<svg viewBox="0 0 16 16" fill="none"><path d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 9h2v2H5z" fill="currentColor"/></svg>'
        + escHtml(T.calendar) + '</a>';

      const meta = [timeTag, priceTag, calBtn].filter(Boolean).join(' ');

      const desc = ev.description
        ? '<details><summary>Details</summary><div class="card-desc">' + escHtml(ev.description) + '</div></details>'
        : '';

      return '<div class="card">'
        + img
        + '<div class="card-body">'
        + '<div class="card-title">' + titleHtml + '</div>'
        + '<div class="card-museum">' + escHtml(ev.museum_name || '') + '</div>'
        + '<div class="card-meta">' + meta + '</div>'
        + desc
        + '</div></div>';
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

    btnToday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(today()), btnToday); });
    btnTomorrow.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(tomorrow()), btnTomorrow); });
    btnWeekend.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(6)), btnWeekend); });
    btnSunday.addEventListener('click', () => { datePicker.value = ''; loadDay(toIso(nextDay(0)), btnSunday); });
    datePicker.addEventListener('change', (e) => { loadDay(e.target.value, null); });

    updateNavVisibility();
    if (__INITIAL_DATA__) {
      dateLabel.textContent = formatDateFull(__INITIAL_DATA__.date);
      render(__INITIAL_DATA__);
    } else {
      loadDay(toIso(today()), btnToday);
    }
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
