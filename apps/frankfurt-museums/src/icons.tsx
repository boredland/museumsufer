export const ICON = {
  search:
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  navigate: "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z",
  gps: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z",
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  visibility:
    "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  visibilityOff:
    "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  openInNew:
    "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  event:
    "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  museum: "M12 2L2 7v2h20V7L12 2zM4 11v6h2v-6H4zm4 0v6h2v-6H8zm4 0v6h2v-6h-2zm4 0v6h2v-6h-2zM2 19v2h20v-2H2z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  report: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
};

export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">
      <symbol id="i-heart" viewBox="0 0 24 24">
        <path d={ICON.heart} />
      </symbol>
      <symbol id="i-navigate" viewBox="0 0 24 24">
        <path d={ICON.navigate} />
      </symbol>
      <symbol id="i-visibility" viewBox="0 0 24 24">
        <path d={ICON.visibility} />
      </symbol>
      <symbol id="i-event" viewBox="0 0 24 24">
        <path d={ICON.event} />
      </symbol>
      <symbol id="i-report" viewBox="0 0 24 24">
        <path d={ICON.report} />
      </symbol>
      <symbol id="i-open" viewBox="0 0 24 24">
        <path d={ICON.openInNew} />
      </symbol>
      <symbol id="i-rmv" viewBox="0 0 24 24">
        <path d="M19 16.94V8.5c0-2.79-2.61-3.4-5.5-3.5V3h-3v2C7.6 5.1 5 5.71 5 8.5v8.44c-.56.51-.97 1.18-1 1.97V21h4v-1h8v1h4v-2.09c-.03-.79-.44-1.46-1-1.97zM12 4.5c3.13.09 4 .84 4 1.5H8c0-.66.87-1.41 4-1.5zM7 8h10v5H7V8zm1.5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
      </symbol>
      <symbol id="i-gmaps" viewBox="0 0 92.3 132.3">
        <path d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" fill="#1a73e8" />
        <path d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-31.8L10.8 16.5z" fill="#ea4335" />
        <path
          d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"
          fill="#4285f4"
        />
        <path
          d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 31.8c4.7 10.3 12.3 18.9 22.3 29.1l31.2-36.1c-3.3 3.2-7.9 4.2-11.9 4.2"
          fill="#fbbc04"
        />
        <path
          d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L24.8 95.9c2.6 2.8 5.3 5.8 7.9 9.2 11.4 14.7 13.5 27.2 13.5 27.2s2.1-12.5 12.9-23.1"
          fill="#34a853"
        />
      </symbol>
      <symbol id="i-apple" viewBox="0 0 24 24">
        <path
          d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.43 8.9 9.18c1.25.07 2.12.73 2.86.78.97-.2 1.9-.76 2.93-.69 1.24.1 2.17.58 2.79 1.48-2.56 1.53-1.95 4.89.58 5.83-.45 1.19-.99 2.38-1.95 3.72h-.06zM12.03 9.12C11.9 7.05 13.6 5.36 15.56 5.2c.29 2.38-2.16 4.16-3.53 3.92z"
          fill="#333"
        />
      </symbol>
      <symbol id="i-cal-google" viewBox="0 0 16 16">
        <path d="M8 1a7 7 0 110 14A7 7 0 018 1z" stroke="currentColor" stroke-width="1.2" fill="none" />
        <path
          d="M5.5 8l2 2 3-4"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-cal-outlook" viewBox="0 0 16 16">
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
        <path d="M2 6l6 3.5L14 6" stroke="currentColor" stroke-width="1.2" fill="none" />
      </symbol>
      <symbol id="i-cal-yahoo" viewBox="0 0 16 16">
        <path
          d="M3 3l5 6v4M13 3L8 9"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="i-cal-ics" viewBox="0 0 16 16">
        <path
          d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </symbol>
    </svg>
  );
}
