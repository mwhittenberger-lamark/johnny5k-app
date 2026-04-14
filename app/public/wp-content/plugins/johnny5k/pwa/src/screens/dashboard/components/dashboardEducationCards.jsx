import { useState } from 'react'

import { DashboardIconBadge } from './dashboardSharedCards'

const BEGINNER_EDUCATION_ITEMS = [
  {
    id: 'first-8-weeks',
    type: 'FAQ',
    title: 'What matters most in your first 8 weeks?',
    body: 'Consistency beats intensity early. Nail 3-4 clean sessions, leave 1-3 reps in reserve, and let technique settle before chasing numbers.',
    actionLabel: 'Ask Johnny',
    action: { kind: 'ask', prompt: 'Teach me what to focus on during my first 8 weeks of lifting so I do not overcomplicate it.' },
  },
  {
    id: 'set-effort',
    type: 'FAQ',
    title: 'How hard should my sets feel?',
    body: 'Most work should feel challenging but controlled. If your form breaks down or every set turns into a grind, you are pushing too hard.',
    actionLabel: 'Learn effort',
    action: { kind: 'ask', prompt: 'Explain reps in reserve for a beginner and tell me how hard my working sets should feel.' },
  },
  {
    id: 'adding-weight',
    type: 'FAQ',
    title: 'When should I add weight?',
    body: 'Only move load up after you hit the top of the rep range with stable form. The goal is boring, repeatable progress, not random jumps.',
    actionLabel: 'Progression guide',
    action: { kind: 'ask', prompt: 'Show me a simple beginner progression rule for when to add weight versus repeat the same load.' },
  },
  {
    id: 'first-gym-day',
    type: 'Checklist',
    title: 'First gym day checklist',
    body: 'Know your first 4-6 movements, where they are in the gym, and what your backup machine or dumbbell version is before you start.',
    actionLabel: 'Open workout',
    action: { kind: 'route', href: '/workout' },
  },
  {
    id: 'warm-up',
    type: 'Guide',
    title: 'Warm up in 5 minutes',
    body: 'Use 2-3 minutes of easy movement, one mobility drill for the main joint, then 2 ramp-up sets before the first lift.',
    actionLabel: 'Get warm-up',
    action: { kind: 'ask', prompt: 'Build me a 5-minute beginner warm-up for today’s workout and keep it simple.' },
  },
  {
    id: 'rest-times',
    type: 'Guide',
    title: 'Rest times made simple',
    body: 'Take 2-3 minutes on harder compound lifts and about 60-90 seconds on accessories. Rest enough to repeat good reps.',
    actionLabel: 'Open timer plan',
    action: { kind: 'ask', prompt: 'Give me simple beginner rest-time rules for compounds, accessories, and cardio intervals.' },
  },
  {
    id: 'squat-video',
    type: 'Video',
    title: 'Watch beginner squat form',
    body: 'A quick visual can help the pattern click faster than overthinking cues. Start with goblet squat form before barbell work.',
    actionLabel: 'Watch videos',
    action: { kind: 'external', href: 'https://www.youtube.com/results?search_query=beginner+goblet+squat+form' },
  },
  {
    id: 'press-video',
    type: 'Video',
    title: 'Watch dumbbell press setup',
    body: 'Learn how to set your shoulders, where your elbows should track, and how to get the dumbbells into position without chaos.',
    actionLabel: 'Watch videos',
    action: { kind: 'external', href: 'https://www.youtube.com/results?search_query=beginner+dumbbell+bench+press+form' },
  },
  {
    id: 'pulldown-video',
    type: 'Video',
    title: 'Watch lat pulldown form',
    body: 'This helps with upper-back setup, arm path, and avoiding the common beginner mistake of turning every pulldown into a biceps curl.',
    actionLabel: 'Watch videos',
    action: { kind: 'external', href: 'https://www.youtube.com/results?search_query=lat+pulldown+form+for+beginners' },
  },
  {
    id: 'protein-basics',
    type: 'Resource',
    title: 'Protein basics for lifters',
    body: 'You do not need perfect meals. You need regular protein hits across the day so recovery and muscle gain have something to work with.',
    actionLabel: 'Open nutrition',
    action: { kind: 'route', href: '/nutrition' },
  },
  {
    id: 'sleep-basics',
    type: 'Resource',
    title: 'Sleep basics for recovery',
    body: 'Bad sleep makes training feel harder, recovery slower, and hunger louder. Protecting bedtime is a real training skill.',
    actionLabel: 'Open sleep',
    action: { kind: 'route', href: '/body', state: { focusTab: 'sleep' } },
  },
  {
    id: 'progress-photos',
    type: 'Resource',
    title: 'Take progress photos that help',
    body: 'Use the same lighting, angles, and relaxed stance each time. Cleaner check-ins beat dramatic flexed pictures every time.',
    actionLabel: 'Open photos',
    action: { kind: 'route', href: '/progress-photos' },
  },
]

export function BeginnerEducationCard({ onAction }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const totalItems = BEGINNER_EDUCATION_ITEMS.length
  const activeItem = BEGINNER_EDUCATION_ITEMS[activeIndex] ?? BEGINNER_EDUCATION_ITEMS[0]

  function jumpToItem(nextIndex) {
    if (!totalItems) return
    const normalizedIndex = ((nextIndex % totalItems) + totalItems) % totalItems
    setActiveIndex(normalizedIndex)
  }

  return (
    <section className="dash-card dashboard-optional-card dashboard-beginner-education-card">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="coach" tone="teal" />
        <span className="dashboard-chip ai">Beginner Education</span>
        <span className="dashboard-card-kicker">{BEGINNER_EDUCATION_ITEMS.length} quick resources</span>
      </div>
      <h3>Start with the stuff that actually makes training easier</h3>
      <p className="dashboard-beginner-education-copy">These are the first concepts most people wish they understood sooner: effort, form, progression, recovery, and what to ignore while you build confidence.</p>
      <div className="dashboard-beginner-education-rotator">
        <div className="dashboard-beginner-education-rotator-top">
          <span className="dashboard-beginner-education-progress">
            {activeIndex + 1} / {totalItems}
          </span>
          <div className="dashboard-beginner-education-controls" aria-label="Beginner education rotator controls">
            <button type="button" className="btn-outline small" onClick={() => jumpToItem(activeIndex - 1)}>
              Previous
            </button>
            <button type="button" className="btn-outline small" onClick={() => jumpToItem(activeIndex + 1)}>
              Next
            </button>
          </div>
        </div>
        <article key={activeItem.id} className="dashboard-beginner-resource-card">
          <div className="dashboard-beginner-resource-head">
            <span className="dashboard-chip subtle">{activeItem.type}</span>
            <strong>{activeItem.title}</strong>
          </div>
          <p>{activeItem.body}</p>
          <button type="button" className="btn-outline small" onClick={() => onAction?.(activeItem.action)}>
            {activeItem.actionLabel}
          </button>
        </article>
        <div className="dashboard-beginner-education-dots" aria-label="Choose a beginner education card">
          {BEGINNER_EDUCATION_ITEMS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`dashboard-beginner-education-dot${index === activeIndex ? ' active' : ''}`}
              onClick={() => jumpToItem(index)}
              aria-label={`Show ${item.title}`}
              aria-pressed={index === activeIndex}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
