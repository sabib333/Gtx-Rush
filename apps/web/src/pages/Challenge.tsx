import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Avatar, ScoreCard, Badge } from '@gtx-rush/ui';

type ChallengeState = 'received' | 'playing' | 'result';

export function Challenge() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ChallengeState>('received');
  const [myScore, setMyScore] = useState(0);

  const opponentName = 'Karim';
  const opponentScore = 9420;
  const gameName = 'Reaction Rush';

  const handleAccept = useCallback(() => {
    setState('playing');
    // Simulate game
    setTimeout(() => {
      setMyScore(Math.floor(Math.random() * 10000) + 1000);
      setState('result');
    }, 3000);
  }, []);

  const handleRematch = useCallback(() => {
    setState('received');
    setMyScore(0);
  }, []);

  const iWon = myScore > opponentScore;

  // Challenge received
  if (state === 'received') {
    return (
      <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6">
        <div className="text-center animate-bounce-in">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-display font-display text-white mb-2">Challenge</h1>
          <p className="text-body-sm text-txt-secondary mb-6">{gameName}</p>
        </div>

        <Card glow className="w-full max-w-sm mb-6 animate-slide-up">
          <div className="text-center py-4">
            <Avatar name={opponentName} size="lg" className="mx-auto mb-3" />
            <p className="text-body text-txt-secondary mb-1">{opponentName} scored</p>
            <div className="text-score-lg font-score text-white tabular-nums mb-4">
              {opponentScore.toLocaleString()}
            </div>
            <p className="text-body-sm text-txt-tertiary">Can you beat him?</p>
          </div>
        </Card>

        <Button variant="primary" size="lg" onClick={handleAccept} className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '100ms' }}>
          ⚔️ Accept Challenge
        </Button>
      </div>
    );
  }

  // Playing
  if (state === 'playing') {
    return (
      <div className="min-h-dvh bg-surface-base flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-4">⚔️</div>
          <p className="text-body text-txt-secondary">Challenge in progress...</p>
        </div>
      </div>
    );
  }

  // Result
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6">
      {/* Result header */}
      <div className="text-center mb-8 animate-bounce-in">
        <div className="text-5xl mb-3">{iWon ? '🏆' : '⚔️'}</div>
        <h1 className="text-display font-display text-white">
          {iWon ? 'You Won!' : 'You Lost'}
        </h1>
      </div>

      {/* Scores comparison */}
      <Card glow className="w-full max-w-sm mb-8 animate-slide-up">
        <div className="flex items-center justify-between py-2">
          <div className="text-center flex-1">
            <div className="text-caption text-txt-secondary mb-1">You</div>
            <div className={`text-score font-score tabular-nums ${iWon ? 'text-success-400' : 'text-txt-primary'}`}>
              {myScore.toLocaleString()}
            </div>
          </div>
          <div className="text-txt-tertiary text-lg font-bold px-4">vs</div>
          <div className="text-center flex-1">
            <div className="text-caption text-txt-secondary mb-1">{opponentName}</div>
            <div className={`text-score font-score tabular-nums ${!iWon ? 'text-success-400' : 'text-txt-primary'}`}>
              {opponentScore.toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      {/* XP */}
      <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <Badge variant="energy" size="md">⚡ +{Math.floor(myScore / 100)} XP</Badge>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <Button variant="primary" fullWidth onClick={handleRematch}>
          🔄 Rematch
        </Button>
        <Button variant="secondary" fullWidth onClick={() => {}}>
          📤 Share Result
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
          ← Back Home
        </Button>
      </div>
    </div>
  );
}
