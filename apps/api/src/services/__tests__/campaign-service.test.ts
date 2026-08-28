/**
 * GTX Rush — Campaign Service Tests
 *
 * Tests for:
 * - Campaign creation
 * - Campaign lifecycle
 * - Campaign attribution
 * - Campaign queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCampaign,
  updateCampaignStatus,
  getCampaign,
  getActiveCampaigns,
  getCampaignsByStatus,
  recordCampaignAttribution,
  getCampaignAttributions,
  getUserCampaignAttributions,
  isCampaignActive,
  checkCampaignStatuses,
  _clearCampaignService,
  _getCampaignCount,
  _getActiveCampaignCount,
} from '../campaign-service';

describe('Campaign Service', () => {
  const testUserId = 'test-user-001';

  beforeEach(() => {
    _clearCampaignService();
  });

  describe('Campaign Creation', () => {
    it('should create a campaign', () => {
      const campaign = createCampaign({
        name: 'Summer Rush',
        description: 'Summer promotional campaign',
        source: 'campaign',
        startsAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
      });

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Summer Rush');
      expect(campaign.status).toBe('draft');
    });

    it('should generate unique campaign IDs', () => {
      const campaign1 = createCampaign({
        name: 'Campaign 1',
        description: 'First campaign',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const campaign2 = createCampaign({
        name: 'Campaign 2',
        description: 'Second campaign',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      expect(campaign1.id).not.toBe(campaign2.id);
    });
  });

  describe('Campaign Lifecycle', () => {
    it('should update campaign status', () => {
      const campaign = createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const updated = updateCampaignStatus(campaign.id, 'active');
      expect(updated).toBe(true);

      const fetched = getCampaign(campaign.id);
      expect(fetched?.status).toBe('active');
    });

    it('should return false for non-existent campaign', () => {
      const updated = updateCampaignStatus('non-existent', 'active');
      expect(updated).toBe(false);
    });

    it('should check campaign statuses based on time', () => {
      createCampaign({
        name: 'Past Campaign',
        description: 'Already started',
        source: 'campaign',
        startsAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const updated = checkCampaignStatuses();
      expect(updated).toBeGreaterThan(0);
    });
  });

  describe('Campaign Queries', () => {
    it('should get campaign by ID', () => {
      const created = createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const fetched = getCampaign(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('Test Campaign');
    });

    it('should return null for non-existent campaign', () => {
      const fetched = getCampaign('non-existent');
      expect(fetched).toBeNull();
    });

    it('should get active campaigns', () => {
      const campaign = createCampaign({
        name: 'Active Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateCampaignStatus(campaign.id, 'active');

      const active = getActiveCampaigns();
      expect(active.length).toBe(1);
      expect(active[0].name).toBe('Active Campaign');
    });

    it('should get campaigns by status', () => {
      const campaign1 = createCampaign({
        name: 'Campaign 1',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const campaign2 = createCampaign({
        name: 'Campaign 2',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateCampaignStatus(campaign1.id, 'active');
      updateCampaignStatus(campaign2.id, 'ended');

      const active = getCampaignsByStatus('active');
      const ended = getCampaignsByStatus('ended');

      expect(active.length).toBe(1);
      expect(ended.length).toBe(1);
    });

    it('should check if campaign is active', () => {
      const campaign = createCampaign({
        name: 'Active Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateCampaignStatus(campaign.id, 'active');

      expect(isCampaignActive(campaign.id)).toBe(true);
    });

    it('should return false for non-active campaign', () => {
      const campaign = createCampaign({
        name: 'Draft Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      expect(isCampaignActive(campaign.id)).toBe(false);
    });
  });

  describe('Campaign Attribution', () => {
    it('should record campaign attribution', () => {
      const campaign = createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const attribution = recordCampaignAttribution(
        campaign.id,
        testUserId,
        'campaign',
        { source: 'share' },
      );

      expect(attribution).toBeDefined();
      expect(attribution.campaignId).toBe(campaign.id);
      expect(attribution.userId).toBe(testUserId);
    });

    it('should get campaign attributions', () => {
      const campaign = createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      recordCampaignAttribution(campaign.id, testUserId, 'campaign');
      recordCampaignAttribution(campaign.id, 'user-2', 'campaign');

      const attributions = getCampaignAttributions(campaign.id);
      expect(attributions.length).toBe(2);
    });

    it('should get user campaign attributions', () => {
      const campaign1 = createCampaign({
        name: 'Campaign 1',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const campaign2 = createCampaign({
        name: 'Campaign 2',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      recordCampaignAttribution(campaign1.id, testUserId, 'campaign');
      recordCampaignAttribution(campaign2.id, testUserId, 'campaign');

      const attributions = getUserCampaignAttributions(testUserId);
      expect(attributions.length).toBe(2);
    });

    it('should update participant count', () => {
      const campaign = createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      recordCampaignAttribution(campaign.id, testUserId, 'campaign');
      recordCampaignAttribution(campaign.id, 'user-2', 'campaign');

      const fetched = getCampaign(campaign.id);
      expect(fetched?.configuration.participantCount).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should clear campaign service', () => {
      createCampaign({
        name: 'Test Campaign',
        description: 'Test',
        source: 'campaign',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      _clearCampaignService();
      expect(_getCampaignCount()).toBe(0);
      expect(_getActiveCampaignCount()).toBe(0);
    });
  });
});
