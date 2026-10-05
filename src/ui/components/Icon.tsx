const PATHS = {
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M14.8 9.2c-.4-.9-1.5-1.5-2.8-1.5-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 2 2.8.9 2.8 2.1-1.2 2-2.8 2c-1.4 0-2.6-.6-3-1.6" />
    </>
  ),
  vp: <path d="M5 21V4M5 4h12l-2.5 4L17 12H5" />,
  card: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  action: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  buy: <path d="M5 8h14l-1.2 12H6.2L5 8zM9 8a3 3 0 0 1 6 0" />,
  hand: (
    <>
      <rect x="3" y="6" width="10" height="14" rx="2" transform="rotate(-12 8 13)" />
      <rect x="11" y="4" width="10" height="14" rx="2" transform="rotate(10 16 11)" />
    </>
  ),
  deck: (
    <>
      <rect x="4" y="7" width="12" height="14" rx="2" />
      <path d="M8 4h10a2 2 0 0 1 2 2v11" />
    </>
  ),
  discard: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M12 3v8M8.5 7.5L12 11l3.5-3.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 8v5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </>
  ),
  trophy: <path d="M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8" />,
  wifiOff: (
    <>
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M2 9a15 15 0 0 1 5-3M14.8 10.4A10 10 0 0 1 19 12.9M17 6a15 15 0 0 1 5 3" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  shuffle: <path d="M16 4h4v4M20 4l-6 6M4 20l6-6M16 20h4v-4M20 20L4 4" />,
  door: <path d="M14 4H6v16h8M10 12h10M17 9l3 3-3 3" />,
  play: <path d="M7 4l13 8-13 8V4z" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'ico' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
