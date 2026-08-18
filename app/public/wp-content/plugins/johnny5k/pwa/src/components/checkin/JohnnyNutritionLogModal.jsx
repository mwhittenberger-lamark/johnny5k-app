import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { aiApi } from '../../api/modules/ai'
import { nutritionApi } from '../../api/modules/nutrition'
import AppDialog from '../ui/AppDialog'
import LabelScanPromptPanel from '../nutrition/LabelScanPromptPanel'
import { confirmGlobalAction } from '../../lib/uiFeedback'

const LATE_BREAKFAST_HOUR = 11

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatHour(hour) {
  const normalized = ((hour % 24) + 24) % 24
  const period = normalized >= 12 ? 'pm' : 'am'
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12
  return `${displayHour}${period}`
}

export default function JohnnyNutritionLogModal({ onClose }) {
  const closeRef = useRef(null)
  const mealPhotoInputRef = useRef(null)
  const labelFrontInputRef = useRef(null)
  const labelBackInputRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const [activePanel, setActivePanel] = useState('today')
  const [summary, setSummary] = useState(null)
  const [meals, setMeals] = useState([])
  const [savedMeals, setSavedMeals] = useState([])
  const [savedFoods, setSavedFoods] = useState([])
  const [recipes, setRecipes] = useState([])
  const [planSlots, setPlanSlots] = useState({ breakfast: [], lunch: [], dinner: [], snack: [] })
  const [activePlanSlot, setActivePlanSlot] = useState('breakfast')
  const [tileCreator, setTileCreator] = useState('')
  const [tileForm, setTileForm] = useState(emptyTileForm)
  const [tileBusy, setTileBusy] = useState(false)
  const [tileScanImages, setTileScanImages] = useState({ front: '', back: '' })
  const [tileScanNote, setTileScanNote] = useState('')
  const [lockingPlan, setLockingPlan] = useState('')
  const [mealDescription, setMealDescription] = useState('')
  const [mealPhoto, setMealPhoto] = useState(null)
  const [mealEntryMode, setMealEntryMode] = useState('photo')
  const [mealType, setMealType] = useState('breakfast')
  const [mealDraft, setMealDraft] = useState(null)
  const [analyzingMeal, setAnalyzingMeal] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribingVoice, setTranscribingVoice] = useState(false)
  const [savingMeal, setSavingMeal] = useState(false)
  const [water, setWater] = useState({ glasses: 0, target: 6 })
  const [loading, setLoading] = useState(true)
  const [savingWater, setSavingWater] = useState(false)
  const [drinkQuery, setDrinkQuery] = useState('')
  const [drinkSuggestions, setDrinkSuggestions] = useState([])
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [drinkMultiplier, setDrinkMultiplier] = useState(1)
  const [searchingDrinks, setSearchingDrinks] = useState(false)
  const [lookingUpDrink, setLookingUpDrink] = useState(false)
  const [savingDrink, setSavingDrink] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const drinkServingOptions = buildDrinkServingOptions(selectedDrink)

  useEffect(() => {
    let active = true
    Promise.all([
      nutritionApi.getBeverageBoard(today()).catch(() => null),
      nutritionApi.getSummary(today()).catch(() => null),
      nutritionApi.getMeals(today()).catch(() => []),
      nutritionApi.getSavedMeals().catch(() => []),
      nutritionApi.getSavedFoods?.().catch(() => []) ?? Promise.resolve([]),
      nutritionApi.getRecipes?.().catch(() => []) ?? Promise.resolve([]),
    ]).then(([board, nutritionSummary, recentMeals, mealLibrary, foodLibrary, recipeLibrary]) => {
      if (!active) return
      const boardWater = board?.water || {}
      setWater({
        glasses: Number(boardWater.glasses) || 0,
        target: Number(boardWater.target_glasses) || 6,
      })
      setSummary(nutritionSummary)
      setMeals(Array.isArray(recentMeals) ? recentMeals : [])
      setSavedMeals(Array.isArray(mealLibrary) ? mealLibrary : [])
      setSavedFoods(Array.isArray(foodLibrary) ? foodLibrary : [])
      setRecipes(Array.isArray(recipeLibrary) ? recipeLibrary : [])
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const query = drinkQuery.trim()
    if (query.length < 2 || selectedDrink) {
      setDrinkSuggestions([])
      return undefined
    }
    let active = true
    const timeout = window.setTimeout(async () => {
      setSearchingDrinks(true)
      try {
        const results = await nutritionApi.searchFoods(query, { beverageOnly: true })
        if (active) setDrinkSuggestions(Array.isArray(results) ? results : [])
      } catch {
        if (active) setDrinkSuggestions([])
      } finally {
        if (active) setSearchingDrinks(false)
      }
    }, 120)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [drinkQuery, selectedDrink])

  useEffect(() => () => {
    speechRecognitionRef.current?.stop?.()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks?.().forEach(track => track.stop())
  }, [])

  async function updateWater(nextGlasses) {
    const previous = water.glasses
    setWater(current => ({ ...current, glasses: nextGlasses }))
    setSavingWater(true)
    setError('')
    setStatus('')
    try {
      const result = await nutritionApi.setWaterIntake(today(), nextGlasses)
      const resultWater = result?.water
      if (resultWater) setWater({ glasses: Number(resultWater.glasses) || 0, target: Number(resultWater.target_glasses) || water.target })
      setStatus(`Water updated to ${nextGlasses} of ${water.target} glasses.`)
    } catch (saveError) {
      setWater(current => ({ ...current, glasses: previous }))
      setError(saveError?.message || 'Water could not be updated. Try again.')
    } finally {
      setSavingWater(false)
    }
  }

  function chooseDrink(drink) {
    const normalized = normalizeDrink(drink)
    setSelectedDrink(normalized)
    setDrinkQuery(drinkLabel(normalized))
    setDrinkMultiplier(1)
    setDrinkSuggestions([])
  }

  async function lookupDrink() {
    const query = drinkQuery.trim()
    if (!query) return
    setLookingUpDrink(true)
    setError('')
    try {
      chooseDrink(await aiApi.analyseFoodText(query))
    } catch (lookupError) {
      setError(lookupError?.message || 'Johnny could not look up that drink.')
    } finally {
      setLookingUpDrink(false)
    }
  }

  async function saveDrink() {
    if (!selectedDrink) return
    setSavingDrink(true)
    setError('')
    setStatus('')
    try {
      await nutritionApi.logMeal(buildDrinkPayload(selectedDrink, drinkMultiplier))
      await refreshFuelData(setSummary, setMeals)
      setStatus(`${drinkLabel(selectedDrink)} saved to today’s nutrition log.`)
      setDrinkQuery('')
      setSelectedDrink(null)
      setDrinkMultiplier(1)
    } catch (saveError) {
      setError(saveError?.message || 'The drink could not be saved. Try again.')
    } finally {
      setSavingDrink(false)
    }
  }

  async function handleMealPhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setMealPhoto({ dataUrl, name: file.name || 'Meal photo' })
      setMealEntryMode('photo')
      setMealDraft(null)
    } catch {
      setError('That photo could not be read. Try another image.')
    }
  }

  async function analyzeMealEntry() {
    const description = mealDescription.trim()
    if (!mealPhoto && !description) {
      setError('Add a meal photo or describe what you ate first.')
      return
    }
    setAnalyzingMeal(true)
    setError('')
    setStatus('')
    try {
      const result = mealPhoto
        ? await aiApi.analyseMeal(mealPhoto.dataUrl, description)
        : await aiApi.analyseMealText(description)
      const items = (Array.isArray(result?.items) ? result.items : []).map(normalizeMealItem).filter(item => item.food_name)
      if (!items.length) throw new Error('Johnny could not identify any foods in that meal.')
      setMealDraft({ items, notes: result?.notes || '' })
    } catch (analysisError) {
      setError(analysisError?.message || 'Johnny could not analyze that meal.')
    } finally {
      setAnalyzingMeal(false)
    }
  }

  async function startVoiceCapture() {
    if (window.MediaRecorder && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const preferredType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => window.MediaRecorder.isTypeSupported?.(type)) || ''
        const recorder = preferredType ? new window.MediaRecorder(stream, { mimeType: preferredType }) : new window.MediaRecorder(stream)
        mediaStreamRef.current = stream
        mediaRecorderRef.current = recorder
        audioChunksRef.current = []
        recorder.ondataavailable = event => { if (event.data?.size) audioChunksRef.current.push(event.data) }
        recorder.onerror = () => {
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          mediaStreamRef.current = null
          setListening(false)
          setError('Voice recording stopped unexpectedly. Try again or type what you ate.')
        }
        recorder.onstop = async () => {
          const mimeType = recorder.mimeType || preferredType || 'audio/webm'
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          mediaStreamRef.current = null
          audioChunksRef.current = []
          setListening(false)
          if (!blob.size) {
            setError('I did not capture any audio. Tap Voice record and try again.')
            return
          }
          setTranscribingVoice(true)
          setError('')
          setStatus('Turning your meal recording into text…')
          try {
            const dataUrl = await readFileAsDataUrl(blob)
            const result = await aiApi.transcribe(String(dataUrl).split(',').pop() || '', mimeType)
            setMealDescription(current => [current.trim(), String(result?.text || '').trim()].filter(Boolean).join(' '))
            setMealDraft(null)
            setStatus('Meal description ready. Review it, then analyze your meal.')
          } catch (transcriptionError) {
            setError(transcriptionError?.message || 'Johnny could not transcribe that recording. Try again or type what you ate.')
            setStatus('')
          } finally {
            setTranscribingVoice(false)
          }
        }
        setError('')
        setStatus('Recording your meal… tap Stop recording when you’re done.')
        setListening(true)
        recorder.start()
        return
      } catch (captureError) {
        const blocked = captureError?.name === 'NotAllowedError' || captureError?.name === 'SecurityError'
        setError(blocked ? 'Microphone access is blocked. Allow it for this site and try again.' : 'The microphone could not start. Try again or type what you ate.')
        return
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice capture is not available in this browser. Type what you ate instead.')
      return
    }
    setError('')
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = event => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0]?.transcript || ''} `
      setMealDescription(transcript.trim())
    }
    recognition.onerror = event => {
      setListening(false)
      setError(event?.error === 'network'
        ? 'Browser voice recognition could not connect. Try again on a stable connection or type what you ate.'
        : event?.error ? `Voice capture stopped: ${event.error}.` : 'Voice capture stopped unexpectedly.')
    }
    recognition.onend = () => {
      setListening(false)
      speechRecognitionRef.current = null
    }
    recognition.start()
    speechRecognitionRef.current = recognition
    setListening(true)
  }

  function stopVoiceCapture() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      return
    }
    speechRecognitionRef.current?.stop?.()
    speechRecognitionRef.current = null
    setListening(false)
  }

  async function saveMealDraft() {
    if (!mealDraft?.items?.length) return
    if (mealType === 'breakfast' && new Date().getHours() >= LATE_BREAKFAST_HOUR) {
      const confirmed = await confirmGlobalAction({
        title: 'Log this as breakfast?',
        message: `It’s after ${formatHour(LATE_BREAKFAST_HOUR)} — just checking you meant to log this as breakfast and not lunch.`,
        confirmLabel: 'Yes, it’s breakfast',
        cancelLabel: 'Change meal type',
      })
      if (!confirmed) return
    }
    setSavingMeal(true)
    setError('')
    setStatus('')
    try {
      await nutritionApi.logMeal({
        meal_datetime: `${today()}T${new Date().toTimeString().slice(0, 8)}`,
        meal_type: mealType,
        source: 'ai_text',
        items: mealDraft.items,
      })
      await refreshFuelData(setSummary, setMeals)
      setMealDescription('')
      setMealPhoto(null)
      setMealEntryMode('photo')
      setMealDraft(null)
      setStatus(`${formatMealType(mealType)} saved to today’s nutrition log.`)
    } catch (saveError) {
      setError(saveError?.message || 'The meal could not be saved. Try again.')
    } finally {
      setSavingMeal(false)
    }
  }

  if (analyzingMeal) {
    return <FullScreenMealAnalyzer hasPhoto={Boolean(mealPhoto)} />
  }

  if (savingMeal) {
    return <FullScreenSavingMeal />
  }

  if (mealDraft) {
    return (
      <FullScreenMealReview
        draft={mealDraft}
        mealType={mealType}
        onChangeMealType={setMealType}
        saving={savingMeal}
        onChange={setMealDraft}
        onApprove={() => { void saveMealDraft() }}
        onBack={() => setMealDraft(null)}
        onStartOver={() => {
          setMealDraft(null)
          setMealPhoto(null)
          setMealDescription('')
          setMealEntryMode('photo')
        }}
      />
    )
  }

  const planningTiles = buildPlanningTiles(savedFoods, savedMeals, recipes)
  const planTotals = sumPlanningSlots(planSlots)

  function addTileToPlan(tile) {
    setPlanSlots(current => ({ ...current, [activePlanSlot]: [...current[activePlanSlot], { ...tile, instanceId: `${tile.key}-${Date.now()}-${Math.random()}` }] }))
    setStatus(`${tile.name} added to ${formatMealType(activePlanSlot)}.`)
  }

  function removePlanTile(slot, instanceId) {
    setPlanSlots(current => ({ ...current, [slot]: current[slot].filter(tile => tile.instanceId !== instanceId) }))
  }

  async function createManualTile(event) {
    event.preventDefault()
    setTileBusy(true)
    setError('')
    try {
      const payload = tileFormToPayload(tileForm)
      const created = await nutritionApi.createSavedFood(payload)
      const food = { ...payload, id: created?.id || created?.food?.id }
      setSavedFoods(current => [...current, food])
      addTileToPlan(foodToPlanningTile(food))
      setTileForm(emptyTileForm())
      setTileCreator('')
    } catch (createError) {
      setError(createError?.message || 'That food tile could not be created.')
    } finally {
      setTileBusy(false)
    }
  }

  async function selectTileLabelImage(side, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setTileScanImages(current => ({ ...current, [side]: dataUrl }))
    } catch {
      setError(`Johnny could not read that ${side} photo.`)
    }
  }

  async function scanTileLabel() {
    if (!tileScanImages.front || !tileScanImages.back) return
    setTileBusy(true)
    setError('')
    try {
      const result = await aiApi.analyseLabel({
        frontImageBase64: String(tileScanImages.front).split(',').pop() || '',
        backImageBase64: String(tileScanImages.back).split(',').pop() || '',
        labelNote: tileScanNote,
      })
      setTileForm({
        name: result?.food_name || result?.canonical_name || 'Scanned food',
        serving: result?.serving_size || '1 serving',
        calories: Number(result?.calories || 0),
        protein: Number(result?.protein_g || 0),
        carbs: Number(result?.carbs_g || 0),
        fat: Number(result?.fat_g || 0),
        source: 'label',
      })
      setTileCreator('manual')
      setTileScanImages({ front: '', back: '' })
      setTileScanNote('')
      setStatus('Label read. Check the tile, then save it to your board.')
    } catch (scanError) {
      setError(scanError?.message || 'Johnny could not read that label.')
    } finally {
      setTileBusy(false)
    }
  }

  async function lockMealPlan(slot) {
    const tiles = planSlots[slot]
    if (!tiles.length || lockingPlan) return
    setLockingPlan(slot)
    setError('')
    try {
      await nutritionApi.logMeal({ meal_datetime: `${today()}T12:00:00`, meal_type: slot, source: 'planned', items: tiles.flatMap(tile => tile.items) })
      await refreshFuelData(setSummary, setMeals)
      setPlanSlots(current => ({ ...current, [slot]: [] }))
      setStatus(`${formatMealType(slot)} locked in and added to today.`)
    } catch (lockError) {
      setError(lockError?.message || `Could not lock in ${formatMealType(slot).toLowerCase()}.`)
    } finally {
      setLockingPlan('')
    }
  }

  async function lockWholePlan() {
    const occupied = Object.keys(planSlots).filter(slot => planSlots[slot].length)
    if (!occupied.length || lockingPlan) return
    setLockingPlan('all')
    setError('')
    try {
      await Promise.all(occupied.map(slot => nutritionApi.logMeal({ meal_datetime: `${today()}T12:00:00`, meal_type: slot, source: 'planned', items: planSlots[slot].flatMap(tile => tile.items) })))
      await refreshFuelData(setSummary, setMeals)
      setPlanSlots({ breakfast: [], lunch: [], dinner: [], snack: [] })
      setStatus('Your full food plan is locked in for today.')
    } catch (lockError) {
      setError(lockError?.message || 'The full plan could not be locked in.')
    } finally {
      setLockingPlan('')
    }
  }

  return (
    <AppDialog ariaLabel="Daily nutrition log" className={`johnny-nutrition-log-modal${activePanel === 'plan' ? ' planning' : ''}`} initialFocusRef={closeRef} onClose={onClose} open overlayClassName="johnny-daily-log-shell" size="md">
      <div className="johnny-nutrition-log">
        <header className="johnny-daily-log-head">
          <div>
            <span>{activePanel === 'plan' ? 'Food planner' : 'Daily fuel'}</span>
            <h2>{activePanel === 'plan' ? 'Build your day' : 'Log today’s inputs'}</h2>
            <p>{activePanel === 'plan' ? 'Try combinations before they count.' : 'Food, hydration, and movement in one quick view.'}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close daily nutrition log">×</button>
        </header>

        <div className="johnny-nutrition-tabs" role="tablist" aria-label="Nutrition views">
          <button type="button" role="tab" aria-selected={activePanel === 'today'} className={activePanel === 'today' ? 'active' : ''} onClick={() => setActivePanel('today')}>Today</button>
          <button type="button" role="tab" aria-selected={activePanel === 'plan'} className={activePanel === 'plan' ? 'active' : ''} onClick={() => setActivePanel('plan')}>Plan</button>
        </div>

        {activePanel === 'today' ? (
          <section className="johnny-nutrition-fuel-panel" aria-labelledby="johnny-food-log-heading">
            <FuelSummary summary={summary} meals={meals} loading={loading} />
            <div className="johnny-nutrition-meal-log">
              <div className="johnny-nutrition-section-heading"><div><span>Meal log</span><h3 id="johnny-food-log-heading">Capture what you ate</h3></div><strong>{meals.length} logged</strong></div>
              <div className="johnny-nutrition-meal-type" role="group" aria-label="Meal type">
                {['breakfast', 'lunch', 'dinner', 'snack'].map(type => <button key={type} type="button" className={mealType === type ? 'active' : ''} aria-pressed={mealType === type} onClick={() => setMealType(type)}>{formatMealType(type)}</button>)}
              </div>
              <input ref={mealPhotoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={event => { void handleMealPhotoSelected(event) }} />
              {mealEntryMode === 'photo' ? (
                <div className="johnny-nutrition-photo-flow">
                  <button type="button" className={`johnny-nutrition-photo-prompt${mealPhoto ? ' has-photo' : ''}`} onClick={() => mealPhotoInputRef.current?.click()}>
                    {mealPhoto ? <img src={mealPhoto.dataUrl} alt="Selected meal" /> : <span aria-hidden="true">＋</span>}
                    <strong>{mealPhoto ? 'Change meal photo' : 'Add a photo of your meal'}</strong>
                    <small>{mealPhoto ? mealPhoto.name : 'Use your camera or photo library'}</small>
                  </button>
                  {mealPhoto ? <label className="johnny-nutrition-meal-note"><span>Add a note <small>optional</small></span><textarea value={mealDescription} onChange={event => { setMealDescription(event.target.value); setMealDraft(null) }} placeholder="Dressing on the side, half the rice…" aria-label="Meal photo note" /></label> : null}
                  {!mealPhoto ? <button type="button" className="johnny-nutrition-skip-photo" onClick={() => { setMealEntryMode('describe'); setMealDraft(null) }}>Skip photo — type or speak instead</button> : null}
                </div>
              ) : (
                <div className="johnny-nutrition-description-flow">
                  <label><span>What did you eat?</span><textarea value={mealDescription} disabled={transcribingVoice} onChange={event => { setMealDescription(event.target.value); setMealDraft(null) }} placeholder="Example: chicken, rice, and broccoli" aria-label="Describe your meal" /></label>
                  <div><button type="button" disabled={transcribingVoice} className={listening ? 'listening' : ''} onClick={listening ? stopVoiceCapture : startVoiceCapture}>{listening ? 'Stop recording' : transcribingVoice ? 'Transcribing…' : 'Voice record'}</button><button type="button" disabled={transcribingVoice} onClick={() => { stopVoiceCapture(); setMealEntryMode('photo'); setMealDescription('') }}>Use a photo</button></div>
                  {listening ? <p role="status">Recording… describe the foods and portions, then tap Stop recording.</p> : null}
                </div>
              )}
              {(mealPhoto || mealEntryMode === 'describe') ? <button type="button" className="johnny-nutrition-analyze" disabled={analyzingMeal || transcribingVoice || (!mealPhoto && !mealDescription.trim())} onClick={() => { stopVoiceCapture(); void analyzeMealEntry() }}>Analyze meal</button> : null}
            </div>
          </section>
        ) : (
          <MealPlanningWorkbench
            activeSlot={activePlanSlot}
            busy={tileBusy}
            creator={tileCreator}
            form={tileForm}
            locking={lockingPlan}
            planSlots={planSlots}
            targets={summary?.targets || {}}
            tiles={planningTiles}
            totals={planTotals}
            onAdd={addTileToPlan}
            onChangeForm={setTileForm}
            onCloseCreator={() => setTileCreator('')}
            onCreate={createManualTile}
            onLockAll={() => { void lockWholePlan() }}
            onLockMeal={slot => { void lockMealPlan(slot) }}
            onOpenManual={() => { setTileForm(emptyTileForm()); setTileCreator('manual') }}
            onRemove={removePlanTile}
            onOpenScan={() => setTileCreator('scan')}
            onSelectSlot={setActivePlanSlot}
          />
        )}

        <section className="johnny-nutrition-water" aria-labelledby="johnny-water-heading">
          <header><div><span>Beverage bar</span><h3 id="johnny-water-heading">Water first</h3></div><strong>{water.glasses}/{water.target}</strong></header>
          <div className="johnny-nutrition-water-bar" role="group" aria-label="Daily water glasses" aria-busy={loading || savingWater}>
            {Array.from({ length: water.target }, (_, index) => {
              const filled = index < water.glasses
              const next = water.glasses === index + 1 ? index : index + 1
              return <button key={index} type="button" className={filled ? 'filled' : ''} data-glass={index + 1} disabled={loading || savingWater} aria-label={`Water glass ${index + 1}`} aria-pressed={filled} onClick={() => { void updateWater(next) }}><span /></button>
            })}
          </div>
          <p>Tap a glass to update today’s hydration.</p>
          <div className="johnny-nutrition-drink-finder">
            <div className="johnny-nutrition-drink-heading"><strong>Log a drink</strong><span>Saved + recent beverages</span></div>
            <div className="johnny-nutrition-drink-search">
              <input type="search" aria-label="Find a drink" placeholder="Latte, Gatorade, iced tea…" value={drinkQuery} onChange={event => { setDrinkQuery(event.target.value); setSelectedDrink(null) }} />
              <button type="button" disabled={!drinkQuery.trim() || lookingUpDrink} onClick={() => { void lookupDrink() }}>{lookingUpDrink ? 'Looking…' : 'Ask Johnny'}</button>
            </div>
            {searchingDrinks ? <p role="status">Checking your saved and recent drinks…</p> : null}
            {drinkSuggestions.length ? <div className="johnny-nutrition-drink-results">{drinkSuggestions.map((drink, index) => <button key={`${drink.id || drink.food_id || 'drink'}-${index}`} type="button" onClick={() => chooseDrink(drink)}><strong>{drinkLabel(normalizeDrink(drink))}</strong><span>{drink.serving_size || '1 serving'} · {Math.round(Number(drink.calories) || 0)} cal</span></button>)}</div> : null}
            {selectedDrink ? (
              <div className="johnny-nutrition-drink-selection">
                <div><strong>{drinkLabel(selectedDrink)}</strong><span>{selectedDrink.serving_size} · {Math.round(selectedDrink.calories * drinkMultiplier)} cal · {formatNumber(selectedDrink.carbs_g * drinkMultiplier)}g carbs · {formatNumber(selectedDrink.sugar_g * drinkMultiplier)}g sugar</span></div>
                <div><select aria-label="Drink size" value={drinkMultiplier} onChange={event => setDrinkMultiplier(Number(event.target.value))}>{drinkServingOptions.map(option => <option key={option.multiplier} value={option.multiplier}>{option.label}</option>)}</select><button type="button" disabled={savingDrink} onClick={() => { void saveDrink() }}>{savingDrink ? 'Saving…' : 'Save drink'}</button></div>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <p className="johnny-daily-log-error" role="alert">{error}</p> : null}
        {status ? <p className="johnny-daily-log-success" role="status">{status}</p> : null}
        <button type="button" className="johnny-nutrition-done" onClick={onClose}>Done</button>
      </div>
      <input ref={labelFrontInputRef} type="file" accept="image/*" capture="environment" hidden onChange={event => { void selectTileLabelImage('front', event) }} />
      <input ref={labelBackInputRef} type="file" accept="image/*" capture="environment" hidden onChange={event => { void selectTileLabelImage('back', event) }} />
      {tileCreator === 'scan' ? <LabelScanPromptPanel fullViewport busy={tileBusy} images={tileScanImages} note={tileScanNote} onChangeNote={setTileScanNote} onPickFront={() => labelFrontInputRef.current?.click()} onPickBack={() => labelBackInputRef.current?.click()} onSubmit={() => { void scanTileLabel() }} onCancel={() => { setTileCreator(''); setTileScanImages({ front: '', back: '' }); setTileScanNote('') }} /> : null}
    </AppDialog>
  )
}

function MealPlanningWorkbench({ activeSlot, busy, creator, form, locking, planSlots, targets, tiles, totals, onAdd, onChangeForm, onCloseCreator, onCreate, onLockAll, onLockMeal, onOpenManual, onOpenScan, onRemove, onSelectSlot }) {
  const [tileFilter, setTileFilter] = useState('all')
  const [tileQuery, setTileQuery] = useState('')
  const targetRows = [
    ['Calories', totals.calories, Number(targets.target_calories || 0), 'calories', ''],
    ['Protein', totals.protein_g, Number(targets.target_protein_g || 0), 'protein', 'g'],
    ['Carbs', totals.carbs_g, Number(targets.target_carbs_g || 0), 'carbs', 'g'],
    ['Fat', totals.fat_g, Number(targets.target_fat_g || 0), 'fat', 'g'],
  ]
  const occupiedMeals = Object.values(planSlots).filter(items => items.length).length
  const normalizedTileQuery = tileQuery.trim().toLowerCase()
  const typeFilteredTiles = tileFilter === 'all' ? tiles : tiles.filter(tile => tile.kind === tileFilter)
  const visibleTiles = normalizedTileQuery
    ? typeFilteredTiles.filter(tile => [tile.name, tile.category, tile.serving, tile.kind].some(value => String(value || '').toLowerCase().includes(normalizedTileQuery)))
    : typeFilteredTiles

  return (
    <section className="johnny-plan-workbench" aria-labelledby="johnny-meal-plan-heading">
      <header className="johnny-plan-workbench-head">
        <div><span>Macro workbench</span><h3 id="johnny-meal-plan-heading">Design the fuel. Own the day.</h3><p>Tap a meal lane, then add foods, meals, or recipes. Nothing counts until you lock it in.</p></div>
        <div className="johnny-plan-score"><strong>{Math.round(totals.calories).toLocaleString()}</strong><span>planned calories</span></div>
      </header>

      <div className="johnny-plan-targets" aria-label="Planned nutrition against targets">
        {targetRows.map(([label, value, target, tone, unit]) => {
          const over = target > 0 && value > target
          return <div className={over ? 'over' : ''} key={label}><span><b>{label}</b><small>{Math.round(value)}{unit} / {Math.round(target)}{unit}</small></span><i><em className={tone} style={{ width: `${progressPercent(value, target)}%` }} /></i></div>
        })}
      </div>

      <nav className="johnny-plan-slot-tabs" aria-label="Choose a meal to plan">
        {Object.entries(planSlots).map(([slot, slotTiles]) => <button key={slot} type="button" className={activeSlot === slot ? 'active' : ''} aria-pressed={activeSlot === slot} onClick={() => onSelectSlot(slot)}><span>{formatMealType(slot)}</span><small>{slotTiles.length || '—'}</small></button>)}
      </nav>

      <div className="johnny-plan-lanes">
        {Object.entries(planSlots).map(([slot, slotTiles]) => {
          const slotTotals = sumNutritionItems(slotTiles.flatMap(tile => tile.items))
          const active = activeSlot === slot
          return (
            <section key={slot} className={`johnny-plan-lane${active ? ' active' : ''}`} onClick={() => onSelectSlot(slot)}>
              <header><button type="button" onClick={() => onSelectSlot(slot)}><span>{formatMealType(slot)}</span><small>{slotTiles.length ? `${Math.round(slotTotals.calories)} cal · ${Math.round(slotTotals.protein_g)}g P` : 'Tap to add here'}</small></button>{slotTiles.length ? <button type="button" className="lock" disabled={Boolean(locking)} onClick={event => { event.stopPropagation(); onLockMeal(slot) }}>{locking === slot ? 'Locking…' : 'Lock meal'}</button> : null}</header>
              <div className="johnny-plan-lane-tiles">
                {slotTiles.map(tile => <FoodPlanTile key={tile.instanceId} tile={tile} removable onAction={event => { event.stopPropagation(); onRemove(slot, tile.instanceId) }} />)}
                {!slotTiles.length ? <button type="button" className="johnny-plan-empty-lane" onClick={() => onSelectSlot(slot)}>＋ Add your first tile</button> : null}
              </div>
            </section>
          )
        })}
      </div>

      <section className="johnny-plan-shelf">
        <header><div><span>Add to {formatMealType(activeSlot)}</span><h4>Tile shelf</h4></div><div><button type="button" disabled={busy} onClick={onOpenScan}>{busy ? 'Reading…' : 'Scan label'}</button><button type="button" onClick={onOpenManual}>＋ New tile</button></div></header>
        <div className="johnny-plan-shelf-filters" role="group" aria-label="Filter planning tiles">
          {[['all', 'All'], ['food', 'Foods'], ['meal', 'Meals'], ['recipe', 'Recipes']].map(([value, label]) => <button key={value} type="button" className={tileFilter === value ? 'active' : ''} aria-pressed={tileFilter === value} onClick={() => setTileFilter(value)}>{label}<small>{value === 'all' ? tiles.length : tiles.filter(tile => tile.kind === value).length}</small></button>)}
        </div>
        <div className="johnny-plan-shelf-search">
          <label htmlFor="johnny-tile-search">Find a tile</label>
          <input id="johnny-tile-search" type="search" list="johnny-tile-suggestions" value={tileQuery} onChange={event => setTileQuery(event.target.value)} placeholder="Start typing a food, meal, or recipe…" autoComplete="off" />
          {tileQuery ? <button type="button" onClick={() => setTileQuery('')} aria-label="Clear tile search">×</button> : null}
          <datalist id="johnny-tile-suggestions">{typeFilteredTiles.slice(0, 30).map(tile => <option key={tile.key} value={tile.name} />)}</datalist>
        </div>
        <div className="johnny-plan-tile-row">
          {visibleTiles.map(tile => <FoodPlanTile key={tile.key} tile={tile} onAction={() => onAdd(tile)} />)}
          {!visibleTiles.length ? <div className="johnny-plan-no-tiles"><strong>{tileQuery ? `No tiles match “${tileQuery}”` : `No ${tileFilter === 'all' ? 'tiles' : tileFilter + ' tiles'} yet`}</strong><span>{tileQuery ? 'Keep typing or clear the search to see everything.' : 'Scan a label or make a tile manually.'}</span></div> : null}
        </div>
      </section>

      {creator === 'manual' ? <TileCreator form={form} busy={busy} onChange={onChangeForm} onClose={onCloseCreator} onCreate={onCreate} /> : null}

      <footer className="johnny-plan-lockbar"><div><strong>{occupiedMeals ? `${occupiedMeals} meal${occupiedMeals === 1 ? '' : 's'} ready` : 'Build your plan'}</strong><span>{occupiedMeals ? 'Locking adds every planned tile to today’s food log.' : 'Your planning board is a sandbox until you lock it in.'}</span></div><button type="button" disabled={!occupiedMeals || Boolean(locking)} onClick={onLockAll}>{locking === 'all' ? 'Locking plan…' : 'Lock in whole plan'}</button></footer>
    </section>
  )
}

function FoodPlanTile({ tile, removable = false, onAction }) {
  return (
    <article className={`johnny-food-plan-tile ${tile.kind}`}>
      <button type="button" className={removable ? 'remove' : 'add'} onClick={onAction} aria-label={`${removable ? 'Remove' : 'Add'} ${tile.name}`}>{removable ? '×' : '+'}</button>
      <span>{tile.category}</span>
      <h5>{tile.name}</h5>
      <p>{tile.serving}</p>
      <strong>{Math.round(tile.totals.calories)} <small>cal</small></strong>
      <div><b>P {Math.round(tile.totals.protein_g)}g</b><b>C {Math.round(tile.totals.carbs_g)}g</b><b>F {Math.round(tile.totals.fat_g)}g</b></div>
      <em>{tile.kind === 'recipe' ? 'Recipe' : tile.kind === 'meal' ? 'Complete meal' : 'Food'}</em>
    </article>
  )
}

function TileCreator({ form, busy, onChange, onClose, onCreate }) {
  const update = (field, value) => onChange(current => ({ ...current, [field]: value }))
  return createPortal(
    <div className="johnny-tile-workflow" role="dialog" aria-modal="true" aria-label="Create a new food tile">
      <div className="johnny-tile-workflow-scroll">
        <form className="johnny-plan-tile-creator" onSubmit={onCreate}>
          <header><div><span>New food tile</span><h4>Make one reusable building block</h4><p>Define a serving once. Johnny keeps the calories and macros attached whenever you use this tile.</p></div><button type="button" onClick={onClose} aria-label="Close tile creator">×</button></header>
          <div className="johnny-tile-creator-fields">
            <label className="wide"><span>Name</span><input autoFocus required value={form.name} onChange={event => update('name', event.target.value)} placeholder="Greek yogurt" /></label>
            <label className="wide"><span>Unit / serving</span><input required value={form.serving} onChange={event => update('serving', event.target.value)} placeholder="1 cup" /></label>
            {['calories', 'protein', 'carbs', 'fat'].map(field => <label key={field}><span>{field}</span><input required type="number" min="0" step={field === 'calories' ? 1 : 0.1} value={form[field]} onChange={event => update(field, event.target.value)} /></label>)}
          </div>
          <aside className="johnny-tile-creator-preview"><span>Live tile preview</span><strong>{form.name || 'Your food tile'}</strong><p>{form.serving || 'Add a serving size'}</p><div><b>{Math.round(Number(form.calories) || 0)} cal</b><b>P {formatNumber(form.protein)}g</b><b>C {formatNumber(form.carbs)}g</b><b>F {formatNumber(form.fat)}g</b></div></aside>
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="save" disabled={busy}>{busy ? 'Saving tile…' : 'Save tile + add'}</button></footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function FuelSummary({ summary, meals, loading }) {
  const totals = summary?.totals || {}
  const targets = summary?.targets || {}
  const calories = Number(totals.calories || 0)
  const calorieTarget = Number(targets.target_calories || 0)
  const calorieProgress = progressPercent(calories, calorieTarget)
  const macros = [
    ['Protein', Number(totals.protein_g || 0), Number(targets.target_protein_g || 0), 'protein'],
    ['Carbs', Number(totals.carbs_g || 0), Number(targets.target_carbs_g || 0), 'carbs'],
    ['Fat', Number(totals.fat_g || 0), Number(targets.target_fat_g || 0), 'fat'],
  ]
  const mealGroups = groupMeals(meals)

  return (
    <div className="johnny-nutrition-fuel-summary" aria-busy={loading}>
      <div className="johnny-nutrition-fuel-main">
        <div className={`johnny-nutrition-cal-ring${calorieTarget > 0 && calories > calorieTarget ? ' over' : ''}`} style={{ '--fuel-progress': `${calorieProgress * 3.6}deg` }} role="img" aria-label={`${Math.round(calories)} of ${Math.round(calorieTarget)} calories`}>
          <div><strong>{loading ? '—' : Math.round(calories).toLocaleString()}</strong><span>{calorieTarget ? `of ${Math.round(calorieTarget).toLocaleString()}` : 'calories'}</span></div>
        </div>
        <div className="johnny-nutrition-macro-list">
          {macros.map(([label, value, target, tone]) => <div key={label} className="johnny-nutrition-macro-row"><div><span>{label}</span><strong>{Math.round(value)}g <small>/ {Math.round(target)}g</small></strong></div><div className="johnny-nutrition-macro-track"><span className={tone} style={{ width: `${progressPercent(value, target)}%` }} /></div></div>)}
        </div>
      </div>
      <details className="johnny-nutrition-meal-breakdown">
        <summary><span>Break out by meal</span><small>{mealGroups.length ? `${mealGroups.length} slots` : 'No meals yet'}</small></summary>
        <div>{mealGroups.length ? mealGroups.map(meal => <div key={meal.type}><span><strong>{formatMealType(meal.type)}</strong><small>{meal.items.length} item{meal.items.length === 1 ? '' : 's'}</small></span><strong>{Math.round(meal.totals.calories)} cal · {Math.round(meal.totals.protein_g)}g P</strong></div>) : <p>Your logged meals will appear here.</p>}</div>
      </details>
    </div>
  )
}

function FullScreenMealAnalyzer({ hasPhoto }) {
  return (
    <FullScreenMealProgress
      ariaLabel="Analyzing meal"
      eyebrow="Johnny is analyzing"
      title={hasPhoto ? 'Reading your plate' : 'Breaking down your meal'}
      subtitle={hasPhoto ? 'Identifying foods, portions, and macros from your photo and note.' : 'Matching your description to foods, portions, and macros.'}
      footnote="Keep this screen open. Your editable review is next."
    />
  )
}

function FullScreenSavingMeal() {
  return (
    <FullScreenMealProgress
      ariaLabel="Saving meal"
      eyebrow="Johnny is logging"
      title="Saving your meal"
      subtitle="Recording foods, portions, and macros to today’s log."
      footnote="Keep this screen open. This only takes a moment."
    />
  )
}

function FullScreenMealProgress({ ariaLabel, eyebrow, title, subtitle, footnote }) {
  const ringRef = useRef(null)
  const ringLabelRef = useRef(null)
  const dotRefs = useRef([])
  const fieldRefs = useRef([])

  // iOS Safari has a known WebKit bug where a CSS @keyframes animation on an
  // element with a conic-gradient background (inside a position:fixed ancestor)
  // freezes on its first frame. Driving the motion with rAF + direct style
  // writes sidesteps that entirely, since it never relies on the CSS animation
  // engine to tick the frame.
  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      dotRefs.current.forEach(el => { if (el) el.style.transform = 'none' })
      const start = performance.now()
      let frameId
      const tick = now => {
        const elapsed = now - start
        dotRefs.current.forEach((el, index) => {
          if (!el) return
          const t = ((elapsed + index * 200) % 1400) / 1400
          el.style.opacity = String(0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI)))
        })
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frameId)
    }

    const RING_MS = 1300
    const DOT_MS = 1000
    const FIELD_MS = 2400
    const DOT_DELAYS = [0, 140, 280]
    const FIELD_DELAYS = [0, 400, 800]
    const start = performance.now()
    let frameId

    function tick(now) {
      const elapsed = now - start

      const ringAngle = ((elapsed % RING_MS) / RING_MS) * 360
      if (ringRef.current) ringRef.current.style.transform = `rotate(${ringAngle}deg)`
      if (ringLabelRef.current) ringLabelRef.current.style.transform = `rotate(${-ringAngle}deg)`

      dotRefs.current.forEach((el, index) => {
        if (!el) return
        const t = ((elapsed + DOT_DELAYS[index]) % DOT_MS) / DOT_MS
        const bounce = Math.max(0, Math.sin(t * Math.PI))
        el.style.transform = `translateY(${-7 * bounce}px)`
        el.style.opacity = String(0.35 + 0.65 * bounce)
      })

      fieldRefs.current.forEach((el, index) => {
        if (!el) return
        const t = ((elapsed + FIELD_DELAYS[index]) % FIELD_MS) / FIELD_MS
        const scale = 0.82 + 0.26 * t
        const opacity = Math.max(0, t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6)
        el.style.transform = `scale(${scale})`
        el.style.opacity = String(opacity)
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <main className="johnny-meal-analyzer" role="status" aria-live="assertive" aria-label={ariaLabel}>
      <div className="johnny-meal-analyzer-field" aria-hidden="true">
        <span ref={el => { fieldRefs.current[0] = el }} />
        <span ref={el => { fieldRefs.current[1] = el }} />
        <span ref={el => { fieldRefs.current[2] = el }} />
      </div>
      <div className="johnny-meal-analyzer-core">
        <div className="johnny-meal-analyzer-ring" ref={ringRef} style={{ position: 'relative' }}><span ref={ringLabelRef}>J5K</span></div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{subtitle}</span>
        <div className="johnny-meal-analyzer-progress"><i ref={el => { dotRefs.current[0] = el }} /><i ref={el => { dotRefs.current[1] = el }} /><i ref={el => { dotRefs.current[2] = el }} /></div>
        <small>{footnote}</small>
      </div>
    </main>
  )
}

function FullScreenMealReview({ draft, mealType, onChangeMealType, saving, onChange, onApprove, onBack, onStartOver }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const itemRefs = useRef([])
  const totals = sumNutritionItems(draft.items)

  function updateItem(index, field, value) {
    const numericFields = new Set(['serving_amount', 'calories', 'protein_g', 'carbs_g', 'fat_g'])
    onChange(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: numericFields.has(field) ? Math.max(0, Number(value) || 0) : value }
        : item),
    }))
  }

  function removeItem(index) {
    onChange(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
    setEditingIndex(null)
  }

  function toggleEditor(index, isEditing) {
    const nextIndex = isEditing ? null : index
    setEditingIndex(nextIndex)
    if (nextIndex !== null) {
      window.requestAnimationFrame(() => itemRefs.current[nextIndex]?.scrollIntoView?.({ block: 'nearest' }))
    }
  }

  return (
    <main className="johnny-meal-review-screen" aria-labelledby="johnny-meal-review-title">
      <header className="johnny-meal-review-header">
        <button type="button" onClick={onBack} disabled={saving} aria-label="Back to meal capture">←</button>
        <div>
          <span>Analysis complete</span>
          <h1 id="johnny-meal-review-title">Review your {formatMealType(mealType).toLowerCase()}</h1>
          <p>Confirm what Johnny found. Adjust only the items that need it.</p>
          <div className="johnny-nutrition-meal-type" role="group" aria-label="Meal type">
            {['breakfast', 'lunch', 'dinner', 'snack'].map(type => <button key={type} type="button" className={mealType === type ? 'active' : ''} aria-pressed={mealType === type} disabled={saving} onClick={() => onChangeMealType(type)}>{formatMealType(type)}</button>)}
          </div>
        </div>
      </header>

      <section className="johnny-meal-review-total" aria-label="Detected meal totals">
        <div><strong>{Math.round(totals.calories)}</strong><span>Calories</span></div>
        <div><strong>{formatNumber(totals.protein_g)}g</strong><span>Protein</span></div>
        <div><strong>{formatNumber(totals.carbs_g)}g</strong><span>Carbs</span></div>
        <div><strong>{formatNumber(totals.fat_g)}g</strong><span>Fat</span></div>
      </section>

      <section className="johnny-meal-review-results" aria-label="Foods found">
        <div className="johnny-meal-review-results-heading"><span>Foods found</span><strong>{draft.items.length} item{draft.items.length === 1 ? '' : 's'}</strong></div>
        {draft.items.map((item, index) => {
          const isEditing = editingIndex === index
          return (
            <article ref={element => { itemRefs.current[index] = element }} className={`johnny-meal-review-item${isEditing ? ' editing' : ''}`} key={`${item.food_name}-${index}`}>
              <div className="johnny-meal-review-item-summary">
                <div><span>{index + 1}</span><div><h2>{item.food_name}</h2><p>{formatNumber(item.serving_amount)} {item.serving_unit} · {Math.round(item.calories)} cal · {formatNumber(item.protein_g)}g protein</p></div></div>
                <button type="button" onClick={() => toggleEditor(index, isEditing)} aria-expanded={isEditing}>{isEditing ? 'Done' : 'Adjust'}</button>
              </div>
              {isEditing ? (
                <div className="johnny-meal-review-item-editor">
                  <label className="wide"><span>Food name</span><input value={item.food_name} onChange={event => updateItem(index, 'food_name', event.target.value)} /></label>
                  <label><span>Amount</span><input type="number" min="0" step="0.25" inputMode="decimal" value={item.serving_amount} onChange={event => updateItem(index, 'serving_amount', event.target.value)} /></label>
                  <label><span>Serving</span><input value={item.serving_unit} onChange={event => updateItem(index, 'serving_unit', event.target.value)} /></label>
                  <label><span>Calories</span><input type="number" min="0" inputMode="numeric" value={item.calories} onChange={event => updateItem(index, 'calories', event.target.value)} /></label>
                  <label><span>Protein</span><input type="number" min="0" step="0.1" inputMode="decimal" value={item.protein_g} onChange={event => updateItem(index, 'protein_g', event.target.value)} /></label>
                  <label><span>Carbs</span><input type="number" min="0" step="0.1" inputMode="decimal" value={item.carbs_g} onChange={event => updateItem(index, 'carbs_g', event.target.value)} /></label>
                  <label><span>Fat</span><input type="number" min="0" step="0.1" inputMode="decimal" value={item.fat_g} onChange={event => updateItem(index, 'fat_g', event.target.value)} /></label>
                  <button type="button" className="johnny-meal-review-remove" onClick={() => removeItem(index)}>Remove this item</button>
                </div>
              ) : null}
            </article>
          )
        })}
        {!draft.items.length ? <div className="johnny-meal-review-empty"><strong>No foods left</strong><span>Go back to change your description or start over with another photo.</span></div> : null}
      </section>

      <footer className="johnny-meal-review-actions">
        <button type="button" onClick={onStartOver} disabled={saving}>Start over</button>
        <button type="button" onClick={onApprove} disabled={saving || !draft.items.length}>{saving ? 'Saving meal…' : 'Approve and log meal'}</button>
      </footer>
    </main>
  )
}

async function refreshFuelData(setSummary, setMeals) {
  const [nextSummary, nextMeals] = await Promise.all([
    nutritionApi.getSummary(today()).catch(() => null),
    nutritionApi.getMeals(today()).catch(() => []),
  ])
  if (nextSummary) setSummary(nextSummary)
  setMeals(Array.isArray(nextMeals) ? nextMeals : [])
}

function normalizeMealItem(item) {
  return {
    food_id: item?.food_id ?? null,
    food_name: String(item?.food_name || item?.canonical_name || '').trim(),
    serving_amount: Number(item?.serving_amount ?? 1) || 1,
    serving_unit: String(item?.serving_unit || item?.serving_size || 'serving').trim(),
    calories: Number(item?.calories || 0),
    protein_g: Number(item?.protein_g || 0),
    carbs_g: Number(item?.carbs_g || 0),
    fat_g: Number(item?.fat_g || 0),
    fiber_g: Number(item?.fiber_g || 0),
    sugar_g: Number(item?.sugar_g || 0),
    sodium_mg: Number(item?.sodium_mg || 0),
    micros: Array.isArray(item?.micros) ? item.micros : [],
    source: item?.source || null,
  }
}

function sumNutritionItems(items) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => ({
    calories: total.calories + Number(item?.calories || 0),
    protein_g: total.protein_g + Number(item?.protein_g || 0),
    carbs_g: total.carbs_g + Number(item?.carbs_g || 0),
    fat_g: total.fat_g + Number(item?.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
}

function groupMeals(meals) {
  const grouped = new Map()
  ;(Array.isArray(meals) ? meals : []).forEach(meal => {
    const type = String(meal?.meal_type || 'meal')
    const current = grouped.get(type) || { type, items: [] }
    current.items.push(...(Array.isArray(meal?.items) ? meal.items : []))
    grouped.set(type, current)
  })
  return Array.from(grouped.values()).map(meal => ({ ...meal, totals: sumNutritionItems(meal.items) }))
}

function emptyTileForm() {
  return { name: '', serving: '1 serving', calories: '', protein: '', carbs: '', fat: '', source: 'manual' }
}

function tileFormToPayload(form) {
  return {
    canonical_name: String(form.name || '').trim(),
    serving_size: String(form.serving || '').trim() || '1 serving',
    calories: Number(form.calories || 0),
    protein_g: Number(form.protein || 0),
    carbs_g: Number(form.carbs || 0),
    fat_g: Number(form.fat || 0),
    source: form.source || 'manual',
  }
}

function foodToPlanningTile(food) {
  const item = normalizeMealItem({ ...food, food_name: food?.canonical_name || food?.food_name, serving_unit: food?.serving_size })
  return {
    key: `food-${food?.id || item.food_name}`,
    kind: 'food',
    category: food?.brand || 'Saved food',
    name: item.food_name || 'Food',
    serving: food?.serving_size || '1 serving',
    totals: sumNutritionItems([item]),
    items: [item],
  }
}

function mealToPlanningTile(meal) {
  const items = (Array.isArray(meal?.items) ? meal.items : []).map(normalizeMealItem)
  return {
    key: `meal-${meal?.id || meal?.name}`,
    kind: 'meal',
    category: formatMealType(meal?.meal_type || 'meal'),
    name: meal?.name || 'Saved meal',
    serving: `${items.length} item${items.length === 1 ? '' : 's'}`,
    totals: sumNutritionItems(items),
    items,
  }
}

function recipeToPlanningTile(recipe, index) {
  const item = normalizeMealItem({
    food_name: recipe?.recipe_name || 'Recipe',
    serving_amount: 1,
    serving_unit: 'recipe serving',
    calories: recipe?.estimated_calories,
    protein_g: recipe?.estimated_protein_g,
    carbs_g: recipe?.estimated_carbs_g,
    fat_g: recipe?.estimated_fat_g,
    source: { type: 'recipe', recipe_key: recipe?.recipe_key || '' },
  })
  return {
    key: `recipe-${recipe?.recipe_key || recipe?.recipe_name || index}`,
    kind: 'recipe',
    category: formatMealType(recipe?.meal_type || 'recipe'),
    name: item.food_name,
    serving: Array.isArray(recipe?.ingredients) ? `${recipe.ingredients.length} ingredients` : '1 serving',
    totals: sumNutritionItems([item]),
    items: [item],
  }
}

function buildPlanningTiles(savedFoods, savedMeals, recipes) {
  return [
    ...(Array.isArray(savedFoods) ? savedFoods : []).map(foodToPlanningTile),
    ...(Array.isArray(savedMeals) ? savedMeals : []).map(mealToPlanningTile),
    ...(Array.isArray(recipes) ? recipes : []).map(recipeToPlanningTile),
  ].filter(tile => tile.name && tile.items.length).slice(0, 36)
}

function sumPlanningSlots(slots) {
  return sumNutritionItems(Object.values(slots).flatMap(tiles => tiles.flatMap(tile => tile.items)))
}

function progressPercent(value, target) {
  if (!(target > 0)) return 0
  return Math.min(100, Math.max(0, (value / target) * 100))
}

function formatMealType(value) {
  const label = String(value || 'meal').replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'))
    reader.readAsDataURL(file)
  })
}

function normalizeDrink(drink) {
  return {
    food_id: drink?.food_id ?? drink?.id ?? null,
    canonical_name: String(drink?.canonical_name || drink?.food_name || 'Drink').trim(),
    brand: String(drink?.brand || '').trim(),
    serving_size: String(drink?.serving_size || drink?.serving_unit || '1 serving').trim(),
    calories: Number(drink?.calories) || 0,
    protein_g: Number(drink?.protein_g) || 0,
    carbs_g: Number(drink?.carbs_g) || 0,
    fat_g: Number(drink?.fat_g) || 0,
    fiber_g: Number(drink?.fiber_g) || 0,
    sugar_g: Number(drink?.sugar_g) || 0,
    sodium_mg: Number(drink?.sodium_mg) || 0,
    micros: Array.isArray(drink?.micros) ? drink.micros : [],
    source: typeof drink?.source === 'object' && drink.source ? drink.source : { type: drink?.match_type || 'manual' },
  }
}

function drinkLabel(drink) {
  return drink?.brand && drink.brand.toLowerCase() !== drink.canonical_name.toLowerCase() ? `${drink.canonical_name} (${drink.brand})` : drink?.canonical_name || 'Drink'
}

function formatNumber(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function buildDrinkServingOptions(drink) {
  const servingSize = String(drink?.serving_size || '1 serving').trim()
  const volume = parseDrinkVolumeOunces(servingSize)
  if (!volume) {
    return [0.5, 1, 1.5, 2, 2.5, 3].map(multiplier => ({
      multiplier,
      label: multiplier === 1 ? servingSize : `${formatNumber(multiplier)}× ${servingSize}`,
    }))
  }

  const commonSizes = [8, 12, 16, 16.9, 20, 24, 32]
  if (!commonSizes.some(size => Math.abs(size - volume) < 0.05)) commonSizes.push(volume)
  return commonSizes.sort((left, right) => left - right).map(ounces => ({
    multiplier: ounces / volume,
    label: formatDrinkSizeLabel(ounces),
  }))
}

function parseDrinkVolumeOunces(servingSize) {
  const ounceMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/i)
  if (ounceMatch) return Number(ounceMatch[1])
  const milliliterMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*ml\b/i)
  if (milliliterMatch) return Number(milliliterMatch[1]) / 29.5735
  return 0
}

function formatDrinkSizeLabel(ounces) {
  const amount = Number.isInteger(ounces) ? ounces : ounces.toFixed(1)
  if (ounces === 12) return `${amount} fl oz can`
  if (ounces === 16.9 || ounces === 20) return `${amount} fl oz bottle`
  return `${amount} fl oz`
}

function buildDrinkPayload(drink, multiplier) {
  const scaled = key => formatNumber(drink[key] * multiplier)
  return {
    meal_datetime: `${today()}T${new Date().toTimeString().slice(0, 8)}`,
    meal_type: 'beverage',
    source: 'manual',
    items: [{
      food_id: drink.food_id,
      food_name: drink.canonical_name,
      serving_amount: multiplier,
      serving_unit: drink.serving_size,
      calories: Math.round(drink.calories * multiplier),
      protein_g: scaled('protein_g'), carbs_g: scaled('carbs_g'), fat_g: scaled('fat_g'),
      fiber_g: scaled('fiber_g'), sugar_g: scaled('sugar_g'), sodium_mg: scaled('sodium_mg'),
      micros: drink.micros, is_beverage: true,
      source: { ...drink.source, brand: drink.brand, is_beverage: true },
    }],
  }
}
