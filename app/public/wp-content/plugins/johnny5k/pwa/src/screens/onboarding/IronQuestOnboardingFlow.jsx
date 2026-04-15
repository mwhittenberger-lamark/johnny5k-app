import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import { onboardingApi } from '../../api/modules/onboarding'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import ErrorState from '../../components/ui/ErrorState'
import { resolveExperienceModeFromIronQuestPayload } from '../../lib/experienceMode'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { useAuthStore } from '../../store/authStore'

const IRONQUEST_CLASS_OPTIONS = [
  { value: 'warrior', label: 'Warrior', summary: 'Lift heavy. Dominate.', detail: 'Direct and durable. Best if you want your quest tone to feel physical and relentless.' },
  { value: 'ranger', label: 'Ranger', summary: 'Move fast. Endure.', detail: 'Balanced and disciplined. A good fit if you like steady training momentum and range.' },
  { value: 'mage', label: 'Mage', summary: 'Stay consistent. Control.', detail: 'Calculated and focused. Good for a more cerebral, ritual-driven progression vibe.' },
  { value: 'rogue', label: 'Rogue', summary: 'Start small. Stay sharp.', detail: 'Fast and adaptable. Fits a scrappier, efficient training identity.' },
]

const IRONQUEST_MOTIVATION_OPTIONS = [
  { value: 'discipline', label: 'Discipline', summary: 'Steady structure.', detail: 'You want consistent reps, clear structure, and visible momentum.' },
  { value: 'strength', label: 'Strength', summary: 'Raw capability.', detail: 'You care most about feeling powerful and capable.' },
  { value: 'transformation', label: 'Transformation', summary: 'Visible change.', detail: 'You want the quest framed around physical change and progress.' },
  { value: 'redemption', label: 'Redemption', summary: 'Comeback arc.', detail: 'You want a sharper comeback story and harder-edged tone.' },
]

const IRONQUEST_STEPS = [
  { key: 'intro', label: 'Hook' },
  { key: 'class', label: 'Class' },
  { key: 'motivation', label: 'Drive' },
  { key: 'image', label: 'Image' },
  { key: 'ready', label: 'Launch' },
]

const IRONQUEST_STEP_INDEX = IRONQUEST_STEPS.reduce((map, step, index) => {
  map[step.key] = index
  return map
}, {})

function renderLoadingScreen(title) {
  return (
    <AppLoadingScreen
      eyebrow="IronQuest"
      title={title}
      message="Johnny is loading your quest entitlement, identity state, and starting region so the add-on setup stays in sync with the plan you just built."
      compact
      variant="panel"
    />
  )
}

function formatOptionLabel(options, value, fallback = 'Unchosen') {
  const match = options.find((option) => option.value === String(value || '').trim())
  return match?.label || fallback
}

function buildMissionLabel(payload) {
  const activeMissionSlug = String(payload?.profile?.active_mission_slug || '').trim()
  const activeMission = (payload?.missions ?? []).find((mission) => mission.slug === activeMissionSlug)
  return activeMission?.name || payload?.active_run?.mission_slug || 'Awaiting first mission'
}

function IronQuestStepLayout({ stepKey, title, subtitle, children, aside }) {
  const currentIndex = IRONQUEST_STEP_INDEX[stepKey] ?? 0
  const totalTransitions = Math.max(1, IRONQUEST_STEPS.length - 1)
  const percentComplete = Math.round((currentIndex / totalTransitions) * 100)

  return (
    <div className="onboarding-screen ironquest-onboarding-screen">
      <div className="dash-card onboarding-progress-card ironquest-onboarding-progress-card">
        <div className="onboarding-progress-top">
          <span>IronQuest layer</span>
          <span>{IRONQUEST_STEPS[currentIndex]?.label || 'Quest setup'}</span>
        </div>
        <div className="onboarding-progress-track" aria-hidden="true">
          <span className="onboarding-progress-fill" style={{ width: `${percentComplete}%` }} />
        </div>
        <div className="onboarding-progress-steps" aria-hidden="true">
          {IRONQUEST_STEPS.map((step, index) => (
            <span key={step.key} className={`onboarding-progress-step ${index <= currentIndex ? 'active' : ''}`} />
          ))}
        </div>
      </div>
      <div className="dash-card ironquest-onboarding-header-card">
        <span className="dashboard-chip subtle">Builds on top of Johnny5k</span>
        <h2>{title}</h2>
        {subtitle ? <p className="settings-subtitle">{subtitle}</p> : null}
      </div>
      {aside ? <div className="dash-card ironquest-onboarding-aside">{aside}</div> : null}
      {children}
    </div>
  )
}

function IntroStep() {
  const navigate = useNavigate()

  return (
    <IronQuestStepLayout
      stepKey="intro"
      title="You can enter IronQuest without changing your Johnny5k plan"
      subtitle="This is a secondary setup pass. Your calories, split, meals, and reminders are already ready. IronQuest only adds identity, mission framing, and map progression on top."
      aside={
        <>
          <strong>What stays the same</strong>
          <p>Your workouts, nutrition targets, and daily plan stay exactly as Johnny just built them.</p>
        </>
      }
    >
      <div className="dash-card ironquest-onboarding-hero-card">
        <p className="ironquest-onboarding-hero-copy">You are about to enter IronQuest. First, choose how Johnny should frame your quest identity.</p>
        <div className="ironquest-onboarding-actions">
          <button className="btn-primary" type="button" onClick={() => navigate('/onboarding/ironquest/class')}>Begin IronQuest setup</button>
          <button className="btn-secondary" type="button" onClick={() => navigate('/dashboard')}>Skip for now</button>
        </div>
      </div>
    </IronQuestStepLayout>
  )
}

function ClassStep({ selectedClass, onSelectClass }) {
  const navigate = useNavigate()
  const selectedOption = IRONQUEST_CLASS_OPTIONS.find((option) => option.value === selectedClass) ?? IRONQUEST_CLASS_OPTIONS[0]

  return (
    <IronQuestStepLayout
      stepKey="class"
      title="Choose your class"
      subtitle="Pick the tone that should sit on top of your training. You can change this later."
      aside={
        <>
          <strong>Current pick</strong>
          <p>{selectedOption.label}: {selectedOption.detail}</p>
        </>
      }
    >
      <div className="ironquest-onboarding-choice-grid">
        {IRONQUEST_CLASS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`dash-card ironquest-onboarding-choice-card ${selectedClass === option.value ? 'active' : ''}`}
            onClick={() => onSelectClass(option.value)}
          >
            <span>{option.label}</span>
            <strong>{option.summary}</strong>
            <p>{option.detail}</p>
          </button>
        ))}
      </div>
      <div className="ironquest-onboarding-actions">
        <button className="btn-secondary" type="button" onClick={() => navigate('/onboarding/ironquest')}>Back</button>
        <button className="btn-primary" type="button" onClick={() => navigate('/onboarding/ironquest/motivation')}>Continue</button>
      </div>
    </IronQuestStepLayout>
  )
}

function MotivationStep({ selectedMotivation, onSelectMotivation, selectedClass, submitting, error }) {
  const navigate = useNavigate()
  const selectedClassLabel = formatOptionLabel(IRONQUEST_CLASS_OPTIONS, selectedClass, 'Class pending')
  const selectedOption = IRONQUEST_MOTIVATION_OPTIONS.find((option) => option.value === selectedMotivation) ?? IRONQUEST_MOTIVATION_OPTIONS[0]

  return (
    <IronQuestStepLayout
      stepKey="motivation"
      title="What drives you?"
      subtitle="This choice personalizes the tone of the quest layer while leaving your core plan untouched."
      aside={
        <>
          <strong>Quest identity</strong>
          <p>{selectedClassLabel} with a {selectedOption.label.toLowerCase()} arc.</p>
        </>
      }
    >
      <div className="ironquest-onboarding-choice-grid">
        {IRONQUEST_MOTIVATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`dash-card ironquest-onboarding-choice-card ${selectedMotivation === option.value ? 'active' : ''}`}
            onClick={() => onSelectMotivation(option.value)}
          >
            <span>{option.label}</span>
            <strong>{option.summary}</strong>
            <p>{option.detail}</p>
          </button>
        ))}
      </div>
      {error ? <ErrorState className="onboarding-inline-error" message={error} title="IronQuest could not be activated" /> : null}
      <div className="ironquest-onboarding-actions">
        <button className="btn-secondary" type="button" onClick={() => navigate('/onboarding/ironquest/class')}>Back</button>
        <button className="btn-primary" type="button" onClick={() => navigate('/onboarding/ironquest/image')} disabled={submitting}>
          Continue to image
        </button>
      </div>
    </IronQuestStepLayout>
  )
}

function PortraitStep({
  headshot,
  headshotSrc,
  generatedImages,
  generatedImageSrcs,
  selectedPortraitAttachmentId,
  generationPrompt,
  generationCount,
  headshotUploading,
  generatingImages,
  error,
  message,
  onUploadHeadshot,
  onDeleteHeadshot,
  onGenerationPromptChange,
  onGenerationCountChange,
  onGenerateImages,
  onSelectPortrait,
  onFinish,
  submitting,
}) {
  const navigate = useNavigate()
  const selectedPortrait = Number(selectedPortraitAttachmentId || 0)
  const selectedGeneratedImage = generatedImages.find((image) => Number(image?.attachment_id || 0) === selectedPortrait) ?? null
  const selectedSummary = selectedGeneratedImage
    ? selectedGeneratedImage.scenario || 'Generated portrait selected'
    : headshot?.configured && Number(headshot?.attachment_id || 0) === selectedPortrait
      ? 'Using uploaded headshot as the starter portrait'
      : 'No portrait selected yet'

  return (
    <IronQuestStepLayout
      stepKey="image"
      title="See yourself in IronQuest"
      subtitle="Upload a face image, optionally generate Johnny scenes, then choose the portrait IronQuest should use for your starter identity."
      aside={
        <>
          <strong>Starter portrait</strong>
          <p>{selectedSummary}</p>
        </>
      }
    >
      <div className="dash-card ironquest-onboarding-hero-card ironquest-onboarding-portrait-card">
        <div className="ironquest-onboarding-portrait-grid">
          <div className="ironquest-onboarding-portrait-preview-shell">
            {headshotSrc ? (
              <img src={headshotSrc} alt="Uploaded headshot" className="ironquest-onboarding-portrait-preview" />
            ) : (
              <div className="ironquest-onboarding-portrait-empty">Upload a clear face photo to seed your starter portrait.</div>
            )}
          </div>
          <div className="ironquest-onboarding-portrait-controls">
            <div className="ironquest-onboarding-actions">
              <label className="btn-secondary ironquest-onboarding-upload-trigger">
                <input type="file" accept="image/*" onChange={onUploadHeadshot} disabled={headshotUploading || generatingImages || submitting} />
                {headshotUploading ? 'Uploading…' : headshot?.configured ? 'Replace image' : 'Upload image'}
              </label>
              {headshot?.configured ? (
                <button className="btn-outline" type="button" onClick={onDeleteHeadshot} disabled={headshotUploading || generatingImages || submitting}>
                  Remove image
                </button>
              ) : null}
            </div>
            {headshot?.configured ? (
              <button
                type="button"
                className={`ironquest-onboarding-select-card ${Number(headshot?.attachment_id || 0) === selectedPortrait ? 'active' : ''}`}
                onClick={() => onSelectPortrait(Number(headshot?.attachment_id || 0))}
              >
                <strong>Use uploaded headshot</strong>
                <span>Fastest path. You can swap to a generated image later.</span>
              </button>
            ) : null}
            <label>
              Extra image direction
              <textarea
                rows="3"
                value={generationPrompt}
                onChange={(event) => onGenerationPromptChange(event.target.value)}
                placeholder="Optional: add scene direction like torch-lit stronghold, cold dawn roadwork, or heavy barbell hall."
                disabled={generatingImages || submitting}
              />
            </label>
            <label>
              Images to generate
              <select value={generationCount} onChange={(event) => onGenerationCountChange(Number(event.target.value))} disabled={generatingImages || submitting}>
                <option value={1}>1 image</option>
                <option value={2}>2 images</option>
              </select>
            </label>
            <div className="ironquest-onboarding-actions">
              <button className="btn-primary" type="button" onClick={onGenerateImages} disabled={!headshot?.configured || generatingImages || headshotUploading || submitting}>
                {generatingImages ? 'Generating…' : `Generate ${generationCount} portrait${generationCount === 1 ? '' : 's'}`}
              </button>
            </div>
            {error ? <ErrorState className="onboarding-inline-error" message={error} title="Portrait setup could not update" /> : null}
            {message ? <p className="success-message">{message}</p> : null}
          </div>
        </div>
      </div>
      {generatedImages.length ? (
        <div className="ironquest-onboarding-choice-grid ironquest-onboarding-image-grid">
          {generatedImages.map((image) => {
            const attachmentId = Number(image?.attachment_id || 0)
            const isSelected = attachmentId === selectedPortrait
            return (
              <button
                key={image.id}
                type="button"
                className={`dash-card ironquest-onboarding-choice-card ironquest-onboarding-image-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectPortrait(attachmentId)}
              >
                {generatedImageSrcs[image.id] ? (
                  <img src={generatedImageSrcs[image.id]} alt={image.scenario || 'Generated portrait'} className="ironquest-onboarding-generated-preview" />
                ) : (
                  <div className="ironquest-onboarding-generated-empty">Loading preview…</div>
                )}
                <span>{image.scenario || 'Generated portrait'}</span>
                <strong>{isSelected ? 'Selected starter portrait' : 'Tap to use this portrait'}</strong>
                <p>{image.created_at || 'Just now'}</p>
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="ironquest-onboarding-actions">
        <button className="btn-secondary" type="button" onClick={() => navigate('/onboarding/ironquest/motivation')} disabled={submitting}>Back</button>
        <button className="btn-outline" type="button" onClick={() => onSelectPortrait(0)} disabled={submitting}>Skip image for now</button>
        <button className="btn-primary" type="button" onClick={onFinish} disabled={submitting || headshotUploading || generatingImages}>
          {submitting ? 'Forging identity…' : 'Finish IronQuest setup'}
        </button>
      </div>
    </IronQuestStepLayout>
  )
}

function ReadyStep({ ironQuest }) {
  const navigate = useNavigate()
  const profile = ironQuest?.profile ?? {}
  const location = ironQuest?.location ?? null
  const missionLabel = buildMissionLabel(ironQuest)
  const starterPortrait = useIronQuestStarterPortrait(profile.starter_portrait_attachment_id)

  return (
    <IronQuestStepLayout
      stepKey="ready"
      title="Your quest profile is live"
      subtitle="Johnny5k stays responsible for the plan. IronQuest now frames that same work as region progress, missions, XP, and gold."
      aside={
        <>
          <strong>Identity locked in</strong>
          <p>{formatOptionLabel(IRONQUEST_CLASS_OPTIONS, profile.class_slug)} | {formatOptionLabel(IRONQUEST_MOTIVATION_OPTIONS, profile.motivation_slug)}</p>
        </>
      }
    >
      {starterPortrait?.src ? (
        <div className="dash-card ironquest-onboarding-ready-card">
          <div className="ironquest-onboarding-ready-portrait-frame">
            <img src={starterPortrait.src} alt={starterPortrait.label || 'Starter portrait'} className="ironquest-onboarding-ready-portrait" />
          </div>
          <div className="ironquest-onboarding-ready-copy">
            <strong>Starter portrait locked</strong>
            <p>This portrait now follows your quest hub and workout mission moments.</p>
          </div>
        </div>
      ) : null}
      <div className="dash-card settings-section">
        <div className="onboarding-review-list">
          <div className="onboarding-review-row"><span>Current region</span><strong>{location?.name || 'The Training Grounds'}</strong></div>
          <div className="onboarding-review-row"><span>First mission</span><strong>{missionLabel}</strong></div>
          <div className="onboarding-review-row"><span>Resources</span><strong>{profile.xp || 0} XP | {profile.gold || 0} gold</strong></div>
        </div>
      </div>
      <div className="dash-card ironquest-onboarding-hero-card">
        <p className="ironquest-onboarding-hero-copy">Start a workout and Johnny will now run the session with the IronQuest layer active behind it.</p>
        <div className="ironquest-onboarding-actions">
          <button className="btn-primary" type="button" onClick={() => navigate('/ironquest')}>Open quest hub</button>
          <button className="btn-secondary" type="button" onClick={() => navigate('/dashboard')}>Open dashboard</button>
        </div>
      </div>
    </IronQuestStepLayout>
  )
}

export default function IronQuestOnboardingFlow() {
  const navigate = useNavigate()
  const setExperienceMode = useAuthStore((state) => state.setExperienceMode)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ironQuest, setIronQuest] = useState(null)
  const [headshot, setHeadshot] = useState({ configured: false })
  const [headshotSrc, setHeadshotSrc] = useState('')
  const [generatedImages, setGeneratedImages] = useState([])
  const [generatedImageSrcs, setGeneratedImageSrcs] = useState({})
  const [selectedPortraitAttachmentId, setSelectedPortraitAttachmentId] = useState(0)
  const [headshotUploading, setHeadshotUploading] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generationCount, setGenerationCount] = useState(1)
  const [selectedClass, setSelectedClass] = useState(IRONQUEST_CLASS_OPTIONS[0].value)
  const [selectedMotivation, setSelectedMotivation] = useState(IRONQUEST_MOTIVATION_OPTIONS[0].value)

  const applyIronQuestState = useCallback((payload) => {
    setIronQuest(payload)
    const nextClass = String(payload?.profile?.class_slug || '').trim()
    const nextMotivation = String(payload?.profile?.motivation_slug || '').trim()
    const nextPortraitAttachmentId = Number(payload?.profile?.starter_portrait_attachment_id || 0)

    if (nextClass) {
      setSelectedClass(nextClass)
    }

    if (nextMotivation) {
      setSelectedMotivation(nextMotivation)
    }

    if (nextPortraitAttachmentId > 0) {
      setSelectedPortraitAttachmentId(nextPortraitAttachmentId)
    }
  }, [])

  const applyOnboardingAssets = useCallback((payload) => {
    const nextHeadshot = payload?.headshot ?? { configured: false }
    const nextGeneratedImages = Array.isArray(payload?.generated_images) ? payload.generated_images : []
    setHeadshot(nextHeadshot)
    setGeneratedImages(nextGeneratedImages)

    setSelectedPortraitAttachmentId((current) => {
      if (current > 0) return current
      if (Number(ironQuest?.profile?.starter_portrait_attachment_id || 0) > 0) {
        return Number(ironQuest?.profile?.starter_portrait_attachment_id || 0)
      }
      if (Number(nextHeadshot?.attachment_id || 0) > 0) {
        return Number(nextHeadshot.attachment_id)
      }
      return 0
    })
  }, [ironQuest?.profile?.starter_portrait_attachment_id])

  async function loadOnboardingAssets() {
    const data = await onboardingApi.getState()
    applyOnboardingAssets(data)
    return data
  }

  useEffect(() => {
    let active = true

    Promise.all([ironquestApi.profile(), onboardingApi.getState()])
      .then(([ironQuestData, onboardingData]) => {
        if (!active) return
        setExperienceMode(resolveExperienceModeFromIronQuestPayload(ironQuestData))
        applyIronQuestState(ironQuestData)
        applyOnboardingAssets(onboardingData)
      })
      .catch((nextError) => {
        if (!active) return
        setError(nextError?.data?.message || nextError?.message || 'Could not load IronQuest right now.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [applyIronQuestState, applyOnboardingAssets, setExperienceMode])

  useEffect(() => {
    if (!headshot?.configured) {
      setHeadshotSrc('')
      return undefined
    }

    let active = true
    let objectUrl = ''

    onboardingApi.headshotBlob()
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setHeadshotSrc(objectUrl)
      })
      .catch(() => {
        if (!active) return
        setHeadshotSrc('')
      })

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [headshot])

  useEffect(() => {
    let active = true
    const objectUrls = []

    if (!generatedImages.length) {
      setGeneratedImageSrcs({})
      return undefined
    }

    Promise.all(
      generatedImages.map(async (image) => {
        const imageId = String(image?.id || '').trim()
        if (!imageId) return null
        const blob = await onboardingApi.generatedImageBlob(imageId)
        const objectUrl = URL.createObjectURL(blob)
        objectUrls.push(objectUrl)
        return [imageId, objectUrl]
      }),
    )
      .then((entries) => {
        if (!active) return
        setGeneratedImageSrcs(Object.fromEntries(entries.filter(Boolean)))
      })
      .catch(() => {
        if (!active) return
        setGeneratedImageSrcs({})
      })

    return () => {
      active = false
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [generatedImages])

  const profile = ironQuest?.profile ?? {}
  const hasAccess = Boolean(ironQuest?.entitlement?.has_access)
  const hasIdentity = Boolean(profile.class_slug && profile.motivation_slug)
  const isReady = Boolean(profile.enabled && hasIdentity)

  const finishSetup = async () => {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (!profile.enabled) {
        await ironquestApi.enable()
      }

      await ironquestApi.saveIdentity({
        class_slug: selectedClass,
        motivation_slug: selectedMotivation,
        starter_portrait_attachment_id: selectedPortraitAttachmentId,
      })

      const [payload] = await Promise.all([ironquestApi.profile(), loadOnboardingAssets()])
      setExperienceMode(resolveExperienceModeFromIronQuestPayload(payload))
      applyIronQuestState(payload)
      navigate('/onboarding/ironquest/ready')
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Could not activate IronQuest right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleHeadshotUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const formData = new FormData()
    formData.append('headshot', file)

    setHeadshotUploading(true)
    setError('')
    setMessage('')

    try {
      const data = await onboardingApi.uploadHeadshot(formData)
      const nextHeadshot = data?.headshot ?? { configured: true }
      setHeadshot(nextHeadshot)
      if (Number(nextHeadshot?.attachment_id || 0) > 0) {
        setSelectedPortraitAttachmentId(Number(nextHeadshot.attachment_id))
      }
      setMessage('Image uploaded. You can use the headshot directly or generate a stylized portrait.')
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Could not upload your image right now.')
    } finally {
      setHeadshotUploading(false)
    }
  }

  const handleHeadshotDelete = async () => {
    setHeadshotUploading(true)
    setError('')
    setMessage('')

    try {
      await onboardingApi.deleteHeadshot()
      setHeadshot({ configured: false })
      setGeneratedImages([])
      setSelectedPortraitAttachmentId(0)
      setMessage('Image removed.')
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Could not remove your image right now.')
    } finally {
      setHeadshotUploading(false)
    }
  }

  const handleGenerateImages = async () => {
    if (!headshot?.configured) return

    setGeneratingImages(true)
    setError('')
    setMessage('')

    try {
      const data = await onboardingApi.generateImages({
        prompt: generationPrompt.trim(),
        count: generationCount,
      })
      const nextImages = Array.isArray(data?.generated_images) ? data.generated_images : []
      setGeneratedImages(nextImages)
      if (nextImages[0]?.attachment_id) {
        setSelectedPortraitAttachmentId(Number(nextImages[0].attachment_id))
      }
      setMessage(`Generated ${generationCount} portrait image${generationCount === 1 ? '' : 's'}.`)
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Could not generate portraits right now.')
    } finally {
      setGeneratingImages(false)
    }
  }

  const readyElement = useMemo(() => <ReadyStep ironQuest={ironQuest} />, [ironQuest])

  if (loading) {
    return renderLoadingScreen('Loading IronQuest setup')
  }

  if (error && !ironQuest) {
    return (
      <div className="onboarding-screen ironquest-onboarding-screen">
        <div className="dash-card settings-section">
          <ErrorState className="onboarding-inline-error" message={error} title="IronQuest setup could not load" />
          <div className="ironquest-onboarding-actions">
            <button className="btn-secondary" type="button" onClick={() => navigate('/dashboard')}>Open dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Routes>
      <Route index element={isReady ? <Navigate to="/onboarding/ironquest/ready" replace /> : <IntroStep />} />
      <Route path="class" element={isReady ? <Navigate to="/onboarding/ironquest/ready" replace /> : <ClassStep selectedClass={selectedClass} onSelectClass={setSelectedClass} />} />
      <Route path="motivation" element={isReady ? <Navigate to="/onboarding/ironquest/ready" replace /> : <MotivationStep selectedMotivation={selectedMotivation} onSelectMotivation={setSelectedMotivation} selectedClass={selectedClass} submitting={submitting} error={error} />} />
      <Route path="image" element={isReady ? <Navigate to="/onboarding/ironquest/ready" replace /> : <PortraitStep headshot={headshot} headshotSrc={headshotSrc} generatedImages={generatedImages} generatedImageSrcs={generatedImageSrcs} selectedPortraitAttachmentId={selectedPortraitAttachmentId} generationPrompt={generationPrompt} generationCount={generationCount} headshotUploading={headshotUploading} generatingImages={generatingImages} error={error} message={message} onUploadHeadshot={handleHeadshotUpload} onDeleteHeadshot={handleHeadshotDelete} onGenerationPromptChange={setGenerationPrompt} onGenerationCountChange={setGenerationCount} onGenerateImages={handleGenerateImages} onSelectPortrait={setSelectedPortraitAttachmentId} onFinish={finishSetup} submitting={submitting} />} />
      <Route path="ready" element={readyElement} />
      <Route path="*" element={<Navigate to="/onboarding/ironquest" replace />} />
    </Routes>
  )
}