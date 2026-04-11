import { useEffect, useState } from 'react'
import { onboardingApi } from '../../../api/modules/onboarding'

export function useLiveWorkoutFrames() {
  const [liveWorkoutFrames, setLiveWorkoutFrames] = useState([])

  useEffect(() => {
    let active = true
    const objectUrls = []

    async function loadLiveFrames() {
      try {
        const data = await onboardingApi.getState()
        if (!active) return

        const configuredFrames = Array.isArray(data?.live_workout_frames) ? data.live_workout_frames : []
        const generatedImages = Array.isArray(data?.generated_images) ? data.generated_images : []
        const favoritedImages = generatedImages.filter(image => image?.favorited && image?.id)

        if (!favoritedImages.length) {
          setLiveWorkoutFrames(configuredFrames)
          return
        }

        const favoritedFrames = (await Promise.all(
          favoritedImages.map(async image => {
            try {
              const blob = await onboardingApi.generatedImageBlob(image.id)
              const src = window.URL.createObjectURL(blob)
              objectUrls.push(src)
              return {
                image: src,
                label: image.scenario || 'Live frame',
                note: 'Favorited generated image',
              }
            } catch {
              return null
            }
          }),
        )).filter(Boolean)

        if (!active) return
        setLiveWorkoutFrames([...favoritedFrames, ...configuredFrames])
      } catch {
        if (active) {
          setLiveWorkoutFrames([])
        }
      }
    }

    loadLiveFrames()

    return () => {
      active = false
      objectUrls.forEach(url => window.URL.revokeObjectURL(url))
    }
  }, [])

  return liveWorkoutFrames
}
