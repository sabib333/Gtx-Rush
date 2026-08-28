import type { GameInput } from '@gtx-rush/types';
import type { GameSessionData } from './types';

/**
 * Manages game session state.
 * In production, this interacts with the database via the API service layer.
 * This module provides the pure logic for session management.
 */

export class SessionManager {
  /**
   * Validate that a session can accept new inputs.
   */
  canAcceptInput(session: GameSessionData, config: { maxDurationMs: number; inputTimeoutMs: number }): string | null {
    if (session.status !== 'active') {
      return 'Session is not active';
    }

    const elapsed = Date.now() - session.startedAt.getTime();
    if (elapsed > config.maxDurationMs) {
      return 'Session has expired';
    }

    if (session.inputs.length > 0) {
      const lastInput = session.inputs[session.inputs.length - 1]!;
      const sinceLastInput = Date.now() - lastInput.timestamp;
      if (sinceLastInput > config.inputTimeoutMs) {
        return 'Input timeout exceeded';
      }
    }

    return null; // Valid
  }

  /**
   * Validate input sequence number.
   */
  validateSequence(inputs: GameInput[], newSequence: number): string | null {
    if (inputs.length === 0) {
      if (newSequence !== 0) {
        return 'First input must have sequence 0';
      }
      return null;
    }

    const lastInput = inputs[inputs.length - 1]!;
    if (newSequence !== lastInput.sequence + 1) {
      return `Invalid sequence: expected ${lastInput.sequence + 1}, got ${newSequence}`;
    }

    return null; // Valid
  }

  /**
   * Check for duplicate inputs.
   */
  isDuplicateInput(inputs: GameInput[], newInput: GameInput): boolean {
    return inputs.some(
      (i) => i.sequence === newInput.sequence && i.type === newInput.type
    );
  }
}

export const sessionManager = new SessionManager();
