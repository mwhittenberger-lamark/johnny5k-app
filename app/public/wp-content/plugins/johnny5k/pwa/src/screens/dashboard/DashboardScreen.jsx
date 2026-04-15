import { useState } from 'react'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import AppIcon from '../../components/ui/AppIcon'
import OfflineState from '../../components/ui/OfflineState'
import { DailyFocusHero } from './components/DashboardCards'
import { DashboardIconBadge } from './components/dashboardSharedCards'
import { DASHBOARD_BUCKET_META } from './dashboardCardRegistry'
import { groupDashboardCardsByBucket } from './dashboardLayoutUtils'
import { useDashboardViewModel } from './hooks/useDashboardViewModel.jsx'

export default function DashboardScreen() {
  const {
    actionNoticeKey,
    addDashboardCard,
    buildVisibleBucketOrder,
    canMoveDashboardCardAcrossBuckets,
    coachStarterPrompt,
    coachLine,
    customizeOpen,
    dailyFocus,
    dashboardCardsByBucket,
    dateLabel,
    greetingName,
    handleDashboardAction,
    hiddenDashboardCards,
    isOnline,
    johnnyActionNotice,
    loadAwards,
    loadSnapshot,
    loading,
    moveDashboardCard,
    openDashboardJohnny,
    quickPrompts,
    resetDashboardLayout,
    setCustomizeOpen,
    snapshot,
    targetsNoticeKey,
    targetsUpdated,
    toggleDashboardCard,
    visibleDashboardCards,
  } = useDashboardViewModel()
  const [dismissedTargetsNoticeKey, setDismissedTargetsNoticeKey] = useState('')
  const [dismissedActionNoticeKey, setDismissedActionNoticeKey] = useState('')
  const [recoveryLoopOpen, setRecoveryLoopOpen] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const [trainingExtrasOpen, setTrainingExtrasOpen] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const moreActionCards = dashboardCardsByBucket.quick_actions || []

  if (!snapshot && !isOnline) {
    return (
      <OfflineState
        title="Dashboard unavailable offline"
        body="Johnny5k can show this dashboard offline after it has loaded online once. Reconnect briefly to refresh today’s board and cache the latest snapshot."
        actionLabel="Try again"
        onAction={() => {
          void loadSnapshot(true)
          void loadAwards()
        }}
      />
    )
  }

  if (loading && !snapshot) {
    return (
      <AppLoadingScreen
        eyebrow="Dashboard"
        title="Building today\'s board"
        message="Johnny is pulling your snapshot, arranging your cards, and getting the day ready to scan fast."
        variant="dashboard"
      />
    )
  }

  function renderDashboardCardSlot(card, visibleBucketIds = []) {
    if (card.sectionControl) return null

    const index = visibleBucketIds.indexOf(card.id)
    const canCrossBucketUp = Boolean(card.optional) && canMoveDashboardCardAcrossBuckets(card.id, -1)
    const canCrossBucketDown = Boolean(card.optional) && canMoveDashboardCardAcrossBuckets(card.id, 1)

    const cardBody = card.id === 'recovery_loop' ? (
      <DashboardDisclosureSection
        title={card.label}
        caption={card.description}
        open={customizeOpen || recoveryLoopOpen}
        onToggle={() => setRecoveryLoopOpen(open => !open)}
        actionLabel={customizeOpen || recoveryLoopOpen ? 'Hide' : 'Show'}
      >
        {card.content}
      </DashboardDisclosureSection>
    ) : card.content

    return (
      <DashboardCardSlot
        key={card.id}
        card={card}
        customizing={customizeOpen}
        canMoveUp={index > 0 || canCrossBucketUp}
        canMoveDown={(index > -1 && index < visibleBucketIds.length - 1) || canCrossBucketDown}
        onMoveUp={() => moveDashboardCard(card.id, card.bucket, -1, visibleBucketIds)}
        onMoveDown={() => moveDashboardCard(card.id, card.bucket, 1, visibleBucketIds)}
        onHide={() => toggleDashboardCard(card.id)}
      >
        {cardBody}
      </DashboardCardSlot>
    )
  }

  return (
    <div className="screen dashboard-screen">
      <header className="screen-header dashboard-header">
        <div>
          <p className="dashboard-eyebrow">My Dashboard</p>
          <h1>{greetingName ? `Hi, ${greetingName}` : 'Today'}</h1>
          <p className="dashboard-subtitle">{coachLine}</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="date dashboard-date">{dateLabel}</span>
        </div>
      </header>

      {targetsUpdated && dismissedTargetsNoticeKey !== targetsNoticeKey ? (
        <div className="dash-card settings-warning dashboard-notice" role="status">
          <div>
            <strong>Targets updated.</strong>
            <p>{targetsUpdated.target_calories} calories | {targetsUpdated.target_protein_g}g protein | {targetsUpdated.target_carbs_g}g carbs | {targetsUpdated.target_fat_g}g fat</p>
          </div>
          <button className="btn-outline small" onClick={() => setDismissedTargetsNoticeKey(targetsNoticeKey)}>Dismiss</button>
        </div>
      ) : null}

      {johnnyActionNotice && dismissedActionNoticeKey !== actionNoticeKey ? (
        <div className="dash-card settings-warning dashboard-notice" role="status">
          <div>
            <strong>Johnny opened this screen.</strong>
            <p>{johnnyActionNotice}</p>
          </div>
          <button className="btn-outline small" onClick={() => setDismissedActionNoticeKey(actionNoticeKey)}>Dismiss</button>
        </div>
      ) : null}

      {visibleDashboardCards.length ? (
        <>
          <section className="dashboard-command-center">
            <DailyFocusHero
              model={dailyFocus ? { ...dailyFocus, askPrompt: coachStarterPrompt } : null}
              suggestions={quickPrompts}
              onPrimaryAction={handleDashboardAction}
              onSecondaryAction={handleDashboardAction}
              onAskJohnny={(prompt) => openDashboardJohnny(prompt || coachStarterPrompt, {
                surface: 'dashboard_daily_focus',
                promptKind: 'starter_prompt',
              })}
            />
          </section>

          {(dashboardCardsByBucket.primary_main?.length || dashboardCardsByBucket.primary_side?.length) ? (
            <section className="dashboard-primary-grid">
              {dashboardCardsByBucket.primary_main?.length ? (
                <div className="dashboard-primary-stack">
                  {dashboardCardsByBucket.primary_main.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.primary_main)))}
                </div>
              ) : null}
              {dashboardCardsByBucket.primary_side?.length ? (
                <div className="dashboard-primary-stack">
                  {dashboardCardsByBucket.primary_side.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.primary_side)))}
                </div>
              ) : null}
            </section>
          ) : null}

          {(dashboardCardsByBucket.training_main?.length || dashboardCardsByBucket.training_side?.length) ? (
            <section className="dashboard-section dashboard-two-col">
              {dashboardCardsByBucket.training_main?.length ? (
                <div className="dashboard-primary-stack">
                  {dashboardCardsByBucket.training_main.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.training_main)))}
                </div>
              ) : null}
              {dashboardCardsByBucket.training_side?.length ? (
                <div className="dashboard-side-stack">
                  <DashboardDisclosureSection
                    title="Training extras"
                    caption="Momentum and tomorrow planning"
                    open={customizeOpen || trainingExtrasOpen}
                    onToggle={() => setTrainingExtrasOpen(open => !open)}
                    actionLabel={customizeOpen || trainingExtrasOpen ? 'Hide' : 'Show'}
                  >
                    <div className="dashboard-side-stack">
                      {dashboardCardsByBucket.training_side.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.training_side)))}
                    </div>
                  </DashboardDisclosureSection>
                </div>
              ) : null}
            </section>
          ) : null}

          {moreActionCards.length ? (
            <DashboardDisclosureSection
              title="More actions"
              caption="Secondary shortcuts for logging and profile tasks"
              open={customizeOpen || moreActionsOpen}
              onToggle={() => setMoreActionsOpen(open => !open)}
              actionLabel={customizeOpen || moreActionsOpen ? 'Hide' : 'Show'}
            >
              <div className="dashboard-action-grid compact dashboard-action-grid-secondary">
                {moreActionCards.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(moreActionCards)))}
              </div>
            </DashboardDisclosureSection>
          ) : null}

          {dashboardCardsByBucket.story?.length ? (
            <DashboardDisclosureSection
              title="Inspiration and stories"
              caption="Editorial coaching and transformation stories"
              open={customizeOpen || storyOpen}
              onToggle={() => setStoryOpen(open => !open)}
              actionLabel={customizeOpen || storyOpen ? 'Hide' : 'Show'}
            >
              <div className="dashboard-story-stack">
                {dashboardCardsByBucket.story.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.story)))}
              </div>
            </DashboardDisclosureSection>
          ) : null}
        </>
      ) : (
        <section className="dash-card dashboard-empty-layout-card">
          <span className="dashboard-chip subtle">All hidden</span>
          <h2>Your dashboard is currently empty.</h2>
          <p>Turn on Pimp My Dashboard to add cards back or reset the layout.</p>
          <div className="dashboard-empty-layout-actions">
            <button type="button" className="btn-outline small" onClick={() => setCustomizeOpen(true)}>Start arranging</button>
            <button type="button" className="btn-secondary small" onClick={resetDashboardLayout}>Reset layout</button>
          </div>
        </section>
      )}

      {customizeOpen ? <DashboardAddCardsSection cards={hiddenDashboardCards} onAddCard={addDashboardCard} /> : null}

      <div className="dashboard-bottom-actions">
        <button type="button" className={`btn-outline small dashboard-customize-trigger${customizeOpen ? ' active' : ''}`} onClick={() => setCustomizeOpen(open => !open)}>
          {customizeOpen ? 'Done arranging' : 'Pimp My Dashboard'}
        </button>
        {customizeOpen ? <button type="button" className="btn-secondary small dashboard-customize-trigger" onClick={resetDashboardLayout}>Reset layout</button> : null}
      </div>
    </div>
  )
}

function DashboardDisclosureSection({ title, caption, open, onToggle, actionLabel, children }) {
  return (
    <section className="dashboard-section dashboard-disclosure-section">
      <div className="dashboard-section-title-row dashboard-section-title-row-tight">
        <div>
          <h2>{title}</h2>
          {caption ? <span className="dashboard-section-caption">{caption}</span> : null}
        </div>
        <button type="button" className="btn-ghost small dashboard-section-toggle" onClick={onToggle}>
          {actionLabel}
        </button>
      </div>
      {open ? children : null}
    </section>
  )
}

function DashboardCardSlot({ card, customizing, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onHide, children }) {
  return (
    <div className={`dashboard-layout-slot${customizing ? ' customizing' : ''}`}>
      {customizing ? (
        <div className="dashboard-layout-slot-overlay">
          <span className="dashboard-layout-slot-label">{card.label}</span>
          <div className="dashboard-layout-slot-controls">
            {card.optional ? <span className="dashboard-customize-optional-badge">Optional</span> : null}
            <button type="button" className="btn-outline small dashboard-slot-icon-control" onClick={onMoveUp} disabled={!canMoveUp} aria-label={`Move ${card.label} up`}>
              <AppIcon name="chevron-up" />
            </button>
            <button type="button" className="btn-outline small dashboard-slot-icon-control" onClick={onMoveDown} disabled={!canMoveDown} aria-label={`Move ${card.label} down`}>
              <AppIcon name="chevron-down" />
            </button>
            <button type="button" className="btn-secondary small dashboard-slot-icon-control" onClick={onHide} aria-label={`Hide ${card.label}`}>
              <AppIcon name="close" />
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}

function DashboardAddCardsSection({ cards, onAddCard }) {
  if (!cards.length) return null

  const cardsByBucket = groupDashboardCardsByBucket(cards)

  return (
    <section className="dashboard-section dashboard-add-cards-section" aria-labelledby="dashboard-add-cards-title">
      <div className="dashboard-section-title-row">
        <div>
          <h2 id="dashboard-add-cards-title">Add cards</h2>
          <p className="dashboard-add-cards-subtitle">Hidden and optional cards live here until you add them back to the board.</p>
        </div>
      </div>
      <div className="dashboard-add-cards-groups">
        {Object.entries(cardsByBucket).map(([bucket, bucketCards]) => {
          const bucketMeta = DASHBOARD_BUCKET_META[bucket] || { label: bucket, description: '' }

          return (
            <section key={bucket} className="dashboard-add-cards-group">
              <div className="dashboard-add-cards-group-head">
                <strong>{bucketMeta.label}</strong>
                {bucketMeta.description ? <p>{bucketMeta.description}</p> : null}
              </div>
              <div className="dashboard-add-cards-list">
                {bucketCards.map(card => (
                  <article key={card.id} className="dashboard-add-card-item">
                    <div className="dashboard-add-card-copy">
                      <div className="dashboard-add-card-title-row">
                        <DashboardIconBadge iconName={card.iconName} tone={card.iconTone} compact />
                        <strong>{card.label}</strong>
                      </div>
                      <p>{card.description}</p>
                    </div>
                    <div className="dashboard-add-card-actions">
                      <span className="dashboard-customize-status hidden">Hidden</span>
                      {card.optional ? <span className="dashboard-customize-optional-badge">Optional</span> : null}
                      <button type="button" className="btn-primary small" onClick={() => onAddCard(card.id)}>Add card</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
