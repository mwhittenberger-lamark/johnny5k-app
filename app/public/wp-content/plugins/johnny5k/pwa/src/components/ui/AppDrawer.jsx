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

export default function AppDrawer({
  ariaLabel = '',
  children,
  className = '',
  description = '',
  dismissible = true,
  footer = null,
  onClose,
  open = false,
  overlayClassName = '',
  side = 'right',
  title = '',
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
      const focusableElements = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      const nextFocusTarget = focusableElements[0] || panelRef.current
      nextFocusTarget?.focus()
    }, 0)

    function handleKeydown(event) {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onClose?.()
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
    <div className={`ui-overlay ui-overlay-drawer ui-overlay-drawer-${side}${overlayClassName ? ` ${overlayClassName}` : ''}`} role="presentation">
      <button
        type="button"
        className="ui-overlay-backdrop"
        aria-label={dismissible ? 'Close drawer' : 'Drawer backdrop'}
        onClick={dismissible ? onClose : undefined}
      />
      <aside
        ref={panelRef}
        className={`ui-drawer ui-drawer-${side}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || undefined}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {title || description ? (
          <header className="ui-drawer-header">
            {title ? <h2 id={titleId} className="ui-drawer-title">{title}</h2> : null}
            {description ? <p id={descriptionId} className="ui-drawer-description">{description}</p> : null}
          </header>
        ) : null}
        <div className="ui-drawer-body">
          {children}
        </div>
        {footer ? <footer className="ui-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>,
    portalRoot,
  )
}
