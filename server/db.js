import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'cardle.db');

let db = null;
let SQL = null;

class PreparedStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  run(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.database.run(this.sql, flatParams);
    const lastId = this.database.exec('SELECT last_insert_rowid() as id');
    const changes = this.database.exec('SELECT changes() as c');
    saveDb();
    return {
      lastInsertRowid: lastId[0]?.values[0]?.[0] ?? 0,
      changes: changes[0]?.values[0]?.[0] ?? 0,
    };
  }

  get(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    let stmt;
    try {
      stmt = this.database.prepare(this.sql);
      if (flatParams.length > 0) stmt.bind(flatParams);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  all(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const results = [];
    let stmt;
    try {
      stmt = this.database.prepare(this.sql);
      if (flatParams.length > 0) stmt.bind(flatParams);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      if (stmt) stmt.free();
    }
  }
}

class DbWrapper {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new PreparedStatement(this.database, sql);
  }

  exec(sql) {
    this.database.run(sql);
    saveDb();
  }

  pragma(str) {
    try {
      this.database.run(`PRAGMA ${str}`);
    } catch {
      // some pragmas not supported in sql.js
    }
  }
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch {
    // ignore save errors in edge cases
  }
}

export async function initDb() {
  if (db) return db;

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new DbWrapper(new SQL.Database(buffer));
  } else {
    db = new DbWrapper(new SQL.Database());
  }

  initializeDatabase();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_token TEXT,
      game_type TEXT NOT NULL,
      game_date TEXT,
      game_number INTEGER,
      car_ids TEXT NOT NULL,
      guesses TEXT DEFAULT '[]',
      scores TEXT DEFAULT '[]',
      total_score INTEGER DEFAULT 0,
      current_car_index INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      share_code TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gs_user_daily ON game_sessions(user_id, game_type, game_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gs_share ON game_sessions(share_code)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gs_token ON game_sessions(session_token, game_type, game_date)`);
  } catch {
    // indices may already exist
  }
}

export function loadCars() {
  const carsPath = path.join(__dirname, 'data', 'cars.json');
  const raw = fs.readFileSync(carsPath, 'utf-8');
  return JSON.parse(raw);
}

const START_DATE = new Date('2026-03-17T00:00:00');

export function getGameNumber(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((date - START_DATE) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function getCurrentDateEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function getDailyCarIds(dateStr, totalCars, count = 5) {
  let hash = 0;
  const str = 'cardle-' + dateStr;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const seed = Math.abs(hash);
  const indices = Array.from({ length: totalCars }, (_, i) => i);

  let rng = seed;
  const nextRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (rng >>> 0) / 0xFFFFFFFF;
  };

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count);
}

export function calculateScore(guess, actual) {
  const percentOff = Math.abs(guess - actual) / actual;
  const score = Math.max(0, Math.round(1000 * (1 - percentOff)));
  let rating, emoji;

  if (percentOff <= 0.05) {
    rating = 'Spot On';
    emoji = '🟩';
  } else if (percentOff <= 0.15) {
    rating = 'Excellent';
    emoji = '🟩';
  } else if (percentOff <= 0.30) {
    rating = 'Good';
    emoji = '🟨';
  } else if (percentOff <= 0.60) {
    rating = 'Fair';
    emoji = '🟧';
  } else if (percentOff < 1.0) {
    rating = 'Poor';
    emoji = '🟥';
  } else {
    rating = 'Miss';
    emoji = '⬛';
  }

  return { score, percentOff: Math.round(percentOff * 1000) / 10, rating, emoji };
}

export function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
