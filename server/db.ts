import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'moody.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT,
    spotifyId TEXT UNIQUE,
    profilePicture TEXT,
    bannerImage TEXT,
    badges TEXT, -- JSON array
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    songs TEXT, -- JSON array
    createdBy TEXT,
    isPublic INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(createdBy) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    userId TEXT,
    friendId TEXT,
    PRIMARY KEY(userId, friendId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(friendId) REFERENCES users(id)
  );
`);

export default db;
