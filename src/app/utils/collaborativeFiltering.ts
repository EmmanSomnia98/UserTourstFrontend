import { Destination, UserPreferences } from '@/app/types/destination';

// Simulated user-item interaction matrix
// In a real system, this would come from a database of user behavior
export interface UserInteraction {
  userId: string;
  destinationId: string;
  rating: number; // 1-5
  visited: boolean;
  interests: string[];
  activityLevel: string;
}

// Simulate historical user data for collaborative filtering
const simulatedUserData: UserInteraction[] = [
  // User 1: Adventure lover
  { userId: 'u1', destinationId: '1', rating: 5, visited: true, interests: ['hiking', 'adventure'], activityLevel: 'active' },
  { userId: 'u1', destinationId: '8', rating: 5, visited: true, interests: ['hiking', 'adventure'], activityLevel: 'active' },
  { userId: 'u1', destinationId: '4', rating: 4, visited: true, interests: ['hiking', 'adventure'], activityLevel: 'active' },
  { userId: 'u1', destinationId: '5', rating: 4, visited: true, interests: ['hiking', 'adventure'], activityLevel: 'active' },
  
  // User 2: Nature enthusiast
  { userId: 'u2', destinationId: '2', rating: 5, visited: true, interests: ['nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u2', destinationId: '4', rating: 5, visited: true, interests: ['nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u2', destinationId: '9', rating: 5, visited: true, interests: ['nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u2', destinationId: '3', rating: 4, visited: true, interests: ['nature', 'photography'], activityLevel: 'moderate' },
  
  // User 3: Relaxation seeker
  { userId: 'u3', destinationId: '3', rating: 5, visited: true, interests: ['relaxation'], activityLevel: 'relaxed' },
  { userId: 'u3', destinationId: '2', rating: 5, visited: true, interests: ['relaxation'], activityLevel: 'relaxed' },
  { userId: 'u3', destinationId: '6', rating: 4, visited: true, interests: ['relaxation', 'culture'], activityLevel: 'relaxed' },
  
  // User 4: Waterfall chaser
  { userId: 'u4', destinationId: '5', rating: 5, visited: true, interests: ['swimming', 'nature'], activityLevel: 'moderate' },
  { userId: 'u4', destinationId: '10', rating: 5, visited: true, interests: ['swimming', 'nature'], activityLevel: 'moderate' },
  { userId: 'u4', destinationId: '2', rating: 4, visited: true, interests: ['swimming', 'nature'], activityLevel: 'moderate' },
  
  // User 5: Cultural explorer
  { userId: 'u5', destinationId: '6', rating: 5, visited: true, interests: ['culture', 'photography'], activityLevel: 'relaxed' },
  { userId: 'u5', destinationId: '7', rating: 4, visited: true, interests: ['culture', 'photography'], activityLevel: 'relaxed' },
  { userId: 'u5', destinationId: '4', rating: 4, visited: true, interests: ['culture', 'photography'], activityLevel: 'relaxed' },
  
  // User 6: Balanced traveler
  { userId: 'u6', destinationId: '1', rating: 4, visited: true, interests: ['hiking', 'nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u6', destinationId: '2', rating: 5, visited: true, interests: ['hiking', 'nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u6', destinationId: '3', rating: 4, visited: true, interests: ['hiking', 'nature', 'photography'], activityLevel: 'moderate' },
  { userId: 'u6', destinationId: '5', rating: 5, visited: true, interests: ['hiking', 'nature', 'photography'], activityLevel: 'moderate' },
  
  // User 7: Adventure + Nature
  { userId: 'u7', destinationId: '1', rating: 5, visited: true, interests: ['hiking', 'adventure', 'nature'], activityLevel: 'active' },
  { userId: 'u7', destinationId: '4', rating: 5, visited: true, interests: ['hiking', 'adventure', 'nature'], activityLevel: 'active' },
  { userId: 'u7', destinationId: '8', rating: 5, visited: true, interests: ['hiking', 'adventure', 'nature'], activityLevel: 'active' },
  { userId: 'u7', destinationId: '9', rating: 4, visited: true, interests: ['hiking', 'adventure', 'nature'], activityLevel: 'active' },
];

/**
 * Calculate user similarity based on preferences
 */
function calculateUserSimilarity(
  currentPreferences: UserPreferences,
  historicalUser: { interests: string[]; activityLevel: string }
): number {
  let similarity = 0;
  
  // Interest overlap (Jaccard similarity)
  const intersection = currentPreferences.interests.filter(i =>
    historicalUser.interests.some(hi => 
      i.toLowerCase().includes(hi.toLowerCase()) || 
      hi.toLowerCase().includes(i.toLowerCase())
    )
  ).length;
  
  const union = new Set([...currentPreferences.interests, ...historicalUser.interests]).size;
  const jaccardSimilarity = union > 0 ? intersection / union : 0;
  similarity += jaccardSimilarity * 0.7;
  
  // Activity level match
  if (currentPreferences.activityLevel === historicalUser.activityLevel) {
    similarity += 0.3;
  } else if (
    (currentPreferences.activityLevel === 'moderate' && historicalUser.activityLevel !== 'moderate') ||
    (currentPreferences.activityLevel !== 'moderate' && historicalUser.activityLevel === 'moderate')
  ) {
    similarity += 0.15; // Partial match with moderate
  }
  
  return similarity;
}

/**
 * User-based Collaborative Filtering
 * Find similar users and recommend items they liked
 */
export function userBasedCF(
  preferences: UserPreferences,
  allDestinations: Destination[]
): Map<string, number> {
  const scores = new Map<string, number>();
  
  // Group interactions by user
  const userProfiles = new Map<string, UserInteraction[]>();
  simulatedUserData.forEach(interaction => {
    if (!userProfiles.has(interaction.userId)) {
      userProfiles.set(interaction.userId, []);
    }
    userProfiles.get(interaction.userId)!.push(interaction);
  });
  
  // Calculate similarity with each historical user
  const userSimilarities = new Map<string, number>();
  userProfiles.forEach((interactions, userId) => {
    const userInterests = [...new Set(interactions.flatMap(i => i.interests))];
    const userActivityLevel = interactions[0].activityLevel;
    
    const similarity = calculateUserSimilarity(preferences, {
      interests: userInterests,
      activityLevel: userActivityLevel
    });
    
    userSimilarities.set(userId, similarity);
  });
  
  // Aggregate ratings from similar users
  simulatedUserData.forEach(interaction => {
    const userSimilarity = userSimilarities.get(interaction.userId) || 0;
    
    if (userSimilarity > 0.3) { // Only consider reasonably similar users
      const currentScore = scores.get(interaction.destinationId) || 0;
      // Weight the rating by user similarity
      const weightedRating = interaction.rating * userSimilarity;
      scores.set(interaction.destinationId, currentScore + weightedRating);
    }
  });
  
  return scores;
}

/**
 * Item-based Collaborative Filtering
 * Find items similar to what user might like based on item co-occurrence
 */
export function itemBasedCF(
  preferences: UserPreferences,
  allDestinations: Destination[]
): Map<string, number> {
  const scores = new Map<string, number>();
  
  // Build item-item co-occurrence matrix
  const cooccurrence = new Map<string, Map<string, number>>();
  
  // Group by user to find items viewed together
  const userViews = new Map<string, string[]>();
  simulatedUserData.forEach(interaction => {
    if (!userViews.has(interaction.userId)) {
      userViews.set(interaction.userId, []);
    }
    userViews.get(interaction.userId)!.push(interaction.destinationId);
  });
  
  // Calculate co-occurrence
  userViews.forEach(items => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i];
        const item2 = items[j];
        
        if (!cooccurrence.has(item1)) {
          cooccurrence.set(item1, new Map());
        }
        if (!cooccurrence.has(item2)) {
          cooccurrence.set(item2, new Map());
        }
        
        const count1 = cooccurrence.get(item1)!.get(item2) || 0;
        const count2 = cooccurrence.get(item2)!.get(item1) || 0;
        
        cooccurrence.get(item1)!.set(item2, count1 + 1);
        cooccurrence.get(item2)!.set(item1, count2 + 1);
      }
    }
  });
  
  // Calculate item similarity using cosine similarity
  const itemSimilarity = new Map<string, Map<string, number>>();
  
  cooccurrence.forEach((related, itemId) => {
    itemSimilarity.set(itemId, new Map());
    
    related.forEach((count, relatedId) => {
      const item1Count = simulatedUserData.filter(i => i.destinationId === itemId).length;
      const item2Count = simulatedUserData.filter(i => i.destinationId === relatedId).length;
      
      // Cosine similarity
      const similarity = count / Math.sqrt(item1Count * item2Count);
      itemSimilarity.get(itemId)!.set(relatedId, similarity);
    });
  });
  
  // Score items based on similarity to items matching user preferences
  allDestinations.forEach(dest => {
    let score = 0;
    
    // Find destinations that match user interests
    const interestMatch = dest.interests.some(interest =>
      preferences.interests.some(userInterest =>
        interest.toLowerCase().includes(userInterest.toLowerCase()) ||
        userInterest.toLowerCase().includes(interest.toLowerCase())
      )
    );
    
    if (interestMatch) {
      // This item matches user interests, boost similar items
      const similarItems = itemSimilarity.get(dest.id);
      
      if (similarItems) {
        similarItems.forEach((similarity, relatedId) => {
          const currentScore = scores.get(relatedId) || 0;
          scores.set(relatedId, currentScore + similarity * 10);
        });
      }
    }
  });
  
  return scores;
}

/**
 * Hybrid Collaborative Filtering
 * Combines user-based and item-based approaches
 */
export function hybridCollaborativeFiltering(
  preferences: UserPreferences,
  allDestinations: Destination[]
): Map<string, number> {
  const userScores = userBasedCF(preferences, allDestinations);
  const itemScores = itemBasedCF(preferences, allDestinations);
  
  const hybridScores = new Map<string, number>();
  
  // Combine scores with weighting
  const userWeight = 0.6;
  const itemWeight = 0.4;
  
  // Merge all destination IDs
  const allIds = new Set([...userScores.keys(), ...itemScores.keys()]);
  
  allIds.forEach(destId => {
    const userScore = userScores.get(destId) || 0;
    const itemScore = itemScores.get(destId) || 0;
    
    const combinedScore = (userScore * userWeight) + (itemScore * itemWeight);
    hybridScores.set(destId, combinedScore);
  });
  
  return hybridScores;
}

/**
 * Calculate popularity boost based on overall ratings and visits
 */
export function calculatePopularityScore(destinationId: string): number {
  const interactions = simulatedUserData.filter(i => i.destinationId === destinationId);
  
  if (interactions.length === 0) return 0;
  
  const avgRating = interactions.reduce((sum, i) => sum + i.rating, 0) / interactions.length;
  const visitCount = interactions.filter(i => i.visited).length;
  
  // Popularity score combining rating and visit frequency
  return (avgRating * 0.7) + (visitCount * 0.3);
}
