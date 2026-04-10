/* eslint-disable react-hooks/refs */

import { nutritionApi } from '../../../api/modules/nutrition'
import AppIcon from '../../../components/ui/AppIcon'

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
      <header className="screen-header nutrition-header">
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

      {screen.error ? <p className="error">{screen.error}</p> : null}

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
            <input type="search" placeholder="Search items, units, notes, or category" value={screen.pantrySearchQuery} onChange={event => screen.setPantrySearchQuery(event.target.value)} />
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
          <PantryVoiceCapture onError={screen.showErrorToast} onToast={screen.showToast} onAddItems={screen.handleBulkPantryImport} onCancel={() => screen.setShowPantryVoice(false)} />
        </div>
      ) : null}

      {screen.showPantryForm ? (
        <div ref={screen.pantryFormAnchor} className="dash-card nutrition-planning-card nutrition-pantry-utility-card">
          <PantryForm onError={screen.showErrorToast} onSave={screen.handleCreatePantryItem} onCancel={() => screen.setShowPantryForm(false)} />
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
        <div className="dash-card nutrition-planning-card nutrition-pantry-empty-state-card">
          <h3>No pantry items match these filters</h3>
          <p className="empty-state">Try a broader search or reset the category filter to see everything again.</p>
          <div className="nutrition-card-actions">
            <button type="button" className="btn-secondary small" onClick={() => screen.setPantrySearchQuery('')}>Clear search</button>
            <button type="button" className="btn-secondary small" onClick={() => screen.setPantryCategoryFilter('all')}>Show all categories</button>
          </div>
        </div>
      ) : (
        <div className="dash-card nutrition-planning-card">
          <h3>Pantry on hand</h3>
          <p className="empty-state">No pantry items yet. Add your staples and Johnny5k can suggest meals around them.</p>
        </div>
      )}

      {screen.activeToast ? <AppToast toast={screen.activeToast} onDismiss={() => screen.dismissToast(screen.activeToast.id)} /> : null}
    </div>
  )
}

export function NutritionModeTabs({ screen }) {
  return (
    <div className="nutrition-mode-tabs" role="tablist" aria-label="Nutrition sections">
      <button type="button" className={`nutrition-mode-tab${screen.activeView === 'today' ? ' active' : ''}`} onClick={() => screen.changeActiveView('today', screen.mealsSectionAnchor)}>
        Today
        <small>{screen.meals.length ? `${screen.meals.length} logged` : 'Start logging'}</small>
      </button>
      <button type="button" className={`nutrition-mode-tab${screen.activeView === 'library' ? ' active' : ''}`} onClick={() => screen.changeActiveView('library', screen.savedFoodsSectionAnchor)}>
        Library
        <small>{screen.libraryItemCount ? `${screen.libraryItemCount} saved` : 'Foods and meals'}</small>
      </button>
      <button type="button" className={`nutrition-mode-tab${screen.activeView === 'plan' ? ' active' : ''}`} onClick={() => screen.changeActiveView('plan', screen.planningSectionAnchor)}>
        Plan
        <small>{screen.planningItemCount ? `${screen.planningItemCount} planning items` : 'Recipes and grocery gap'}</small>
      </button>
    </div>
  )
}

export function NutritionAiReviewPanels({ screen, deps }) {
  const { AiMealReviewCard } = deps

  return (
    <>
      {screen.analyzing ? <p className="ai-thinking">Analyzing photo…</p> : null}
      {screen.aiMealDraft ? <AiMealReviewCard draft={screen.aiMealDraft} caloriesRemaining={screen.caloriesRemaining} onChange={screen.setAiMealDraft} onConfirm={screen.handleConfirmAiMeal} onCancel={() => screen.setAiMealDraft(null)} onSaveFood={screen.handleSaveAiItemAsFood} /> : null}
      {screen.labelReview ? (
        <div className="dash-card label-review-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip nutrition">Label review</span>
            <span className="dashboard-chip subtle">Per serving</span>
          </div>
          <h3>{screen.labelReview.headline}</h3>
          <div className="label-review-grid">
            <div><strong>Food</strong><span>{screen.labelReview.foodName}</span></div>
            <div><strong>Brand</strong><span>{screen.labelReview.brand || '—'}</span></div>
            <div><strong>Serving</strong><span>{screen.labelReview.servingSize}</span></div>
            <div><strong>Calories</strong><span>{screen.labelReview.calories}</span></div>
            <div><strong>Protein</strong><span>{screen.labelReview.protein}g</span></div>
            <div><strong>Carbs</strong><span>{screen.labelReview.carbs}g</span></div>
            <div><strong>Fat</strong><span>{screen.labelReview.fat}g</span></div>
            <div><strong>Sodium</strong><span>{screen.labelReview.sodium}mg</span></div>
          </div>
          <div className="nutrition-gap-list">{screen.labelReview.flags.map(flag => <span key={flag} className="onboarding-chip active">{flag}</span>)}</div>
          <div className="nutrition-stack-list">{screen.labelReview.suggestions.map(suggestion => <div key={suggestion.title} className="nutrition-recipe-card label-suggestion-card"><strong>{suggestion.title}</strong><p>{suggestion.body}</p></div>)}</div>
          <div className="ai-result-actions">
            <button className="btn-primary" onClick={screen.handleSaveLabelFood} disabled={Boolean(screen.labelReviewAction)}>{screen.labelReviewAction === 'save' ? 'Saving…' : 'Save to foods'}</button>
            <button className="btn-secondary" onClick={screen.handleQuickLogLabelFood} disabled={Boolean(screen.labelReviewAction)}>{screen.labelReviewAction === 'log' ? 'Saving…' : 'Save and log'}</button>
            <button className="btn-secondary" onClick={() => screen.setLabelReview(null)} disabled={Boolean(screen.labelReviewAction)}>Close review</button>
          </div>
          {screen.labelReviewAction ? <p className="empty-state">Working on your label review…</p> : null}
        </div>
      ) : null}
    </>
  )
}

export function TodayNutritionView({ screen, deps }) {
  const {
    AddMealForm,
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
              <strong>{screen.showMicros ? 'Hide micros' : 'See micronutrients'}</strong>
              <span>{screen.highlightedMicros.length ? 'Micronutrient breakdown ready' : 'No micronutrient data logged yet'}</span>
            </summary>
            <div className="nutrition-micro-accordion-body">
              <p>Combined from logged foods and scaled meal-template servings.</p>
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
                <p className="empty-state">No micronutrients logged yet today. AI-filled foods, label-based foods, and saved foods with vitamin or mineral data will show up here once logged.</p>
              )}
            </div>
          </details>
        </div>
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
          <div className="nutrition-coach-prompt-grid">{screen.coachPrompts.map(prompt => <button key={prompt.label} type="button" className="nutrition-coach-prompt" onClick={() => screen.openDrawer(prompt.prompt)}><strong>{prompt.label}</strong><span>{prompt.meta}</span></button>)}</div>
        </div>
      </div>

      <div className="dash-card nutrition-planning-card nutrition-meals-card">
        <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Logged meals</span><button className="btn-secondary small" onClick={() => screen.setShowAddForm(current => !current)}>{screen.showAddForm ? 'Close' : 'Add meal'}</button></div>
        <h3>What you logged today</h3>
        <p>Your latest meals stay at the top so edits and confirmations are easier to find.</p>
        {screen.showAddForm ? <div ref={screen.addMealFormAnchor}><AddMealForm savedFoods={screen.savedFoods} onError={screen.showErrorToast} onToast={screen.showToast} onSave={async data => {
          await screen.runAction(() => nutritionApi.logMeal(data), 'Meal logged.', { onSuccess: async () => { screen.invalidate(); screen.setShowAddForm(false); await screen.loadData(); scrollNodeIntoView(screen.mealsSectionAnchor.current) } })
        }} onSaveAsTemplate={async data => {
          await screen.runAction(() => nutritionApi.createSavedMeal(data), 'Saved meal created.', { onSuccess: async () => { screen.setShowAddForm(false); await screen.refreshPlanning(); scrollNodeIntoView(screen.mealsSectionAnchor.current) } })
        }} onCancel={() => screen.setShowAddForm(false)} /></div> : null}
        <div className="meals-list">{screen.visibleMeals.map(meal => <MealCard key={meal.id} meal={meal} savedFoods={screen.savedFoods} onError={screen.showErrorToast} onSave={async data => {
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
        }} />)}{!screen.mergedMeals.length && !screen.showAddForm ? <p className="empty-state">No meals logged yet today. Scan one or add one manually.</p> : null}</div>
        <SectionClampToggle count={screen.meals.length} expanded={screen.expandedSections.meals} limit={4} label="meals" onToggle={() => screen.toggleSection('meals')} />
      </div>
    </section>
  )
}

export function LibraryNutritionView({ screen, deps }) {
  const {
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
        <div ref={screen.savedFoodsSectionAnchor} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Saved foods</span><button className="btn-secondary small" onClick={() => screen.setShowSavedFoodForm(current => !current)}>New</button></div>
          <h3>First-class food library</h3>
          <p>Use this for repeat items from labels, snacks, or common proteins without rebuilding a whole meal.</p>
          <div className="nutrition-stack-list">{screen.visibleSavedFoods.map(food => <SavedFoodRow key={food.id} food={food} onError={screen.showErrorToast} onLog={screen.handleLogSavedFood} onSave={async data => screen.runAction(() => nutritionApi.updateSavedFood(food.id, data), 'Saved food updated.', { onSuccess: screen.refreshPlanning })} onDelete={async () => screen.runAction(() => nutritionApi.deleteSavedFood(food.id), 'Saved food deleted.', { onSuccess: screen.refreshPlanning })} />)}{!screen.savedFoods.length ? <p className="empty-state">No saved foods yet. Save one from a label review or meal scan.</p> : null}</div>
          <SectionClampToggle count={screen.savedFoods.length} expanded={screen.expandedSections.savedFoods} limit={4} label="foods" onToggle={() => screen.toggleSection('savedFoods')} />
          {screen.showSavedFoodForm ? <div ref={screen.savedFoodFormAnchor}><SavedFoodForm savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onLogExisting={async foodId => { await screen.handleLogSavedFood(foodId); screen.setShowSavedFoodForm(false) }} onSave={async data => screen.runAction(() => nutritionApi.createSavedFood(data), 'Saved food added.', { onSuccess: async () => { screen.setShowSavedFoodForm(false); await screen.refreshPlanning(); scrollNodeIntoView(screen.savedFoodsSectionAnchor.current) } })} onCancel={() => screen.setShowSavedFoodForm(false)} onToast={screen.showToast} /></div> : null}
        </div>

        <div ref={screen.savedMealsSectionAnchor} className="dash-card nutrition-planning-card">
          <div className="dashboard-card-head"><span className="dashboard-chip nutrition">Saved meals</span><button className="btn-secondary small" onClick={() => screen.setShowSavedMealForm(current => !current)}>New</button></div>
          <h3>Reusable defaults</h3>
          <p>Keep a few reliable meals ready so logging takes seconds.</p>
          <div className="nutrition-stack-list">{screen.visibleSavedMeals.map(meal => <SavedMealRow key={meal.id} meal={meal} savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onLog={screen.handleLogSavedMeal} onSave={async data => screen.runAction(() => nutritionApi.updateSavedMeal(meal.id, data), 'Saved meal updated.', { onSuccess: screen.refreshPlanning })} onDelete={async () => screen.runAction(() => nutritionApi.deleteSavedMeal(meal.id), 'Saved meal deleted.', { onSuccess: screen.refreshPlanning })} />)}{!screen.savedMeals.length ? <p className="empty-state">No saved meals yet. Build one from your most common breakfast or lunch.</p> : null}</div>
          <SectionClampToggle count={screen.savedMeals.length} expanded={screen.expandedSections.savedMeals} limit={4} label="saved meals" onToggle={() => screen.toggleSection('savedMeals')} />
          {screen.showSavedMealForm ? <div ref={screen.savedMealFormAnchor}><SavedMealForm initialValues={screen.location.state?.savedMealDraft || null} savedFoods={screen.orderedSavedFoods} onError={screen.showErrorToast} onToast={screen.showToast} onSave={async data => screen.runAction(() => nutritionApi.createSavedMeal(data), 'Saved meal created.', { onSuccess: async () => { screen.setShowSavedMealForm(false); await screen.refreshPlanning(); scrollNodeIntoView(screen.savedMealsSectionAnchor.current) } })} onCancel={() => screen.setShowSavedMealForm(false)} /></div> : null}
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
      <section className="dashboard-section dashboard-two-col nutrition-planning-grid"><PlanningAccordionCard innerRef={screen.pantrySectionAnchor} open={screen.planningAccordions.pantry} onToggle={() => screen.togglePlanningAccordion('pantry')} chip={<span className="dashboard-chip workout">Pantry</span>} title="Pantry on hand" description="Use what you already have before creating shopping friction. You can remove pantry items here fast, or open the pantry page for editing and category cleanup." meta={<span className="dashboard-chip subtle">{screen.pantry.length ? `${screen.pantry.length} items` : 'No items yet'}</span>} actions={<button className="btn-secondary small" onClick={screen.openPantryPage}>Open pantry</button>}><div className="nutrition-pantry-preview-list">{screen.pantry.map(item => <PantryDisplayRow key={item.id} item={item} actionLabel="Remove" onAction={() => screen.handleDeletePantryItem(item)} />)}{!screen.pantry.length ? <p className="empty-state">No pantry items yet. Add your staples and Johnny5k can suggest meals around them.</p> : null}</div>{screen.pantry.length ? <p className="nutrition-list-note">Grouped into {screen.pantryCategories.length} food type {screen.pantryCategories.length === 1 ? 'category' : 'categories'} so planning stays readable on mobile.</p> : null}</PlanningAccordionCard></section>
      <section ref={screen.groceryGapSectionAnchor} className="dashboard-section dashboard-two-col nutrition-planning-grid"><PlanningAccordionCard open={screen.planningAccordions.groceryGap} onToggle={() => screen.togglePlanningAccordion('groceryGap')} chip={<span className="dashboard-chip awards">Grocery gap</span>} title="Missing staples" description="Check items off as you grab them at the store. Your checklist stays put after a refresh, and checked items drop to the bottom until you add them into pantry." meta={<span className="dashboard-chip subtle">{screen.displayedGroceryGap.recipe_items.length ? `${screen.displayedGroceryGap.recipe_items.length} recipe-driven` : 'Planning'}</span>}><div className="nutrition-gap-toolbar"><button className="btn-secondary small" onClick={() => screen.setShowGroceryGapVoice(current => !current)}>{screen.showGroceryGapVoice ? 'Close voice' : 'Speak list'}</button><button className="btn-secondary small" onClick={() => screen.setShowGroceryGapForm(current => !current)}>{screen.showGroceryGapForm ? 'Close add' : 'Add item'}</button></div>{screen.displayedGroceryGap.missing_items.length ? <div className="nutrition-gap-bulk-bar"><button type="button" className="btn-ghost small" onClick={screen.handleSelectAllGapItems} disabled={screen.allGapItemsChecked}>Check all</button><button type="button" className="btn-ghost small" onClick={screen.handleClearCheckedGapItems} disabled={!screen.checkedGapItems.length}>Clear checks</button><button type="button" className="btn-ghost small" onClick={screen.handleDeleteCheckedGapItems} disabled={!screen.checkedGapItems.length}>Delete checked{screen.checkedGapItems.length ? ` (${screen.checkedGapItems.length})` : ''}</button><button type="button" className="btn-primary small" onClick={screen.handleMoveGapToPantry} disabled={screen.syncingGapToPantry || !screen.checkedGapItems.length}>{screen.syncingGapToPantry ? 'Updating…' : `Add checked to pantry${screen.checkedGapItems.length ? ` (${screen.checkedGapItems.length})` : ''}`}</button></div> : null}{screen.showGroceryGapVoice ? <div ref={screen.groceryGapVoiceAnchor}><GroceryGapVoiceCapture onError={screen.showErrorToast} onToast={screen.showToast} onAddItems={screen.handleBulkGroceryGapImport} onCancel={() => screen.setShowGroceryGapVoice(false)} /></div> : null}{screen.showGroceryGapForm ? <div ref={screen.groceryGapFormAnchor}><GroceryGapForm onError={screen.showErrorToast} onSave={screen.handleCreateGroceryGapItem} onCancel={() => screen.setShowGroceryGapForm(false)} /></div> : null}<div className="nutrition-gap-list nutrition-gap-checklist">{screen.visibleGapItems.map(item => { const checked = screen.checkedGapItemSet.has(item.key); return <div key={item.key} className={`nutrition-gap-check-item${checked ? ' checked' : ''}`}><label className="nutrition-gap-check-main"><input type="checkbox" checked={checked} onChange={() => screen.toggleGapItemChecked(item.key)} /><span className="nutrition-gap-check-copy"><strong>{item.item_name}</strong>{item.quantity != null || item.unit || item.notes ? <span className="nutrition-gap-check-meta">{item.quantity != null || item.unit ? <span className="nutrition-gap-check-badge">{formatGroceryGapAmount(item.quantity, item.unit)}</span> : null}{item.notes ? <span className="nutrition-gap-check-note">{item.notes}</span> : null}</span> : null}</span></label><button type="button" className="btn-ghost small nutrition-gap-delete" onClick={() => screen.handleDeleteGroceryGapItem(item)}>Remove</button></div> })}{!screen.displayedGroceryGap.missing_items.length ? <p className="empty-state">You have the main staples covered right now.</p> : null}</div>{screen.displayedGroceryGap.recipe_items.length ? <div className="nutrition-stack-list nutrition-gap-detail-list">{screen.displayedGroceryGap.recipe_items.map(entry => <div key={`${entry.item}-${entry.recipes.join('|')}`} className="nutrition-item-row nutrition-gap-detail-row"><div><strong>{entry.item}</strong><p>Needed for {entry.recipes.join(', ')}</p></div></div>)}</div> : null}<SectionClampToggle count={screen.displayedGroceryGap.missing_items.length} expanded={screen.expandedSections.groceryGap} limit={10} label="items" onToggle={() => screen.toggleSection('groceryGap')} /></PlanningAccordionCard></section>
      <section className="dashboard-section nutrition-planning-grid"><PlanningAccordionCard innerRef={screen.recipesSectionAnchor} open={screen.planningAccordions.recipes} onToggle={() => screen.togglePlanningAccordion('recipes')} chip={<span className="dashboard-chip coach">Recipe ideas</span>} title="What you can make next" description="Select recipes to feed the grocery gap above. Use My cook book to focus only on the recipes you already picked." meta={<span className="dashboard-chip subtle">{screen.selectedRecipeKeys.length} selected</span>} actions={<>{screen.selectedRecipeKeys.length ? <button type="button" className="btn-ghost small" onClick={screen.handleClearSelectedRecipes}>Clear</button> : null}<button className="btn-secondary small" onClick={async () => { const refreshed = await screen.refreshPlanning({ recipeRefreshToken: String(Date.now()) }); if (refreshed) { screen.showToast('Recipe ideas refreshed.') } }} disabled={screen.loadingExtras}>{screen.loadingExtras ? 'Refreshing…' : 'Refresh'}</button></>}><details className="nutrition-filter-accordion" open={screen.recipeFiltersOpen} onToggle={event => screen.setRecipeFiltersOpen(event.currentTarget.open)}><summary><span>Search and filters</span><span className="nutrition-filter-accordion-meta">{screen.recipeSearchQuery ? `Search: ${screen.recipeSearchQuery}` : `${screen.recipeCollectionFilter === 'cookbook' ? 'My cook book' : 'All recipes'} · ${screen.recipeMealFilter === 'all' ? 'All meals' : formatMealTypeLabel(screen.recipeMealFilter)}`}</span></summary><div className="nutrition-filter-accordion-body"><label className="field-label nutrition-pantry-search"><span>Search recipes</span><input type="search" placeholder="Search by recipe or ingredient" value={screen.recipeSearchQuery} onChange={event => screen.setRecipeSearchQuery(event.target.value)} /></label><div className="nutrition-gap-list nutrition-quick-picks"><button type="button" className={`onboarding-chip${screen.recipeCollectionFilter === 'all' ? ' active' : ''}`} onClick={() => screen.setRecipeCollectionFilter('all')}>All recipes</button><button type="button" className={`onboarding-chip${screen.recipeCollectionFilter === 'cookbook' ? ' active' : ''}`} onClick={() => screen.setRecipeCollectionFilter('cookbook')}>My cook book ({screen.selectedRecipeKeys.length})</button></div><div className="nutrition-gap-list nutrition-quick-picks"><button type="button" className={`onboarding-chip${screen.recipeMealFilter === 'all' ? ' active' : ''}`} onClick={() => screen.setRecipeMealFilter('all')}>All ({screen.recipes.length})</button>{MEAL_TYPES.map(mealType => { const count = screen.recipes.filter(recipe => recipe?.meal_type === mealType).length; return <button key={mealType} type="button" className={`onboarding-chip${screen.recipeMealFilter === mealType ? ' active' : ''}`} onClick={() => screen.setRecipeMealFilter(mealType)}>{formatMealTypeLabel(mealType)} ({count})</button> })}</div>{(screen.recipeSearchQuery || screen.recipeMealFilter !== 'all' || screen.recipeCollectionFilter !== 'all') ? <div className="nutrition-card-actions">{screen.recipeSearchQuery ? <button type="button" className="btn-secondary small" onClick={() => screen.setRecipeSearchQuery('')}>Clear search</button> : null}{screen.recipeMealFilter !== 'all' || screen.recipeCollectionFilter !== 'all' ? <button type="button" className="btn-ghost small" onClick={() => { screen.setRecipeMealFilter('all'); screen.setRecipeCollectionFilter('all') }}>Reset filters</button> : null}</div> : null}</div></details><div className="nutrition-stack-list">{screen.visibleRecipes.map(recipe => <RecipeIdeaCard key={getRecipeKey(recipe)} recipe={recipe} selected={screen.selectedRecipeKeys.includes(getRecipeKey(recipe))} onToggle={() => screen.toggleRecipeSelection(recipe)} />)}{!screen.recipes.length ? <p className="empty-state">No suggestions yet. Add pantry items or refresh recipe ideas.</p> : null}{screen.recipeCollectionFilter === 'cookbook' && !screen.selectedRecipeKeys.length ? <p className="empty-state">Choose a few recipes first, then use My cook book to narrow the list.</p> : null}{screen.recipes.length > 0 && screen.filteredRecipes.length === 0 && !(screen.recipeCollectionFilter === 'cookbook' && !screen.selectedRecipeKeys.length) ? <p className="empty-state">No {formatMealTypeLabel(screen.recipeMealFilter).toLowerCase()} ideas match this search and filter state right now. Clear the search or refresh and try again.</p> : null}</div><SectionClampToggle count={screen.filteredRecipes.length} expanded={screen.expandedSections.recipes} limit={RECIPE_CARD_VISIBLE_LIMIT} label="recipes" onToggle={() => screen.toggleSection('recipes')} />{screen.filteredRecipes.length > RECIPE_CARD_VISIBLE_LIMIT ? <p className="nutrition-list-note">Showing 5 of {screen.filteredRecipes.length} recipe ideas on the dashboard.</p> : null}</PlanningAccordionCard></section>
    </section>
  )
}
