import { Suspense } from 'react'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'

export function LazyRoute({ children }) {
  return (
    <Suspense fallback={(
      <div className="screen-loading">
        <AppLoadingScreen
          compact
          eyebrow="Loading screen"
          title="Getting the next view ready"
          message="Shaping the cards and pulling in the next screen."
        />
      </div>
    )}
    >
      {children}
    </Suspense>
  )
}
