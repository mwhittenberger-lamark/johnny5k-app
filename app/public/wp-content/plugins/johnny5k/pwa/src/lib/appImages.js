import brandmarkFallback from '../assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.webp'
import loginWelcomeFallback from '../assets/welcome.webp'
import johnnyDrawerFallback from '../assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.webp'
import liveWorkoutFrameOneFallback from '../assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.webp'
import liveWorkoutFrameTwoFallback from '../assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.webp'
import liveWorkoutFrameThreeFallback from '../assets/hero.png'

export const APP_IMAGE_FIELDS = [
  { key: 'brandmark', label: 'Brandmark', description: 'Header logo shown in the main app shell.' },
  { key: 'login_welcome', label: 'Login welcome', description: 'Welcome image shown on the sign-in screen.' },
  { key: 'johnny_drawer', label: 'Johnny assistant drawer', description: 'Illustration shown in the Ask Johnny drawer.' },
  { key: 'live_workout_frame_1', label: 'Live workout fallback 1', description: 'First bundled fallback frame used in Live Workout Mode.' },
  { key: 'live_workout_frame_2', label: 'Live workout fallback 2', description: 'Second bundled fallback frame used in Live Workout Mode.' },
  { key: 'live_workout_frame_3', label: 'Live workout fallback 3', description: 'Third bundled fallback frame used in Live Workout Mode.' },
]

export const DEFAULT_APP_IMAGES = {
  brandmark: brandmarkFallback,
  login_welcome: loginWelcomeFallback,
  johnny_drawer: johnnyDrawerFallback,
  live_workout_frame_1: liveWorkoutFrameOneFallback,
  live_workout_frame_2: liveWorkoutFrameTwoFallback,
  live_workout_frame_3: liveWorkoutFrameThreeFallback,
}

export function normalizeAppImages(value) {
  const nextImages = { ...DEFAULT_APP_IMAGES }

  if (!value || typeof value !== 'object') {
    return nextImages
  }

  APP_IMAGE_FIELDS.forEach(({ key }) => {
    const imageUrl = typeof value[key] === 'string' ? value[key].trim() : ''
    if (imageUrl) {
      nextImages[key] = imageUrl
    }
  })

  return nextImages
}

export function getAppImageUrl(appImages, key) {
  return normalizeAppImages(appImages)[key] ?? DEFAULT_APP_IMAGES[key] ?? ''
}

export function getDefaultLiveWorkoutFrames(appImages) {
  const resolvedImages = normalizeAppImages(appImages)

  return [
    { image: resolvedImages.live_workout_frame_1, label: 'Locked in', note: 'Placeholder frame 1 of Johnny live coaching art.' },
    { image: resolvedImages.live_workout_frame_2, label: 'Watching the set', note: 'Placeholder frame 2 of Johnny live coaching art.' },
    { image: resolvedImages.live_workout_frame_3, label: 'Mid-session cue', note: 'Placeholder frame 3 of Johnny live coaching art.' },
  ]
}