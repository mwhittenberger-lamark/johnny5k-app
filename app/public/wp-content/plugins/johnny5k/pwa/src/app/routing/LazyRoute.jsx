import { Suspense } from 'react'

export function LazyRoute({ children }) {
  return <Suspense fallback={<div className="screen-loading">Loading...</div>}>{children}</Suspense>
}