import { useEffect, useRef } from 'react'

// iOS Safari has a known WebKit bug where a `conic-gradient` background
// painted on the same element as a rotating transform (whether the rotation
// comes from a CSS @keyframes animation or JS-driven style writes) can freeze
// on its first frame, especially when the element sits inside a
// `position: fixed` ancestor. SVG shapes don't hit this bug, so callers
// should rotate an SVG element (never one with a conic-gradient background)
// with the ref this hook returns.
export function useSpinRef(periodMs = 1300) {
  const ref = useRef(null)

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return undefined

    const start = performance.now()
    let frameId

    function tick(now) {
      const angle = (((now - start) % periodMs) / periodMs) * 360
      if (ref.current) ref.current.style.transform = `rotate(${angle}deg)`
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [periodMs])

  return ref
}
