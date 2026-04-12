export function scrollAppToTop({ behavior = 'smooth' } = {}) {
  if (typeof window === 'undefined') {
    return
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const shellScroller = document.querySelector('[data-route-scroll-root="true"]')
    if (shellScroller instanceof HTMLElement) {
      shellScroller.scrollTo({ top: 0, behavior })
    }
  })
}
