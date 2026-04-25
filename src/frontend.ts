export function renderPage(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museumsufer Frankfurt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fafaf8;
      color: #1a1a1a;
      line-height: 1.5;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    header {
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    header p {
      color: #666;
      margin-top: 0.25rem;
    }

    .date-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .date-nav button {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s;
    }

    .date-nav button:hover { border-color: #999; }
    .date-nav button.active { background: #1a1a1a; color: white; border-color: #1a1a1a; }

    .date-nav input[type="date"] {
      padding: 0.45rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.875rem;
      font-family: inherit;
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #999;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #eee;
    }

    .section { margin-bottom: 2.5rem; }

    .card {
      display: flex;
      gap: 1rem;
      padding: 0.875rem 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .card:last-child { border-bottom: none; }

    .card-img {
      width: 80px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
      flex-shrink: 0;
      background: #eee;
    }

    .card-body { min-width: 0; }

    .card-title {
      font-size: 0.9375rem;
      font-weight: 600;
      margin-bottom: 0.125rem;
    }

    .card-title a {
      color: inherit;
      text-decoration: none;
    }

    .card-title a:hover { text-decoration: underline; }

    .card-museum {
      font-size: 0.8125rem;
      color: #666;
    }

    .card-dates {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.125rem;
    }

    .empty {
      color: #999;
      font-style: italic;
      padding: 1rem 0;
    }

    .loading {
      color: #999;
      padding: 1rem 0;
    }

    .count {
      font-weight: 400;
      color: #999;
      font-size: 0.75rem;
    }

    @media (max-width: 480px) {
      .card-img { width: 60px; height: 45px; }
      .container { padding: 1.5rem 0.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Museumsufer Frankfurt</h1>
      <p>Ausstellungen &amp; Veranstaltungen</p>
    </header>

    <nav class="date-nav">
      <button id="btn-today" class="active">Heute</button>
      <button id="btn-tomorrow">Morgen</button>
      <button id="btn-weekend">Wochenende</button>
      <input type="date" id="date-picker">
    </nav>

    <div id="content">
      <div class="loading">Laden&hellip;</div>
    </div>
  </div>

  <script>
    const content = document.getElementById('content');
    const btnToday = document.getElementById('btn-today');
    const btnTomorrow = document.getElementById('btn-tomorrow');
    const btnWeekend = document.getElementById('btn-weekend');
    const datePicker = document.getElementById('date-picker');

    function toIso(d) { return d.toISOString().slice(0, 10); }
    function today() { return new Date(); }
    function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
    function nextSaturday() {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 6 ? 0 : (6 - day);
      d.setDate(d.getDate() + diff);
      return d;
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatDateShort(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    }

    function setActive(btn) {
      [btnToday, btnTomorrow, btnWeekend].forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    async function loadDay(date, label) {
      content.innerHTML = '<div class="loading">Laden&hellip;</div>';
      try {
        const res = await fetch('/api/day?date=' + date);
        const data = await res.json();
        render(data, label);
      } catch (e) {
        content.innerHTML = '<div class="empty">Fehler beim Laden.</div>';
      }
    }

    function render(data, label) {
      let html = '';

      html += '<div class="section">';
      html += '<h2 class="section-title">Ausstellungen <span class="count">(' + data.exhibitions.length + ')</span></h2>';
      if (data.exhibitions.length === 0) {
        html += '<p class="empty">Keine Ausstellungen gefunden.</p>';
      } else {
        for (const ex of data.exhibitions) {
          html += renderExhibition(ex);
        }
      }
      html += '</div>';

      html += '<div class="section">';
      html += '<h2 class="section-title">Veranstaltungen <span class="count">(' + data.events.length + ')</span></h2>';
      if (data.events.length === 0) {
        html += '<p class="empty">Keine Veranstaltungen gefunden.</p>';
      } else {
        for (const ev of data.events) {
          html += renderEvent(ev);
        }
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
        + (dates ? '<div class="card-dates">' + dates + '</div>' : '')
        + '</div></div>';
    }

    function renderEvent(ev) {
      const timeStr = ev.time ? ev.time + ' · ' : '';
      return '<div class="card">'
        + '<div class="card-body">'
        + '<div class="card-title">' + escHtml(ev.title) + '</div>'
        + '<div class="card-museum">' + escHtml(timeStr) + escHtml(ev.museum_name || '') + '</div>'
        + '</div></div>';
    }

    function escHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    btnToday.addEventListener('click', () => { setActive(btnToday); datePicker.value = ''; loadDay(toIso(today()), 'Heute'); });
    btnTomorrow.addEventListener('click', () => { setActive(btnTomorrow); datePicker.value = ''; loadDay(toIso(tomorrow()), 'Morgen'); });
    btnWeekend.addEventListener('click', () => { setActive(btnWeekend); datePicker.value = ''; loadDay(toIso(nextSaturday()), 'Wochenende'); });
    datePicker.addEventListener('change', (e) => { setActive(null); loadDay(e.target.value, formatDate(e.target.value)); });

    loadDay(toIso(today()), 'Heute');
  </script>
</body>
</html>`;
}
