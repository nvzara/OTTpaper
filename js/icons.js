// Original inline SVG icons drawn for this project (no third-party icon set, no licensing obligations).
const svg = (body, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const I = {
  search: () => svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
  key: () => svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 3 3"/>'),
  globe: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>'),
  palette: () => svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 0 0 3-3c0-5-4-11-8-11z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/>'),
  tvbox: () => svg('<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M8 21h8M12 18v3"/>'),
  download: () => svg('<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>'),
  upload: () => svg('<path d="M12 16V5m-4 4 4-4 4 4M5 20h14"/>'),
  trash: () => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  check: () => svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  info: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  external: () => svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>'),
  language: () => svg('<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 7M12 6c-.5 3-3 6-7 7.5"/><path d="m12 20 4-9 4 9M13.5 17h5"/>'),
  type: () => svg('<path d="M4 7V5h16v2M12 5v14M9 19h6"/>'),
  moon: () => svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  scissors: () => svg('<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.4 20 17M8.2 15.6 20 7"/>'),
  lock: () => svg('<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sparkle: () => svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
};
