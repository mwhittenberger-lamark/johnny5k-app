import { useEffect } from 'react'

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isFocusableElement(element) {
  if (!element) {
    return false
  }

  if (element.matches('[disabled], [hidden], [inert]')) {
    return false
  }

  if (element.getAttribute('aria-hidden') === 'true') {
    return false
  }

  return true
}

export function getFocusableElements(container) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusableElement)
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function getAccessibleScrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}

export function useOverlayAccessibility({
  open,
  containerRef,
  initialFocusRef = null,
  restoreFocusRef = null,
  onClose,
  dismissible = true,
  trapFocus = true,
  lockBodyScroll = true,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined
    }

    const previousActiveElement = document.activeElement
    const previousOverflow = document.body.style.overflow

    if (lockBodyScroll) {
      document.body.style.overflow = 'hidden'
    }

    const focusTimer = window.setTimeout(() => {
      const preferredFocusTarget = initialFocusRef?.current
      const focusableElements = getFocusableElements(containerRef.current)
      const nextFocusTarget = isFocusableElement(preferredFocusTarget)
        ? preferredFocusTarget
        : focusableElements[0] || containerRef.current

      nextFocusTarget?.focus?.({ preventScroll: true })
    }, 0)

    function handleKeydown(event) {
      const container = containerRef.current
      if (!container) {
        return
      }

      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onClose?.()
        return
      }

      if (!trapFocus || event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(container)
      if (!focusableElements.length) {
        event.preventDefault()
        container.focus?.({ preventScroll: true })
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (!container.contains(activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? lastElement : firstElement).focus()
        return
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    const restoreTarget = restoreFocusRef?.current || previousActiveElement

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeydown)

      if (lockBodyScroll) {
        document.body.style.overflow = previousOverflow
      }

      restoreTarget?.focus?.({ preventScroll: true })
    }
  }, [containerRef, dismissible, initialFocusRef, lockBodyScroll, onClose, open, restoreFocusRef, trapFocus])
}