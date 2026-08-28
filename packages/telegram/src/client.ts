/**
 * Telegram Mini App Client
 *
 * Centralized wrapper around the Telegram WebApp SDK.
 * All Telegram-specific API access goes through this module.
 * Never access window.Telegram.WebApp directly from components.
 */

import type {
  TelegramWebApp,
  ThemeParams,
  WebAppUser,
  HapticFeedback,
} from './client-types';

class TelegramClient {
  private _app: TelegramWebApp | null = null;
  private _initialized = false;

  /**
   * Get the raw Telegram WebApp instance.
   * Returns null if not running inside Telegram.
   */
  get app(): TelegramWebApp | null {
    if (this._app) return this._app;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      this._app = window.Telegram.WebApp;
      return this._app;
    }
    return null;
  }

  /**
   * Whether the app is running inside Telegram.
   */
  get isTelegram(): boolean {
    return this.app !== null;
  }

  /**
   * Whether the app is running in a browser (not Telegram).
   */
  get isBrowser(): boolean {
    return !this.isTelegram;
  }

  /**
   * Initialize the Telegram Mini App.
   * Call this once at app startup.
   */
  initialize(): void {
    if (this._initialized) return;

    const app = this.app;
    if (app) {
      app.ready();
      app.expand();
      this._initialized = true;
    }
  }

  /**
   * Get the init data string for backend verification.
   * Returns null if not in Telegram.
   */
  getInitData(): string | null {
    return this.app?.initData ?? null;
  }

  /**
   * Get the parsed init data (unsafe — must be verified server-side).
   */
  getInitDataUnsafe() {
    return this.app?.initDataUnsafe ?? null;
  }

  /**
   * Get the current Telegram user.
   * WARNING: This is unverified client-side data.
   */
  getTelegramUser(): WebAppUser | null {
    return this.app?.initDataUnsafe?.user ?? null;
  }

  /**
   * Get the start parameter from the deep link.
   */
  getStartParam(): string | null {
    return this.app?.initDataUnsafe?.start_param ?? null;
  }

  // ============================================================
  // Theme
  // ============================================================

  get colorScheme(): 'light' | 'dark' {
    return this.app?.colorScheme ?? 'dark';
  }

  get themeParams(): ThemeParams {
    return this.app?.themeParams ?? {};
  }

  // ============================================================
  // Viewport
  // ============================================================

  get viewportHeight(): number {
    return this.app?.height ?? window.innerHeight;
  }

  get viewportWidth(): number {
    return this.app?.width ?? window.innerWidth;
  }

  get isExpanded(): boolean {
    return this.app?.isExpanded ?? false;
  }

  expand(): void {
    this.app?.expand();
  }

  close(): void {
    this.app?.close();
  }

  enableClosingConfirmation(): void {
    this.app?.enableClosingConfirmation();
  }

  disableClosingConfirmation(): void {
    this.app?.disableClosingConfirmation();
  }

  // ============================================================
  // Main Button
  // ============================================================

  get mainButton() {
    return this.app?.MainButton;
  }

  showMainButton(text: string, onClick: () => void): void {
    const btn = this.app?.MainButton;
    if (!btn) return;
    btn.setText(text);
    btn.show();
    btn.enable();
    btn.onClick(onClick);
  }

  hideMainButton(): void {
    const btn = this.app?.MainButton;
    if (!btn) return;
    btn.hide();
    btn.offClick(() => {});
  }

  setMainButtonLoading(loading: boolean): void {
    const btn = this.app?.MainButton;
    if (!btn) return;
    if (loading) {
      btn.showProgress();
    } else {
      btn.hideProgress();
    }
  }

  // ============================================================
  // Back Button
  // ============================================================

  get backButton() {
    return this.app?.BackButton;
  }

  showBackButton(onClick: () => void): void {
    const btn = this.app?.BackButton;
    if (!btn) return;
    btn.show();
    btn.onClick(onClick);
  }

  hideBackButton(): void {
    const btn = this.app?.BackButton;
    if (!btn) return;
    btn.hide();
    btn.offClick(() => {});
  }

  // ============================================================
  // Haptic Feedback
  // ============================================================

  get haptics(): HapticFeedback | null {
    return this.app?.HapticFeedback ?? null;
  }

  hapticLight(): void {
    this.haptics?.impactOccurred('light');
  }

  hapticMedium(): void {
    this.haptics?.impactOccurred('medium');
  }

  hapticHeavy(): void {
    this.haptics?.impactOccurred('heavy');
  }

  hapticSuccess(): void {
    this.haptics?.notificationOccurred('success');
  }

  hapticError(): void {
    this.haptics?.notificationOccurred('error');
  }

  hapticWarning(): void {
    this.haptics?.notificationOccurred('warning');
  }

  hapticSelection(): void {
    this.haptics?.selectionChanged();
  }

  // ============================================================
  // Sharing
  // ============================================================

  shareScore(gameName: string, score: number): void {
    const text = `⚡ I scored ${score.toLocaleString()} in ${gameName} on GTX Rush! Can you beat me? 🏆`;
    this.app?.openTelegramLink(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`);
  }

  shareChallenge(challengeLink: string): void {
    this.app?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(challengeLink)}&text=${encodeURIComponent('⚔️ Challenge me on GTX Rush!')}`);
  }

  openLink(url: string): void {
    this.app?.openLink(url);
  }

  // ============================================================
  // Popup / Dialogs
  // ============================================================

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.app) {
        this.app.showAlert(message, () => resolve());
      } else {
        window.alert(message);
        resolve();
      }
    });
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.app) {
        this.app.showConfirm(message, (confirmed) => resolve(confirmed));
      } else {
        resolve(window.confirm(message));
      }
    });
  }

  // ============================================================
  // Clipboard
  // ============================================================

  readClipboard(): Promise<string> {
    return new Promise((resolve) => {
      if (this.app) {
        this.app.readTextFromClipboard((data) => resolve(data));
      } else {
        resolve('');
      }
    });
  }

  copyToClipboard(text: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }
}

/** Singleton Telegram client */
export const telegram = new TelegramClient();
