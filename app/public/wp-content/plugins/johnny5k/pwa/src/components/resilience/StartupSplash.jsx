import AppLoadingScreen from '../ui/AppLoadingScreen'

export default function StartupSplash() {
  return (
    <div className="splash">
      <AppLoadingScreen
        eyebrow="Starting Johnny5k"
        title="Building your first view"
        message="Loading your account, training state, and today’s cards so the app lands with context instead of a blank wait."
      />
    </div>
  )
}
