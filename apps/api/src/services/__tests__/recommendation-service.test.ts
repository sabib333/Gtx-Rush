import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHomeRecommendations,
  trackRecommendation,
  getRecommendationAnalytics,
  clearRecommendationCache,
  _clearUserRecommendationData,
  _clearAllRecommendationData,
} from '../recommendation-service';
import { _clearAllData } from '../preference-engine';

describe('RecommendationService', () => {
  beforeEach(() => {
    _clearAllData();
    _clearAllRecommendationData();
  });

  describe('Home Recommendations', () => {
    it('should return home recommendations', () => {
      const result = getHomeRecommendations('user-1');

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.welcomeMessage).toBeDefined();
    });

    it('should include personal best coach', () => {
      const result = getHomeRecommendations('user-1');

      expect(result.personalBestCoach).toBeDefined();
    });

    it('should include smart plan', () => {
      const result = getHomeRecommendations('user-1');

      expect(result.smartPlan).toBeDefined();
      expect(result.smartPlan!.tasks).toBeDefined();
    });

    it('should return different recommendations for different users', () => {
      const result1 = getHomeRecommendations('user-1');
      const result2 = getHomeRecommendations('user-2');

      // They should have different recommendation IDs
      expect(result1.recommendations[0].id).not.toBe(result2.recommendations[0].id);
    });

    it('should cache recommendations', () => {
      const result1 = getHomeRecommendations('user-1');
      const result2 = getHomeRecommendations('user-1');

      // Should return cached results
      expect(result1.recommendations[0].id).toBe(result2.recommendations[0].id);
    });
  });

  describe('Recommendation Tracking', () => {
    it('should track recommendation shown', () => {
      trackRecommendation('user-1', 'rec-1', 'shown');

      const analytics = getRecommendationAnalytics('user-1');
      expect(analytics.totalShown).toBe(1);
    });

    it('should track recommendation clicked', () => {
      trackRecommendation('user-1', 'rec-1', 'shown');
      trackRecommendation('user-1', 'rec-1', 'clicked');

      const analytics = getRecommendationAnalytics('user-1');
      expect(analytics.totalShown).toBe(1);
      expect(analytics.totalClicked).toBe(1);
      expect(analytics.clickThroughRate).toBe(1);
    });

    it('should track recommendation completed', () => {
      trackRecommendation('user-1', 'rec-1', 'shown');
      trackRecommendation('user-1', 'rec-1', 'clicked');
      trackRecommendation('user-1', 'rec-1', 'completed');

      const analytics = getRecommendationAnalytics('user-1');
      expect(analytics.totalCompleted).toBe(1);
    });

    it('should track recommendation dismissed', () => {
      trackRecommendation('user-1', 'rec-1', 'shown');
      trackRecommendation('user-1', 'rec-1', 'dismissed');

      const analytics = getRecommendationAnalytics('user-1');
      expect(analytics.totalDismissed).toBe(1);
    });

    it('should calculate click-through rate', () => {
      trackRecommendation('user-1', 'rec-1', 'shown');
      trackRecommendation('user-1', 'rec-2', 'shown');
      trackRecommendation('user-1', 'rec-1', 'clicked');

      const analytics = getRecommendationAnalytics('user-1');
      expect(analytics.totalShown).toBe(2);
      expect(analytics.totalClicked).toBe(1);
      expect(analytics.clickThroughRate).toBe(0.5);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific user', () => {
      getHomeRecommendations('user-1');
      clearRecommendationCache('user-1');

      // Next request should generate new recommendations
      const result = getHomeRecommendations('user-1');
      expect(result).toBeDefined();
    });

    it('should clear all cache', () => {
      getHomeRecommendations('user-1');
      getHomeRecommendations('user-2');
      clearRecommendationCache();

      // Both users should get fresh recommendations
      const result1 = getHomeRecommendations('user-1');
      const result2 = getHomeRecommendations('user-2');
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
