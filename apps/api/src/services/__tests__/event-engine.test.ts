/**
 * GTX Rush — Event Engine Tests
 *
 * Tests for:
 * - Event creation
 * - Event lifecycle
 * - Event participation
 * - Event attempts
 * - Event leaderboard
 * - Event history
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEvent,
  updateEventStatus,
  getEvent,
  getAllEvents,
  getActiveEvents,
  getUpcomingEvents,
  getLiveEvents,
  joinEvent,
  getParticipant,
  getEventParticipants,
  submitEventAttempt,
  getEventLeaderboard,
  getUserEventHistory,
  checkEventStatuses,
  _clearEventEngine,
  _getEventCount,
  _getActiveEventCount,
  _getParticipantCount,
} from '../event-engine';

describe('Event Engine', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';

  beforeEach(() => {
    _clearEventEngine();
  });

  describe('Event Creation', () => {
    it('should create an event', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'A test event',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      });

      expect(event).toBeDefined();
      expect(event.name).toBe('Test Event');
      expect(event.type).toBe('daily_event');
      expect(event.status).toBe('draft');
    });

    it('should generate unique event IDs', () => {
      const event1 = createEvent({
        name: 'Event 1',
        description: 'First event',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const event2 = createEvent({
        name: 'Event 2',
        description: 'Second event',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      expect(event1.id).not.toBe(event2.id);
    });
  });

  describe('Event Lifecycle', () => {
    it('should update event status', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const updated = updateEventStatus(event.id, 'active');
      expect(updated).toBe(true);

      const fetched = getEvent(event.id);
      expect(fetched?.status).toBe('active');
    });

    it('should return false for non-existent event', () => {
      const updated = updateEventStatus('non-existent', 'active');
      expect(updated).toBe(false);
    });

    it('should check event statuses based on time', () => {
      createEvent({
        name: 'Past Event',
        description: 'Already started',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const updated = checkEventStatuses();
      expect(updated).toBeGreaterThan(0);
    });
  });

  describe('Event Queries', () => {
    it('should get event by ID', () => {
      const created = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const fetched = getEvent(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('Test Event');
    });

    it('should return null for non-existent event', () => {
      const fetched = getEvent('non-existent');
      expect(fetched).toBeNull();
    });

    it('should get all events', () => {
      createEvent({
        name: 'Event 1',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      createEvent({
        name: 'Event 2',
        description: 'Test',
        type: 'weekly_event',
        gameId: 'tap-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });

      const all = getAllEvents();
      expect(all.length).toBe(2);
    });

    it('should get active events', () => {
      const event = createEvent({
        name: 'Active Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      const active = getActiveEvents();
      expect(active.length).toBe(1);
      expect(active[0].name).toBe('Active Event');
    });

    it('should get upcoming events', () => {
      createEvent({
        name: 'Upcoming Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
      });

      const upcoming = getUpcomingEvents();
      expect(upcoming.length).toBe(1);
    });

    it('should get live events for discovery', () => {
      const event = createEvent({
        name: 'Live Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      const live = getLiveEvents();
      expect(live.live.length).toBe(1);
    });
  });

  describe('Event Participation', () => {
    it('should join an event', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      const result = joinEvent(event.id, testUserId);
      expect(result.success).toBe(true);
      expect(result.participant).toBeDefined();
    });

    it('should not join non-active event', () => {
      const event = createEvent({
        name: 'Draft Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = joinEvent(event.id, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('EVENT_NOT_AVAILABLE');
    });

    it('should not join same event twice', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      joinEvent(event.id, testUserId);
      const result = joinEvent(event.id, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_JOINED');
    });

    it('should get participant info', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      joinEvent(event.id, testUserId);
      const participant = getParticipant(event.id, testUserId);
      expect(participant).toBeDefined();
      expect(participant?.userId).toBe(testUserId);
    });

    it('should get event participants', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      joinEvent(event.id, testUserId);
      joinEvent(event.id, testUserId2);

      const participants = getEventParticipants(event.id);
      expect(participants.length).toBe(2);
    });
  });

  describe('Event Attempts', () => {
    it('should submit an event attempt', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');
      joinEvent(event.id, testUserId);

      const result = submitEventAttempt(event.id, testUserId, 'session-1', 9842);
      expect(result.success).toBe(true);
      expect(result.eventScore).toBe(9842);
    });

    it('should not submit to non-active event', () => {
      const event = createEvent({
        name: 'Draft Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() + 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      const result = submitEventAttempt(event.id, testUserId, 'session-1', 9842);
      expect(result.success).toBe(false);
      expect(result.error).toBe('EVENT_NOT_ACTIVE');
    });

    it('should not submit if not participant', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      const result = submitEventAttempt(event.id, testUserId, 'session-1', 9842);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_PARTICIPANT');
    });

    it('should update best score', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');
      joinEvent(event.id, testUserId);

      submitEventAttempt(event.id, testUserId, 'session-1', 5000);
      submitEventAttempt(event.id, testUserId, 'session-2', 9842);

      const participant = getParticipant(event.id, testUserId);
      expect(participant?.bestScore).toBe(9842);
    });
  });

  describe('Event Leaderboard', () => {
    it('should get event leaderboard', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      joinEvent(event.id, testUserId);
      joinEvent(event.id, testUserId2);

      submitEventAttempt(event.id, testUserId, 'session-1', 5000);
      submitEventAttempt(event.id, testUserId2, 'session-2', 9842);

      const leaderboard = getEventLeaderboard(event.id);
      expect(leaderboard.entries.length).toBe(2);
      expect(leaderboard.entries[0].eventScore).toBe(9842); // Higher score first
    });

    it('should find current user in leaderboard', () => {
      const event = createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      updateEventStatus(event.id, 'active');

      joinEvent(event.id, testUserId);
      submitEventAttempt(event.id, testUserId, 'session-1', 9842);

      const leaderboard = getEventLeaderboard(event.id, { currentUserId: testUserId });
      expect(leaderboard.userEntry).toBeDefined();
      expect(leaderboard.userEntry?.userId).toBe(testUserId);
    });
  });

  describe('Event History', () => {
    it('should get user event history', () => {
      const event = createEvent({
        name: 'Completed Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        endsAt: new Date(Date.now() - 1000 * 60 * 60),
      });
      updateEventStatus(event.id, 'completed');

      joinEvent(event.id, testUserId);
      submitEventAttempt(event.id, testUserId, 'session-1', 9842);

      const history = getUserEventHistory(testUserId);
      expect(history.entries.length).toBe(1);
      expect(history.entries[0].eventName).toBe('Completed Event');
    });
  });

  describe('Cleanup', () => {
    it('should clear event engine', () => {
      createEvent({
        name: 'Test Event',
        description: 'Test',
        type: 'daily_event',
        gameId: 'reaction-rush',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      _clearEventEngine();
      expect(_getEventCount()).toBe(0);
      expect(_getActiveEventCount()).toBe(0);
    });
  });
});
