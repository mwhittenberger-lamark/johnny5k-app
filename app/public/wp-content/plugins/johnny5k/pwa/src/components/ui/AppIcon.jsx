import { normalizeAppIconName } from './AppIcon.utils'

export default function AppIcon({ name, className = '' }) {
  const classes = className ? `app-icon ${className}` : 'app-icon'

  switch (normalizeAppIconName(name, 'home')) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M4 11.5 12 5l8 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 10.5V19h10v-8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'workout':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M3 10v4M7 8v8M17 8v8M21 10v4M7 12h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'nutrition':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M7 3v7M10 3v7M7 7h3M15 3v18M18 3c0 3-1.3 5-3 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'progress':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 18V9M12 18V5M19 18v-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.5 19a6.8 6.8 0 0 1 13 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'admin':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 3.5 14 5l2.6-.2.8 2.5 2.3 1.4-1.1 2.3 1.1 2.3-2.3 1.4-.8 2.5L14 19l-2 1.5L10 19l-2.6.2-.8-2.5-2.3-1.4 1.1-2.3-1.1-2.3 2.3-1.4.8-2.5L10 5l2-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'coach':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 4 5 8v5c0 4 3.2 6.8 7 7 3.8-.2 7-3 7-7V8l-7-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 12.2 11.3 14l3.2-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'camera':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M4 7h4l2-2h4l2 2h4v11H4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'label':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 0 4 21V7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 9h7M8 13h8M8 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 7h14M9 7V5h6v2M8 7l.7 11h6.6L16 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 11v4M14 11v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'close':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'send':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M5 12 19 5l-3 7 3 7-14-7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'logout':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'award':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.5 11.2 8 20l4-2 4 2-1.5-8.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'trophy':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 5H5a2 2 0 0 0 2 4h1M16 5h3a2 2 0 0 1-2 4h-1M12 11v4M9 19h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M13.5 4c.8 2.3-.2 4.1-1.8 5.7-1 1-1.7 2.1-1.7 3.7a3.9 3.9 0 1 0 7.8 0c0-3.1-2-5.5-4.3-9.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="M13 3 6 13h5l-1 8 8-11h-5l0-7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'question':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.6 9.4a2.7 2.7 0 1 1 4.8 1.7c-.7.8-1.7 1.3-2.1 2.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="16.8" r="1" fill="currentColor" />
        </svg>
      )
    case 'chevron-up':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <path d="m6 10 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" className={classes} aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
  }
}
