import { Destination, UserPreferences } from '@/app/types/destination';
import { getRecommendationScores } from '@/app/utils/recommendation';
import { formatPeso } from '@/app/utils/currency';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { 
  Brain, 
  Heart, 
  Activity, 
  DollarSign, 
  Compass, 
  Star 
} from 'lucide-react';

interface RecommendationBreakdownProps {
  destination: Destination;
  preferences: UserPreferences;
}

export function RecommendationBreakdown({ 
  destination, 
  preferences 
}: RecommendationBreakdownProps) {
  const scores = getRecommendationScores(destination, preferences);
  
  const maxTotal = 100;
  const scorePercentage = Math.min(100, (scores.totalScore / maxTotal) * 100);
  
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Recommendation Analysis</h3>
        <p className="text-sm text-gray-600">
          See how this destination matches your preferences
        </p>
      </div>

      {/* Overall Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Overall Match Score</span>
          <span className="text-2xl font-bold text-blue-600">
            {Math.round(scorePercentage)}%
          </span>
        </div>
        <Progress value={scorePercentage} className="h-3" />
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {scorePercentage >= 80 && (
            <Badge className="bg-green-100 text-green-800">Excellent Match</Badge>
          )}
          {scorePercentage >= 60 && scorePercentage < 80 && (
            <Badge className="bg-blue-100 text-blue-800">Good Match</Badge>
          )}
          {scorePercentage >= 40 && scorePercentage < 60 && (
            <Badge className="bg-yellow-100 text-yellow-800">Moderate Match</Badge>
          )}
          {scorePercentage < 40 && (
            <Badge className="bg-gray-100 text-gray-800">Fair Match</Badge>
          )}
        </div>
      </div>

      {/* Score Components */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Scoring Breakdown</h4>
        
        {/* Content-Based Score */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Preference Match</span>
            <span className="ml-auto text-sm font-semibold">
              {Math.round(scores.contentScore)}
            </span>
          </div>
          <Progress 
            value={(scores.contentScore / 200) * 100} 
            className="h-2"
          />
          <p className="text-xs text-gray-600">
            Based on your interests, activity level, budget, and travel style
          </p>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="font-medium text-sm">Preference Matching Details</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-gray-700">Interests:</span>
            <span className="ml-auto font-medium">
              {Math.round(scores.breakdown.interests)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="text-gray-700">Activity:</span>
            <span className="ml-auto font-medium">
              {Math.round(scores.breakdown.activityLevel)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-gray-700">Budget:</span>
            <span className="ml-auto font-medium">
              {Math.round(scores.breakdown.budget)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Compass className="w-4 h-4 text-blue-500" />
            <span className="text-gray-700">Style:</span>
            <span className="ml-auto font-medium">
              {Math.round(scores.breakdown.travelStyle)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-700">Rating:</span>
            <span className="ml-auto font-medium">
              {Math.round(scores.breakdown.rating)}
            </span>
          </div>
        </div>
      </div>

      {/* Backend AI Info */}
      <div className="pt-4 border-t">
        <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 p-3 rounded-lg">
          <Brain className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900 mb-1">Backend AI Recommendation</p>
            <p>
              This destination score is generated by our backend recommendation service
              using your budget ({formatPeso(preferences.budget)}) and trip duration
              ({preferences.duration} days).
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
