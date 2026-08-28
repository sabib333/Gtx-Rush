/**
 * Telegram Mini App SDK TypeScript Types
 *
 * Complete type definitions for the Telegram WebApp interface.
 * Source: https://core.telegram.org/bots/webapps
 */

export interface TelegramWebApp {
  /** Unique id for this Mini App session */
  initData: string;
  /** initData for the bot that opened the Mini App */
  initDataUnsafe: WebAppInitData;
  /** The version of the Bot API */
  version: string;
  /** The platform of the Telegram app */
  platform: string;
  /** True if the Mini App is expanded to its maximum height */
  isExpanded: boolean;
  /** Height of the visible area of the Mini App */
  height: number;
  /** Height of the visible area of the Mini App in stable state */
  stableHeight: number;
  /** Width of the visible area of the Mini App */
  width: number;
  /** Current color scheme: 'light' or 'dark' */
  colorScheme: 'light' | 'dark';
  /** Theme parameters */
  themeParams: ThemeParams;
  /** An object for controlling the Main Button */
  MainButton: MainButton;
  /** An object for controlling the Back Button */
  BackButton: BackButton;
  /** An object for controlling haptic feedback */
  HapticFeedback: HapticFeedback;
  /** An object for sending data to the bot */
  sendData: (data: string) => void;
  /** Opens a link in an external browser */
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  /** Opens a Telegram link */
  openTelegramLink: (url: string) => void;
  /** Opens the Telegram native link */
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  /** Ready signal */
  ready: () => void;
  /** Expand the Mini App */
  expand: () => void;
  /** Close the Mini App */
  close: () => void;
  /** Enable closing confirmation */
  enableClosingConfirmation: () => void;
  /** Disable closing confirmation */
  disableClosingConfirmation: () => void;
  /** Request write access for messages */
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  /** Request contact access */
  requestContact: (callback?: (shared: boolean) => void) => void;
  /** Switch to the Home screen */
  switchInlineQuery: (query: string, chat_types?: string[]) => void;
  /** Show a popup */
  showPopup: (params: PopupParams, callback?: (buttonId: string) => void) => void;
  /** Show an alert */
  showAlert: (message: string, callback?: () => void) => void;
  /** Show a confirm dialog */
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  /** Show a scan QR popup */
  showScanQrPopup: (params: { text?: string }, callback?: (data: string) => boolean) => void;
  /** Close scan QR popup */
  closeScanQrPopup: () => void;
  /** Read clipboard */
  readTextFromClipboard: (callback?: (data: string) => void) => void;
  /** Request access to write to gallery */
  requestWriteAccessToPhotos: (callback?: (granted: boolean) => void) => void;
}

export interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export interface WebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  setParams: (params: MainButtonParams) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface MainButtonParams {
  text?: string;
  color?: string;
  text_color?: string;
  is_active?: boolean;
  is_visible?: boolean;
}

export interface BackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

export interface PopupButton {
  id: string;
  type?: 'default' | 'ok' | 'cancel' | 'destructive';
  text?: string;
}

/**
 * Global window type augmentation for Telegram WebApp
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
