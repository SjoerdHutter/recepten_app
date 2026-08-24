/** Een handvol iconen als inline SVG; een icoonpakket zou zwaarder wegen dan dit. */
const PATHS = {
  zoek: 'M11 4a7 7 0 1 0 4.19 12.6l3.1 3.1a1 1 0 0 0 1.42-1.42l-3.1-3.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  dobbelsteen:
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-7 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  plus: 'M12 5v14M5 12h14',
  min: 'M5 12h14',
  vink: 'm4 12 5 5L20 6',
  kruis: 'M6 6l12 12M18 6 6 18',
  delen: 'M12 3v12M8 7l4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  kopieer:
    'M9 3h9a2 2 0 0 1 2 2v9M6 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  printer:
    'M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 15h10v6H7z',
  prullenbak:
    'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  boek: 'M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5Zm2 12h13',
  lijst: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  tandwiel:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8.6 3a8.6 8.6 0 0 0-.15-1.5l2-1.55-2-3.46-2.4.96a8.6 8.6 0 0 0-2.6-1.5L15 2H9l-.45 2.45a8.6 8.6 0 0 0-2.6 1.5l-2.4-.96-2 3.46 2 1.55a8.6 8.6 0 0 0 0 3l-2 1.55 2 3.46 2.4-.96a8.6 8.6 0 0 0 2.6 1.5L9 22h6l.45-2.45a8.6 8.6 0 0 0 2.6-1.5l2.4.96 2-3.46-2-1.55c.1-.49.15-.99.15-1.5Z',
  zon: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  maan: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  klok: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2',
  vuur: 'M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5 1-3.5.5 1 1.5 1.5 2 1.5-.5-2 1-5.5 2-7Z',
  vernieuw: 'M20 11a8 8 0 1 0-.6 4M20 5v6h-6',
  terug: 'm14 6-6 6 6 6',
  omlaag: 'm6 9 6 6 6-6',
  wolkUit: 'M3 3l18 18M7 18a4 4 0 0 1-.4-8 6 6 0 0 1 9-3.6M20 15.5A3.5 3.5 0 0 0 17 12',
  slot: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  potlood: 'M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z',
  kast: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 8h16M10 7v2m0 6v2',
  waarschuwing: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
  kalender:
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 5h16M8 3v4m8-4v4',
} as const;

export type IconName = keyof typeof PATHS;

export const Icon = ({
  name,
  className = 'h-5 w-5',
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[name]} />
  </svg>
);
