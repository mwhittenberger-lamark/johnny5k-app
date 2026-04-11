import { useCallback, useEffect, useState } from 'react'
import { bodyApi } from '../../../api/modules/body'
import { dashboardApi } from '../../../api/modules/dashboard'
import { nutritionApi } from '../../../api/modules/nutrition'
import { onboardingApi } from '../../../api/modules/onboarding'
import { reportClientDiagnostic } from '../../../lib/clientDiagnostics'

export function useDashboardSupplementalData({ loadSnapshot, loadAwards }) {
  const [weeklyWeights, setWeeklyWeights] = useState([])
  const [groceryGap, setGroceryGap] = useState(null)
  const [smsReminders, setSmsReminders] = useState({ timezone: '', scheduled: [] })
  const [generatedImageGallery, setGeneratedImageGallery] = useState([])
  const [realSuccessStoryData, setRealSuccessStoryData] = useState(null)
  const [realSuccessStoryLoading, setRealSuccessStoryLoading] = useState(false)
  const [realSuccessStoryError, setRealSuccessStoryError] = useState('')

  useEffect(() => {
    let active = true
    const objectUrls = []

    loadSnapshot()
    loadAwards()

    bodyApi.getWeight(7)
      .then(rows => {
        if (!active) return
        setWeeklyWeights(Array.isArray(rows) ? rows.slice(0, 7).reverse() : [])
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'dashboard_weekly_weights_load',
          message: 'Dashboard weekly weight history failed to load.',
          error,
          context: {
            surface: 'dashboard',
          },
        })
      })

    nutritionApi.getGroceryGap()
      .then(data => {
        if (!active) return
        setGroceryGap(data || null)
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'dashboard_grocery_gap_load',
          message: 'Dashboard grocery gap failed to load.',
          error,
          context: {
            surface: 'dashboard',
          },
        })
      })

    onboardingApi.getSmsReminders()
      .then(data => {
        if (!active) return
        setSmsReminders({
          timezone: data?.timezone ?? '',
          scheduled: Array.isArray(data?.scheduled) ? data.scheduled : [],
        })
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'dashboard_sms_reminders_load',
          message: 'Dashboard SMS reminders failed to load.',
          error,
          context: {
            surface: 'dashboard',
          },
        })
      })

    onboardingApi.getGeneratedImages()
      .then(async data => {
        const rows = Array.isArray(data?.generated_images) ? data.generated_images : []
        const sorted = [...rows].sort((a, b) => {
          const aTime = Date.parse(String(a?.created_at || ''))
          const bTime = Date.parse(String(b?.created_at || ''))
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
        })
        const nextRows = sorted.slice(0, 8)
        const nextGallery = await Promise.all(
          nextRows.map(async image => {
            if (!image?.id) return null

            try {
              const blob = await onboardingApi.generatedImageBlob(image.id)
              const previewSrc = window.URL.createObjectURL(blob)
              objectUrls.push(previewSrc)
              return { ...image, previewSrc }
            } catch {
              return { ...image, previewSrc: '' }
            }
          }),
        )

        if (!active) return
        setGeneratedImageGallery(nextGallery.filter(Boolean))
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'dashboard_generated_images_load',
          message: 'Dashboard generated image gallery failed to load.',
          error,
          context: {
            surface: 'dashboard',
          },
        })
        if (active) {
          setGeneratedImageGallery([])
        }
      })

    setRealSuccessStoryLoading(true)
    dashboardApi.realSuccessStory()
      .then(data => {
        if (!active) return
        setRealSuccessStoryData(data || null)
        setRealSuccessStoryError('')
      })
      .catch(error => {
        if (!active) return
        setRealSuccessStoryError(error?.message || 'Could not load inspiration right now.')
      })
      .finally(() => {
        if (active) {
          setRealSuccessStoryLoading(false)
        }
      })
    return () => {
      active = false
      objectUrls.forEach(url => window.URL.revokeObjectURL(url))
    }
  }, [loadAwards, loadSnapshot])

  const refreshRealSuccessStory = useCallback(async () => {
    setRealSuccessStoryLoading(true)
    try {
      const data = await dashboardApi.realSuccessStory(true)
      setRealSuccessStoryData(data || null)
      setRealSuccessStoryError('')
    } catch (error) {
      setRealSuccessStoryError(error?.message || 'Could not refresh inspiration right now.')
    } finally {
      setRealSuccessStoryLoading(false)
    }
  }, [])

  return {
    generatedImageGallery,
    groceryGap,
    realSuccessStoryData,
    realSuccessStoryError,
    realSuccessStoryLoading,
    refreshRealSuccessStory,
    smsReminders,
    weeklyWeights,
  }
}
