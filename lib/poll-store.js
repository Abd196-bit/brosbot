import { kv } from '@vercel/kv';
import { createHash, randomUUID } from 'crypto';

const key = (id) => `brosjam:poll:${id}`;

export async function createPoll(input) {
  const poll = { id: randomUUID(), ...input, createdAt: new Date().toISOString(), votes: {} };
  await kv.set(key(poll.id), poll);
  await kv.lpush('brosjam:polls', poll.id);
  return publicPoll(poll);
}

export async function vote(id, userId, choice, text) {
  const poll = await kv.get(key(id));
  if (!poll) throw new Error('Poll not found');
  if (poll.closesAt && Date.parse(poll.closesAt) <= Date.now()) throw new Error('Poll has closed');
  if (text) {
    if (!poll.allowText || typeof text !== 'string' || !text.trim()) throw new Error('Custom responses are disabled');
    const cleanText = text.trim().slice(0, 80);
    let textChoice = poll.choices.findIndex((item) => item.toLowerCase() === cleanText.toLowerCase());
    if (textChoice < 0) { poll.choices.push(cleanText); textChoice = poll.choices.length - 1; }
    choice = textChoice;
  }
  if (!Number.isInteger(choice) || choice < 0 || choice >= poll.choices.length) throw new Error('Invalid choice');
  // A stable salted digest permits one changeable vote per person without storing
  // their Discord user ID in Vercel KV or showing it in the organiser dashboard.
  const voterKey = createHash('sha256').update(`${process.env.BOT_API_SECRET}:${userId}`).digest('hex');
  poll.votes[voterKey] = choice;
  await kv.set(key(id), poll);
  return publicPoll(poll);
}

export async function listPolls() {
  const ids = await kv.lrange('brosjam:polls', 0, 99);
  const polls = await Promise.all(ids.map((id) => kv.get(key(id))));
  return polls.filter(Boolean).map(publicPoll);
}

function publicPoll(poll) {
  const counts = Array(poll.choices.length).fill(0);
  Object.values(poll.votes).forEach((choice) => { if (Number.isInteger(choice)) counts[choice] += 1; });
  const { votes, ...safe } = poll;
  return { ...safe, counts, totalVotes: Object.keys(votes).length };
}
