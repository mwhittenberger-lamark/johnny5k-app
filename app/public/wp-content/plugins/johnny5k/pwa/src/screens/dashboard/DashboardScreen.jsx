import { useState } from 'react'
import AppIcon from '../../components/ui/AppIcon'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import OfflineState from '../../components/ui/OfflineState'
import { groupDashboardCardsByBucket } from './dashboardLayoutUtils'
import { DashboardIconBadge, WeekRhythmDrawer } from './components/DashboardCards'
import { DASHBOARD_BUCKET_META } from './dashboardCardRegistry'
import { buildWeekRhythmDrawerCopy } from './dashboardRecommendationHelpers'
import { useDashboardViewModel } from './hooks/useDashboardViewModel.jsx'

export default function DashboardScreen() {
  const {
    actionNoticeKey,
    addDashboardCard,
    buildVisibleBucketOrder,
    canMoveDashboardCardAcrossBuckets,
    coachLine,
    customizeOpen,
    dashboardCardsByBucket,
    dateLabel,
    greetingName,
    hiddenDashboardCards,
    isOnline,
    johnnyActionNotice,
    loadAwards,
    loadSnapshot,
    loading,
    moveDashboardCard,
    openRewards,
    openSettings,
    resetDashboardLayout,
    setCustomizeOpen,
    showSnapshotSectionRow,
    snapshot,
    snapshotEditTargetsHidden,
    snapshotScore,
    snapshotSectionTitleHidden,
    targetsNoticeKey,
    targetsUpdated,
    toggleDashboardCard,
    visibleDashboardCards,
    weekRhythmOpen,
    weeklyRhythmBreakdown,
    setWeekRhythmOpen,
  } = useDashboardViewModel()
  const [dismissedTargetsNoticeKey, setDismissedTargetsNoticeKey] = useState('')
  const [dismissedActionNoticeKey, setDismissedActionNoticeKey] = useState('')

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
        {card.content}
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

          {dashboardCardsByBucket.quick_actions?.length ? (
            <section className="dashboard-section">
              <div className="dashboard-section-title-row dashboard-section-title-row-tight">
                <h2>Do this now</h2>
              </div>
              <div className="dashboard-action-grid compact">
                {dashboardCardsByBucket.quick_actions.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.quick_actions)))}
              </div>
            </section>
          ) : null}

          {(dashboardCardsByBucket.snapshot_stats?.length || dashboardCardsByBucket.snapshot_detail?.length) ? (
            <section className="dashboard-section">
              {showSnapshotSectionRow ? (
                <div className="dashboard-section-title-row">
                  {!snapshotSectionTitleHidden ? (
                    <div className="dashboard-section-inline-control">
                      <h2>Today&apos;s Snapshot</h2>
                      {customizeOpen ? (
                        <button
                          type="button"
                          className="btn-secondary small dashboard-slot-icon-control"
                          onClick={() => toggleDashboardCard('snapshot_section_title')}
                          aria-label="Hide Today’s Snapshot title"
                        >
                          <AppIcon name="close" />
                        </button>
                      ) : null}
                    </div>
                  ) : <div />}
                  {!snapshotEditTargetsHidden ? (
                    <div className="dashboard-section-inline-control">
                      <button className="btn-outline small" onClick={openSettings}>Edit targets</button>
                      {customizeOpen ? (
                        <button
                          type="button"
                          className="btn-secondary small dashboard-slot-icon-control"
                          onClick={() => toggleDashboardCard('snapshot_edit_targets')}
                          aria-label="Hide Edit targets button"
                        >
                          <AppIcon name="close" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {dashboardCardsByBucket.snapshot_stats?.length ? (
                <div className="dashboard-stat-grid">
                  {dashboardCardsByBucket.snapshot_stats.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.snapshot_stats)))}
                </div>
              ) : null}
              {dashboardCardsByBucket.snapshot_detail?.length ? (
                <div className="dashboard-detail-stack">
                  {dashboardCardsByBucket.snapshot_detail.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.snapshot_detail)))}
                </div>
              ) : null}
              <WeekRhythmDrawer
                isOpen={weekRhythmOpen}
                score={snapshotScore}
                breakdown={weeklyRhythmBreakdown}
                copy={buildWeekRhythmDrawerCopy(snapshotScore)}
                onClose={() => setWeekRhythmOpen(false)}
                onOpenRewards={openRewards}
              />
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
                  {dashboardCardsByBucket.training_side.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.training_side)))}
                </div>
              ) : null}
            </section>
          ) : null}

          {dashboardCardsByBucket.story?.length ? (
            <section className="dashboard-section">
              <div className="dashboard-section-title-row dashboard-section-title-row-tight">
                <h2>Inspirational thoughts</h2>
                <span className="dashboard-section-caption">Editorial coaching plus real-world transformation inspiration</span>
              </div>
              <div className="dashboard-story-stack">
                {dashboardCardsByBucket.story.map(card => renderDashboardCardSlot(card, buildVisibleBucketOrder(dashboardCardsByBucket.story)))}
              </div>
            </section>
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
