import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getDb, loadCars, getCurrentDateEST, getGameNumber,
  getDailyCarIds, calculateScore, generateShareCode,
} from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
let carsCache = null;

function getCars() {
  if (!carsCache) carsCache = loadCars();
  return carsCache;
}

function stripPrice(car) {
  const { soldPrice, ...rest } = car;
  return rest;
}

function getOrCreateSession(db, userId, sessionToken, gameType, gameDate, carIds, gameNumber) {
  let session;
  if (userId) {
    session = db.prepare(
      'SELECT * FROM game_sessions WHERE user_id = ? AND game_type = ? AND game_date = ?'
    ).get(userId, gameType, gameDate);
  } else if (sessionToken) {
    session = db.prepare(
      'SELECT * FROM game_sessions WHERE session_token = ? AND game_type = ? AND game_date = ?'
    ).get(sessionToken, gameType, gameDate);
  }

  if (!session) {
    const shareCode = generateShareCode();
    const result = db.prepare(`
      INSERT INTO game_sessions (user_id, session_token, game_type, game_date, game_number, car_ids, share_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, sessionToken, gameType, gameDate, gameNumber, JSON.stringify(carIds), shareCode);
    session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid);
  }

  return session;
}

router.get('/daily', authenticateToken, (req, res) => {
  const cars = getCars();
  const dateStr = getCurrentDateEST();
  const gameNumber = getGameNumber(dateStr);
  const carIndices = getDailyCarIds(dateStr, cars.length);
  const dailyCars = carIndices.map(i => cars[i]);
  const db = getDb();

  const userId = req.user?.id || null;
  const sessionToken = req.headers['x-session-token'] || null;

  if (!userId && !sessionToken) {
    return res.json({
      gameNumber,
      date: dateStr,
      cars: dailyCars.map(stripPrice),
      session: null,
      needsSession: true,
    });
  }

  const session = getOrCreateSession(db, userId, sessionToken, 'daily', dateStr, carIndices, gameNumber);
  const guesses = JSON.parse(session.guesses);
  const scores = JSON.parse(session.scores);

  const carsWithReveal = dailyCars.map((car, i) => {
    if (i < guesses.length) {
      return { ...car, guessed: true, userGuess: guesses[i], ...scores[i] };
    }
    return stripPrice(car);
  });

  res.json({
    gameNumber,
    date: dateStr,
    cars: carsWithReveal,
    session: {
      id: session.id,
      currentCarIndex: session.current_car_index,
      completed: !!session.completed,
      totalScore: session.total_score,
      shareCode: session.share_code,
      guesses,
      scores,
    },
  });
});

router.post('/daily/guess', authenticateToken, (req, res) => {
  const { guess } = req.body;
  if (typeof guess !== 'number' || guess < 0) {
    return res.status(400).json({ error: 'Invalid guess' });
  }

  const cars = getCars();
  const dateStr = getCurrentDateEST();
  const gameNumber = getGameNumber(dateStr);
  const carIndices = getDailyCarIds(dateStr, cars.length);
  const db = getDb();

  const userId = req.user?.id || null;
  const sessionToken = req.headers['x-session-token'] || null;

  if (!userId && !sessionToken) {
    return res.status(400).json({ error: 'Session required' });
  }

  const session = getOrCreateSession(db, userId, sessionToken, 'daily', dateStr, carIndices, gameNumber);

  if (session.completed) {
    return res.status(400).json({ error: 'Game already completed' });
  }

  const guesses = JSON.parse(session.guesses);
  const scores = JSON.parse(session.scores);

  if (guesses.length >= 5) {
    return res.status(400).json({ error: 'All guesses submitted' });
  }

  const carIndex = guesses.length;
  const car = cars[carIndices[carIndex]];
  const result = calculateScore(guess, car.soldPrice);

  guesses.push(guess);
  scores.push(result);
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const completed = guesses.length >= 5 ? 1 : 0;

  db.prepare(`
    UPDATE game_sessions
    SET guesses = ?, scores = ?, total_score = ?, current_car_index = ?,
        completed = ?, completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(JSON.stringify(guesses), JSON.stringify(scores), totalScore, carIndex + 1, completed, completed, session.id);

  res.json({
    actualPrice: car.soldPrice,
    guess,
    ...result,
    carIndex,
    totalScore,
    completed: !!completed,
    shareCode: completed ? session.share_code : null,
  });
});

router.post('/practice/start', authenticateToken, (req, res) => {
  const cars = getCars();
  const db = getDb();

  const indices = [];
  const used = new Set();
  while (indices.length < 5) {
    const idx = Math.floor(Math.random() * cars.length);
    if (!used.has(idx)) {
      used.add(idx);
      indices.push(idx);
    }
  }

  const userId = req.user?.id || null;
  const sessionToken = req.headers['x-session-token'] || uuidv4();
  const practiceId = uuidv4().slice(0, 8);
  const shareCode = generateShareCode();

  const result = db.prepare(`
    INSERT INTO game_sessions (user_id, session_token, game_type, game_date, car_ids, share_code)
    VALUES (?, ?, 'practice', ?, ?, ?)
  `).run(userId, sessionToken, practiceId, JSON.stringify(indices), shareCode);

  const practiceCars = indices.map(i => stripPrice(cars[i]));

  res.json({
    practiceId,
    sessionToken,
    gameSessionId: result.lastInsertRowid,
    cars: practiceCars,
  });
});

router.post('/practice/:id/guess', authenticateToken, (req, res) => {
  const { guess, gameSessionId } = req.body;
  if (typeof guess !== 'number' || guess < 0) {
    return res.status(400).json({ error: 'Invalid guess' });
  }

  const cars = getCars();
  const db = getDb();

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ? AND game_type = ?')
    .get(gameSessionId, 'practice');

  if (!session) return res.status(404).json({ error: 'Game not found' });
  if (session.completed) return res.status(400).json({ error: 'Game already completed' });

  const carIndices = JSON.parse(session.car_ids);
  const guesses = JSON.parse(session.guesses);
  const scores = JSON.parse(session.scores);

  if (guesses.length >= 5) {
    return res.status(400).json({ error: 'All guesses submitted' });
  }

  const carIndex = guesses.length;
  const car = cars[carIndices[carIndex]];
  const result = calculateScore(guess, car.soldPrice);

  guesses.push(guess);
  scores.push(result);
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const completed = guesses.length >= 5 ? 1 : 0;

  db.prepare(`
    UPDATE game_sessions
    SET guesses = ?, scores = ?, total_score = ?, current_car_index = ?,
        completed = ?, completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(JSON.stringify(guesses), JSON.stringify(scores), totalScore, carIndex + 1, completed, completed, session.id);

  res.json({
    actualPrice: car.soldPrice,
    guess,
    ...result,
    carIndex,
    totalScore,
    completed: !!completed,
    shareCode: completed ? session.share_code : null,
  });
});

router.get('/share/:code', (req, res) => {
  const db = getDb();
  const cars = getCars();

  const session = db.prepare('SELECT * FROM game_sessions WHERE share_code = ?').get(req.params.code);
  if (!session) return res.status(404).json({ error: 'Shared game not found' });

  const carIndices = JSON.parse(session.car_ids);
  const guesses = JSON.parse(session.guesses);
  const scores = JSON.parse(session.scores);

  let username = 'Anonymous';
  if (session.user_id) {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(session.user_id);
    if (user) username = user.username;
  }

  const gameCars = carIndices.map((idx, i) => {
    const car = cars[idx];
    return {
      ...car,
      guessed: i < guesses.length,
      userGuess: guesses[i] || null,
      ...(scores[i] || {}),
    };
  });

  res.json({
    gameType: session.game_type,
    gameNumber: session.game_number,
    gameDate: session.game_date,
    username,
    cars: gameCars,
    guesses,
    scores,
    totalScore: session.total_score,
    completed: !!session.completed,
  });
});

router.get('/user/stats', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  const db = getDb();
  const userId = req.user.id;

  const totalGames = db.prepare(
    'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ? AND completed = 1'
  ).get(userId).count;

  const dailyGames = db.prepare(
    'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ? AND game_type = ? AND completed = 1'
  ).get(userId, 'daily').count;

  const practiceGames = db.prepare(
    'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ? AND game_type = ? AND completed = 1'
  ).get(userId, 'practice').count;

  const avgScore = db.prepare(
    'SELECT AVG(total_score) as avg FROM game_sessions WHERE user_id = ? AND completed = 1'
  ).get(userId).avg || 0;

  const bestScore = db.prepare(
    'SELECT MAX(total_score) as best FROM game_sessions WHERE user_id = ? AND completed = 1'
  ).get(userId).best || 0;

  const recentGames = db.prepare(`
    SELECT id, game_type, game_date, game_number, total_score, completed_at, share_code
    FROM game_sessions
    WHERE user_id = ? AND completed = 1
    ORDER BY completed_at DESC
    LIMIT 20
  `).all(userId);

  const dailyStreak = calculateStreak(db, userId);

  res.json({
    totalGames,
    dailyGames,
    practiceGames,
    avgScore: Math.round(avgScore),
    bestScore,
    dailyStreak,
    recentGames,
  });
});

function calculateStreak(db, userId) {
  const games = db.prepare(`
    SELECT game_date FROM game_sessions
    WHERE user_id = ? AND game_type = 'daily' AND completed = 1
    ORDER BY game_date DESC
  `).all(userId);

  if (games.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < games.length; i++) {
    const prev = new Date(games[i - 1].game_date);
    const curr = new Date(games[i].game_date);
    const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  const today = getCurrentDateEST();
  const lastPlayed = games[0].game_date;
  const daysSinceLast = Math.round(
    (new Date(today) - new Date(lastPlayed)) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceLast > 1) return 0;

  return streak;
}

export default router;
