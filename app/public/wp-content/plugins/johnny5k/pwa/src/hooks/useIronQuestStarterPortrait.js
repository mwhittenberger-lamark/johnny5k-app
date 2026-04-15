import { useEffect, useState } from 'react'
import { onboardingApi } from '../api/modules/onboarding'

export function useIronQuestStarterPortrait(attachmentId) {
  const [portrait, setPortrait] = useState(null)

  useEffect(() => {
    const normalizedAttachmentId = Number(attachmentId || 0)
    let cancelled = false
    let objectUrl = ''

    if (normalizedAttachmentId <= 0) {
      setPortrait(null)
      return undefined
    }

    async function loadPortrait() {
      try {
        const state = await onboardingApi.getState()
        const headshot = state?.headshot ?? {}
        const generatedImages = Array.isArray(state?.generated_images) ? state.generated_images : []

        if (Number(headshot?.attachment_id || 0) === normalizedAttachmentId) {
          const blob = await onboardingApi.headshotBlob()
          objectUrl = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(objectUrl)
            return
          }
          if (!cancelled) {
            setPortrait({
              src: objectUrl,
              label: 'Starter portrait from uploaded headshot',
              kind: 'headshot',
              attachmentId: normalizedAttachmentId,
            })
          }
          return
        }

        const matchedImage = generatedImages.find((image) => Number(image?.attachment_id || 0) === normalizedAttachmentId)
        if (matchedImage?.id) {
          const blob = await onboardingApi.generatedImageBlob(matchedImage.id)
          objectUrl = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(objectUrl)
            return
          }
          if (!cancelled) {
            setPortrait({
              src: objectUrl,
              label: matchedImage.scenario || 'Starter portrait from generated image',
              kind: 'generated',
              attachmentId: normalizedAttachmentId,
            })
          }
          return
        }

        if (!cancelled) {
          setPortrait(null)
        }
      } catch {
        if (!cancelled) {
          setPortrait(null)
        }
      }
    }

    setPortrait(null)
    void loadPortrait()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [attachmentId])

  return portrait
}