import { useEffect, useState } from 'react'
import { ironquestApi } from '../api/modules/ironquest'

export function useIronQuestWorldArt(artKey, fallbackLabel = 'IronQuest world art', refreshKey = 0) {
  const normalizedArtKey = String(artKey || '').trim()
  const [image, setImage] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    if (!normalizedArtKey) {
      setImage(null)
      return undefined
    }

    async function loadImage() {
      try {
        const blob = await ironquestApi.worldArtBlob(normalizedArtKey)
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setImage({
          id: normalizedArtKey,
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
  }, [fallbackLabel, normalizedArtKey, refreshKey])

  if (!normalizedArtKey) {
    return null
  }

  return image?.id === normalizedArtKey ? image : null
}
