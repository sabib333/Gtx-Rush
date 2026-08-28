/**
 * Quiz Rush — Review Screen
 *
 * Post-game answer review. Shows each question with:
 * - The question
 * - Their answer
 * - The correct answer
 * - Explanation
 */

import type { AnsweredQuestion } from './types';

interface ReviewScreenProps {
  answers: AnsweredQuestion[];
  onBack: () => void;
  onPlayAgain: () => void;
}

export function ReviewScreen({ answers, onBack, onPlayAgain }: ReviewScreenProps) {
  return (
    <div className="min-h-dvh bg-surface-base flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-base/95 backdrop-blur-sm border-b border-surface-elevated">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="text-body text-txt-secondary">
            ← Back
          </button>
          <h1 className="text-body font-bold text-white">Answer Review</h1>
          <button onClick={onPlayAgain} className="text-body text-accent-400">
            Play Again
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {answers.map((answer, index) => (
          <div
            key={answer.questionId}
            className={`p-4 rounded-xl border ${
              answer.correct
                ? 'border-green-500/30 bg-green-500/5'
                : answer.selectedOptionId === null
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            {/* Question number and status */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-caption font-bold text-txt-tertiary">
                Q{index + 1}
              </span>
              <span className={`text-caption-xs px-2 py-0.5 rounded-full ${
                answer.difficulty === 'easy'
                  ? 'text-green-400 bg-green-500/10'
                  : answer.difficulty === 'medium'
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-red-400 bg-red-500/10'
              }`}>
                {answer.difficulty.toUpperCase()}
              </span>
              <span className="ml-auto">
                {answer.correct ? '✅' : answer.selectedOptionId === null ? '⏰' : '❌'}
              </span>
            </div>

            {/* Question text */}
            <p className="text-body font-medium text-white mb-3">
              {answer.question}
            </p>

            {/* Options */}
            <div className="space-y-2 mb-3">
              {answer.options.map((option) => {
                const isCorrect = option.id === answer.correctOptionId;
                const isSelected = option.id === answer.selectedOptionId;

                let style = 'bg-surface-raised text-txt-secondary';
                if (isCorrect) style = 'bg-green-500/20 text-green-400 border border-green-500/30';
                if (isSelected && !answer.correct) style = 'bg-red-500/20 text-red-400 border border-red-500/30';
                if (isSelected && answer.correct) style = 'bg-green-500/20 text-green-400 border border-green-500/30';

                return (
                  <div
                    key={option.id}
                    className={`px-3 py-2 rounded-lg text-caption ${style}`}
                  >
                    {option.text}
                    {isCorrect && <span className="ml-2">✓</span>}
                    {isSelected && !isCorrect && <span className="ml-2">✗</span>}
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            {answer.explanation && (
              <div className="bg-surface-elevated/50 rounded-lg p-3">
                <p className="text-caption text-txt-secondary leading-relaxed">
                  💡 {answer.explanation}
                </p>
              </div>
            )}

            {/* Time */}
            <div className="mt-2 text-caption-xs text-txt-tertiary">
              Answered in {(answer.timeToAnswerMs / 1000).toFixed(1)}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
