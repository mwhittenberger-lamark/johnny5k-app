import { createPortal } from 'react-dom'

function getToastLayerRoot() {
  if (typeof document === 'undefined') {
    return null
  }

  let root = document.getElementById('toast-layer-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'toast-layer-root'
    document.body.appendChild(root)
  }

  return root
}

export default function ToastPortal({ children }) {
  const portalRoot = getToastLayerRoot()

  return portalRoot ? createPortal(children, portalRoot) : null
}
