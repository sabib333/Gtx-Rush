/**
 * User State Hook
 *
 * Manages user data from the authenticated session.
 * Provides user info and update methods.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface User {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  totalScore: number;
  avatarUrl: string | null;
  country: string | null;
}

const defaultUser: User = {
  id: '',
  telegramId: 0,
  username: '',
  displayName: 'Player',
  level: 1,
  xpTotal: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalGamesPlayed: 0,
  totalScore: 0,
  avatarUrl: null,
  country: null,
};

export function useUser() {
  const { user: authUser, token, isAuthenticated, getAuthHeader } = useAuth();
  const [user, setUser] = useState<User>(defaultUser);
  const [loading, setLoading] = useState(false);

  // Sync user from auth state
  useEffect(() => {
    if (authUser) {
      setUser((prev) => ({
        ...prev,
        ...authUser,
      }));
    }
  }, [authUser]);

  // Fetch full user profile
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/auth/me', {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setUser((prev) => ({
          ...prev,
          ...data.data,
        }));
      }
    } catch {
      // Silently fail — use cached data
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAuthHeader]);

  // Fetch profile on auth
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    user,
    loading,
    updateUser,
    fetchProfile,
    isAuthenticated,
  };
}
