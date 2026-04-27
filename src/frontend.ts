import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";
import { getMuseumLocations } from "./museum-config";
import { escHtml as escHtmlShared } from "./shared";
import type { MuseumInfo } from "./types";

export type { MuseumInfo };

const MUSEUM_LOCATIONS = getMuseumLocations();

export interface InitialData {
  date: string;
  exhibitions: unknown[];
  events: unknown[];
}

export function renderPage(locale: Locale, initialData?: InitialData, museums?: Record<string, MuseumInfo>): string {
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);
  const initialDataJson = initialData ? JSON.stringify(initialData) : "null";
  const geoJson = JSON.stringify(MUSEUM_LOCATIONS);
  const museumsJson = JSON.stringify(museums || {});
  const berlinOffset = getBerlinUtcOffset();
  const eventSchemaJson = initialData ? buildEventSchema(initialData, berlinOffset) : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(tr.pageTitle)}</title>
  <meta name="description" content="${escHtml(tr.metaLong)}">
  <link rel="canonical" href="https://museumsufer.app/">
  <link rel="alternate" hreflang="de" href="https://museumsufer.app/?lang=de">
  <link rel="alternate" hreflang="en" href="https://museumsufer.app/?lang=en">
  <link rel="alternate" hreflang="fr" href="https://museumsufer.app/?lang=fr">
  <link rel="alternate" hreflang="x-default" href="https://museumsufer.app/">
  <meta property="og:title" content="${escHtml(tr.pageTitle)}">
  <meta property="og:description" content="${escHtml(tr.metaLong)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://museumsufer.app/">
  <meta property="og:locale" content="${locale}">
  <meta property="og:site_name" content="Museumsufer Frankfurt">
  <meta property="og:image" content="https://museumsufer.app/og-image.svg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(tr.pageTitle)}">
  <meta name="twitter:description" content="${escHtml(tr.metaLong)}">
  <meta name="twitter:image" content="https://museumsufer.app/og-image.svg">
  <link rel="icon" href="/icon-192.png" type="image/png">
  <link rel="apple-touch-icon" href="/icon-192.png">
  <link rel="alternate" type="application/rss+xml" title="Museumsufer Frankfurt" href="/feed.xml">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#f5f0eb">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Museumsufer Frankfurt","url":"https://museumsufer.app/","description":"${escHtml(tr.metaLong)}","inLanguage":["de","en","fr"]}</script>
  ${eventSchemaJson}
  <script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js" defer></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <style>
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

    .card:last-child { border-bottom: none; }
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
    .visited-section summary::before { content: '+ '; font-family: monospace; }
    .visited-section[open] summary::before { content: '- '; }

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
    .card details summary::before { content: '+ '; }
    .card details[open] summary::before { content: '- '; }
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
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 200;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
    }

    .search-overlay.open { display: flex; }

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
        (l) =>
          `<a href="?lang=${l}" ${l === locale ? 'class="active" aria-current="page"' : ""}>${l.toUpperCase()}</a>`,
      ).join("")}</div>
    </header>

    <button class="search-trigger" id="search-trigger" onclick="openSearch()">
      <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>${escHtml(tr.searchPlaceholder)}</span>
      <kbd class="search-kbd">Ctrl K</kbd>
    </button>

    <div class="pass-promo">
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true"><path d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/><path d="M14.5 9.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span class="pass-promo-text">${escHtml(tr.passPromo)}</span>
      <span class="pass-promo-links">
        <a href="https://www.museumsufer.de/${{ de: "de/eintritt-und-tickets/dauerkarten/museumsufercard/", en: "en/admission-tickets/season-tickets/museumsufercard/", fr: "fr/tickets/tickets-permanentes/museumsufercard/" }[locale]}?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=card" target="_blank" rel="noopener">${escHtml(tr.passCard)}</a>
        <a href="https://www.museumsufer.de/${{ de: "de/eintritt-und-tickets/dauerkarten/museumsuferticket/", en: "en/admission-tickets/season-tickets/museumsuferticket/", fr: "fr/tickets/tickets-permanentes/museumsufer-ticket/" }[locale]}?utm_source=museumsufer.app&utm_medium=referral&utm_campaign=pass_promo&utm_content=ticket" target="_blank" rel="noopener">${escHtml(tr.passTicket)}</a>
      </span>
    </div>

    <nav class="date-nav" aria-label="${escHtml(tr.dateNav)}">
      <button id="btn-today" class="active">${escHtml(tr.today)}</button>
      <button id="btn-tomorrow">${escHtml(tr.tomorrow)}</button>
      <button id="btn-weekend">${escHtml(tr.saturday)}</button>
      <button id="btn-sunday">${escHtml(tr.sunday)}</button>
      <label class="date-picker-label" aria-label="${escHtml(tr.pickDate)}">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input type="date" id="date-picker" aria-label="${escHtml(tr.pickDate)}" min="" max="">
      </label>
      <button id="btn-near" aria-pressed="false">${escHtml(tr.nearMe)}</button>
    </nav>

    <p class="date-label" id="date-label" aria-live="polite"></p>

    <main id="content">
      ${initialData ? "" : `<div class="loading">${escHtml(tr.loading)}</div>`}
    </main>

    <footer class="site-footer">
      <a href="https://calendar.google.com/calendar/r?cid=webcal://museumsufer.app/feed.ics" target="_blank" rel="noopener">${escHtml(tr.subscribeCal)}</a>
      <a href="/feed.xml">${escHtml(tr.rssFeed)}</a>
      <a href="https://github.com/boredland/museumsufer/issues/new?template=missing-event.yml" target="_blank" rel="noopener">${escHtml(tr.missingEvent)}</a>
    </footer>

    <details class="why-section">
      <summary>${escHtml(tr.whyTitle)}</summary>
      <p>${escHtml(tr.whyText)}</p>
    </details>

    <details class="llm-tip">
      <summary>
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${escHtml(tr.llmTip)}
      </summary>
      <div class="llm-tip-prompt" id="llm-prompt" data-prompt="${escHtml(tr.llmPrompt)}">${escHtml(tr.llmPrompt)}<button class="llm-tip-copy" onclick="copyPrompt()" aria-label="${escHtml(tr.copyPrompt)}">${escHtml(tr.copyPrompt)}</button></div>
    </details>
  </div>

  <div class="search-overlay" id="search-overlay" role="dialog" aria-label="${escHtml(tr.search)}">
    <div class="search-box">
      <div class="search-input-wrap">
        <svg viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input class="search-input" id="search-input" type="text" placeholder="${escHtml(tr.searchPlaceholder)}" autocomplete="off">
        <span class="search-kbd">Esc</span>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>
  </div>

  <script>
    const T = ${trJson};
    const DATE_LOCALE = ${dlJson};
    const LOCALES = ${localesJson};
    const CURRENT_LANG = '${locale}';
    const __INITIAL_DATA__ = ${initialDataJson};
    const MUSEUM_GEO = ${geoJson};
    const MUSEUMS = ${museumsJson};
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

    function sortItemsByDistance(items) {
      if (!userPos || !sortByDistance) return items;
      return [...items].sort((a, b) => {
        const da = walkKm(a.museum_slug) ?? 999;
        const db = walkKm(b.museum_slug) ?? 999;
        return da - db;
      });
    }

    let lastRenderData = null;

    function onToggleVisited(id) {
      toggleVisited(id);
      if (lastRenderData) render(lastRenderData);
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

      const sortedEvents = sortItemsByDistance(data.events).map((e, i) => ({...e, _idx: i}));
      let eventsInner;
      if (sortedEvents.length === 0) {
        eventsInner = '<div class="empty">' + escHtml(T.noEvents) + '</div>';
      } else {
        eventsInner = '<div class="card-list">';
        for (const ev of sortedEvents) eventsInner += renderEvent(ev);
        eventsInner += '</div>';
      }
      html += renderSection('events', T.events, data.events.length, 'M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', eventsInner);

      const sortedExhibitions = sortItemsByDistance(data.exhibitions).map((e, i) => ({...e, _idx: i}));
      const museumsWithExhibitions = new Set(sortedExhibitions.map(ex => ex.museum_slug));
      const museumsWithout = Object.keys(MUSEUMS)
        .filter(slug => !museumsWithExhibitions.has(slug))
        .sort((a, b) => MUSEUMS[a].name.localeCompare(MUSEUMS[b].name));

      let exhInner;
      if (sortedExhibitions.length === 0 && museumsWithout.length === 0) {
        exhInner = '<div class="empty">' + escHtml(T.noExhibitions) + '</div>';
      } else {
        exhInner = '<div class="card-list">';
        exhInner += renderExhibitionsGrouped(sortedExhibitions);
        for (const slug of museumsWithout) {
          const m = MUSEUMS[slug];
          exhInner += '<div class="museum-group-header museum-no-exhibition">'
            + museumHeader(m.name, slug)
            + '<span class="museum-permanent">' + escHtml(T.permanentCollection) + '</span>'
            + '</div>';
        }
        exhInner += '</div>';
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
        html += '<details class="visited-section"><summary>'
          + escHtml(T.alreadyVisited) + ' <span class="section-count">' + visited.length + '</span>'
          + '</summary><div class="card-list">'
          + renderExhibitionList(visited)
          + '</div></details>';
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
          html += '<div class="museum-group-header">' + museumHeader(museum, ex.museum_slug) + '</div>';
        }
        html += renderExhibition(ex);
      }
      return html;
    }

    function renderExhibition(ex) {
      const imgTag = ex.image_url
        ? '<img class="card-img" src="' + escHtml(ex.image_url + '?w=120') + '" srcset="' + escHtml(ex.image_url + '?w=120') + ' 120w, ' + escHtml(ex.image_url + '?w=200') + ' 200w" sizes="(max-width: 480px) 56px, 72px" alt="' + escHtml(ex.title) + '"' + (ex._idx > 2 ? ' loading="lazy"' : '') + '>'
        : '<div class="card-img-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>';
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
        if (daysLeft <= 3) endingTag = '<span class="card-ending-soon" title="' + daysLeft + ' ' + (daysLeft === 1 ? 'Tag' : 'Tage') + '">' + escHtml(T.lastDays) + '</span>';
        else if (daysLeft <= 14) endingTag = '<span class="card-ending-soon" title="' + daysLeft + ' ' + (daysLeft === 1 ? 'Tag' : 'Tage') + '">' + escHtml(T.endingSoon) + '</span>';
      }

      const desc = ex.description
        ? '<details><summary>' + escHtml(T.details) + '</summary><div class="card-desc">' + escHtml(ex.description) + '</div></details>'
        : '';

      const v = isVisited(ex.id);
      const visitedBtn = v
        ? '<button class="card-visited-btn is-visited" aria-pressed="true" aria-label="' + escAttr(T.unmarkVisited) + '" title="' + escAttr(T.unmarkVisited) + '" onclick="onToggleVisited(' + ex.id + ')">'
          + '<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
          + '</button>'
        : '<button class="card-visited-btn" aria-pressed="false" aria-label="' + escAttr(T.markVisited) + '" title="' + escAttr(T.markVisited) + '" onclick="onToggleVisited(' + ex.id + ')">'
          + '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          + '</button>';

      return '<div class="card">'
        + img
        + '<div class="card-body">'
        + '<div class="card-title">' + titleHtml + ' ' + translatedBadge(ex) + '</div>'
        + '<div class="card-meta">'
        + (dates ? '<span class="card-dates">' + dates + '</span>' : '')
        + endingTag
        + distanceBadge(ex.museum_slug)
        + navButton(ex.museum_slug)
        + visitedBtn
        + '</div>'
        + desc
        + '</div></div>';
    }

    function renderEvent(ev) {
      const imgTag = ev.image_url
        ? '<img class="card-img" src="' + escHtml(ev.image_url + '?w=120') + '" srcset="' + escHtml(ev.image_url + '?w=120') + ' 120w, ' + escHtml(ev.image_url + '?w=200') + ' 200w" sizes="(max-width: 480px) 56px, 72px" alt="' + escHtml(ev.title) + '"' + (ev._idx > 2 ? ' loading="lazy"' : '') + '>'
        : '<div class="card-img-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>';
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

      const meta = [timeTag, priceTag, distanceBadge(ev.museum_slug), navButton(ev.museum_slug), calBtn].filter(Boolean).join(' ');

      const desc = ev.description
        ? '<details><summary>' + escHtml(T.details) + '</summary><div class="card-desc">' + escHtml(ev.description) + '</div></details>'
        : '';

      return '<div class="card">'
        + img
        + '<div class="card-body">'
        + '<div class="card-title">' + titleHtml + ' ' + translatedBadge(ev) + '</div>'
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
        btnNear.textContent = T.nearMe;
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
        btnNear.textContent = '...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            sortByDistance = true;
            btnNear.classList.remove('loading');
            btnNear.classList.add('active');
            btnNear.setAttribute('aria-pressed', 'true');
            btnNear.textContent = T.nearMe;
            if (lastRenderData) render(lastRenderData);
          },
          () => {
            btnNear.classList.remove('loading');
            btnNear.textContent = T.nearMe;
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
      searchOverlay.classList.add('open');
      searchInput.value = '';
      searchInput.focus();
      updateSearch();
    }

    function closeSearch() {
      searchOverlay.classList.remove('open');
      searchIdx = -1;
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

        return '<div class="search-result" data-idx="' + i + '"'
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
      if (searchIdx >= 0 && rows[searchIdx]) rows[searchIdx].scrollIntoView({ block: 'nearest' });
    });

    searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) closeSearch(); });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  </script>
</body>
</html>`;
}

function getBerlinUtcOffset(): string {
  const now = new Date();
  const utc = now.toLocaleString("en-US", { timeZone: "UTC" });
  const berlin = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  const diff = (new Date(berlin).getTime() - new Date(utc).getTime()) / 3600000;
  return `+${String(Math.floor(diff)).padStart(2, "0")}:00`;
}

function buildEventSchema(data: InitialData, tz: string): string {
  const events = data.events as Array<Record<string, unknown>>;
  if (!events || events.length === 0) return "";

  const schemas = events.slice(0, 20).map((ev) => {
    const date = ev.date as string;
    const time = ev.time as string | null;
    const endTime = ev.end_time as string | null;
    const endDate = ev.end_date as string | null;
    const museum = (ev.museum_name as string) || "";
    const slug = (ev.museum_slug as string) || "";
    const geo = MUSEUM_LOCATIONS[slug];

    const startIso = time ? `${date}T${time}:00${tz}` : `${date}T09:00:00${tz}`;
    let endIso: string;
    if (endTime) {
      const ed = endDate || date;
      endIso = `${ed}T${endTime}:00${tz}`;
    } else if (time) {
      const h = (parseInt(time.split(":")[0], 10) + 1) % 24;
      endIso = `${date}T${h.toString().padStart(2, "0")}:${time.split(":")[1]}:00${tz}`;
    } else {
      endIso = `${date}T18:00:00${tz}`;
    }

    const schema: Record<string, unknown> = {
      "@type": "Event",
      name: ev.title,
      startDate: startIso,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    };
    schema.endDate = endIso;
    if (ev.description) schema.description = ev.description;
    if (ev.detail_url) schema.url = ev.detail_url;
    if (ev.image_url) schema.image = ev.image_url;

    const location: Record<string, unknown> = { "@type": "Place", name: museum };
    if (geo) {
      location.geo = { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng };
      location.address = { "@type": "PostalAddress", addressLocality: "Frankfurt am Main", addressCountry: "DE" };
    }
    schema.location = location;

    if (ev.price) {
      schema.offers = { "@type": "Offer", price: 0, priceCurrency: "EUR", description: ev.price };
    }

    return schema;
  });

  const wrapper = { "@context": "https://schema.org", "@graph": schemas };
  return `<script type="application/ld+json">${JSON.stringify(wrapper)}</script>`;
}

const escHtml = escHtmlShared;
