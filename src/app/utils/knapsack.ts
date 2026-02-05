import { Destination } from '@/app/types/destination';

export interface KnapsackItem {
  destination: Destination;
  value: number; // recommendation score
  weight: number; // could be cost or duration
}

export interface KnapsackConstraints {
  maxBudget: number;
  maxDuration: number; // in hours
  minItems?: number;
  maxItems?: number;
}

/**
 * 0/1 Knapsack Algorithm with dual constraints (budget and time)
 * Optimizes destination selection based on value (recommendation score)
 * while respecting budget and time constraints
 */
export function knapsackOptimization(
  items: KnapsackItem[],
  constraints: KnapsackConstraints
): Destination[] {
  const n = items.length;
  const { maxBudget, maxDuration } = constraints;
  
  // Create a 3D DP table: dp[i][budget][duration] = max value
  // For efficiency, we'll use a 2D approach with combined constraint
  const W = Math.floor(maxBudget);
  const T = Math.floor(maxDuration);
  
  // dp[w][t] = {value, items[]}
  const dp: Array<Array<{ value: number; indices: number[] }>> = Array(W + 1)
    .fill(null)
    .map(() =>
      Array(T + 1)
        .fill(null)
        .map(() => ({ value: 0, indices: [] }))
    );
  
  // Fill the DP table
  for (let i = 0; i < n; i++) {
    const item = items[i];
    const cost = Math.floor(item.destination.estimatedCost);
    const duration = Math.floor(item.destination.duration);
    const value = item.value;
    
    // Traverse in reverse to avoid using same item multiple times
    for (let w = W; w >= cost; w--) {
      for (let t = T; t >= duration; t--) {
        const newValue = dp[w - cost][t - duration].value + value;
        
        // Check if this item is already in the indices to prevent duplicates
        const existingIndices = dp[w - cost][t - duration].indices;
        if (!existingIndices.includes(i) && newValue > dp[w][t].value) {
          dp[w][t] = {
            value: newValue,
            indices: [...existingIndices, i]
          };
        }
      }
    }
  }
  
  // Find the maximum value considering all valid combinations
  let maxValue = 0;
  let bestIndices: number[] = [];
  
  for (let w = 0; w <= W; w++) {
    for (let t = 0; t <= T; t++) {
      if (dp[w][t].value > maxValue) {
        maxValue = dp[w][t].value;
        bestIndices = dp[w][t].indices;
      }
    }
  }
  
  // Apply min/max item constraints if specified
  if (constraints.minItems && bestIndices.length < constraints.minItems) {
    // Add more items even if they exceed optimal value slightly
    return greedyFallback(items, constraints);
  }
  
  if (constraints.maxItems && bestIndices.length > constraints.maxItems) {
    // Take top maxItems by individual value
    bestIndices = bestIndices
      .sort((a, b) => items[b].value - items[a].value)
      .slice(0, constraints.maxItems);
  }
  
  return bestIndices.map(i => items[i].destination);
}

/**
 * Greedy fallback when knapsack doesn't meet minimum items
 */
function greedyFallback(
  items: KnapsackItem[],
  constraints: KnapsackConstraints
): Destination[] {
  const sorted = [...items].sort((a, b) => {
    // Value per cost ratio
    const ratioA = a.value / (a.destination.estimatedCost + a.destination.duration);
    const ratioB = b.value / (b.destination.estimatedCost + b.destination.duration);
    return ratioB - ratioA;
  });
  
  const selected: Destination[] = [];
  let totalCost = 0;
  let totalDuration = 0;
  
  for (const item of sorted) {
    // Check if destination is already selected (by ID)
    if (selected.some(dest => dest.id === item.destination.id)) {
      continue;
    }
    
    const newCost = totalCost + item.destination.estimatedCost;
    const newDuration = totalDuration + item.destination.duration;
    
    if (newCost <= constraints.maxBudget && newDuration <= constraints.maxDuration) {
      selected.push(item.destination);
      totalCost = newCost;
      totalDuration = newDuration;
      
      if (constraints.maxItems && selected.length >= constraints.maxItems) {
        break;
      }
    }
  }
  
  return selected;
}

/**
 * Fractional Knapsack for initial screening (can take partial items conceptually)
 * Used to rank destinations by value-to-weight ratio
 */
export function fractionalKnapsackRanking(
  items: KnapsackItem[]
): KnapsackItem[] {
  return [...items].sort((a, b) => {
    // Calculate efficiency: value per unit of combined resource (cost + time)
    const efficiencyA = a.value / (a.destination.estimatedCost + a.destination.duration * 100);
    const efficiencyB = b.value / (b.destination.estimatedCost + b.destination.duration * 100);
    return efficiencyB - efficiencyA;
  });
}

/**
 * Multi-dimensional knapsack variant
 * Optimizes for value while balancing multiple constraints and preferences
 */
export function multiConstraintKnapsack(
  items: KnapsackItem[],
  constraints: KnapsackConstraints,
  diversityWeight: number = 0.3
): Destination[] {
  // First, get optimal selection
  let selected = knapsackOptimization(items, constraints);
  
  // Apply diversity enhancement
  if (diversityWeight > 0) {
    selected = enhanceDiversity(selected, items, constraints, diversityWeight);
  }
  
  return selected;
}

/**
 * Enhance diversity in selected destinations
 */
function enhanceDiversity(
  selected: Destination[],
  allItems: KnapsackItem[],
  constraints: KnapsackConstraints,
  diversityWeight: number
): Destination[] {
  const typeCount = new Map<string, number>();
  const difficultyCount = new Map<string, number>();
  
  selected.forEach(dest => {
    typeCount.set(dest.type, (typeCount.get(dest.type) || 0) + 1);
    difficultyCount.set(dest.difficulty, (difficultyCount.get(dest.difficulty) || 0) + 1);
  });
  
  // Find over-represented categories
  const avgTypeCount = selected.length / 5; // 5 types
  const overRepresented = selected.filter(dest => {
    const count = typeCount.get(dest.type) || 0;
    return count > avgTypeCount * 1.5;
  });
  
  if (overRepresented.length === 0) return selected;
  
  // Try to swap some over-represented items with diverse alternatives
  const remaining = allItems
    .filter(item => !selected.some(dest => dest.id === item.destination.id))
    .sort((a, b) => b.value - a.value);
  
  const result = [...selected];
  let totalCost = selected.reduce((sum, d) => sum + d.estimatedCost, 0);
  let totalDuration = selected.reduce((sum, d) => sum + d.duration, 0);
  
  for (let i = overRepresented.length - 1; i >= 0; i--) {
    const toReplace = overRepresented[i];
    const currentType = toReplace.type;
    
    // Find a replacement with different type
    for (const item of remaining) {
      if (item.destination.type !== currentType) {
        const newCost = totalCost - toReplace.estimatedCost + item.destination.estimatedCost;
        const newDuration = totalDuration - toReplace.duration + item.destination.duration;
        
        if (newCost <= constraints.maxBudget && newDuration <= constraints.maxDuration) {
          // Value loss should be acceptable
          const valueDiff = item.value - (allItems.find(it => it.destination.id === toReplace.id)?.value || 0);
          if (valueDiff >= -item.value * diversityWeight) {
            const idx = result.findIndex(d => d.id === toReplace.id);
            if (idx !== -1) {
              // Ensure we're not adding a duplicate
              if (!result.some(d => d.id === item.destination.id)) {
                result[idx] = item.destination;
                totalCost = newCost;
                totalDuration = newDuration;
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // Final deduplication check
  const uniqueResult = Array.from(
    new Map(result.map(d => [d.id, d])).values()
  );
  
  return uniqueResult;
}