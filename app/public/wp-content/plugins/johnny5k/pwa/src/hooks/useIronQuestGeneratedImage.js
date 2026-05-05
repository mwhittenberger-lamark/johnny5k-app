import { useEffect, useState } from 'react'
import { onboardingApi } from '../api/modules/onboarding'

export function useIronQuestGeneratedImage(generatedImageId, fallbackLabel = 'IronQuest reward portrait') {
  const normalizedImageId = String(generatedImageId || '').trim()
  const [image, setImage] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    if (!normalizedImageId) {
      setImage(null)
      return undefined
    }

    async function loadImage() {
      try {
        const blob = await onboardingApi.generatedImageBlob(normalizedImageId)
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setImage({
          id: normalizedImageId,
          src: objectUrl,
          label: fallbackLabel,
        })
      } catch {
        if (!cancelled) {
          setImage(null)
        }
      }
    }

    void loadImage()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [fallbackLabel, normalizedImageId])

  if (!normalizedImageId) {
    return null
  }

  return image?.id === normalizedImageId ? image : null
}
