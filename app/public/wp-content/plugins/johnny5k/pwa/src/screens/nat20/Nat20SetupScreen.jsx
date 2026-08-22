import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ironquestApi } from '../../api/modules/ironquest'
import { onboardingApi } from '../../api/modules/onboarding'
import { applyBrand } from '../../brands/registry'
import { useAuthStore } from '../../store/authStore'

const CLASSES = [
  { id: 'warrior', name: 'Vanguard', mark: '◆', oath: 'Power through the gate', detail: 'For bold, strength-led training and decisive action.' },
  { id: 'ranger', name: 'Wayfinder', mark: '⌁', oath: 'Outlast the long road', detail: 'For balanced movement, stamina, and steady momentum.' },
  { id: 'mage', name: 'Arcanist', mark: '✦', oath: 'Master the daily ritual', detail: 'For thoughtful systems, consistency, and measured progress.' },
  { id: 'rogue', name: 'Nightstep', mark: '◈', oath: 'Move before doubt', detail: 'For efficient sessions, adaptability, and quick wins.' },
]

const DRIVES = [
  { id: 'discipline', name: 'The Unbroken Ritual', detail: 'I want structure that becomes second nature.' },
  { id: 'strength', name: 'The Greater Might', detail: 'I want to feel powerful and capable.' },
  { id: 'transformation', name: 'The Changing Form', detail: 'I want visible proof of how far I have traveled.' },
  { id: 'redemption', name: 'The Returning Flame', detail: 'I am building my comeback one choice at a time.' },
]

const STEPS = ['Calling', 'Oath', 'Portrait']

export default function Nat20SetupScreen() {
  const navigate = useNavigate()
  const setExperienceMode = useAuthStore(state => state.setExperienceMode)
  const [step, setStep] = useState(0)
  const [classId, setClassId] = useState('warrior')
  const [driveId, setDriveId] = useState('discipline')
  const [profile, setProfile] = useState(null)
  const [headshot, setHeadshot] = useState({ configured: false })
  const [headshotSrc, setHeadshotSrc] = useState('')
  const [portraits, setPortraits] = useState([])
  const [portraitSrcs, setPortraitSrcs] = useState({})
  const [selectedPortraitId, setSelectedPortraitId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  const selectedClass = useMemo(() => CLASSES.find(item => item.id === classId) || CLASSES[0], [classId])
  const selectedDrive = useMemo(() => DRIVES.find(item => item.id === driveId) || DRIVES[0], [driveId])

  useEffect(() => {
    let active = true
    Promise.all([ironquestApi.profile(), onboardingApi.getState()])
      .then(([profileData, onboardingData]) => {
        if (!active) return
        const nextProfile = profileData?.profile || {}
        const nextHeadshot = onboardingData?.headshot || { configured: false }
        const nextPortraits = Array.isArray(onboardingData?.generated_images) ? onboardingData.generated_images : []
        setProfile(profileData)
        setClassId(nextProfile.class_slug || 'warrior')
        setDriveId(nextProfile.motivation_slug || 'discipline')
        setHeadshot(nextHeadshot)
        setPortraits(nextPortraits)
        setSelectedPortraitId(Number(nextProfile.starter_portrait_attachment_id || nextHeadshot.attachment_id || 0))
      })
      .catch(nextError => setError(nextError?.data?.message || nextError?.message || 'The character folio could not be opened.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!headshot?.configured) {
      setHeadshotSrc('')
      return undefined
    }
    let active = true
    let objectUrl = ''
    onboardingApi.headshotBlob().then(blob => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setHeadshotSrc(objectUrl)
    }).catch(() => setHeadshotSrc(''))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [headshot])

  useEffect(() => {
    if (!portraits.length) {
      setPortraitSrcs({})
      return undefined
    }
    let active = true
    const objectUrls = []
    Promise.all(portraits.map(async portrait => {
      const id = String(portrait?.id || '')
      if (!id) return null
      const blob = await onboardingApi.generatedImageBlob(id)
      const src = URL.createObjectURL(blob)
      objectUrls.push(src)
      return [id, src]
    })).then(entries => active && setPortraitSrcs(Object.fromEntries(entries.filter(Boolean))))
      .catch(() => active && setPortraitSrcs({}))
    return () => {
      active = false
      objectUrls.forEach(src => URL.revokeObjectURL(src))
    }
  }, [portraits])

  async function uploadHeadshot(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('headshot', file)
    setBusy(true)
    setError('')
    try {
      const data = await onboardingApi.uploadHeadshot(form)
      const nextHeadshot = data?.headshot || { configured: true }
      setHeadshot(nextHeadshot)
      setSelectedPortraitId(Number(nextHeadshot.attachment_id || 0))
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Your image could not be uploaded.')
    } finally {
      setBusy(false)
    }
  }

  async function generatePortraits() {
    if (!headshot?.configured) return
    setGenerating(true)
    setError('')
    try {
      const data = await onboardingApi.generateImages({
        count: 2,
        generation_context: 'ironquest',
        ironquest_class_slug: classId,
        ironquest_motivation_slug: driveId,
        prompt: `A grounded fantasy adventurer portrait for Nat20 Fitness. ${selectedClass.name}, guided by ${selectedDrive.name}.`,
      })
      const nextPortraits = Array.isArray(data?.generated_images) ? data.generated_images : []
      setPortraits(nextPortraits)
      if (nextPortraits[0]?.attachment_id) setSelectedPortraitId(Number(nextPortraits[0].attachment_id))
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'The portrait spell failed. Try again in a moment.')
    } finally {
      setGenerating(false)
    }
  }

  async function finishSetup() {
    setBusy(true)
    setError('')
    try {
      if (!profile?.profile?.enabled) await ironquestApi.enable()
      await ironquestApi.saveIdentity({
        class_slug: classId,
        motivation_slug: driveId,
        starter_portrait_attachment_id: selectedPortraitId,
      })
      applyBrand('nat20')
      setExperienceMode('standard')
      setComplete(true)
    } catch (nextError) {
      setError(nextError?.data?.message || nextError?.message || 'Your character could not be sealed yet.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <main className="nat20-setup nat20-setup-loading"><div className="nat20-eye-seal" aria-hidden="true"><i /></div><p>Opening the character folio…</p></main>

  if (complete) {
    return (
      <main className="nat20-setup nat20-setup-complete">
        <section className="nat20-complete-folio">
          <span className="nat20-kicker">The seal is set</span>
          <div className="nat20-eye-seal" aria-hidden="true"><i /></div>
          <h1>{selectedClass.name}, your road begins.</h1>
          <p>Your Johnny5k history remains intact. Nat20 will now tell the story around it.</p>
          <button type="button" className="nat20-primary-action" onClick={() => navigate('/nat20')}>Enter Nat20</button>
        </section>
      </main>
    )
  }

  return (
    <main className="nat20-setup">
      <header className="nat20-setup-header">
        <button type="button" className="nat20-text-action" onClick={() => navigate('/settings')}>← Leave setup</button>
        <div><span className="nat20-kicker">Nat20 Fitness</span><h1>Forge your adventurer</h1></div>
        <span className="nat20-step-count">{step + 1} / {STEPS.length}</span>
      </header>

      <nav className="nat20-step-nav" aria-label="Character setup progress">
        {STEPS.map((label, index) => <span key={label} className={index <= step ? 'is-lit' : ''}><b>{index + 1}</b>{label}</span>)}
      </nav>

      <div className="nat20-forge-layout">
        <section className="nat20-choice-stage">
          {step === 0 ? (
            <fieldset>
              <legend>Choose your calling</legend>
              <p className="nat20-stage-copy">This changes the voice and framing of your adventure—not your workout plan.</p>
              <div className="nat20-class-grid">
                {CLASSES.map(option => (
                  <button key={option.id} type="button" className={classId === option.id ? 'is-selected' : ''} onClick={() => setClassId(option.id)} aria-pressed={classId === option.id}>
                    <i aria-hidden="true">{option.mark}</i><span><strong>{option.name}</strong><small>{option.oath}</small></span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset>
              <legend>Name the force that moves you</legend>
              <p className="nat20-stage-copy">Your oath guides the tone of quests, milestones, and encouragement.</p>
              <div className="nat20-drive-list">
                {DRIVES.map(option => (
                  <button key={option.id} type="button" className={driveId === option.id ? 'is-selected' : ''} onClick={() => setDriveId(option.id)} aria-pressed={driveId === option.id}>
                    <span /><strong>{option.name}</strong><small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset>
              <legend>Set your likeness</legend>
              <p className="nat20-stage-copy">A portrait is optional. Upload a photo to use directly or transform it into your adventurer.</p>
              <div className="nat20-portrait-actions">
                <label className="nat20-upload-action"><input type="file" accept="image/*" onChange={uploadHeadshot} disabled={busy || generating} />{busy ? 'Uploading…' : headshot?.configured ? 'Replace source photo' : 'Upload source photo'}</label>
                <button type="button" onClick={generatePortraits} disabled={!headshot?.configured || busy || generating}>{generating ? 'Casting portrait spell…' : 'Create 2 magical portraits'}</button>
              </div>
              <div className="nat20-portrait-grid">
                {headshotSrc ? <PortraitChoice src={headshotSrc} label="Original likeness" id={Number(headshot.attachment_id || 0)} selectedId={selectedPortraitId} onSelect={setSelectedPortraitId} /> : null}
                {portraits.map(portrait => <PortraitChoice key={portrait.id} src={portraitSrcs[String(portrait.id)]} label={portrait.scenario || 'Generated adventurer'} id={Number(portrait.attachment_id || 0)} selectedId={selectedPortraitId} onSelect={setSelectedPortraitId} />)}
                {!headshotSrc && !portraits.length ? <div className="nat20-empty-portrait"><div className="nat20-eye-seal" aria-hidden="true"><i /></div><span>Your likeness awaits</span></div> : null}
              </div>
            </fieldset>
          ) : null}

          {error ? <p className="nat20-setup-error" role="alert">{error}</p> : null}
          <div className="nat20-stage-actions">
            <button type="button" className="nat20-back-action" onClick={() => setStep(current => Math.max(0, current - 1))} disabled={step === 0 || busy}>Back</button>
            {step < STEPS.length - 1
              ? <button type="button" className="nat20-primary-action" onClick={() => setStep(current => current + 1)}>Continue the forging</button>
              : <button type="button" className="nat20-primary-action" onClick={finishSetup} disabled={busy || generating}>{busy ? 'Sealing character…' : 'Seal my character'}</button>}
          </div>
        </section>

        <aside className="nat20-character-folio" aria-live="polite">
          <div className="nat20-folio-corner" aria-hidden="true" />
          <span className="nat20-kicker">Adventurer’s folio</span>
          <div className="nat20-folio-portrait">
            {selectedPortraitId && (selectedPortraitId === Number(headshot.attachment_id || 0) ? headshotSrc : portraitSrcs[String(portraits.find(item => Number(item.attachment_id) === selectedPortraitId)?.id)])
              ? <img src={selectedPortraitId === Number(headshot.attachment_id || 0) ? headshotSrc : portraitSrcs[String(portraits.find(item => Number(item.attachment_id) === selectedPortraitId)?.id)]} alt="Selected character portrait" />
              : <div className="nat20-eye-seal" aria-hidden="true"><i /></div>}
          </div>
          <h2>{selectedClass.name}</h2>
          <p className="nat20-folio-oath">“{selectedClass.oath}.”</p>
          <dl><div><dt>Calling</dt><dd>{selectedClass.detail}</dd></div><div><dt>Guiding oath</dt><dd>{selectedDrive.name}</dd></div><div><dt>Origin</dt><dd>Johnny5k traveler</dd></div></dl>
          <small>Your health data stays factual. Nat20 changes the story around the work.</small>
        </aside>
      </div>
    </main>
  )
}

function PortraitChoice({ src, label, id, selectedId, onSelect }) {
  if (!src || !id) return null
  return <button type="button" className={`nat20-portrait-choice ${id === selectedId ? 'is-selected' : ''}`} onClick={() => onSelect(id)} aria-pressed={id === selectedId}><img src={src} alt="" /><span>{label}</span></button>
}
