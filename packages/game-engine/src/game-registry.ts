import type { GameEngine } from './types';

/**
 * Global game registry.
 * Games register themselves here on import.
 * The API and web app both use this to discover available games.
 */
class GameRegistry {
  private games = new Map<string, GameEngine>();

  register(engine: GameEngine): void {
    if (this.games.has(engine.gameId)) {
      throw new Error(`Game "${engine.gameId}" is already registered`);
    }
    this.games.set(engine.gameId, engine);
  }

  get(gameId: string): GameEngine | undefined {
    return this.games.get(gameId);
  }

  getAll(): GameEngine[] {
    return Array.from(this.games.values());
  }

  has(gameId: string): boolean {
    return this.games.has(gameId);
  }
}

/** Singleton registry instance */
export const gameRegistry = new GameRegistry();
