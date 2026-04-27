export const PAGE_STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #f5f0eb;
      --surface: #ffffff;
      --text: #1c1917;
      --text-secondary: #6b6560;
      --text-tertiary: #706a68;
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
      margin-bottom: 1rem;
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

    #btn-near {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      min-height: 36px;
      padding: 0.5rem;
    }

    .date-nav button.loading {
      pointer-events: none;
      opacity: 0.6;
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

    details.section { margin-bottom: 2.5rem; }
    details.section > summary { list-style: none; }
    details.section > summary::-webkit-details-marker { display: none; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      cursor: pointer;
      user-select: none;
    }

    .section-header:hover .section-title { color: var(--text-secondary); }

    .section-chevron {
      margin-left: auto;
      color: var(--text-tertiary);
      transition: transform 0.2s;
      flex-shrink: 0;
    }

    details.section[open] > .section-header .section-chevron { transform: rotate(180deg); }

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
      list-style: none;
      padding: 0;
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
      margin: 0;
    }

    .museum-group-header:first-child { border-top: none; }
    .museum-link { color: var(--text-tertiary); margin-left: 0.25rem; }
    .museum-link:hover { color: var(--accent); }
    .museum-link svg, .not-museumsufer svg { vertical-align: -1px; }
    .not-museumsufer { color: var(--text-tertiary); margin-left: 0.25rem; opacity: 0.6; }
    .museum-no-exhibition { display: flex; align-items: center; gap: 0.5rem; opacity: 0.7; border-left-color: var(--border-light); }
    .museum-permanent { margin-left: auto; flex-shrink: 0; font-weight: 400; font-size: 0.625rem; letter-spacing: 0; text-transform: none; color: var(--text-tertiary); }

    .card {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--border-light);
      transition: background 0.2s ease;
    }

    li:last-child > .card { border-bottom: none; }
    .card:hover { background: #fdf8f0; }

    .card-img {
      width: 72px;
      height: 54px;
      object-fit: cover;
      border-radius: 8px;
      flex-shrink: 0;
      background: var(--border-light);
      overflow: hidden;
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

    .card-visited-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      min-height: 28px;
      color: var(--text-tertiary);
      background: none;
      border: 1px solid var(--border);
      padding: 0;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .card-visited-btn:hover { border-color: var(--accent); color: var(--accent); }
    .card-visited-btn.is-visited { color: #166534; background: #dcfce7; border-color: #dcfce7; }
    .card-visited-btn svg { width: 12px; height: 12px; }

    .heart-prompt {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.75rem;
      background: var(--accent-light);
      border-radius: 8px;
      margin-top: 0.375rem;
      animation: fadeIn 0.2s ease-out;
    }

    .heart-prompt-text {
      font-size: 0.75rem;
      color: var(--text-secondary);
      flex: 1;
    }

    .heart-prompt-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 100px;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--text-secondary);
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .heart-prompt-btn:hover { border-color: var(--accent); color: var(--accent); }
    .heart-prompt-btn.heart { color: #dc2626; border-color: #fecaca; }
    .heart-prompt-btn.heart:hover { background: #fef2f2; border-color: #dc2626; }
    .heart-prompt-btn svg { width: 12px; height: 12px; }

    .card-likes {
      font-size: 0.6875rem;
      font-weight: 500;
      color: #dc2626;
      background: #fef2f2;
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 0.1875rem;
    }

    .card-likes svg { width: 10px; height: 10px; flex-shrink: 0; }

    .visited-section {
      margin-top: 1rem;
    }

    .visited-section summary {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .visited-section summary::-webkit-details-marker { display: none; }
    .disclosure-icon::before { content: '+'; font-family: monospace; margin-right: 0.25rem; }
    [open] > summary .disclosure-icon::before { content: '-'; }

    .visited-section .card { opacity: 0.6; }
    .visited-section .card:hover { opacity: 1; }

    .card-distance {
      font-size: 0.6875rem;
      font-weight: 500;
      color: #1e40af;
      background: #dbeafe;
      padding: 0.0625rem 0.375rem;
      border-radius: 4px;
      white-space: nowrap;
    }

    .card-translated {
      font-size: 0.5625rem;
      color: var(--text-tertiary);
      display: inline-flex;
      align-items: center;
      gap: 0.1875rem;
    }

    .card-translated svg { width: 10px; height: 10px; }

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
      line-height: 28px;
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
    .card-ical { min-width: 28px; min-height: 28px; justify-content: center; }

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
    .card details summary:hover { color: var(--accent); }

    .pass-promo {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .pass-promo-text {
      flex: 1;
      min-width: 0;
    }

    .pass-promo-links {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
    }

    .pass-promo-links a {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      text-decoration: none;
      white-space: nowrap;
      border: 1px solid var(--border);
      color: var(--text);
      transition: border-color 0.15s, color 0.15s;
    }

    .pass-promo-links a:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    @media (max-width: 480px) {
      .pass-promo { flex-direction: column; align-items: stretch; gap: 0.375rem; }
      .pass-promo-links { justify-content: stretch; }
      .pass-promo-links a { flex: 1; text-align: center; }
    }

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

    .why-section {
      margin-top: 1rem;
      padding: 0.625rem 1rem;
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .why-section summary {
      cursor: pointer;
      font-weight: 500;
      color: var(--text-tertiary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      list-style: none;
    }

    .why-section summary::-webkit-details-marker { display: none; }
    .why-section p { margin-top: 0.5rem; line-height: 1.5; }

    .llm-tip {
      margin-top: 1rem;
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

    .search-trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.875rem;
      margin-bottom: 0.75rem;
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: 100px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      transition: border-color 0.2s;
    }

    .search-trigger:hover { border-color: var(--accent); }
    .search-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .search-trigger span { flex: 1; text-align: left; }

    .search-overlay {
      border: none;
      background: transparent;
      padding: 0;
      max-width: 100vw;
      max-height: 100vh;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .search-overlay::backdrop { background: rgba(0,0,0,0.4); }

    .search-overlay[open] {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
    }

    .search-box {
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      width: 90%;
      max-width: 520px;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .search-input-wrap {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .search-input-wrap svg { width: 18px; height: 18px; color: var(--text-tertiary); flex-shrink: 0; }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 0.9375rem;
      font-family: inherit;
      color: var(--text);
      background: transparent;
    }

    .search-input::placeholder { color: var(--text-tertiary); }

    .search-kbd {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.125rem 0.375rem;
      font-family: ui-monospace, monospace;
    }

    .search-results {
      overflow-y: auto;
      padding: 0.5rem 0;
    }

    .search-result {
      display: flex;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
      align-items: center;
      transition: background 0.1s;
    }

    .search-result:hover, .search-result.active { background: var(--accent-light); }

    .search-result-type {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
      width: 3rem;
      flex-shrink: 0;
    }

    .search-result-body { min-width: 0; }

    .search-result-title {
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-result-museum {
      font-size: 0.6875rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-result-desc {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      margin-top: 0.125rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .search-result-time {
      font-size: 0.625rem;
      font-weight: 500;
      color: var(--accent);
      background: var(--accent-light);
      padding: 0 0.25rem;
      border-radius: 3px;
      vertical-align: middle;
    }

    .search-result mark {
      background: var(--accent-light);
      color: var(--accent);
      border-radius: 2px;
      padding: 0 1px;
    }

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
`;
