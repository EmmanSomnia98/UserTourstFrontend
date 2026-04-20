import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Route, Sparkles, Wallet } from 'lucide-react';

import { Modal } from '@/app/components/Modal';

export type FeatureModalId = 'AI_ENGINE' | 'BUDGET' | 'SCHEDULER';

type FeatureModalsProps = {
  activeModal: FeatureModalId | null;
  onClose: () => void;
  onGenerateRecommendations: () => void;
  onOpenBudgetPlan: (preset: { budget: number; duration: number }) => void;
  onGenerateItinerary: () => void;
};

const budgetDataset = [
  { name: 'Bulusan Lake', cost: 800, value: 91 },
  { name: 'Dancalan Beach', cost: 500, value: 84 },
  { name: 'Palogtoc Falls', cost: 700, value: 88 },
];

export function FeatureModals({
  activeModal,
  onClose,
  onGenerateRecommendations,
  onOpenBudgetPlan,
  onGenerateItinerary,
}: FeatureModalsProps) {
  const [budget, setBudget] = useState(2500);
  const [duration, setDuration] = useState(2);

  const selectedBudgetSummary = useMemo(() => {
    const capacity = Math.max(0, Math.floor(budget));
    const n = budgetDataset.length;
    const dp = Array.from({ length: n + 1 }, () => Array<number>(capacity + 1).fill(0));

    for (let i = 1; i <= n; i += 1) {
      const item = budgetDataset[i - 1];
      for (let w = 0; w <= capacity; w += 1) {
        if (item.cost > w) {
          dp[i][w] = dp[i - 1][w];
          continue;
        }
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - item.cost] + item.value);
      }
    }

    const selected: Array<(typeof budgetDataset)[number]> = [];
    let w = capacity;
    for (let i = n; i > 0; i -= 1) {
      if (dp[i][w] === dp[i - 1][w]) continue;
      const chosen = budgetDataset[i - 1];
      selected.push(chosen);
      w -= chosen.cost;
    }
    selected.reverse();
    const totalCost = selected.reduce((sum, item) => sum + item.cost, 0);
    const totalValue = selected.reduce((sum, item) => sum + item.value, 0);
    return {
      selected,
      totalCost,
      remainingBudget: Math.max(0, budget - totalCost),
      totalValue,
    };
  }, [budget]);

  if (!activeModal) return null;

  if (activeModal === 'AI_ENGINE') {
    return (
      <Modal
        open
        onClose={onClose}
        title="AI Recommendation Engine"
        description="Hybrid Recommendation System (Content-Based + Collaborative Filtering)"
        content={(
          <>
            <section className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
                <Sparkles className="h-4 w-4" />
                How It Works
              </h4>
              <p className="text-sm text-slate-700">
                Bulusan Wanderer combines content-based filtering (destination attributes like category, activity type,
                and estimated cost) with collaborative filtering (patterns from similar users). Cosine similarity is used
                to score profile-to-destination and user-to-user closeness, then a weighted hybrid score adapts based on
                your activity and interaction history.
              </p>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Sample Recommendations</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Bulusan Lake</p>
                  <p className="mt-1 text-xs text-slate-600">Nature, Hiking</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Dancalan Beach</p>
                  <p className="mt-1 text-xs text-slate-600">Swimming, Relaxation</p>
                </article>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Nature', 'Budget-Friendly', 'Adventure'].map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-700">
                Recommendations are generated based on your preferences, past interactions, and similarity to other users.
              </p>
            </section>
          </>
        )}
        actions={[
          {
            label: 'Generate My Recommendations',
            className: 'bg-blue-700 text-white hover:bg-blue-800',
            onClick: onGenerateRecommendations,
          },
        ]}
      />
    );
  }

  if (activeModal === 'BUDGET') {
    return (
      <Modal
        open
        onClose={onClose}
        title="Route and Budget Aware"
        description="Knapsack optimization for budget-constrained destination selection"
        content={(
          <>
            <section className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <Route className="h-4 w-4" />
                How Budget Optimization Works
              </h4>
              <p className="text-sm text-slate-700">
                The engine applies a knapsack algorithm where each destination has a cost and a value from its hybrid score.
                It selects the combination that maximizes total value while keeping total cost within your budget constraint.
              </p>
            </section>

            <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
              {budgetDataset.map((item) => (
                <div key={item.name} className="rounded-md bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-600">Cost: PHP {item.cost.toLocaleString()}</p>
                  <p className="text-xs text-slate-600">Hybrid Value: {item.value}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-sm text-slate-700">
                Selected destinations maximize value without exceeding PHP {budget.toLocaleString()} budget.
              </p>
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Selected (Knapsack Result)</p>
                <p>{selectedBudgetSummary.selected.map((item) => item.name).join(', ') || 'None selected'}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-emerald-800">Total Cost</p>
                  <p>PHP {selectedBudgetSummary.totalCost.toLocaleString()}</p>
                </div>
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-emerald-800">Remaining / Value</p>
                  <p>
                    PHP {selectedBudgetSummary.remainingBudget.toLocaleString()} / {selectedBudgetSummary.totalValue}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700" htmlFor="feature-budget-range">
                <span className="font-semibold">Budget</span>
                <input
                  id="feature-budget-range"
                  type="range"
                  min={1500}
                  max={6000}
                  step={100}
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                  className="w-full accent-emerald-600"
                />
                <span className="block text-xs text-slate-600">PHP {budget.toLocaleString()}</span>
              </label>

              <label className="space-y-2 text-sm text-slate-700" htmlFor="feature-duration-select">
                <span className="font-semibold">Travel Duration</span>
                <select
                  id="feature-duration-select"
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                >
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={4}>4 days</option>
                  <option value={5}>5 days</option>
                </select>
              </label>
            </section>
          </>
        )}
        actions={[
          {
            label: 'Customize My Budget Plan',
            className: 'bg-emerald-700 text-white hover:bg-emerald-800',
            onClick: () => onOpenBudgetPlan({ budget, duration }),
          },
        ]}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Smart Itinerary Scheduling"
      description="Day-by-day schedule generation using priority ranking and load balancing"
      content={(
        <>
          <section className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-700">
              <CalendarDays className="h-4 w-4" />
              How Scheduling Works
            </h4>
            <p className="text-sm text-slate-700">
              Selected destinations are arranged into day-by-day plans using hybrid-score priority ranking and daily load
              balancing. This avoids overcrowded schedules while keeping high-value places in strong time slots.
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Day 1</p>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-violet-600" />
                  <span className="font-medium text-slate-900">Morning:</span>
                  Bulusan Lake
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-violet-600" />
                  <span className="font-medium text-slate-900">Afternoon:</span>
                  Palogtoc Falls
                </p>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Day 2</p>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-violet-600" />
                  <span className="font-medium text-slate-900">Morning:</span>
                  Dancalan Beach
                </p>
                <p className="text-xs text-slate-600">Activity: Relaxation</p>
              </div>
            </article>
          </section>

          <section className="rounded-lg border border-violet-200 bg-white p-4 text-sm text-slate-700">
            Output is a structured itinerary by day and time block (morning/afternoon), ready for itinerary display and
            further manual editing.
          </section>
        </>
      )}
      actions={[
        {
          label: 'Generate My Itinerary',
          className: 'bg-violet-700 text-white hover:bg-violet-800',
          onClick: onGenerateItinerary,
        },
      ]}
    />
  );
}
