import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { resolveInitialBrandId } from '../brands/registry'

const JohnnyHomeScreen = lazy(() => import('./johnny/JohnnyHomeScreen'))

export default function HomeScreen() {
  if (resolveInitialBrandId() === 'nat20') return <Navigate to="/nat20" replace />
  return <Suspense fallback={null}><JohnnyHomeScreen /></Suspense>
}
