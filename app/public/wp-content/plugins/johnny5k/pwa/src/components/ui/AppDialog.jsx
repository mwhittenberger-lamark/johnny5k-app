import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getPortalRoot() {
  if (typeof document === 'undefined') {
    return null
  }

  let root = document.getElementById('ui-layer-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'ui-layer-root'
    document.body.appendChild(root)
  }

  return root
}

function getFocusableElements(container) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
}

export default function AppDialog({
  ariaLabel = '',
  children,
  className = '',
  description = '',
  dismissible = true,
  footer = null,
  onClose,
  open = false,
  overlayClassName = '',
  size = 'md',
  title = '',
  tone = 'default',
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined
    }

    const previousActiveElement = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const focusableElements = getFocusableElements(panelRef.current)
      const nextFocusTarget = focusableElements[0] || panelRef.current
      nextFocusTarget?.focus()
    }, 0)

    function handleKeydown(event) {
      if (!panelRef.current) {
        return
      }

      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(panelRef.current)
      if (!focusableElements.length) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus?.()
    }
  }, [dismissible, onClose, open])

  if (!open) {
    return null
  }

  const portalRoot = getPortalRoot()
  if (!portalRoot) {
    return null
  }

  return createPortal(
    <div className={`ui-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`} role="presentation">
      <button
        type="button"
        className="ui-overlay-backdrop"
        aria-label={dismissible ? 'Close dialog' : 'Dialog backdrop'}
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={`ui-dialog ui-dialog-${size} ui-dialog-${tone}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || undefined}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {title || description ? (
          <header className="ui-dialog-header">
            {title ? <h2 id={titleId} className="ui-dialog-title">{title}</h2> : null}
            {description ? <p id={descriptionId} className="ui-dialog-description">{description}</p> : null}
          </header>
        ) : null}
        <div className="ui-dialog-body">
          {children}
        </div>
        {footer ? <footer className="ui-dialog-footer">{footer}</footer> : null}
      </div>
    </div>,
    portalRoot,
  )
}
