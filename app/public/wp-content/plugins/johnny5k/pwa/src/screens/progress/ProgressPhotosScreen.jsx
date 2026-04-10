import { useEffect, useMemo, useRef, useState } from 'react'
import { dashboardApi } from '../../api/modules/dashboard'
import { formatUsShortDate } from '../../lib/dateFormat'

const ANGLES = ['front', 'side', 'back']

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatPhotoDate(value) {
  return formatUsShortDate(value, value)
}

export default function ProgressPhotosScreen() {
  const [photos, setPhotos] = useState([])
  const [baselines, setBaselines] = useState({})
  const [photoSrcs, setPhotoSrcs] = useState({})
  const [angle, setAngle] = useState('front')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [uploading, setUploading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [baselineSavingAngle, setBaselineSavingAngle] = useState('')
  const [deletingId, setDeletingId] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [selectedPair, setSelectedPair] = useState(null)
  const [openTimelineDates, setOpenTimelineDates] = useState({})
  const uploadRef = useRef(null)
  const comparisonRef = useRef(null)

  async function loadPhotos() {
    setError('')
    try {
      const data = await dashboardApi.photosList()
      setPhotos(data?.photos ?? [])
      setBaselines(data?.baselines ?? {})
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadPhotos()
  }, [])

  useEffect(() => {
    let cancelled = false
    const objectUrls = []

    async function loadPhotoSrcs() {
      if (!photos.length) {
        setPhotoSrcs({})
        return
      }

      try {
        const entries = await Promise.all(photos.map(async (photo) => {
          const blob = await dashboardApi.photoBlob(photo.id)
          const objectUrl = URL.createObjectURL(blob)
          objectUrls.push(objectUrl)
          return [photo.id, objectUrl]
        }))

        if (!cancelled) {
          setPhotoSrcs(Object.fromEntries(entries))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      }
    }

    loadPhotoSrcs()

    return () => {
      cancelled = true
      objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [photos])

  const grouped = useMemo(() => {
    return ANGLES.reduce((carry, currentAngle) => {
      carry[currentAngle] = photos
        .filter(photo => photo.angle === currentAngle)
        .sort((a, b) => String(b.photo_date).localeCompare(String(a.photo_date)) || b.id - a.id)
      return carry
    }, {})
  }, [photos])

  const timelinePhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      return String(b.photo_date).localeCompare(String(a.photo_date))
        || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        || b.id - a.id
    })
  }, [photos])

  const timelineDateGroups = useMemo(() => {
    const groups = []
    const photoGroups = new Map()

    timelinePhotos.forEach(photo => {
      const photoDate = String(photo.photo_date || '')
      if (!photoGroups.has(photoDate)) {
        photoGroups.set(photoDate, [])
      }
      photoGroups.get(photoDate).push(photo)
    })

    photoGroups.forEach((items, photoDate) => {
      groups.push({
        date: photoDate,
        label: formatPhotoDate(photoDate),
        items,
      })
    })

    return groups
  }, [timelinePhotos])

  const compareGroups = useMemo(() => {
    return ANGLES.map(currentAngle => {
      const items = grouped[currentAngle] ?? []
      const latest = items[0] ?? null
      const previous = items[1] ?? null
      const baselineId = Number(baselines[currentAngle] ?? 0)
      const baseline = items.find(photo => Number(photo.id) === baselineId) ?? null

      return {
        angle: currentAngle,
        latest,
        previous,
        baseline,
        count: items.length,
      }
    }).filter(group => group.count > 0)
  }, [baselines, grouped])

  const comparisonFirstSrc = comparison ? photoSrcs[comparison.first_photo?.id] ?? '' : ''
  const comparisonSecondSrc = comparison ? photoSrcs[comparison.second_photo?.id] ?? '' : ''
  const showComparisonCard = comparing || Boolean(comparison)
  const uploadButtonLabel = uploading ? 'Uploading…' : `Upload ${titleCase(angle)} Photo`

  useEffect(() => {
    if (!notice?.id) return undefined

    const timer = window.setTimeout(() => {
      setNotice(null)
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!timelineDateGroups.length) {
      setOpenTimelineDates({})
      return
    }

    setOpenTimelineDates(current => {
      const next = {}

      timelineDateGroups.forEach((group, index) => {
        next[group.date] = Object.prototype.hasOwnProperty.call(current, group.date)
          ? current[group.date]
          : index === 0
      })

      return next
    })
  }, [timelineDateGroups])

  useEffect(() => {
    if (!showComparisonCard || !comparisonRef.current) return

    window.requestAnimationFrame(() => {
      comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [showComparisonCard])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const form = new FormData()
    form.append('photo', file)
    form.append('angle', angle)
    form.append('date', date)

    setUploading(true)
    setError('')
    try {
      await dashboardApi.photoUpload(form)
      await loadPhotos()
      uploadRef.current.value = ''
      setNotice({
        id: `upload-${Date.now()}`,
        tone: 'success',
        title: 'Photo added',
        message: `${titleCase(angle)} photo saved for ${formatPhotoDate(date)}.`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function runCompare(firstPhoto, secondPhoto, label) {
    if (!firstPhoto || !secondPhoto) return

    setSelectedPair(label)
    setComparison(null)
    setComparing(true)
    setError('')
    try {
      const data = await dashboardApi.comparePhotos(firstPhoto.id, secondPhoto.id)
      setComparison(data)
      setNotice({
        id: `compare-${Date.now()}`,
        tone: 'info',
        title: 'Comparison ready',
        message: `Showing ${label.toLowerCase()}.`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setComparing(false)
    }
  }

  async function handleSetBaseline(photo) {
    setBaselineSavingAngle(photo.angle)
    setError('')
    try {
      const data = await dashboardApi.setPhotoBaseline(photo.id, photo.angle)
      setBaselines(data?.baselines ?? {})
      setPhotos(current => current.map(item => ({
        ...item,
        is_baseline: Number(item.id) === Number(photo.id) ? true : item.angle === photo.angle ? false : item.is_baseline,
      })))
      if (comparison && [comparison.first_photo?.angle, comparison.second_photo?.angle].includes(photo.angle)) {
        setComparison(null)
        setSelectedPair(null)
      }
      setNotice({
        id: `baseline-${Date.now()}`,
        tone: 'success',
        title: 'Baseline updated',
        message: `${titleCase(photo.angle)} baseline set to ${formatPhotoDate(photo.photo_date)}.`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBaselineSavingAngle('')
    }
  }

  async function handleDelete(photo) {
    const confirmed = window.confirm(`Delete the ${photo.angle} photo from ${formatPhotoDate(photo.photo_date)}? This also removes the uploaded image file.`)
    if (!confirmed) return

    setDeletingId(photo.id)
    setError('')
    try {
      await dashboardApi.deletePhoto(photo.id)
      if (comparison && [comparison.first_photo?.id, comparison.second_photo?.id].includes(photo.id)) {
        setComparison(null)
        setSelectedPair(null)
      }
      await loadPhotos()
      setNotice({
        id: `remove-${Date.now()}`,
        tone: 'info',
        title: 'Photo removed',
        message: `${titleCase(photo.angle)} photo from ${formatPhotoDate(photo.photo_date)} was deleted.`,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(0)
    }
  }

  function toggleTimelineDate(dateKey) {
    setOpenTimelineDates(current => ({
      ...current,
      [dateKey]: !current[dateKey],
    }))
  }

  return (
    <div className="screen progress-photos-screen">
      <header className="screen-header">
        <div>
          <h1>Progress Photos</h1>
          <p className="settings-subtitle">Keep one shared timeline, choose your front and side baselines, and add a back photo only if you want it.</p>
        </div>
      </header>

      {notice ? (
        <div className={`app-toast ${notice.tone || 'info'}`} role="status" aria-live="polite">
          <div className="app-toast-copy">
            {notice.title ? <p className="app-toast-title">{notice.title}</p> : null}
            {notice.message ? <p className="app-toast-message">{notice.message}</p> : null}
          </div>
          <button type="button" className="app-toast-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss toast">×</button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <section className="dash-card progress-howto-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip subtle">How it works</span>
          <span className="dashboard-card-kicker">3 quick steps</span>
        </div>
        <ol className="progress-howto-list">
          <li>Upload a front or side photo with the correct date.</li>
          <li>Set a baseline in Timeline for each angle you want to track.</li>
          <li>Run a comparison from the angle cards to get Johnny&apos;s review.</li>
        </ol>
      </section>

      <section className="dash-card progress-upload-card">
        <div className="progress-toolbar">
          <label>Angle
            <select value={angle} onChange={event => setAngle(event.target.value)}>
              {ANGLES.map(option => <option key={option} value={option}>{titleCase(option)}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" value={date} onChange={event => setDate(event.target.value)} />
          </label>
          <label className="btn-primary progress-upload-button">
            {uploadButtonLabel}
            <input ref={uploadRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} hidden disabled={uploading} />
          </label>
        </div>
        <p className="progress-upload-note">Front and side photos are recommended. Back photos are optional. Upload starts right after you pick a file.</p>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row">
          <h2>Compare by angle</h2>
          <span>{timelinePhotos.length} total photo(s)</span>
        </div>

        <div className="progress-angle-groups">
          {compareGroups.map(group => (
            <article key={group.angle} className="dash-card progress-angle-card">
              <div className="progress-angle-head">
                <div>
                  <h3>{titleCase(group.angle)}</h3>
                  <p>{group.count} photo{group.count === 1 ? '' : 's'} in the timeline</p>
                </div>
                {group.baseline ? <span className="dashboard-chip">Baseline set</span> : <span className="dashboard-chip subtle">No baseline yet</span>}
              </div>
              <div className="progress-angle-actions">
                <button
                  className="btn-primary"
                  disabled={comparing || !group.latest || !group.baseline || group.latest.id === group.baseline.id}
                  onClick={() => runCompare(group.baseline, group.latest, `${titleCase(group.angle)} baseline vs latest`)}
                >
                  Compare baseline vs latest
                </button>
                <button
                  className="btn-secondary"
                  disabled={comparing || !group.latest || !group.previous}
                  onClick={() => runCompare(group.previous, group.latest, `${titleCase(group.angle)} previous vs latest`)}
                >
                  Compare previous vs latest
                </button>
              </div>
              {!group.baseline ? <p className="progress-angle-tip">Set a baseline in Timeline first.</p> : null}
              {group.baseline && group.latest && group.latest.id === group.baseline.id ? <p className="progress-angle-tip">Add a newer {group.angle} photo to compare against your baseline.</p> : null}
            </article>
          ))}
          {!compareGroups.length ? <p className="empty-state">No progress photos yet. Upload a front or side photo to start your timeline.</p> : null}
        </div>

        {showComparisonCard ? (
          <div ref={comparisonRef} className="dash-card progress-comparison-card">
            <div className="dashboard-card-head">
              <span className="dashboard-chip ai">AI compare</span>
              <strong>{selectedPair}</strong>
            </div>
            {comparing ? (
              <>
                <div className="progress-comparison-images progress-comparison-images-loading" aria-hidden="true">
                  <div className="progress-comparison-image-skeleton" />
                  <div className="progress-comparison-image-skeleton" />
                </div>
                <div className="progress-comparison-loading" aria-live="polite">
                  <p className="progress-comparison-loading-copy">Johnny is reviewing both photos now.</p>
                  <div className="progress-comparison-loading-lines">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </>
            ) : comparison ? (
              <>
                <div className="progress-comparison-images">
                  <figure>
                    <img src={comparisonFirstSrc} alt={`${comparison.first_photo.angle} on ${formatPhotoDate(comparison.first_photo.photo_date)}`} />
                    <figcaption>{formatPhotoDate(comparison.first_photo.photo_date)} · {comparison.first_photo.angle}</figcaption>
                  </figure>
                  <figure>
                    <img src={comparisonSecondSrc} alt={`${comparison.second_photo.angle} on ${formatPhotoDate(comparison.second_photo.photo_date)}`} />
                    <figcaption>{formatPhotoDate(comparison.second_photo.photo_date)} · {comparison.second_photo.angle}</figcaption>
                  </figure>
                </div>
                <p>{comparison.comparison}</p>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-title-row">
          <h2>Timeline</h2>
          <span>Grouped by photo date</span>
        </div>

        <div className="progress-timeline-accordion">
          {timelineDateGroups.map(group => {
            const isOpen = Boolean(openTimelineDates[group.date])

            return (
              <section key={group.date} className="dash-card progress-date-group-card">
                <button
                  type="button"
                  className="progress-date-group-toggle"
                  onClick={() => toggleTimelineDate(group.date)}
                  aria-expanded={isOpen}
                >
                  <div>
                    <strong>{group.label}</strong>
                    <span>{group.items.length} photo{group.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <span className={`progress-date-group-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
                </button>

                {isOpen ? (
                  <div className="progress-photo-grid progress-photo-grid-grouped">
                    {group.items.map(photo => (
                      <article key={photo.id} className="dash-card progress-photo-card">
                        <img src={photoSrcs[photo.id] ?? ''} alt={`${photo.angle} progress photo from ${formatPhotoDate(photo.photo_date)}`} />
                        <div className="progress-photo-meta">
                          <div>
                            <strong>{titleCase(photo.angle)}</strong>
                            <div className="progress-photo-tags">
                              <span className="dashboard-chip">{titleCase(photo.angle)}</span>
                              {photo.is_baseline ? <span className="dashboard-chip success">Baseline</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="progress-photo-actions">
                          <button
                            className="btn-secondary small"
                            type="button"
                            onClick={() => handleSetBaseline(photo)}
                            disabled={baselineSavingAngle === photo.angle || photo.is_baseline}
                          >
                            {photo.is_baseline ? 'Current baseline' : baselineSavingAngle === photo.angle ? 'Saving…' : 'Set baseline'}
                          </button>
                          <button className="btn-outline small" type="button" onClick={() => handleDelete(photo)} disabled={deletingId === photo.id}>
                            {deletingId === photo.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
          {!timelineDateGroups.length ? <p className="empty-state">No progress photos yet. Upload one to start your timeline.</p> : null}
        </div>
      </section>
    </div>
  )
}
