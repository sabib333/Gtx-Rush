/**
 * Quiz Rush — API Routes
 *
 * Handles:
 * - Session creation with server-selected questions (POST /api/games/quiz-rush/session)
 * - Answer submission with server validation (POST /api/games/quiz-rush/session/:sessionId/answer)
 * - Session completion (POST /api/games/quiz-rush/session/:sessionId/complete)
 * - Game stats (GET /api/games/quiz-rush/stats)
 * - Game leaderboard (GET /api/games/quiz-rush/leaderboard)
 *
 * SECURITY: Correct answers are NEVER sent to the client before the user answers.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import {
  QUIZ_RUSH_CONFIG,
  QUIZ_RUSH_VERSION,
  calculateAnswerScore,
  calculateServerScore,
  validateInputSequence,
  toPublicQuestion,
  shuffleArray,
  type Question,
  type PublicQuestion,
  type InputEvent,
  type AnswerResult,
  type AnsweredQuestion,
} from '@gtx-rush/game-quiz-rush';

// ── In-memory question bank (replace with DB in production) ───────────

const QUESTION_BANK: Question[] = [
  // ── General Knowledge ──────────────────────────────────
  {
    id: 'gk-001', version: 1, category: 'general', difficulty: 'easy',
    question: 'What is the capital of France?',
    options: [
      { id: 'a', text: 'London' },
      { id: 'b', text: 'Berlin' },
      { id: 'c', text: 'Paris' },
      { id: 'd', text: 'Madrid' },
    ],
    correctOptionId: 'c', explanation: 'Paris has been the capital of France since the 10th century.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'gk-002', version: 1, category: 'general', difficulty: 'easy',
    question: 'How many continents are there on Earth?',
    options: [
      { id: 'a', text: '5' },
      { id: 'b', text: '6' },
      { id: 'c', text: '7' },
      { id: 'd', text: '8' },
    ],
    correctOptionId: 'c', explanation: 'The seven continents are Africa, Antarctica, Asia, Australia, Europe, North America, and South America.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'gk-003', version: 1, category: 'general', difficulty: 'medium',
    question: 'Which element has the chemical symbol "Au"?',
    options: [
      { id: 'a', text: 'Silver' },
      { id: 'b', text: 'Gold' },
      { id: 'c', text: 'Aluminum' },
      { id: 'd', text: 'Argon' },
    ],
    correctOptionId: 'b', explanation: '"Au" comes from the Latin word "aurum" meaning gold.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Science ───────────────────────────────────────────
  {
    id: 'sci-001', version: 1, category: 'science', difficulty: 'easy',
    question: 'What planet is known as the Red Planet?',
    options: [
      { id: 'a', text: 'Venus' },
      { id: 'b', text: 'Mars' },
      { id: 'c', text: 'Jupiter' },
      { id: 'd', text: 'Saturn' },
    ],
    correctOptionId: 'b', explanation: 'Mars appears reddish because iron minerals on its surface oxidize (rust).',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'sci-002', version: 1, category: 'science', difficulty: 'medium',
    question: 'What is the speed of light in a vacuum?',
    options: [
      { id: 'a', text: '300,000 km/s' },
      { id: 'b', text: '150,000 km/s' },
      { id: 'c', text: '500,000 km/s' },
      { id: 'd', text: '1,000,000 km/s' },
    ],
    correctOptionId: 'a', explanation: 'Light travels at approximately 299,792 km/s in a vacuum.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'sci-003', version: 1, category: 'science', difficulty: 'hard',
    question: 'What is the powerhouse of the cell?',
    options: [
      { id: 'a', text: 'Nucleus' },
      { id: 'b', text: 'Ribosome' },
      { id: 'c', text: 'Mitochondria' },
      { id: 'd', text: 'Golgi apparatus' },
    ],
    correctOptionId: 'c', explanation: 'Mitochondria produce ATP (adenosine triphosphate), the cell\'s main energy currency.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Technology ────────────────────────────────────────
  {
    id: 'tech-001', version: 1, category: 'technology', difficulty: 'easy',
    question: 'What does "HTTP" stand for?',
    options: [
      { id: 'a', text: 'HyperText Transfer Protocol' },
      { id: 'b', text: 'High Tech Transfer Protocol' },
      { id: 'c', text: 'HyperText Transmission Process' },
      { id: 'd', text: 'Home Tool Transfer Protocol' },
    ],
    correctOptionId: 'a', explanation: 'HTTP is the foundation of data communication on the World Wide Web.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'tech-002', version: 1, category: 'technology', difficulty: 'medium',
    question: 'Who is considered the father of the World Wide Web?',
    options: [
      { id: 'a', text: 'Bill Gates' },
      { id: 'b', text: 'Steve Jobs' },
      { id: 'c', text: 'Tim Berners-Lee' },
      { id: 'd', text: 'Vint Cerf' },
    ],
    correctOptionId: 'c', explanation: 'Tim Berners-Lee invented the World Wide Web in 1989 at CERN.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'tech-003', version: 1, category: 'technology', difficulty: 'hard',
    question: 'What year was the first iPhone released?',
    options: [
      { id: 'a', text: '2005' },
      { id: 'b', text: '2006' },
      { id: 'c', text: '2007' },
      { id: 'd', text: '2008' },
    ],
    correctOptionId: 'c', explanation: 'The first iPhone was announced by Steve Jobs on January 9, 2007, and released on June 29, 2007.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Geography ─────────────────────────────────────────
  {
    id: 'geo-001', version: 1, category: 'geography', difficulty: 'easy',
    question: 'What is the largest ocean on Earth?',
    options: [
      { id: 'a', text: 'Atlantic Ocean' },
      { id: 'b', text: 'Indian Ocean' },
      { id: 'c', text: 'Pacific Ocean' },
      { id: 'd', text: 'Arctic Ocean' },
    ],
    correctOptionId: 'c', explanation: 'The Pacific Ocean covers about 165 million square kilometers — more than all land areas combined.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'geo-002', version: 1, category: 'geography', difficulty: 'medium',
    question: 'Which country has the most natural lakes?',
    options: [
      { id: 'a', text: 'United States' },
      { id: 'b', text: 'Canada' },
      { id: 'c', text: 'Russia' },
      { id: 'd', text: 'Finland' },
    ],
    correctOptionId: 'b', explanation: 'Canada has over 800,000 lakes, more than all other countries combined.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'geo-003', version: 1, category: 'geography', difficulty: 'hard',
    question: 'What is the deepest point in the ocean?',
    options: [
      { id: 'a', text: 'Tonga Trench' },
      { id: 'b', text: 'Mariana Trench' },
      { id: 'c', text: 'Philippine Trench' },
      { id: 'd', text: 'Puerto Rico Trench' },
    ],
    correctOptionId: 'b', explanation: 'The Challenger Deep in the Mariana Trench reaches about 10,935 meters below sea level.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── History ───────────────────────────────────────────
  {
    id: 'hist-001', version: 1, category: 'history', difficulty: 'easy',
    question: 'In which year did World War II end?',
    options: [
      { id: 'a', text: '1943' },
      { id: 'b', text: '1944' },
      { id: 'c', text: '1945' },
      { id: 'd', text: '1946' },
    ],
    correctOptionId: 'c', explanation: 'World War II ended in 1945 with the surrender of Germany in May and Japan in September.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'hist-002', version: 1, category: 'history', difficulty: 'medium',
    question: 'Who was the first person to walk on the Moon?',
    options: [
      { id: 'a', text: 'Buzz Aldrin' },
      { id: 'b', text: 'Neil Armstrong' },
      { id: 'c', text: 'Yuri Gagarin' },
      { id: 'd', text: 'John Glenn' },
    ],
    correctOptionId: 'b', explanation: 'Neil Armstrong took the first steps on the Moon on July 20, 1969, during the Apollo 11 mission.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'hist-003', version: 1, category: 'history', difficulty: 'hard',
    question: 'Which ancient wonder was located in Giza, Egypt?',
    options: [
      { id: 'a', text: 'Hanging Gardens of Babylon' },
      { id: 'b', text: 'Colossus of Rhodes' },
      { id: 'c', text: 'Great Pyramid of Giza' },
      { id: 'd', text: 'Lighthouse of Alexandria' },
    ],
    correctOptionId: 'c', explanation: 'The Great Pyramid of Giza is the oldest of the seven ancient wonders and the only one still standing.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Sports ────────────────────────────────────────────
  {
    id: 'sport-001', version: 1, category: 'sports', difficulty: 'easy',
    question: 'How many players are on a basketball team on the court at once?',
    options: [
      { id: 'a', text: '4' },
      { id: 'b', text: '5' },
      { id: 'c', text: '6' },
      { id: 'd', text: '7' },
    ],
    correctOptionId: 'b', explanation: 'Each basketball team has 5 players on the court at a time.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'sport-002', version: 1, category: 'sports', difficulty: 'medium',
    question: 'Which country has won the most FIFA World Cups?',
    options: [
      { id: 'a', text: 'Germany' },
      { id: 'b', text: 'Argentina' },
      { id: 'c', text: 'Italy' },
      { id: 'd', text: 'Brazil' },
    ],
    correctOptionId: 'd', explanation: 'Brazil has won the FIFA World Cup 5 times (1958, 1962, 1970, 1994, 2002).',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'sport-003', version: 1, category: 'sports', difficulty: 'hard',
    question: 'In which year were the first modern Olympic Games held?',
    options: [
      { id: 'a', text: '1896' },
      { id: 'b', text: '1900' },
      { id: 'c', text: '1904' },
      { id: 'd', text: '1888' },
    ],
    correctOptionId: 'a', explanation: 'The first modern Olympic Games were held in Athens, Greece, in 1896.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Entertainment ─────────────────────────────────────
  {
    id: 'ent-001', version: 1, category: 'entertainment', difficulty: 'easy',
    question: 'What is the highest-grossing film of all time?',
    options: [
      { id: 'a', text: 'Avengers: Endgame' },
      { id: 'b', text: 'Avatar' },
      { id: 'c', text: 'Titanic' },
      { id: 'd', text: 'Star Wars: The Force Awakens' },
    ],
    correctOptionId: 'b', explanation: 'Avatar (2009) earned over $2.9 billion at the worldwide box office.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'ent-002', version: 1, category: 'entertainment', difficulty: 'medium',
    question: 'Which band performed "Bohemian Rhapsody"?',
    options: [
      { id: 'a', text: 'The Beatles' },
      { id: 'b', text: 'Led Zeppelin' },
      { id: 'c', text: 'Queen' },
      { id: 'd', text: 'Pink Floyd' },
    ],
    correctOptionId: 'c', explanation: '"Bohemian Rhapsody" was written by Freddie Mercury and released by Queen in 1975.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'ent-003', version: 1, category: 'entertainment', difficulty: 'hard',
    question: 'Who directed the movie "Inception"?',
    options: [
      { id: 'a', text: 'Steven Spielberg' },
      { id: 'b', text: 'Christopher Nolan' },
      { id: 'c', text: 'James Cameron' },
      { id: 'd', text: 'Martin Scorsese' },
    ],
    correctOptionId: 'b', explanation: 'Christopher Nolan wrote and directed "Inception," released in 2010.',
    timeLimitMs: 15_000, status: 'published',
  },
  // ── Logic ─────────────────────────────────────────────
  {
    id: 'logic-001', version: 1, category: 'logic', difficulty: 'easy',
    question: 'If all roses are flowers and some flowers fade quickly, which statement must be true?',
    options: [
      { id: 'a', text: 'All roses fade quickly' },
      { id: 'b', text: 'Some roses may fade quickly' },
      { id: 'c', text: 'No roses fade quickly' },
      { id: 'd', text: 'Roses never fade' },
    ],
    correctOptionId: 'b', explanation: 'Since some flowers fade quickly and roses are flowers, some roses may fade quickly — but we cannot be certain.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'logic-002', version: 1, category: 'logic', difficulty: 'medium',
    question: 'What comes next in the sequence: 2, 6, 12, 20, ...?',
    options: [
      { id: 'a', text: '28' },
      { id: 'b', text: '30' },
      { id: 'c', text: '24' },
      { id: 'd', text: '32' },
    ],
    correctOptionId: 'b', explanation: 'The pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30.',
    timeLimitMs: 15_000, status: 'published',
  },
  {
    id: 'logic-003', version: 1, category: 'logic', difficulty: 'hard',
    question: 'A farmer has 17 sheep. All but 9 die. How many sheep are left?',
    options: [
      { id: 'a', text: '8' },
      { id: 'b', text: '9' },
      { id: 'c', text: '17' },
      { id: 'd', text: '0' },
    ],
    correctOptionId: 'b', explanation: '"All but 9" means 9 sheep survived. The trick is the wording — it\'s not asking how many died.',
    timeLimitMs: 15_000, status: 'published',
  },
];

// ── In-memory session stores (replace with DB in production) ─────────

interface QuizSessionRecord {
  id: string;
  userId: string;
  gameId: 'quiz-rush';
  gameVersion: string;
  status: 'active' | 'completed' | 'expired' | 'disqualified';
  startedAt: number;
  completedAt: number | null;
  clientSessionToken: string;
  questionIds: string[];
  currentQuestionIndex: number;
  answers: Map<string, { optionId: string; timeToAnswerMs: number; sequenceNumber: number }>;
}

interface ScoreRecord {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  breakdown: Record<string, unknown>;
  metadata: Record<string, unknown>;
  antiCheatFlags: string[];
  verdict: 'valid' | 'suspicious' | 'rejected';
  isPersonalBest: boolean;
  createdAt: number;
}

interface UserStats {
  userId: string;
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  averageAccuracy: number;
  bestStreak: number;
  totalCorrect: number;
  totalAnswered: number;
}

const sessions = new Map<string, QuizSessionRecord>();
const scores = new Map<string, ScoreRecord>();
const userStats = new Map<string, UserStats>();

// ── Helper: get or create user stats ──────────────────────────────────
function getOrCreateUserStats(userId: string): UserStats {
  if (!userStats.has(userId)) {
    userStats.set(userId, {
      userId,
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageAccuracy: 0,
      bestStreak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
    });
  }
  return userStats.get(userId)!;
}

// ── Helper: get question map ──────────────────────────────────────────
function getQuestionMap(): Map<string, Question> {
  const map = new Map<string, Question>();
  for (const q of QUESTION_BANK) {
    if (q.status === 'published') {
      map.set(q.id, q);
    }
  }
  return map;
}

// ── Helper: select questions for a session ────────────────────────────
function selectQuestions(count: number): Question[] {
  const published = QUESTION_BANK.filter((q) => q.status === 'published');
  const shuffled = shuffleArray(published);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── Mock auth middleware ──────────────────────────────────────────────
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }
  return 'dev-user-001';
}

// ── Routes ────────────────────────────────────────────────────────────

export async function quizRushRoutes(app: FastifyInstance) {
  /**
   * POST /api/games/quiz-rush/session
   * Create a new quiz session with server-selected questions.
   * Correct answers are NEVER included in the response.
   */
  app.post('/games/quiz-rush/session', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { clientSessionToken, mode, challengeId } = request.body as {
      clientSessionToken?: string;
      mode?: string;
      challengeId?: string;
    };

    if (!clientSessionToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'clientSessionToken is required' },
      });
    }

    // Rate limit: max 2 active sessions
    const activeSessions = Array.from(sessions.values()).filter(
      (s) => s.userId === userId && s.status === 'active'
    );
    if (activeSessions.length >= 2) {
      return reply.status(429).send({
        success: false,
        error: { code: 'TOO_MANY_SESSIONS', message: 'You have too many active sessions' },
      });
    }

    // Server selects questions
    const selectedQuestions = selectQuestions(QUIZ_RUSH_CONFIG.questionCount);
    const questionIds = selectedQuestions.map((q) => q.id);

    const sessionId = nanoid();
    const now = Date.now();

    const session: QuizSessionRecord = {
      id: sessionId,
      userId,
      gameId: 'quiz-rush',
      gameVersion: QUIZ_RUSH_VERSION,
      status: 'active',
      startedAt: now,
      completedAt: null,
      clientSessionToken,
      questionIds,
      currentQuestionIndex: 0,
      answers: new Map(),
    };

    sessions.set(sessionId, session);

    // Return first question (without correct answer)
    const firstQuestion = selectedQuestions[0];
    const publicQuestion = firstQuestion
      ? toPublicQuestion(firstQuestion, 0)
      : null;

    return {
      success: true,
      data: {
        sessionId,
        gameVersion: QUIZ_RUSH_VERSION,
        mode: mode ?? 'normal',
        totalQuestions: selectedQuestions.length,
        firstQuestion: publicQuestion,
        config: {
          countdownDuration: QUIZ_RUSH_CONFIG.countdownDuration,
          defaultTimeLimitMs: QUIZ_RUSH_CONFIG.defaultTimeLimitMs,
        },
        expiresAt: now + 120_000,
      },
    };
  });

  /**
   * POST /api/games/quiz-rush/session/:sessionId/answer
   * Submit an answer for the current question.
   * Server validates the answer and returns the result.
   */
  app.post('/games/quiz-rush/session/:sessionId/answer', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { sessionId } = request.params as { sessionId: string };
    const { questionId, selectedOptionId, clientTimestamp, sequenceNumber } = request.body as {
      questionId: string;
      selectedOptionId: string;
      clientTimestamp: number;
      sequenceNumber: number;
    };

    // 1. Validate session
    const session = sessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    if (session.userId !== userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Session does not belong to you' },
      });
    }

    if (session.status !== 'active') {
      return reply.status(409).send({
        success: false,
        error: { code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' },
      });
    }

    // 2. Validate question belongs to session
    if (!session.questionIds.includes(questionId)) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_QUESTION', message: 'Question does not belong to this session' },
      });
    }

    // 3. Check for duplicate answer
    if (session.answers.has(questionId)) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ANSWERED', message: 'Question already answered' },
      });
    }

    // 4. Look up the correct answer from the server-side question bank
    const questionMap = getQuestionMap();
    const question = questionMap.get(questionId);
    if (!question) {
      return reply.status(422).send({
        success: false,
        error: { code: 'QUESTION_NOT_FOUND', message: 'Question not found in database' },
      });
    }

    // 5. Validate answer option exists
    const validOption = question.options.find((o) => o.id === selectedOptionId);
    if (!validOption) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_OPTION', message: 'Invalid answer option' },
      });
    }

    // 6. Calculate time to answer (server timestamp vs client-reported)
    const serverTimestamp = Date.now();
    const timeToAnswerMs = Math.min(
      Math.max(0, serverTimestamp - session.startedAt - sequenceNumber * 1000),
      question.timeLimitMs * QUIZ_RUSH_CONFIG.maxAnswerTimeMultiplier
    );

    // 7. Check answer correctness using server-side data
    const isCorrect = selectedOptionId === question.correctOptionId;

    // 8. Calculate streak
    let streak = 0;
    const answeredQuestionIds = Array.from(session.answers.keys());
    for (const aqId of answeredQuestionIds) {
      const aq = session.answers.get(aqId);
      if (aq) {
        const aqQuestion = questionMap.get(aqId);
        if (aqQuestion && aq.optionId === aqQuestion.correctOptionId) {
          streak++;
        } else {
          streak = 0;
        }
      }
    }
    if (isCorrect) {
      streak++;
    } else {
      streak = 0;
    }

    // 9. Calculate score for this answer
    const { scoreEarned, speedBonus, streakBonus, difficultyBonus } = calculateAnswerScore(
      isCorrect,
      question.difficulty,
      streak,
      timeToAnswerMs,
      question.timeLimitMs,
    );

    // 10. Record the answer
    session.answers.set(questionId, {
      optionId: selectedOptionId,
      timeToAnswerMs,
      sequenceNumber,
    });

    // 11. Move to next question
    session.currentQuestionIndex++;
    const nextIndex = session.currentQuestionIndex;
    const nextQuestion =
      nextIndex < session.questionIds.length
        ? toPublicQuestion(questionMap.get(session.questionIds[nextIndex]!)!, nextIndex)
        : null;

    return {
      success: true,
      data: {
        correct: isCorrect,
        correctOptionId: question.correctOptionId,
        explanation: question.explanation,
        scoreEarned,
        speedBonus,
        streakBonus,
        difficultyBonus,
        streak: isCorrect ? streak : 0,
        timeToAnswerMs,
        nextQuestion,
        questionsRemaining: session.questionIds.length - nextIndex,
      },
    };
  });

  /**
   * POST /api/games/quiz-rush/session/:sessionId/complete
   * Complete the quiz session and get final authoritative result.
   */
  app.post('/games/quiz-rush/session/:sessionId/complete', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { sessionId } = request.params as { sessionId: string };

    const session = sessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    if (session.userId !== userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Session does not belong to you' },
      });
    }

    if (session.status !== 'active') {
      return reply.status(409).send({
        success: false,
        error: { code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' },
      });
    }

    // Build events from recorded answers
    const events: InputEvent[] = [
      { type: 'session_started', timestamp: session.startedAt },
    ];

    let totalScore = 0;
    let streak = 0;
    let highestStreak = 0;
    let correctAnswers = 0;
    let fastestAnswerMs = Infinity;
    let slowestAnswerMs = 0;
    const questionMap = getQuestionMap();

    for (let i = 0; i < session.questionIds.length; i++) {
      const qId = session.questionIds[i]!;
      const answer = session.answers.get(qId);
      const question = questionMap.get(qId);

      events.push({
        type: 'question_shown',
        timestamp: session.startedAt + i * 2000,
        questionId: qId,
        questionSequence: i,
      });

      if (answer) {
        const isCorrect = answer.optionId === question?.correctOptionId;
        if (isCorrect) {
          streak++;
          correctAnswers++;
          highestStreak = Math.max(highestStreak, streak);
          fastestAnswerMs = Math.min(fastestAnswerMs, answer.timeToAnswerMs);
        } else {
          streak = 0;
        }
        slowestAnswerMs = Math.max(slowestAnswerMs, answer.timeToAnswerMs);

        events.push({
          type: 'answer_submitted',
          timestamp: session.startedAt + i * 2000 + answer.timeToAnswerMs,
          questionId: qId,
          questionSequence: i,
          selectedOptionId: answer.optionId,
          timeToAnswerMs: answer.timeToAnswerMs,
        });
      } else {
        events.push({
          type: 'timeout',
          timestamp: session.startedAt + i * 2000 + (question?.timeLimitMs ?? 15_000),
          questionId: qId,
          questionSequence: i,
          timeToAnswerMs: question?.timeLimitMs ?? 15_000,
        });
      }
    }

    events.push({ type: 'session_finished', timestamp: Date.now() });

    // Calculate authoritative score
    const { result, answers, breakdown: scoreBreakdown } = calculateServerScore(events, questionMap);
    totalScore = result.score;

    // Anti-cheat
    const inputs = events.map((e, i) => ({
      sequence: i,
      timestamp: e.timestamp,
      type: e.type,
      data: {
        questionId: e.questionId,
        questionSequence: e.questionSequence,
        selectedOptionId: e.selectedOptionId,
        timeToAnswerMs: e.timeToAnswerMs,
      },
    }));

    const validation = validateInputSequence(inputs);
    const antiCheatFlags: string[] = [];
    if (!validation.valid) {
      antiCheatFlags.push('INVALID_SEQUENCE');
    }

    // Check for suspicious perfect score
    if (correctAnswers === session.questionIds.length && correctAnswers > 3) {
      // Check if all answers were suspiciously fast
      const avgTime = answers.reduce((sum, a) => sum + a.timeToAnswerMs, 0) / answers.length;
      if (avgTime < QUIZ_RUSH_CONFIG.minAnswerTimeMs * 2) {
        antiCheatFlags.push('SUSPICIOUS_PERFECT');
      }
    }

    const verdict = antiCheatFlags.some((f) => f === 'INVALID_SEQUENCE')
      ? ('rejected' as const)
      : antiCheatFlags.length > 0
        ? ('suspicious' as const)
        : ('valid' as const);

    // Mark session
    session.status = verdict === 'rejected' ? 'disqualified' : 'completed';
    session.completedAt = Date.now();

    // Check personal best
    const existingScores = Array.from(scores.values()).filter(
      (s) => s.userId === userId && s.gameId === 'quiz-rush' && s.verdict === 'valid'
    );
    const previousBest = existingScores.reduce((max, s) => Math.max(max, s.score), 0);
    const isPersonalBest = verdict === 'valid' && totalScore > previousBest;

    // Store score
    const scoreId = nanoid();
    const scoreRecord: ScoreRecord = {
      id: scoreId,
      sessionId,
      userId,
      gameId: 'quiz-rush',
      score: totalScore,
      breakdown: scoreBreakdown as unknown as Record<string, unknown>,
      metadata: result.metadata,
      antiCheatFlags,
      verdict,
      isPersonalBest,
      createdAt: Date.now(),
    };
    scores.set(scoreId, scoreRecord);

    // Update stats
    const stats = getOrCreateUserStats(userId);
    stats.gamesPlayed++;
    if (verdict === 'valid') {
      stats.totalScore += totalScore;
      stats.bestScore = Math.max(stats.bestScore, totalScore);
      const accuracy = (result.metadata as Record<string, unknown>).accuracy as number;
      stats.averageAccuracy = stats.gamesPlayed > 0
        ? (stats.averageAccuracy * (stats.gamesPlayed - 1) + accuracy) / stats.gamesPlayed
        : accuracy;
      stats.bestStreak = Math.max(stats.bestStreak, highestStreak);
      stats.totalCorrect += correctAnswers;
      stats.totalAnswered += session.questionIds.length;
    }

    // Calculate XP
    const xpBase = verdict === 'valid' ? 15 : 0;
    const xpCorrect = verdict === 'valid' ? correctAnswers * 3 : 0;
    const xpPB = isPersonalBest ? 20 : 0;
    const xpAwarded = xpBase + xpCorrect + xpPB;

    // Calculate rank
    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'quiz-rush' && s.verdict === 'valid')
      .sort((a, b) => b.score - a.score);
    const rank = allScores.findIndex((s) => s.sessionId === sessionId) + 1 || allScores.length + 1;

    return {
      success: true,
      data: {
        sessionId,
        score: totalScore,
        personalBest: previousBest,
        isPersonalBest,
        globalRank: rank,
        xpAwarded,
        correctAnswers,
        totalQuestions: session.questionIds.length,
        accuracy: Math.round((correctAnswers / session.questionIds.length) * 100),
        highestStreak,
        fastestAnswerMs: fastestAnswerMs === Infinity ? 0 : fastestAnswerMs,
        breakdown: scoreBreakdown,
        metadata: result.metadata,
        answers,
        antiCheatFlags,
        verdict,
      },
    };
  });

  /**
   * GET /api/games/quiz-rush/stats
   */
  app.get('/games/quiz-rush/stats', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const stats = getOrCreateUserStats(userId);
    const recentScores = Array.from(scores.values())
      .filter((s) => s.userId === userId && s.gameId === 'quiz-rush')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    return {
      success: true,
      data: {
        gamesPlayed: stats.gamesPlayed,
        totalScore: stats.totalScore,
        bestScore: stats.bestScore,
        averageAccuracy: Math.round(stats.averageAccuracy),
        bestStreak: stats.bestStreak,
        totalCorrect: stats.totalCorrect,
        totalAnswered: stats.totalAnswered,
        recentScores: recentScores.map((s) => ({
          score: s.score,
          isPersonalBest: s.isPersonalBest,
          createdAt: s.createdAt,
        })),
      },
    };
  });

  /**
   * GET /api/games/quiz-rush/leaderboard
   */
  app.get('/games/quiz-rush/leaderboard', async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as {
      limit?: number;
      offset?: number;
    };

    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'quiz-rush' && s.verdict === 'valid')
      .sort((a, b) => b.score - a.score);

    const entries = allScores.slice(offset, offset + limit).map((s, i) => ({
      rank: offset + i + 1,
      userId: s.userId,
      score: s.score,
      createdAt: s.createdAt,
    }));

    return {
      success: true,
      data: {
        entries,
        total: allScores.length,
        limit,
        offset,
      },
    };
  });
}
