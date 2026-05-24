import * as SQLite from 'expo-sqlite';

type Session = {
  role: string;
  question: string;
  transcript: string;
  score: number;
  fillerCount: number;
  pace: number;
  feedback: string;
};

const db = SQLite.openDatabaseSync('interviewai.db');

export function initDB() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT,
      question TEXT,
      transcript TEXT,
      score INTEGER,
      filler_count INTEGER,
      pace INTEGER,
      feedback TEXT,
      created_at TEXT
    );
  `);
}

export function saveSession(data: Session) {
  db.runSync(
    `INSERT INTO sessions 
     (role,question,transcript,score,filler_count,pace,feedback,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [data.role, data.question, data.transcript,
     data.score, data.fillerCount, data.pace,
     data.feedback, new Date().toISOString()]
  );
}

export function getSessions() {
  return db.getAllSync('SELECT * FROM sessions ORDER BY created_at DESC');
}