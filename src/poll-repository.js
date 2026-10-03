import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

export function createRepository(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS votes (poll TEXT, voter TEXT, answer TEXT, PRIMARY KEY(poll,voter)); CREATE TABLE IF NOT EXISTS sheet_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS firebase_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);');
  const read = (id) => {
    const row = db.prepare('SELECT data FROM polls WHERE id=?').get(id);
    if (!row) throw new Error('This poll is unavailable. Create a new poll with /poll.');
    const poll = JSON.parse(row.data);
    poll.counts = poll.choices.map(() => 0);
    poll.customResponses = [];
    const rows = db.prepare('SELECT answer, COUNT(*) AS count FROM votes WHERE poll=? GROUP BY answer').all(id);
    poll.totalVotes = 0;
    for (const row of rows) {
      const answer = JSON.parse(row.answer);
      poll.totalVotes += row.count;
      if (typeof answer === 'number') poll.counts[answer] += row.count;
      else poll.customResponses.push({ text: answer, count: row.count });
    }
    return poll;
  };
  return {
    create(input) { const poll = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }; db.prepare('INSERT INTO polls VALUES (?,?)').run(poll.id, JSON.stringify(poll)); return read(poll.id); },
    get: read,
    list() { return db.prepare('SELECT id FROM polls').all().map(row=>read(row.id)); },
    queueSheetEvent(type, data) {
      const event = { id: randomUUID(), type, timestamp: new Date().toISOString(), data };
      db.prepare('INSERT INTO sheet_events VALUES (?,?,?)').run(event.id, JSON.stringify(event), event.timestamp);
      db.prepare('INSERT INTO firebase_events VALUES (?,?,?)').run(event.id, JSON.stringify(event), event.timestamp);
      return event;
    },
    pendingSheetEvents(limit = 25, route = 'all') {
      const filter=route==='theme' ? "WHERE json_extract(payload, '$.type') LIKE 'theme.%'" : route==='poll' ? "WHERE json_extract(payload, '$.type') NOT LIKE 'theme.%'" : '';
      return db.prepare(`SELECT payload FROM sheet_events ${filter} ORDER BY created_at LIMIT ?`).all(limit).map(row => JSON.parse(row.payload));
    },
    completeSheetEvent(id) { db.prepare('DELETE FROM sheet_events WHERE id=?').run(id); },
    pendingFirebaseEvents(limit = 25) {
      return db.prepare('SELECT payload FROM firebase_events ORDER BY created_at LIMIT ?').all(limit).map(row => JSON.parse(row.payload));
    },
    completeFirebaseEvent(id) { db.prepare('DELETE FROM firebase_events WHERE id=?').run(id); },
    update(id, changes) { const poll = { ...read(id), ...changes }; db.prepare('UPDATE polls SET data=? WHERE id=?').run(JSON.stringify(poll), id); return read(id); },
    vote(id, userId, choice, text) {
      const poll = read(id);
      if (poll.closed || (poll.closesAt && Date.parse(poll.closesAt) <= Date.now())) throw new Error('Voting has closed for this poll.');
      let answer = choice;
      if (text !== undefined) {
        if (!poll.allowText) throw new Error('Written answers are disabled for this poll.');
        answer = text.trim();
        if (!answer || answer.length > 80) throw new Error('Write an answer between 1 and 80 characters.');
      } else if (!Number.isInteger(choice) || choice < 0 || choice >= poll.choices.length) throw new Error('Choose one of the poll answers.');
      const voter = createHash('sha256').update(id + ':' + userId).digest('hex');
      db.prepare('INSERT INTO votes VALUES (?,?,?) ON CONFLICT(poll,voter) DO UPDATE SET answer=excluded.answer').run(id, voter, JSON.stringify(answer));
      return read(id);
    },
    close() { db.close(); },
  };
}

export function voterHash(pollId, userId) {
  return createHash('sha256').update(`${pollId}:${userId}`).digest('hex');
}

let repository;
export function getRepository() {
  if (!repository) {
    const dir = process.env.POLL_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url));
    mkdirSync(dir, { recursive: true });
    repository = createRepository(`${dir.replace(/\/$/, '')}/polls.sqlite`);
  }
  return repository;
}
