import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollToTopOnRouteChange() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const shellScroller = document.querySelector('[data-route-scroll-root="true"]')
    if (shellScroller instanceof HTMLElement) {
      shellScroller.scrollTo(0, 0)
    }
  }, [location.pathname])

  return null
}