import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayAccessibility } from '../../lib/accessibility'

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

export default function AppDialog({
  ariaLabel = '',
  children,
  className = '',
  description = '',
  dismissible = true,
  footer = null,
  initialFocusRef = null,
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

  useOverlayAccessibility({
    open,
    containerRef: panelRef,
    initialFocusRef,
    onClose,
    dismissible,
  })

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
