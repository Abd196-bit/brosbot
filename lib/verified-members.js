import { verificationDb } from './firebase-admin.js';

export async function listVerifiedMembers() {
  const query = verificationDb().collection('verificationSessions').where('status', '==', 'completed');
  const members = new Map();
  let cursor;
  while (true) {
    let page = query.limit(500);
    if (cursor) page = page.startAfter(cursor);
    const docs = await page.get();
    for (const doc of docs.docs) {
    const item = doc.data();
    if (!item.userId || !item.email) continue;
    const previous = members.get(item.userId);
    if (!previous || String(item.completedAt || '') > String(previous.completedAt || '')) {
      members.set(item.userId, { userId: item.userId, username: item.username || item.userId, email: item.email, completedAt: item.completedAt || '' });
    }
    }
    if (docs.size < 500) break;
    cursor = docs.docs.at(-1);
  }
  return [...members.values()].sort((a, b) => a.username.localeCompare(b.username));
}
