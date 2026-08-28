/**
 * Telegram Hooks
 *
 * Convenience hooks for accessing Telegram functionality.
 * All Telegram-specific behavior goes through these hooks.
 */

import { useEffect, useCallback, useRef } from 'react';
import { telegram } from '@gtx-rush/telegram';
import { useTelegramContext } from './context';

/**
 * Access the Telegram environment.
 */
export function useTelegram() {
  return useTelegramContext();
}

/**
 * Manage the Telegram Back Button.
 * Automatically shows/hides based on condition.
 *
 * @param onClick - Callback when back button is pressed
 * @param show - Whether to show the back button (default: true)
 */
export function useBackButton(onClick: () => void, show: boolean = true) {
  useEffect(() => {
    if (!telegram.isTelegram || !show) {
      telegram.hideBackButton();
      return;
    }

    telegram.showBackButton(onClick);
    return () => {
      telegram.hideBackButton();
    };
  }, [onClick, show]);
}

/**
 * Manage the Telegram Main Button.
 */
export function useMainButton(
  text: string,
  onClick: () => void,
  options: {
    show?: boolean;
    enabled?: boolean;
    loading?: boolean;
    color?: string;
    textColor?: string;
  } = {}
) {
  const { show = true, enabled = true, loading = false } = options;
  const callbackRef = useRef(onClick);
  callbackRef.current = onClick;

  useEffect(() => {
    if (!telegram.isTelegram || !show) {
      telegram.hideMainButton();
      return;
    }

    const btn = telegram.mainButton;
    if (!btn) return;

    btn.setText(text);
    btn.onClick(callbackRef.current);

    if (enabled) {
      btn.enable();
    } else {
      btn.disable();
    }

    if (loading) {
      btn.showProgress();
    } else {
      btn.hideProgress();
    }

    btn.show();

    return () => {
      btn.hide();
      btn.offClick(callbackRef.current);
    };
  }, [text, show, enabled, loading]);
}

/**
 * Haptic feedback hook.
 */
export function useHaptic() {
  return {
    light: useCallback(() => telegram.hapticLight(), []),
    medium: useCallback(() => telegram.hapticMedium(), []),
    heavy: useCallback(() => telegram.hapticHeavy(), []),
    success: useCallback(() => telegram.hapticSuccess(), []),
    error: useCallback(() => telegram.hapticError(), []),
    warning: useCallback(() => telegram.hapticWarning(), []),
    selection: useCallback(() => telegram.hapticSelection(), []),
  };
}

/**
 * Viewport hook — responsive to Telegram viewport changes.
 */
export function useViewport() {
  const { viewportHeight, viewportWidth, isExpanded } = useTelegramContext();

  return {
    height: viewportHeight,
    width: viewportWidth,
    isExpanded,
    isMobile: viewportWidth < 400,
    isTablet: viewportWidth >= 400 && viewportWidth < 768,
  };
}

/**
 * Theme hook — access Telegram theme parameters.
 */
export function useTheme() {
  const { colorScheme, themeParams } = useTelegramContext();

  return {
    colorScheme,
    themeParams,
    isDark: colorScheme === 'dark',
    isLight: colorScheme === 'light',
    // Map Telegram theme to CSS custom properties
    cssVars: {
      '--tg-bg-color': themeParams.bg_color,
      '--tg-text-color': themeParams.text_color,
      '--tg-hint-color': themeParams.hint_color,
      '--tg-link-color': themeParams.link_color,
      '--tg-button-color': themeParams.button_color,
      '--tg-button-text-color': themeParams.button_text_color,
      '--tg-secondary-bg-color': themeParams.secondary_bg_color,
    } as React.CSSProperties,
  };
}

/**
 * Share hook — Telegram sharing functionality.
 */
export function useShare() {
  return {
    score: useCallback((gameName: string, score: number) => {
      telegram.shareScore(gameName, score);
    }, []),
    challenge: useCallback((link: string) => {
      telegram.shareChallenge(link);
    }, []),
    link: useCallback((url: string) => {
      telegram.openLink(url);
    }, []),
    clipboard: useCallback(async (text: string): Promise<boolean> => {
      try {
        telegram.copyToClipboard(text);
        return true;
      } catch {
        return false;
      }
    }, []),
  };
}

/**
 * Dialog hook — Telegram popups and alerts.
 */
export function useDialog() {
  return {
    alert: useCallback((message: string) => telegram.showAlert(message), []),
    confirm: useCallback((message: string) => telegram.showConfirm(message), []),
  };
}

/**
 * Closing confirmation hook.
 * Warns user before accidentally closing the Mini App.
 */
export function useClosingConfirmation(enabled: boolean = true) {
  useEffect(() => {
    if (!telegram.isTelegram || !enabled) {
      telegram.disableClosingConfirmation();
      return;
    }

    telegram.enableClosingConfirmation();
    return () => {
      telegram.disableClosingConfirmation();
    };
  }, [enabled]);
}
