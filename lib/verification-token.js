import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const encode = (value) => Buffer.from(value).toString('base64url');
const decode = (value) => Buffer.from(value, 'base64url').toString();

function secret() {
  if (!process.env.VERIFICATION_LINK_SECRET) throw new Error('Verification links are not configured.');
  return process.env.VERIFICATION_LINK_SECRET;
}

export function createVerificationToken({ guildId, userId, username }) {
  const payload = encode(JSON.stringify({ guildId, userId, username, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readVerificationToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) throw new Error('This verification link is invalid. Ask for a new one in Discord.');
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('This verification link is invalid. Ask for a new one in Discord.');
  const data = JSON.parse(decode(payload));
  if (!/^\d{10,30}$/.test(data.guildId) || !/^\d{10,30}$/.test(data.userId) || !data.username || Date.now() > data.exp) throw new Error('This verification link has expired. Ask for a new one in Discord.');
  return data;
}

export function verificationSessionId(token) { return createHash('sha256').update(String(token)).digest('hex'); }
export function verificationCode() { return String(randomInt(0, 1_000_000)).padStart(6, '0'); }
export function hashVerificationCode(code) { return createHash('sha256').update(String(code)).digest('hex'); }
