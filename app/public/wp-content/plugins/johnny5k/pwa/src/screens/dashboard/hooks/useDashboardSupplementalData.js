import { useCallback, useEffect, useState } from 'react'
import { dashboardApi } from '../../../api/modules/dashboard'
import { nutritionApi } from '../../../api/modules/nutrition'
import { onboardingApi } from '../../../api/modules/onboarding'
import { reportClientDiagnostic } from '../../../lib/clientDiagnostics'

export function useDashboardSupplementalData({ loadSnapshot, loadAwards }) {
  const [weeklyWeights, setWeeklyWeights] = useState([])
  const [sleepLogs, setSleepLogs] = useState([])
  const [stepLogs, setStepLogs] = useState([])
  const [cardioLogs, setCardioLogs] = useState([])
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [meals, setMeals] = useState([])
  const [weeklyCaloriesReview, setWeeklyCaloriesReview] = useState(null)
  const [coachingDataAvailability, setCoachingDataAvailability] = useState({
    coachingContextLoaded: false,
    weightsLoaded: false,
    sleepLogsLoaded: false,
    stepLogsLoaded: false,
    cardioLogsLoaded: false,
    workoutHistoryLoaded: false,
    nutritionWindowLoaded: false,
    mealsLoaded: false,
  })
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

    dashboardApi.coachingContext()
      .then(data => {
        if (!active) return
        setWeeklyWeights(Array.isArray(data?.weights) ? data.weights : [])
        setSleepLogs(Array.isArray(data?.sleep_logs) ? data.sleep_logs : [])
        setStepLogs(Array.isArray(data?.step_logs) ? data.step_logs : [])
        setCardioLogs(Array.isArray(data?.cardio_logs) ? data.cardio_logs : [])
        setWorkoutHistory(Array.isArray(data?.workout_history) ? data.workout_history : [])
        setMeals(Array.isArray(data?.meals) ? data.meals : [])
        setWeeklyCaloriesReview(data?.weekly_calories_review && typeof data.weekly_calories_review === 'object' ? data.weekly_calories_review : null)
        setCoachingDataAvailability(normalizeCoachingDataAvailability(data?.data_availability))
      })
      .catch(error => {
        reportClientDiagnostic({
          source: 'dashboard_coaching_context_load',
          message: 'Dashboard coaching context failed to load.',
          error,
          context: {
            surface: 'dashboard',
          },
        })
        if (active) {
          setCoachingDataAvailability(current => ({
            ...current,
            coachingContextLoaded: true,
          }))
        }
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
    coachingDataAvailability,
    realSuccessStoryData,
    realSuccessStoryError,
    realSuccessStoryLoading,
    refreshRealSuccessStory,
    cardioLogs,
    smsReminders,
    meals,
    sleepLogs,
    stepLogs,
    weeklyCaloriesReview,
    weeklyWeights,
    workoutHistory,
  }
}

function normalizeCoachingDataAvailability(value) {
  const data = value && typeof value === 'object' ? value : {}

  return {
    coachingContextLoaded: Boolean(data.coaching_context_loaded ?? data.coachingContextLoaded),
    weightsLoaded: Boolean(data.weights_loaded ?? data.weightsLoaded),
    sleepLogsLoaded: Boolean(data.sleep_logs_loaded ?? data.sleepLogsLoaded),
    stepLogsLoaded: Boolean(data.step_logs_loaded ?? data.stepLogsLoaded),
    cardioLogsLoaded: Boolean(data.cardio_logs_loaded ?? data.cardioLogsLoaded),
    workoutHistoryLoaded: Boolean(data.workout_history_loaded ?? data.workoutHistoryLoaded),
    nutritionWindowLoaded: Boolean(data.nutrition_window_loaded ?? data.nutritionWindowLoaded),
    mealsLoaded: Boolean(data.meals_loaded ?? data.mealsLoaded),
  }
}
