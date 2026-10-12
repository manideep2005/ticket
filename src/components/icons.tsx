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
  google: (
    <>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
        stroke="none"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
        stroke="none"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
        stroke="none"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
        stroke="none"
      />
    </>
  ),
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
