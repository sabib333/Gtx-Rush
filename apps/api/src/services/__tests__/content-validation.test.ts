import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateContent,
  sanitizeText,
  submitReport,
  getContentReports,
  isCreatorLimited,
  _clearAllValidationData,
} from '../content-validation';

describe('ContentValidation', () => {
  beforeEach(() => {
    _clearAllValidationData();
  });

  describe('Content Validation', () => {
    it('should validate valid content', () => {
      const result = validateContent(
        {
          title: 'Can You Beat Me?',
          description: 'Try to beat my score!',
          type: 'challenge',
        },
        'creator-1',
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const result = validateContent(
        {
          title: '',
          type: 'challenge',
        },
        'creator-1',
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject malicious content', () => {
      const result = validateContent(
        {
          title: '<script>alert("xss")</script>',
          type: 'challenge',
        },
        'creator-1',
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('malicious'))).toBe(true);
    });
  });

  describe('Text Sanitization', () => {
    it('should remove HTML tags', () => {
      const sanitized = sanitizeText('<b>Bold text</b>');
      expect(sanitized).toBe('Bold text');
    });

    it('should remove JavaScript', () => {
      const sanitized = sanitizeText('javascript:alert("xss")');
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const sanitized = sanitizeText('onclick=alert("xss")');
      expect(sanitized).not.toContain('onclick=');
    });

    it('should trim whitespace', () => {
      const sanitized = sanitizeText('  Hello World  ');
      expect(sanitized).toBe('Hello World');
    });
  });

  describe('Reporting System', () => {
    it('should submit a report', () => {
      const result = submitReport(
        'user-1',
        'challenge',
        'challenge-1',
        'spam',
        'This challenge is spam',
      );

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
    });

    it('should prevent duplicate reports', () => {
      submitReport('user-1', 'challenge', 'challenge-1', 'spam');
      const result = submitReport('user-1', 'challenge', 'challenge-1', 'spam');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_REPORTED');
    });

    it('should get reports for content', () => {
      submitReport('user-1', 'challenge', 'challenge-1', 'spam');
      submitReport('user-2', 'challenge', 'challenge-1', 'harassment');

      const reports = getContentReports('challenge-1');
      expect(reports).toHaveLength(2);
    });
  });

  describe('Moderation', () => {
    it('should detect limited creators', () => {
      // Initially not limited
      expect(isCreatorLimited('creator-1')).toBe(false);
    });
  });
});
