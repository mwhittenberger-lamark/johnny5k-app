import { useRef } from 'react'

/* eslint-disable react-hooks/refs */

import { nutritionApi } from '../../../api/modules/nutrition'
import AppIcon from '../../../components/ui/AppIcon'
import ClearableInput from '../../../components/ui/ClearableInput'
import EmptyState from '../../../components/ui/EmptyState'
import ErrorState from '../../../components/ui/ErrorState'
import SupportIconButton from '../../../components/ui/SupportIconButton'

export function PantryPageContent({ screen, deps }) {
  const {
    AppToast,
    PANTRY_SORT_OPTIONS,
    PantryCategorySection,
    PantryForm,
    PantryVoiceCapture,
  } = deps

  return (
    <div className="screen nutrition-screen upgraded-nutrition-screen">
      <header className="screen-header nutrition-header support-icon-anchor">
        <SupportIconButton label="Get help with pantry" onClick={screen.openPantrySupport} />
        <div>
          <p className="dashboard-eyebrow">Nutrition</p>
          <h1>Pantry by category</h1>
          <p className="settings-subtitle">Group what you have on hand by food type, then add, edit, or clean up items without digging through the full nutrition dashboard.</p>
        </div>
        <div className="header-actions nutrition-pantry-header-actions">
          <button className="btn-secondary header-action-button" onClick={screen.closePantryPage} type="button">
            <span>Back to nutrition</span>
          </button>
          <button className="btn-secondary header-action-button" onClick={() => screen.setShowPantryVoice(current => !current)} type="button">
            <span>{screen.showPantryVoice ? 'Close voice' : 'Speak list'}</span>
          </button>
          <button className="btn-secondary header-action-button" onClick={() => screen.setShowPantryForm(current => !current)} type="button">
            <AppIcon name="plus" />
            <span>{screen.showPantryForm ? 'Close add' : 'Add item'}</span>
          </button>
        </div>
      </header>

      {screen.error ? <ErrorState className="nutrition-inline-state" message={screen.error} title="Could not load pantry data" /> : null}

      <div className="nutrition-pantry-summary-grid">
        <div className="dash-card nutrition-planning-card nutrition-pantry-stat-card">
          <span className="dashboard-chip workout">Pantry items</span>
          <strong>{screen.filteredPantryItems.length}</strong>
          <p>{screen.filteredPantryItems.length === screen.pantry.length ? 'Total ingredients and staples currently on hand.' : `${screen.pantry.length} total items before filters.`}</p>
        </div>
        <div className="dash-card nutrition-planning-card nutrition-pantry-stat-card">
          <span className="dashboard-chip nutrition">Food types</span>
          <strong>{screen.filteredPantryCategories.length}</strong>
          <p>{screen.filteredPantryCategories.length === screen.pantryCategories.length ? 'Auto-grouped so you can scan proteins, produce, grains, and more.' : `${screen.pantryCategories.length} total categories available.`}</p>
        </div>
      </div>

      <div className="dash-card nutrition-planning-card nutrition-pantry-toolbar-card">
        <div className="nutrition-pantry-toolbar">
          <label className="field-label nutrition-pantry-search">
            <span>Search pantry</span>
            <ClearableInput type="search" placeholder="Search items, units, notes, or category" value={screen.pantrySearchQuery} onChange={event => screen.setPantrySearchQuery(event.target.value)} />
          </label>
          <label className="field-label nutrition-pantry-sort-field">
            <span>Sort</span>
            <select value={screen.pantrySortMode} onChange={event => screen.setPantrySortMode(event.target.value)}>
              {PANTRY_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="nutrition-pantry-filter-chips">
          <button type="button" className={`onboarding-chip${screen.pantryCategoryFilter === 'all' ? ' active' : ''}`} onClick={() => screen.setPantryCategoryFilter('all')}>
            All categories ({screen.pantry.length})
          </button>
          {screen.pantryCategoryOptions.map(option => (
            <button key={option.key} type="button" className={`onboarding-chip${screen.pantryCategoryFilter === option.key ? ' active' : ''}`} onClick={() => screen.setPantryCategoryFilter(option.key)}>
              {option.label} ({option.count})
            </button>
          ))}
        </div>
      </div>

      {screen.showPantryVoice ? (
        <div ref={screen.pantryVoiceAnchor} className="dash-card nutrition-planning-card nutrition-pantry-utility-card">
          <PantryVoiceCapture onError={screen.showErrorToast} onToast={screen.showToast} onAddItems={screen.handleBulkPantryImport} onCancel={() => screen.handleFormCancel(() => screen.setShowPantryVoice(false))} />
        </div>
      ) : null}

      {screen.showPantryForm ? (
        <div ref={screen.pantryFormAnchor} className="dash-card nutrition-planning-card nutrition-pantry-utility-card">
          <PantryForm onError={screen.showErrorToast} onSave={screen.handleCreatePantryItem} onCancel={() => screen.handleFormCancel(() => screen.setShowPantryForm(false))} />
        </div>
      ) : null}

      {screen.filteredPantryCategories.length ? (
        <div className="nutrition-pantry-category-list">
          {screen.filteredPantryCategories.map(category => (
            <PantryCategorySection
              key={category.key}
              category={category}
              collapsed={Boolean(screen.collapsedPantryCategories[category.key])}
              onToggle={() => screen.setCollapsedPantryCategories(current => ({ ...current, [category.key]: !current[category.key] }))}
              onDeleteItem={screen.handleDeletePantryItem}
              onSaveItem={(item, data) => screen.handleUpdatePantryItem(item.id, data)}
            />
          ))}
        </div>
      ) : screen.pantry.length ? (
        <EmptyState
          actions={[
            { kind: 'secondary', label: 'Clear search', onClick: () => screen.setPantrySearchQuery('') },
            { kind: 'secondary', label: 'Show all categories', onClick: () => screen.setPantryCategoryFilter('all') },
          ]}
          className="nutrition-pantry-empty-state-card"
          message="Try a broader search or reset the category filter to see everything again."
          title="No pantry items match these filters"
        />
      ) : (
        <EmptyState
          className="nutrition-pantry-empty-state-card"
          message="Add your staples and Johnny5k can suggest meals around them."
          title="Pantry on hand"
        />
      )}

      {screen.activeToast ? <AppToast toast={screen.activeToast} onDismiss={() => screen.dismissToast(screen.activeToast.id)} /> : null}
    </div>
  )
}

export function NutritionModeTabs({ screen }) {
  const tabRefs = useRef([])
  const tabs = [
    {
      key: 'today',
      label: 'Today',
      note: screen.meals.length ? `${screen.meals.length} logged` : 'Start logging',
      anchor: screen.mealsSectionAnchor,
      buttonId: 'nutrition-mode-tab-today',
      panelId: 'nutrition-view-panel-today',
    },
    {
      key: 'library',
      label: 'Library',
      note: screen.libraryItemCount ? `${screen.libraryItemCount} saved` : 'Foods and meals',
      anchor: screen.savedFoodsSectionAnchor,
      buttonId: 'nutrition-mode-tab-library',
      panelId: 'nutrition-view-panel-library',
    },
    {
      key: 'plan',
      label: 'Plan',
      note: screen.planningItemCount ? `${screen.planningItemCount} planning items` : 'Recipes and grocery gap',
      anchor: screen.planningSectionAnchor,
      buttonId: 'nutrition-mode-tab-plan',
      panelId: 'nutrition-view-panel-plan',
    },
  ]

  function focusTab(index) {
    tabRefs.current[index]?.focus()
  }

  function handleTabKeyDown(event, index) {
    const lastIndex = tabs.length - 1

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = index === lastIndex ? 0 : index + 1
      screen.changeActiveView(tabs[nextIndex].key, tabs[nextIndex].anchor)
      focusTab(nextIndex)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = index === 0 ? lastIndex : index - 1
      screen.changeActiveView(tabs[nextIndex].key, tabs[nextIndex].anchor)
      focusTab(nextIndex)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      screen.changeActiveView(tabs[0].key, tabs[0].anchor)
      focusTab(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      screen.changeActiveView(tabs[lastIndex].key, tabs[lastIndex].anchor)
      focusTab(lastIndex)
    }
  }

  return (
    <div className="nutrition-mode-tabs" role="tablist" aria-label="Nutrition sections">
      {tabs.map((tab, index) => {
        const isActive = screen.activeView === tab.key

        return (
          <button
            key={tab.key}
            ref={element => {
              tabRefs.current[index] = element
            }}
            id={tab.buttonId}
            type="button"
            role="tab"
            className={`nutrition-mode-tab${isActive ? ' active' : ''}`}
            aria-selected={isActive}
            aria-controls={tab.panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => screen.changeActiveView(tab.key, tab.anchor)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >
            {tab.label}
            <small>{tab.note}</small>
          </button>
        )
      })}
    </div>
  )
}

export function NutritionAiReviewPanels({ screen, deps }) {
  const { AiMealReviewCard, LabelReviewCard } = deps

  return (
    <>
      {screen.analyzing ? <p className="ai-thinking">Analyzing photo…</p> : null}
      {screen.aiMealDraft ? <AiMealReviewCard draft={screen.aiMealDraft} caloriesRemaining={screen.caloriesRemaining} onChange={screen.setAiMealDraft} onConfirm={screen.handleConfirmAiMeal} onCancel={() => screen.handleFormCancel(() => screen.setAiMealDraft(null))} onSaveFood={screen.handleSaveAiItemAsFood} /> : null}
      {screen.showGlobalLabelReview ? <LabelReviewCard screen={screen} showQuickLog /> : null}
    </>
  )
}

export function LabelReviewCard({ screen, showQuickLog = true }) {
  if (!screen.labelReview) {
    return null
  }

  return (
    <div className="dash-card label-review-card">
      <div className="dashboard-card-head">
        <span className="dashboard-chip nutrition">Label review</span>
        <span className="dashboard-chip subtle">Editable per serving</span>
      </div>
      <h3>{screen.labelReview.headline}</h3>
      <div className="label-review-summary-band">
        <span>{screen.labelReview.servingSize}</span>
        <span>{screen.labelReviewTotals.calories} calories at {screen.labelReviewTotals.quantity} serving{screen.labelReviewTotals.quantity === 1 ? '' : 's'}</span>
        <span>{screen.labelReview.mealType}</span>
      </div>
      <div className="label-review-form-grid">
        <label className="field-label">
          <span>Food</span>
          <input value={screen.labelReview.foodName} onChange={event => screen.handleUpdateLabelReviewField('foodName', event.target.value)} />
        </label>
        <label className="field-label">
          <span>Brand</span>
          <input value={screen.labelReview.brand} onChange={event => screen.handleUpdateLabelReviewField('brand', event.target.value)} />
        </label>
        <label className="field-label">
          <span>Serving size</span>
          <input value={screen.labelReview.servingSize} onChange={event => screen.handleUpdateLabelReviewField('servingSize', event.target.value)} />
        </label>
        <label className="field-label">
          <span>Meal type</span>
          <select value={screen.labelReview.mealType} onChange={event => screen.handleUpdateLabelReviewField('mealType', event.target.value)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>
      </div>
      <div className="macro-inputs label-review-form-grid label-review-macro-grid">
        <label className="field-label">
          <span>Calories</span>
          <input type="number" min="0" step="1" value={screen.labelReview.calories} onChange={event => screen.handleUpdateLabelReviewField('calories', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Protein (g)</span>
          <input type="number" min="0" step="0.1" value={screen.labelReview.protein} onChange={event => screen.handleUpdateLabelReviewField('protein', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Carbs (g)</span>
          <input type="number" min="0" step="0.1" value={screen.labelReview.carbs} onChange={event => screen.handleUpdateLabelReviewField('carbs', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Fat (g)</span>
          <input type="number" min="0" step="0.1" value={screen.labelReview.fat} onChange={event => screen.handleUpdateLabelReviewField('fat', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Fiber (g)</span>
          <input type="number" min="0" step="0.1" value={screen.labelReview.fiber} onChange={event => screen.handleUpdateLabelReviewField('fiber', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Sugar (g)</span>
          <input type="number" min="0" step="0.1" value={screen.labelReview.sugar} onChange={event => screen.handleUpdateLabelReviewField('sugar', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Sodium (mg)</span>
          <input type="number" min="0" step="1" value={screen.labelReview.sodium} onChange={event => screen.handleUpdateLabelReviewField('sodium', Number(event.target.value || 0))} />
        </label>
        <label className="field-label">
          <span>Quantity</span>
          <input type="number" min="0.1" step="0.1" value={screen.labelReview.quantity} onChange={event => screen.handleUpdateLabelReviewField('quantity', event.target.value)} />
        </label>
      </div>
      <div className="label-review-grid">
        <div><strong>Total calories</strong><span>{screen.labelReviewTotals.calories} for {screen.labelReviewTotals.quantity} serving{screen.labelReviewTotals.quantity === 1 ? '' : 's'}</span></div>
        <div><strong>Total protein</strong><span>{screen.labelReviewTotals.protein}g</span></div>
        <div><strong>Total carbs</strong><span>{screen.labelReviewTotals.carbs}g</span></div>
        <div><strong>Total fat</strong><span>{screen.labelReviewTotals.fat}g</span></div>
        <div><strong>Total fiber</strong><span>{screen.labelReviewTotals.fiber}g</span></div>
        <div><strong>Total sugar</strong><span>{screen.labelReviewTotals.sugar}g</span></div>
        <div><strong>Total sodium</strong><span>{screen.labelReviewTotals.sodium}mg</span></div>
        <div><strong>Scan source</strong><span>{screen.labelReview.usedWebSearch ? 'Images + web fallback' : 'Images only'}</span></div>
      </div>
      <div className="nutrition-gap-list">{screen.labelReview.flags.map(flag => <span key={flag} className="onboarding-chip active">{flag}</span>)}</div>
      <div className="nutrition-stack-list">{screen.labelReview.suggestions.map(suggestion => <div key={suggestion.title} className="nutrition-recipe-card label-suggestion-card"><strong>{suggestion.title}</strong><p>{suggestion.body}</p></div>)}</div>
      {screen.labelReview.sources?.length ? (
        <div className="label-review-sources">
          <strong>Reference links</strong>
          <div className="nutrition-gap-list">
            {screen.labelReview.sources.map(source => (
              <a key={source.url} className="onboarding-chip" href={source.url} target="_blank" rel="noreferrer">{source.label || source.url}</a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="ai-result-actions">
        <button className="btn-primary" onClick={screen.handleSaveLabelFood} disabled={Boolean(screen.labelReviewAction)}>{screen.labelReviewAction === 'save' ? 'Saving…' : 'Save to foods'}</button>
        {showQuickLog ? <button className="btn-secondary" onClick={screen.handleQuickLogLabelFood} disabled={Boolean(screen.labelReviewAction)}>{screen.labelReviewAction === 'log' ? 'Saving…' : 'Save and log'}</button> : null}
        <button className="btn-secondary" onClick={screen.handleCancelLabelReview} disabled={Boolean(screen.labelReviewAction)}>Cancel</button>
      </div>
      {screen.labelReviewAction ? <p className="settings-subtitle">Working on your label review…</p> : null}
    </div>
  )
}

function MealListLoadingSkeleton() {
  return (
    <div className="meals-list meal-list-loading" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="meal-card meal-card-skeleton">
          <div className="meal-card-skeleton-head">
            <div className="meal-card-skeleton-block meal-card-skeleton-kicker" />
            <div className="meal-card-skeleton-block meal-card-skeleton-time" />
          </div>
          <div className="meal-card-skeleton-block meal-card-skeleton-title" />
          <div className="meal-card-skeleton-block meal-card-skeleton-copy" />
          <div className="meal-card-skeleton-totals">
            {Array.from({ length: 4 }).map((__, statIndex) => (
              <div key={statIndex} className="meal-card-skeleton-total">
                <div className="meal-card-skeleton-block meal-card-skeleton-stat-label" />
                <div className="meal-card-skeleton-block meal-card-skeleton-stat-value" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TodayNutritionView({ screen, deps }) {
  const {
    AddMealForm,
    AddMealMethodPicker,
    BeverageBoard,
    CoachingSummaryPanel,
    MacroStat,
    MealCard,
    SectionClampToggle,
    buildNutritionCoachBody,
    buildNutritionCoachHeadline,
    formatMicroAmount,
    formatMicroTargetMeta,
    scrollNodeIntoView,
  } = deps

  return (
    <section ref={screen.mealsSectionAnchor} className="nutrition-section-shell nutrition-section-shell-today">
      <div className="dash-card nutrition-planning-card nutrition-today-hero">
        <div className="nutrition-today-hero-head">
          <div>
            <span className="dashboard-chip nutrition">Today&apos;s intake</span>
            <h2>Keep today tight and protein-first</h2>
            <p>{screen.meals.length ? `${screen.meals.length} meal${screen.meals.length === 1 ? '' : 's'} logged${screen.latestMealLabel ? ` · last update ${screen.latestMealLabel}` : ''}.` : 'No meals logged yet today. Start with a scan or a quick manual entry.'}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => screen.changeActiveView('plan', screen.planningSectionAnchor)}>Open planning</button>
        </div>
        {screen.proteinMacroCard ? <div className="nutrition-summary-primary"><MacroStat {...screen.proteinMacroCard} onClick={() => screen.openDrawer(screen.proteinMacroCard.prompt)} /></div> : null}
        <div className="nutrition-summary nutrition-summary-actionable nutrition-summary-secondary-grid">
          {screen.secondaryMacroCards.map(card => <MacroStat key={card.label} {...card} onClick={() => screen.openDrawer(card.prompt)} />)}
        </div>
        <div className="nutrition-today-shortcuts">
          <details className="nutrition-shortcut-card nutrition-micro-accordion" open={screen.showMicros} onToggle={event => screen.setShowMicros(event.currentTarget.open)}>
            <summary>
              <strong>{screen.showMicros ? 'Hide nutrition detail' : 'See micronutrients and fiber'}</strong>
              <span>{screen.highlightedMicros.length ? 'Nutrition breakdown ready' : 'No micronutrient or fiber data logged yet'}</span>
            </summary>
            <div className="nutrition-micro-accordion-body">
              <p>Combined from logged foods and scaled meal-template servings, with fiber and sodium pulled in from today&apos;s totals.</p>
              {screen.highlightedMicros.length ? (
                <>
                  <div className="nutrition-micro-grid">
                    {screen.highlightedMicros.map(micro => (
                      <div key={micro.key || micro.label} className="nutrition-micro-stat">
                        <strong>{micro.label}</strong>
                        <span className="nutrition-micro-value">{formatMicroAmount(micro)}</span>
                        <p>{formatMicroTargetMeta(micro)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState className="nutrition-inline-state" message="AI-filled foods, label-based foods, and saved foods with vitamin or mineral data will show up here once logged." title="No micronutrients, fiber, or sodium data logged yet today" />
              )}
            </div>
          </details>
        </div>
        {screen.coachingSummary ? (
          <TodayPanelAccordion
            open={Boolean(screen.todayAccordions?.coachingRead)}
            onToggle={() => screen.toggleTodayAccordion('coachingRead')}
            chip={<span className="dashboard-chip ai">Coaching read</span>}
            title="Coaching Read"
            description={screen.coachingSummary?.summary || 'Johnny summarizes the strongest pattern and the next move for today.'}
            meta={screen.coachingSummary?.contextLabel ? <span className="dashboard-chip subtle">{screen.coachingSummary.contextLabel}</span> : null}
          >
            <CoachingSummaryPanel
              summary={screen.coachingSummary}
              className="coaching-summary-panel-dark nutrition-today-accordion-panel"
              chipLabel="Coaching read"
              maxInsights={2}
              onAction={screen.handleCoachingAction}
              onAskJohnny={screen.openDrawer}
              askJohnnyLabel="Ask Johnny"
              analyticsContext={{ screen: 'nutrition', surface: 'nutrition_coaching_summary' }}
            />
          </TodayPanelAccordion>
        ) : null}
        <TodayPanelAccordion
          innerRef={screen.beverageBoardSectionAnchor}
          open={Boolean(screen.todayAccordions?.beverageBoard)}
          onToggle={() => screen.toggleTodayAccordion('beverageBoard')}
          chip={<span className="dashboard-chip nutrition">Beverage Board</span>}
          title="Beverage Board"
          description="Track the hidden calories, log drinks fast, and tap water as you go."
          meta={<span className="dashboard-chip subtle">Water + drinks</span>}
        >
          <BeverageBoard screen={screen} showHeader={false} showShell={false} />
        </TodayPanelAccordion>
        <div className="nutrition-coach-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Weekly calories</span><span className="dashboard-chip subtle">{screen.weeklyCaloriesReview.periodLabel || 'Last 7 days'}</span></div>
          <h3>{screen.weeklyCaloriesReview.headline}</h3>
          <p>{screen.weeklyCaloriesReview.review}</p>
          <div className="nutrition-gap-list">
            <span className="onboarding-chip active">Logged: {screen.weeklyCaloriesReview.totalCalories.toLocaleString()}</span>
            <span className="onboarding-chip">Target: {screen.weeklyCaloriesReview.targetCalories.toLocaleString()}</span>
            <span className="onboarding-chip">Days logged: {screen.weeklyCaloriesReview.loggedDays}/7</span>
          </div>
        </div>
        <div className="nutrition-coach-card">
          <div className="dashboard-card-head"><span className="dashboard-chip ai">Ask Johnny</span><span className="dashboard-chip subtle">Context-aware</span></div>
          <h3>{buildNutritionCoachHeadline(screen.summary)}</h3>
          <p>{buildNutritionCoachBody(screen.summary)}</p>
          <div className="nutrition-coach-prompt-grid">{screen.coachPrompts.map(prompt => <button key={prompt.label} type="button" className="nutrition-coach-prompt" onClick={() => screen.handleCoachingPromptOpen(prompt)}><strong>{prompt.label}</strong><span>{prompt.meta}</span></button>)}</div>
        </div>
      </div>

      <div className="dash-card nutrition-planning-card nutrition-meals-card">
        <div className="dashboard-card-head">
          <span className="dashboard-chip nutrition">Logged meals</span>
          {screen.showAddMethodPicker || screen.showAddForm ? <span className="dashboard-chip subtle">Draft open</span> : null}
        </div>
        <h3>What you logged today</h3>
        <p>Your latest meals stay at the top so edits and confirmations are easier to find.</p>
        {screen.showAddMethodPicker || screen.showAddForm ? <div ref={screen.addMealFormAnchor}>{screen.showAddMethodPicker ? <AddMealMethodPicker onSelectMethod={screen.handleAddMealMethodSelect} onCancel={screen.closeAddMealFlow} /> : <AddMealForm savedFoods={screen.savedFoods} initialEntryMode={screen.addMealInitialMode} onError={screen.showErrorToast} onToast={screen.showToast} onOpenPhoto={() => {
          screen.closeAddMealFlow()
          screen.setShowLabelScanPrompt(false)
          screen.setShowMealPhotoPrompt(true)
        }} onSave={async data => {
          const result = await screen.runAction(() => nutritionApi.logMeal(data), '', { onSuccess: async () => { screen.invalidate(); screen.closeAddMealFlow(); await screen.loadData(); scrollNodeIntoView(screen.mealsSectionAnchor.current) } })
          if (result) {
            const itemCount = data.items.length
            const merged = Boolean(result?.merged)
            const mealId = Number(result?.meal_id || 0)

            screen.showToast({
              kind: 'nutrition-meal-log',
              title: merged ? 'Meal Updated' : 'Meal Logged',
              message: merged
                ? `Added ${itemCount} food${itemCount === 1 ? '' : 's'} to ${data.meal_type}.`
                : `${data.meal_type} logged with ${itemCount} food${itemCount === 1 ? '' : 's'}.`,
              details: [
                merged ? 'Johnny merged this into the meal already logged for that slot.' : 'The meal draft is now part of today’s log.',
              ],
              tone: 'success',
              actions: [
                {
                  label: 'View',
                  tone: 'primary',
                  onClick: () => scrollNodeIntoView(screen.mealsSectionAnchor.current),
                },
                ...(!merged && mealId > 0 ? [{
                  label: 'Undo',
                  onClick: async () => {
                    const undone = await screen.runAction(() => nutritionApi.deleteMeal(mealId), '', { onSuccess: async () => { screen.invalidate(); await screen.loadData() } })
                    if (undone) {
                      screen.showToast('Logged meal removed.')
                    }
                  },
                }] : []),
              ],
            })
          }
        }} onSaveAsTemplate={async data => {
          const result = await screen.runAction(() => nutritionApi.createSavedMeal(data), '', { onSuccess: async () => { screen.closeAddMealFlow(); await screen.refreshPlanning(); scrollNodeIntoView(screen.savedMealsSectionAnchor.current) } })
          if (result) {
            screen.showToast({
              kind: 'nutrition-meal-template',
              title: 'Template Saved',
              message: `${data.name || 'Meal draft'} is now in your saved meals.`,
              tone: 'success',
              actions: [
                {
                  label: 'View library',
                  tone: 'primary',
                  onClick: () => screen.changeActiveView('library', screen.savedMealsSectionAnchor),
                },
              ],
            })
          }
        }} onCancel={() => screen.handleFormCancel(() => screen.closeAddMealFlow())} />}</div> : null}
        {screen.loadingMeals ? (
          <MealListLoadingSkeleton />
        ) : (
          <div className="meals-list" aria-busy="false">
            {screen.visibleMeals.map(meal => <MealCard key={meal.id} meal={meal} savedFoods={screen.savedFoods} onError={screen.showErrorToast} onSave={async data => {
              const mealIds = Array.isArray(meal.meal_ids) && meal.meal_ids.length ? meal.meal_ids : [meal.id]
              const primaryMealId = mealIds[0]
              const duplicateMealIds = mealIds.slice(1)
              await screen.runAction(async () => {
                if (!data.items.length) {
                  await Promise.all(mealIds.map(id => nutritionApi.deleteMeal(id)))
                  return
                }
                await nutritionApi.updateMeal(primaryMealId, { meal_datetime: data.meal_datetime, meal_type: data.meal_type, source: meal.source, items: data.items })
                if (duplicateMealIds.length) {
                  await Promise.all(duplicateMealIds.map(id => nutritionApi.deleteMeal(id)))
                }
              }, data.items.length ? 'Logged meal updated.' : 'Logged meal deleted.', { onSuccess: async () => { screen.invalidate(); await screen.loadData() } })
            }} onDelete={async () => {
              const mealIds = Array.isArray(meal.meal_ids) && meal.meal_ids.length ? meal.meal_ids : [meal.id]
              await screen.runAction(() => Promise.all(mealIds.map(id => nutritionApi.deleteMeal(id))), 'Logged meal deleted.', { onSuccess: async () => { screen.invalidate(); await screen.loadData() } })
            }} />)}
            {!screen.mergedMeals.length && !screen.showAddMethodPicker && !screen.showAddForm ? <EmptyState className="nutrition-inline-state" message="Scan one or add one manually." title="No meals logged yet today" /> : null}
          </div>
        )}
        <SectionClampToggle count={screen.meals.length} expanded={screen.expandedSections.meals} limit={4} label="meals" onToggle={() => screen.toggleSection('meals')} />
      </div>
    </section>
  )
}

function TodayPanelAccordion({ innerRef = null, open, onToggle, chip, title, description, meta = null, children }) {
  return (
    <section ref={innerRef} className={`nutrition-coach-card nutrition-today-accordion${open ? ' open' : ''}`}>
      <button type="button" className="nutrition-today-accordion-trigger" onClick={onToggle} aria-expanded={open}>
        <div className="nutrition-today-accordion-copy">
          <div className="nutrition-today-accordion-kicker">
            {chip}
            {meta}
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="nutrition-today-accordion-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="nutrition-today-accordion-body">{children}</div> : null}
    </section>
  )
}

export function LibraryNutritionView({ screen, deps }) {
  const {
    LabelReviewCard,
    LabelScanPromptPanel,
    RecentFoodRow,
    SavedFoodForm,
    SavedFoodRow,
    SavedMealForm,
    SavedMealRow,
    SectionClampToggle,
    scrollNodeIntoView,
  } = deps

  return (
    <section className="nutrition-section-shell nutrition-section-shell-library">
      <div className="dash-card nutrition-planning-card nutrition-section-intro-card"><span className="dashboard-chip nutrition">Library</span><h2>Reusable foods and meals</h2><p>Build the repeatable pieces here so daily logging stays quick and planning doesn&apos;t start from zero.</p></div>
      <section className="dashboard-section dashboard-two-col nutrition-planning-grid">
        <div ref={screen.recentFoodsSectionAnchor} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Recent foods</span><span className="dashboard-chip subtle">Latest logged versions</span></div>
          <h3>Your recent logging shortcuts</h3>
          <p>Johnny5k keeps one version per recent food and uses the latest version you actually logged when duplicates exist.</p>
          {screen.recentFoods.length ? <div className="nutrition-gap-bulk-bar recent-food-bulk-bar"><button type="button" className="btn-ghost small" onClick={screen.handleCheckAllRecentFoods} disabled={screen.allRecentFoodsChecked}>Check all</button><button type="button" className="btn-ghost small" onClick={screen.handleClearCheckedRecentFoods} disabled={!screen.checkedRecentFoodIdSet.size}>Clear checks</button><button type="button" className="btn-ghost small" onClick={screen.handleDeleteCheckedRecentFoods} disabled={!screen.checkedRecentFoodIdSet.size}>Delete checked{screen.checkedRecentFoodIdSet.size ? ` (${screen.checkedRecentFoodIdSet.size})` : ''}</button></div> : null}
          <div className="nutrition-stack-list">{screen.visibleRecentFoods.map(food => <RecentFoodRow key={food.id} food={food} checked={screen.checkedRecentFoodIdSet.has(food.id)} onToggleChecked={() => screen.toggleRecentFoodChecked(food.id)} onError={screen.showErrorToast} onSave={async data => screen.runAction(() => nutritionApi.updateRecentFood(food.id, data), 'Recent food updated.', { onSuccess: async () => { screen.invalidate(); await screen.loadData() } })} onDelete={async () => screen.runAction(() => nutritionApi.deleteRecentFood(food.id), 'Recent food removed from the list.', { onSuccess: async () => { screen.invalidate(); await screen.loadData() } })} />)}{!screen.recentFoods.length ? <EmptyState className="nutrition-inline-state" message="Recent foods appear here after you log a few meals." title="No recent foods yet" /> : null}</div>
          <SectionClampToggle count={screen.recentFoods.length} expanded={screen.expandedSections.recentFoods} limit={4} label="recent foods" onToggle={() => screen.toggleSection('recentFoods')} />
        </div>

        <div ref={screen.savedFoodsSectionAnchor} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Saved foods</span><div className="nutrition-row-actions"><button className="btn-secondary small" onClick={() => screen.openSavedFoodsLabelScanPrompt()}>Scan label</button><button className="btn-secondary small" onClick={() => screen.setShowSavedFoodForm(current => !current)}>New</button></div></div>
          <h3>First-class food library</h3>
          <p>Use this for repeat items from labels, snacks, or common proteins without rebuilding a whole meal.</p>
          {screen.showSavedFoodsLabelScanPrompt ? <div ref={screen.labelScanPromptAnchor}><LabelScanPromptPanel anchorRef={null} busy={screen.analyzing} images={screen.labelScanImages} note={screen.labelScanNote} onChangeNote={screen.setLabelScanNote} onPickFront={screen.pickLabelScanFront} onPickBack={screen.pickLabelScanBack} onSubmit={() => { void screen.handleSubmitLabelScan() }} onCancel={screen.handleSavedFoodsLabelScanCancel} /></div> : null}
          {screen.showSavedFoodsLabelReview ? <LabelReviewCard screen={screen} showQuickLog={false} /> : null}
          <div className="nutrition-stack-list">{screen.visibleSavedFoods.map(food => <SavedFoodRow key={food.id} food={food} onError={screen.showErrorToast} onLog={screen.handleLogSavedFood} onSave={async data => screen.runAction(() => nutritionApi.updateSavedFood(food.id, data), 'Saved food updated.', { onSuccess: screen.refreshPlanning })} onDelete={async () => screen.runAction(() => nutritionApi.deleteSavedFood(food.id), 'Saved food deleted.', { onSuccess: screen.refreshPlanning })} />)}{!screen.savedFoods.length ? <EmptyState className="nutrition-inline-state" message="Save one from a label review or meal scan." title="No saved foods yet" /> : null}</div>
          <SectionClampToggle count={screen.savedFoods.length} expanded={screen.expandedSections.savedFoods} limit={4} label="foods" onToggle={() => screen.toggleSection('savedFoods')} />
          {screen.showSavedFoodForm ? <div ref={screen.savedFoodFormAnchor}><SavedFoodForm savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onLogExisting={async foodId => { await screen.handleLogSavedFood(foodId); screen.setShowSavedFoodForm(false) }} onSave={async data => screen.runAction(() => nutritionApi.createSavedFood(data), 'Saved food added.', { onSuccess: async () => { screen.setShowSavedFoodForm(false); await screen.refreshPlanning(); scrollNodeIntoView(screen.savedFoodsSectionAnchor.current) } })} onCancel={() => screen.handleFormCancel(() => screen.setShowSavedFoodForm(false))} onToast={screen.showToast} /></div> : null}
        </div>

        <div ref={screen.savedMealsSectionAnchor} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Saved meals</span><button className="btn-secondary small" onClick={() => screen.setShowSavedMealForm(current => !current)}>New</button></div>
          <h3>Reusable defaults</h3>
          <p>Keep a few reliable meals ready so logging takes seconds.</p>
          <div className="nutrition-stack-list">{screen.visibleSavedMeals.map(meal => <SavedMealRow key={meal.id} meal={meal} savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onLog={screen.handleLogSavedMeal} onSave={async data => screen.runAction(() => nutritionApi.updateSavedMeal(meal.id, data), 'Saved meal updated.', { onSuccess: screen.refreshPlanning })} onDelete={async () => screen.runAction(() => nutritionApi.deleteSavedMeal(meal.id), 'Saved meal deleted.', { onSuccess: screen.refreshPlanning })} />)}{!screen.savedMeals.length ? <EmptyState className="nutrition-inline-state" message="Build one from your most common breakfast or lunch." title="No saved meals yet" /> : null}</div>
          <SectionClampToggle count={screen.savedMeals.length} expanded={screen.expandedSections.savedMeals} limit={4} label="saved meals" onToggle={() => screen.toggleSection('savedMeals')} />
          {screen.showSavedMealForm ? <div ref={screen.savedMealFormAnchor}><SavedMealForm initialValues={screen.location.state?.savedMealDraft || null} savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onToast={screen.showToast} onSave={async data => screen.runAction(() => nutritionApi.createSavedMeal(data), 'Saved meal created.', { onSuccess: async () => { screen.setShowSavedMealForm(false); await screen.refreshPlanning(); scrollNodeIntoView(screen.savedMealsSectionAnchor.current) } })} onCancel={() => screen.handleFormCancel(() => screen.setShowSavedMealForm(false))} /></div> : null}
        </div>
      </section>
    </section>
  )
}

export function PlanningNutritionView({ screen, deps }) {
  const {
    formatGroceryGapAmount,
    formatMealTypeLabel,
    getRecipeKey,
    GroceryGapForm,
    GroceryGapVoiceCapture,
    MEAL_TYPES,
    PlanningAccordionCard,
    PantryDisplayRow,
    RecipeIdeaCard,
    RECIPE_CARD_VISIBLE_LIMIT,
    SectionClampToggle,
  } = deps

  return (
    <section ref={screen.planningSectionAnchor} className="nutrition-section-shell nutrition-section-shell-plan">
      <div className="dash-card nutrition-planning-card nutrition-section-intro-card nutrition-section-intro-plan"><span className="dashboard-chip awards">Plan</span><h2>Recipes, pantry, and shopping</h2><p>Use this after logging to decide what to cook next, what you already have, and what still needs to be picked up.</p></div>
      <section className="dashboard-section dashboard-two-col nutrition-planning-grid"><PlanningAccordionCard innerRef={screen.pantrySectionAnchor} open={screen.planningAccordions.pantry} onToggle={() => screen.togglePlanningAccordion('pantry')} chip={<span className="dashboard-chip workout">Pantry</span>} title="Pantry on hand" description="Use what you already have before creating shopping friction. You can remove pantry items here fast, or open the pantry page for editing and category cleanup." meta={<span className="dashboard-chip subtle">{screen.pantry.length ? `${screen.pantry.length} items` : 'No items yet'}</span>} actions={<button className="btn-secondary small" onClick={screen.openPantryPage}>Open pantry</button>}><div className="nutrition-pantry-preview-list">{screen.pantry.map(item => <PantryDisplayRow key={item.id} item={item} actionLabel="Remove" onAction={() => screen.handleDeletePantryItem(item)} />)}{!screen.pantry.length ? <EmptyState className="nutrition-inline-state" message="Add your staples and Johnny5k can suggest meals around them." title="No pantry items yet" /> : null}</div>{screen.pantry.length ? <p className="nutrition-list-note">Grouped into {screen.pantryCategories.length} food type {screen.pantryCategories.length === 1 ? 'category' : 'categories'} so planning stays readable on mobile.</p> : null}</PlanningAccordionCard></section>
      <section ref={screen.groceryGapSectionAnchor} className="dashboard-section dashboard-two-col nutrition-planning-grid"><PlanningAccordionCard open={screen.planningAccordions.groceryGap} onToggle={() => screen.togglePlanningAccordion('groceryGap')} chip={<span className="dashboard-chip awards">Grocery gap</span>} title="Missing staples" description="Check items off as you grab them at the store. Your checklist stays put after a refresh, and checked items drop to the bottom until you add them into pantry." meta={<span className="dashboard-chip subtle">{screen.displayedGroceryGap.recipe_items.length ? `${screen.displayedGroceryGap.recipe_items.length} recipe-driven` : 'Planning'}</span>}><div className="nutrition-gap-toolbar"><button className="btn-secondary small" onClick={() => screen.setShowGroceryGapVoice(current => !current)}>{screen.showGroceryGapVoice ? 'Close voice' : 'Speak list'}</button><button className="btn-secondary small" onClick={() => screen.setShowGroceryGapForm(current => !current)}>{screen.showGroceryGapForm ? 'Close add' : 'Add item'}</button></div>{screen.displayedGroceryGap.missing_items.length ? <div className="nutrition-gap-bulk-bar"><button type="button" className="btn-ghost small" onClick={screen.handleSelectAllGapItems} disabled={screen.allGapItemsChecked}>Check all</button><button type="button" className="btn-ghost small" onClick={screen.handleClearCheckedGapItems} disabled={!screen.checkedGapItems.length}>Clear checks</button><button type="button" className="btn-ghost small" onClick={screen.handleDeleteCheckedGapItems} disabled={!screen.checkedGapItems.length}>Delete checked{screen.checkedGapItems.length ? ` (${screen.checkedGapItems.length})` : ''}</button><button type="button" className="btn-primary small" onClick={screen.handleMoveGapToPantry} disabled={screen.syncingGapToPantry || !screen.checkedGapItems.length}>{screen.syncingGapToPantry ? 'Updating…' : `Add checked to pantry${screen.checkedGapItems.length ? ` (${screen.checkedGapItems.length})` : ''}`}</button></div> : null}{screen.showGroceryGapVoice ? <div ref={screen.groceryGapVoiceAnchor}><GroceryGapVoiceCapture onError={screen.showErrorToast} onToast={screen.showToast} onAddItems={screen.handleBulkGroceryGapImport} onCancel={() => screen.handleFormCancel(() => screen.setShowGroceryGapVoice(false))} /></div> : null}{screen.showGroceryGapForm ? <div ref={screen.groceryGapFormAnchor}><GroceryGapForm onError={screen.showErrorToast} onSave={screen.handleCreateGroceryGapItem} onCancel={() => screen.handleFormCancel(() => screen.setShowGroceryGapForm(false))} /></div> : null}<div className="nutrition-gap-list nutrition-gap-checklist">{screen.visibleGapItems.map(item => { const checked = screen.checkedGapItemSet.has(item.key); return <div key={item.key} className={`nutrition-gap-check-item${checked ? ' checked' : ''}`}><label className="nutrition-gap-check-main"><input type="checkbox" checked={checked} onChange={() => screen.toggleGapItemChecked(item.key)} /><span className="nutrition-gap-check-copy"><strong>{item.item_name}</strong>{item.quantity != null || item.unit || item.notes ? <span className="nutrition-gap-check-meta">{item.quantity != null || item.unit ? <span className="nutrition-gap-check-badge">{formatGroceryGapAmount(item.quantity, item.unit)}</span> : null}{item.notes ? <span className="nutrition-gap-check-note">{item.notes}</span> : null}</span> : null}</span></label><button type="button" className="btn-ghost small nutrition-gap-delete" onClick={() => screen.handleDeleteGroceryGapItem(item)}>Remove</button></div> })}{!screen.displayedGroceryGap.missing_items.length ? <EmptyState className="nutrition-inline-state" message="You have the main staples covered right now." title="Nothing missing" /> : null}</div>{screen.displayedGroceryGap.recipe_items.length ? <div className="nutrition-stack-list nutrition-gap-detail-list">{screen.displayedGroceryGap.recipe_items.map(entry => <div key={`${entry.item}-${entry.recipes.join('|')}`} className="nutrition-item-row nutrition-gap-detail-row"><div><strong>{entry.item}</strong><p>Needed for {entry.recipes.join(', ')}</p></div></div>)}</div> : null}<SectionClampToggle count={screen.displayedGroceryGap.missing_items.length} expanded={screen.expandedSections.groceryGap} limit={10} label="items" onToggle={() => screen.toggleSection('groceryGap')} /></PlanningAccordionCard></section>
      <section className="dashboard-section nutrition-planning-grid">
        <PlanningAccordionCard
          innerRef={screen.recipesSectionAnchor}
          open={screen.planningAccordions.recipes}
          onToggle={() => screen.togglePlanningAccordion('recipes')}
          chip={<span className="dashboard-chip coach">Recipe ideas</span>}
          title="What you can make next"
          description="Select recipes to feed the grocery gap above. Use My cook book to focus only on the recipes you already picked."
          meta={<span className="dashboard-chip subtle">{screen.selectedRecipeKeys.length} selected</span>}
          actions={
            <>
              {screen.selectedRecipeKeys.length ? <button type="button" className="btn-ghost small" onClick={screen.handleClearSelectedRecipes}>Clear</button> : null}
              <button className="btn-secondary small" onClick={async () => { const refreshed = await screen.refreshPlanning({ recipeRefreshToken: String(Date.now()) }); if (refreshed) { screen.showToast('Recipe ideas refreshed.') } }} disabled={screen.loadingExtras}>{screen.loadingExtras ? 'Refreshing…' : 'Refresh'}</button>
            </>
          }
        >
          <details className="nutrition-filter-accordion" open={screen.recipeFiltersOpen} onToggle={event => screen.setRecipeFiltersOpen(event.currentTarget.open)}>
            <summary>
              <span>Search and filters</span>
              <span className="nutrition-filter-accordion-meta">
                {screen.recipeSearchQuery
                  ? `Search: ${screen.recipeSearchQuery}`
                  : `${screen.recipeCollectionFilter === 'cookbook' ? 'My cook book' : 'All recipes'} · ${screen.recipeMealFilter === 'all' ? 'All meals' : formatMealTypeLabel(screen.recipeMealFilter)} · ${screen.recipeDietaryFilter === 'all' ? 'All tags' : (screen.recipeDietaryFilterOptions.find(option => option.value === screen.recipeDietaryFilter)?.label || screen.recipeDietaryFilter)}`}
              </span>
            </summary>
            <div className="nutrition-filter-accordion-body">
              <label className="field-label nutrition-pantry-search">
                <span>Search recipes</span>
                <ClearableInput type="search" placeholder="Search by recipe, ingredient, or tag" value={screen.recipeSearchQuery} onChange={event => screen.setRecipeSearchQuery(event.target.value)} />
              </label>
              <div className="nutrition-gap-list nutrition-quick-picks">
                <button type="button" className={`onboarding-chip${screen.recipeCollectionFilter === 'all' ? ' active' : ''}`} onClick={() => screen.setRecipeCollectionFilter('all')}>All recipes</button>
                <button type="button" className={`onboarding-chip${screen.recipeCollectionFilter === 'cookbook' ? ' active' : ''}`} onClick={() => screen.setRecipeCollectionFilter('cookbook')}>My cook book ({screen.selectedRecipeKeys.length})</button>
              </div>
              <div className="nutrition-gap-list nutrition-quick-picks">
                <button type="button" className={`onboarding-chip${screen.recipeMealFilter === 'all' ? ' active' : ''}`} onClick={() => screen.setRecipeMealFilter('all')}>All ({screen.recipes.length})</button>
                {MEAL_TYPES.map(mealType => {
                  const count = screen.recipes.filter(recipe => recipe?.meal_type === mealType).length
                  return <button key={mealType} type="button" className={`onboarding-chip${screen.recipeMealFilter === mealType ? ' active' : ''}`} onClick={() => screen.setRecipeMealFilter(mealType)}>{formatMealTypeLabel(mealType)} ({count})</button>
                })}
              </div>
              <div className="nutrition-gap-list nutrition-quick-picks">
                {screen.recipeDietaryFilterOptions.map(option => {
                  const count = option.value === 'all'
                    ? screen.recipes.length
                    : screen.recipes.filter(recipe => (Array.isArray(recipe?.dietary_tags) ? recipe.dietary_tags : []).includes(option.value)).length
                  return <button key={option.value} type="button" className={`onboarding-chip${screen.recipeDietaryFilter === option.value ? ' active' : ''}`} onClick={() => screen.setRecipeDietaryFilter(option.value)}>{option.label} ({count})</button>
                })}
              </div>
              {(screen.recipeSearchQuery || screen.recipeMealFilter !== 'all' || screen.recipeCollectionFilter !== 'all' || screen.recipeDietaryFilter !== 'all') ? (
                <div className="nutrition-card-actions">
                  {screen.recipeSearchQuery ? <button type="button" className="btn-secondary small" onClick={() => screen.setRecipeSearchQuery('')}>Clear search</button> : null}
                  <button type="button" className="btn-ghost small" onClick={() => { screen.setRecipeMealFilter('all'); screen.setRecipeCollectionFilter('all'); screen.setRecipeDietaryFilter('all') }}>Reset filters</button>
                </div>
              ) : null}
            </div>
          </details>
          <div className="nutrition-stack-list">
            {screen.visibleRecipes.map(recipe => <RecipeIdeaCard key={getRecipeKey(recipe)} recipe={recipe} selected={screen.selectedRecipeKeys.includes(getRecipeKey(recipe))} onToggle={() => screen.toggleRecipeSelection(recipe)} />)}
            {!screen.recipes.length ? <EmptyState className="nutrition-inline-state" message="Add pantry items or refresh recipe ideas." title="No suggestions yet" /> : null}
            {screen.recipeCollectionFilter === 'cookbook' && !screen.selectedRecipeKeys.length ? <EmptyState className="nutrition-inline-state" message="Choose a few recipes first, then use My cook book to narrow the list." title="No cookbook picks yet" /> : null}
            {screen.recipes.length > 0 && screen.filteredRecipes.length === 0 && !(screen.recipeCollectionFilter === 'cookbook' && !screen.selectedRecipeKeys.length) ? <EmptyState className="nutrition-inline-state" message={`No ${formatMealTypeLabel(screen.recipeMealFilter).toLowerCase()} ideas match this search and filter state right now. Clear a tag filter, broaden the search, or refresh and try again.`} title="No recipe matches" /> : null}
          </div>
          <SectionClampToggle count={screen.filteredRecipes.length} expanded={screen.expandedSections.recipes} limit={RECIPE_CARD_VISIBLE_LIMIT} label="recipes" onToggle={() => screen.toggleSection('recipes')} />
          {screen.filteredRecipes.length > RECIPE_CARD_VISIBLE_LIMIT ? <p className="nutrition-list-note">Showing 5 of {screen.filteredRecipes.length} recipe ideas on the dashboard.</p> : null}
        </PlanningAccordionCard>
      </section>
    </section>
  )
}
