/**
 * Telegram Context Provider
 *
 * Provides Telegram environment data to the entire app.
 * Handles initialization, auth state, and environment detection.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { telegram, type WebAppUser, type ThemeParams } from '@gtx-rush/telegram';

export interface TelegramContextValue {
  /** Whether running inside Telegram */
  isTelegram: boolean;
  /** Whether running in browser (not Telegram) */
  isBrowser: boolean;
  /** Current Telegram user (unverified client-side) */
  telegramUser: WebAppUser | null;
  /** Init data string for backend verification */
  initData: string | null;
  /** Start parameter from deep link */
  startParam: string | null;
  /** Current color scheme */
  colorScheme: 'light' | 'dark';
  /** Theme parameters */
  themeParams: ThemeParams;
  /** Viewport height */
  viewportHeight: number;
  /** Viewport width */
  viewportWidth: number;
  /** Whether the Mini App is expanded */
  isExpanded: boolean;
  /** Initialize the Telegram environment */
  initialize: () => void;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    isTelegram: telegram.isTelegram,
    telegramUser: telegram.getTelegramUser(),
    initData: telegram.getInitData(),
    startParam: telegram.getStartParam(),
    colorScheme: telegram.colorScheme,
    themeParams: telegram.themeParams,
    viewportHeight: telegram.viewportHeight,
    viewportWidth: telegram.viewportWidth,
    isExpanded: telegram.isExpanded,
  });

  const initialize = useCallback(() => {
    telegram.initialize();
    setState({
      isTelegram: telegram.isTelegram,
      telegramUser: telegram.getTelegramUser(),
      initData: telegram.getInitData(),
      startParam: telegram.getStartParam(),
      colorScheme: telegram.colorScheme,
      themeParams: telegram.themeParams,
      viewportHeight: telegram.viewportHeight,
      viewportWidth: telegram.viewportWidth,
      isExpanded: telegram.isExpanded,
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for viewport changes
  useEffect(() => {
    if (!telegram.isTelegram) return;

    const handleResize = () => {
      setState((prev) => ({
        ...prev,
        viewportHeight: telegram.viewportHeight,
        viewportWidth: telegram.viewportWidth,
        isExpanded: telegram.isExpanded,
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const value: TelegramContextValue = {
    ...state,
    isBrowser: !state.isTelegram,
    initialize,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

/**
 * Hook to access Telegram context.
 * Must be used inside TelegramProvider.
 */
export function useTelegramContext(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error('useTelegramContext must be used inside TelegramProvider');
  }
  return ctx;
}
