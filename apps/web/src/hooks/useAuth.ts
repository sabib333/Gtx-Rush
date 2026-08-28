/**
 * Authentication Hook
 *
 * Handles the full auth flow:
 * 1. Detect Telegram environment
 * 2. Send init data to backend
 * 3. Backend verifies signature
 * 4. Store JWT
 * 5. Provide auth state to app
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { telegram } from '@gtx-rush/telegram';
import { useTelegramContext } from '../telegram';

const AUTH_TOKEN_KEY = 'gtxr_auth_token';
const AUTH_USER_KEY = 'gtxr_auth_user';

interface AuthUser {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xpTotal: number;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: AuthUser | null;
  token: string | null;
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useAuth() {
  const { isTelegram, isBrowser, initData } = useTelegramContext();
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    token: null,
    error: null,
  });
  const initializedRef = useRef(false);

  // Load cached auth on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const cachedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const cachedUser = localStorage.getItem(AUTH_USER_KEY);

    if (cachedToken && cachedUser) {
      try {
        setState({
          status: 'authenticated',
          user: JSON.parse(cachedUser),
          token: cachedToken,
          error: null,
        });
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      }
    }
  }, []);

  // Authenticate with backend
  const authenticate = useCallback(async () => {
    // Browser dev mode — no Telegram
    if (isBrowser) {
      const devMock = import.meta.env.VITE_DEV_TELEGRAM_MOCK === 'true';
      if (!devMock) {
        setState({
          status: 'unauthenticated',
          user: null,
          token: null,
          error: null,
        });
        return;
      }
    }

    const initDataStr = initData ?? telegram.getInitData();
    if (!initDataStr && isTelegram) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Could not get Telegram init data',
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading' }));

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initDataStr ?? '' }),
      });

      const data = await response.json();

      if (!data.success) {
        setState({
          status: 'error',
          user: null,
          token: null,
          error: data.error?.message ?? 'Authentication failed',
        });
        return;
      }

      const { token, user } = data.data;

      // Store in localStorage
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

      setState({
        status: 'authenticated',
        user,
        token,
        error: null,
      });
    } catch (err) {
      setState({
        status: 'error',
        user: null,
        token: null,
        error: 'Network error. Please check your connection.',
      });
    }
  }, [initData, isBrowser, isTelegram]);

  // Auto-authenticate when init data is available
  useEffect(() => {
    if (state.status !== 'loading') return;
    if (isBrowser) {
      // In browser, check for dev mock
      const devMock = import.meta.env.VITE_DEV_TELEGRAM_MOCK === 'true';
      if (!devMock) {
        setState((prev) => ({ ...prev, status: 'unauthenticated' }));
        return;
      }
    }
    if (initData || isBrowser) {
      authenticate();
    }
  }, [initData, isBrowser, state.status, authenticate]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setState({
      status: 'unauthenticated',
      user: null,
      token: null,
      error: null,
    });
  }, []);

  // Retry authentication
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    authenticate();
  }, [authenticate]);

  // Get auth header for API calls
  const getAuthHeader = useCallback((): Record<string, string> => {
    if (state.token) {
      return { Authorization: `Bearer ${state.token}` };
    }
    return {};
  }, [state.token]);

  return {
    ...state,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    hasError: state.status === 'error',
    authenticate,
    logout,
    retry,
    getAuthHeader,
  };
}
