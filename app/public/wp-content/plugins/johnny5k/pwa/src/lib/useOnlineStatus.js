import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const sync = () => {
      setIsOnline(navigator.onLine !== false)
    }

    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)

    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return isOnline
}
