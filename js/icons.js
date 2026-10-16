// Original inline SVG icons drawn for this project (no third-party icon set, no licensing obligations).
const svg = (body, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const I = {
  logo: cls => svg('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 9 5 3-5 3z"/>', cls),
  search: () => svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
  settings: () => svg('<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  home: () => svg('<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>'),
  trending: () => svg('<path d="M12 3c.5 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2.5-4.5.2 1.7 1 2.5 2 2.5C11 8 11 5 12 3z"/>'),
  film: () => svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5"/>'),
  tv: () => svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m8 3 4 3 4-3"/>'),
  calendar: () => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  clock: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'),
  key: () => svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 3 3"/>'),
  globe: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>'),
  palette: () => svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 0 0 3-3c0-5-4-11-8-11z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/>'),
  tvbox: () => svg('<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M8 21h8M12 18v3"/>'),
  download: () => svg('<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>'),
  upload: () => svg('<path d="M12 16V5m-4 4 4-4 4 4M5 20h14"/>'),
  trash: () => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  check: () => svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  info: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  heart: () => svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  star: () => svg('<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.7L7.2 19l1-5.4-4-3.7 5.4-.7z"/>'),
  external: () => svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>'),
  language: () => svg('<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 7M12 6c-.5 3-3 6-7 7.5"/><path d="m12 20 4-9 4 9M13.5 17h5"/>'),
  news: () => svg('<path d="M5 4h11v16H7a2 2 0 0 1-2-2z"/><path d="M16 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3"/>'),
  sparkle: () => svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
};
