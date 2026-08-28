/**
 * GTX Rush App Root
 *
 * Handles:
 * - Telegram initialization
 * - Authentication loading/failure states
 * - Route rendering
 * - Browser fallback
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TelegramProvider, useTelegramContext } from './telegram';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { Home } from './pages/Home';
import { Games } from './pages/Games';
import { Leaderboard } from './pages/Leaderboard';
import { Rewards } from './pages/Rewards';
import { Profile } from './pages/Profile';
import { GamePlay } from './pages/GamePlay';
import { Challenge } from './pages/Challenge';
import { LoadingSpinner } from '@gtx-rush/ui';

// ============================================================
// Auth Loading Screen
// ============================================================

function AuthLoadingScreen() {
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6">
      <div className="text-center animate-fade-in">
        <div className="text-5xl mb-4">⚡</div>
        <h1 className="text-display font-display text-white mb-2">GTX Rush</h1>
        <p className="text-body-sm text-txt-secondary mb-8">Play. Compete. Rise.</p>
        <LoadingSpinner size="md" />
        <p className="text-caption text-txt-tertiary mt-4">Connecting...</p>
      </div>
    </div>
  );
}

// ============================================================
// Auth Failure Screen
// ============================================================

function AuthFailureScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6">
      <div className="text-center animate-fade-in">
        <div className="text-5xl mb-4">😵</div>
        <h1 className="text-h1 font-display text-white mb-2">Connection Error</h1>
        <p className="text-body-sm text-txt-secondary mb-2">
          Unable to connect to Telegram.
        </p>
        <p className="text-caption text-txt-tertiary mb-6">
          Please reopen GTX Rush from Telegram.
        </p>
        {error && (
          <p className="text-caption-xs text-danger-400 mb-4">{error}</p>
        )}
        <button onClick={onRetry} className="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Browser Fallback Screen
// ============================================================

function BrowserFallbackScreen() {
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6">
      <div className="text-center animate-fade-in">
        <div className="text-5xl mb-4">⚡</div>
        <h1 className="text-display font-display text-white mb-2">GTX Rush</h1>
        <p className="text-body-sm text-txt-secondary mb-6">
          GTX Rush is designed for Telegram.
        </p>
        <p className="text-caption text-txt-tertiary">
          Open GTX Rush in Telegram to continue.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Main App (inside providers)
// ============================================================

function AppContent() {
  const { isBrowser } = useTelegramContext();
  const auth = useAuth();

  // Browser fallback (unless dev mock is enabled)
  const devMock = import.meta.env.VITE_DEV_TELEGRAM_MOCK === 'true';
  if (isBrowser && !devMock) {
    return <BrowserFallbackScreen />;
  }

  // Loading state
  if (auth.isLoading) {
    return <AuthLoadingScreen />;
  }

  // Error state
  if (auth.hasError) {
    return <AuthFailureScreen error={auth.error ?? ''} onRetry={auth.retry} />;
  }

  // Not authenticated
  if (!auth.isAuthenticated) {
    return <AuthFailureScreen error="Please open GTX Rush from Telegram." onRetry={auth.retry} />;
  }

  // Authenticated — render app
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col">
      <Header
        displayName={auth.user?.displayName ?? 'Player'}
        level={auth.user?.level ?? 1}
        avatarUrl={auth.user?.avatarUrl}
        onProfileClick={() => {}}
      />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:gameSlug" element={<GamePlay />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/challenge/:token" element={<Challenge />} />
        </Routes>
      </main>
      <Navigation />
    </div>
  );
}

// ============================================================
// Root App with Providers
// ============================================================

export function App() {
  return (
    <BrowserRouter>
      <TelegramProvider>
        <AppContent />
      </TelegramProvider>
    </BrowserRouter>
  );
}
