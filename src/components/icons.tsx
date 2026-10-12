import type { ReactNode } from "react";

/** Small stroke icon set — avoids an icon-library dependency. */
const PATHS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v1a2.25 2.25 0 0 0 0 4.5v1A2.5 2.5 0 0 1 18.5 17.5h-13A2.5 2.5 0 0 1 3 15v-1a2.25 2.25 0 0 0 0-4.5v-1Z" />
      <path d="M14 6.5v11" strokeDasharray="2.5 2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chart: (
    <>
      <path d="M3 20.5h18" />
      <path d="M6.5 20.5v-6M11.5 20.5V8M16.5 20.5v-9" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="19" cy="5.5" r="2.2" />
      <circle cx="19" cy="18.5" r="2.2" />
      <path d="M7.2 12h3.6l4-5.6M10.8 12l4 5.6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  send: (
    <>
      <path d="M21 4L3 11l7 2.5L13 21l8-17Z" />
      <path d="M10 13.5L21 4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5v5h-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v7" />
      <path d="M4 13.5h4l1.5 2.5h5L16 13.5h4v4A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-4Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6l7-2.5Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.4-3.2 4-4.5 7-4.5s5.6 1.3 7 4.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19c1.2-2.8 3.4-4 6-4s4.8 1.2 6 4" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 15.4c1.7.7 2.9 1.9 3.5 3.6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5L2.8 20h18.4L12 4.5Z" />
      <path d="M12 10v4.5M12 17.3v.2" />
    </>
  ),
  zap: <path d="M13 3L5 13.5h6L10.5 21 19 10.5h-6L13 3Z" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
