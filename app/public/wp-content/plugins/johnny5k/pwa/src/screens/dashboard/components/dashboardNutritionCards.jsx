import { DashboardIconBadge, MacroPill } from './dashboardSharedCards'

export function TodayIntakeCard({ caloriesRemaining, mealCount, nt, goal, calPct, proPct, carbPct, fatPct, exerciseCalories, body, onOpenNutrition }) {
  return (
    <button className="dash-card dashboard-card-button dashboard-hero-card" type="button" onClick={onOpenNutrition}>
      <div className="dashboard-card-head">
        <span className="dashboard-chip">Today&apos;s intake</span>
        <span className="dashboard-card-kicker">{mealCount} meal{mealCount === 1 ? '' : 's'} logged</span>
      </div>
      <h2>{caloriesRemaining != null ? `${caloriesRemaining} cal left` : 'Nutrition ready'}</h2>
      <p>{body}</p>
      <div className="dashboard-hero-progress-row">
        <MacroPill label="Calories" current={nt?.calories} target={goal?.target_calories} pct={calPct} compact />
        <MacroPill label="Protein" current={nt?.protein_g} target={goal?.target_protein_g} pct={proPct} compact suffix="g" />
        <MacroPill label="Carbs" current={nt?.carbs_g} target={goal?.target_carbs_g} pct={carbPct} compact suffix="g" />
        <MacroPill label="Fat" current={nt?.fat_g} target={goal?.target_fat_g} pct={fatPct} compact suffix="g" />
        <MacroPill label="Burned" current={exerciseCalories} compact valueLabel={`${Math.round(exerciseCalories ?? 0)} cal`} />
      </div>
      <span className="dashboard-card-cta">Open nutrition</span>
    </button>
  )
}

export function ProteinRunwayCard({ model, onOpenNutrition, onAskJohnny }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-protein">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="nutrition" tone="teal" />
        <span className="dashboard-chip ai">Protein runway</span>
        <span className="dashboard-card-kicker">{model.statusLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-optional-stat-grid">
        <div>
          <span>Remaining</span>
          <strong>{model.remainingLabel}</strong>
        </div>
        <div>
          <span>Next meal target</span>
          <strong>{model.nextMealProteinLabel}</strong>
        </div>
      </div>
      <div className="dashboard-card-support-text">{model.helper}</div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-outline small" onClick={onOpenNutrition}>Open nutrition</button>
        <button type="button" className="btn-primary small" onClick={() => onAskJohnny(model.prompt)}>Ask Johnny</button>
      </div>
    </section>
  )
}

export function MealRhythmCard({ model, onOpenNutrition }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-meals">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="nutrition" tone="amber" />
        <span className="dashboard-chip subtle">Meal rhythm</span>
        <span className="dashboard-card-kicker">{model.loggedCountLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      <div className="dashboard-rhythm-row">
        {model.windows.map(window => (
          <span key={window.key} className={`dashboard-rhythm-pill ${window.logged ? 'logged' : 'open'}`}>{window.label}</span>
        ))}
      </div>
      <div className="dashboard-card-support-text">{model.helper}</div>
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenNutrition}>Open nutrition</button>
      </div>
    </section>
  )
}

export function GroceryGapSpotlightCard({ model, onOpenGroceryGap }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-grocery">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="award" tone="green" />
        <span className="dashboard-chip awards">Grocery gap</span>
        <span className="dashboard-card-kicker">{model.countLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      {model.items.length ? (
        <div className="dashboard-optional-list">
          {model.items.map(item => (
            <div key={item.key} className="dashboard-optional-list-row">
              <strong>{item.label}</strong>
              <span>{item.sourceLabel}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-primary small" onClick={onOpenGroceryGap}>Open grocery gap</button>
      </div>
    </section>
  )
}

export function ReminderQueueCard({ model, onOpenProfile, onAskJohnny }) {
  if (!model) return null

  return (
    <section className="dash-card dashboard-optional-card dashboard-optional-card-reminders">
      <div className="dashboard-card-head">
        <DashboardIconBadge iconName="profile" tone="pink" />
        <span className="dashboard-chip subtle">Reminder queue</span>
        <span className="dashboard-card-kicker">{model.countLabel}</span>
      </div>
      <h3>{model.title}</h3>
      <p>{model.body}</p>
      {model.nextReminder ? (
        <div className="dashboard-optional-reminder-row">
          <strong>{model.nextReminder.whenLabel}</strong>
          <span>{model.nextReminder.message}</span>
          <small>{model.nextReminder.metaLabel}</small>
        </div>
      ) : null}
      <div className="dashboard-optional-actions">
        <button type="button" className="btn-outline small" onClick={onAskJohnny}>Ask Johnny</button>
        <button type="button" className="btn-primary small" onClick={onOpenProfile}>Open profile</button>
      </div>
    </section>
  )
}
