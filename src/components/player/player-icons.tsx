/* Crisp 24px stroke icons for the floating player (the members-area player uses the same paths). */
type P = { className?: string };
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconPrev = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 5v14" />
    <path d="M19 5.5v13a.6.6 0 0 1-.92.5L8.6 12.5a.6.6 0 0 1 0-1L18.08 5a.6.6 0 0 1 .92.5Z" fill="currentColor" />
  </svg>
);
export const IconNext = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M18 5v14" />
    <path d="M5 5.5v13a.6.6 0 0 0 .92.5l9.48-6.5a.6.6 0 0 0 0-1L5.92 5A.6.6 0 0 0 5 5.5Z" fill="currentColor" />
  </svg>
);
export const IconPlay = ({ className }: P) => (
  <svg {...base} className={className} strokeWidth={0}>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" />
  </svg>
);
export const IconPause = ({ className }: P) => (
  <svg {...base} className={className} strokeWidth={0}>
    <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
export const IconShuffle = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1.1 1.7 2.3 2.7 4.3 2.7H21" />
    <path d="M3 17h3.5c1.3 0 2.2-.4 3-1.2M14.2 8.2c.8-.8 1.7-1.2 3-1.2H21" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" />
  </svg>
);
export const IconRepeat = ({ className, one }: P & { one?: boolean }) => (
  <svg {...base} className={className}>
    <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19" />
    <path d="m16.5 3.5 2.5 2.5-2.5 2.5" />
    <path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5" />
    <path d="m7.5 20.5-2.5-2.5 2.5-2.5" />
    {one && <path d="M11.3 10.6 12.6 10v4.4" strokeWidth={1.7} />}
  </svg>
);
export const IconVolume = ({ className, level }: P & { level: number }) => (
  <svg {...base} className={className}>
    <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4Z" fill="currentColor" strokeWidth={1.4} />
    {level === 0 ? (
      <path d="m16 9.5 5 5m0-5-5 5" />
    ) : (
      <>
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        {level > 0.5 && <path d="M18.2 6.6a7.7 7.7 0 0 1 0 10.8" />}
      </>
    )}
  </svg>
);
export const IconQueue = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 6h13M4 10.5h13M4 15h8M4 19.5h8" />
    <path d="M15.5 14.2v6.1a.4.4 0 0 0 .6.35l4.6-3.05a.4.4 0 0 0 0-.7L16.1 13.85a.4.4 0 0 0-.6.35Z" fill="currentColor" />
  </svg>
);
export const IconMinimize = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5.5 12h13" />
  </svg>
);
export const IconExpand = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />
  </svg>
);
export const IconClose = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m6.5 6.5 11 11m0-11-11 11" />
  </svg>
);
export const IconMore = ({ className }: P) => (
  <svg {...base} className={className} strokeWidth={0}>
    <circle cx="5.5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.8" fill="currentColor" />
  </svg>
);
export const IconNote = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);
