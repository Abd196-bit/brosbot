import { verificationDb } from './firebase-admin.js';

export function dashboardRoot() {
  return verificationDb().collection(process.env.FIREBASE_COLLECTION || 'october').doc('jam-data');
}

export function validateDashboardAction(input) {
  const action = String(input?.action || '');
  const data = input?.data || {};
  if (action === 'announce') {
    const message = String(data.message || '').trim();
    if (!message || message.length > 1800) throw new Error('Announcement must be 1–1800 characters.');
    return { action, data: { message } };
  }
  if (action === 'activity') {
    const text = String(data.text || '').trim();
    if (!text || text.length > 120) throw new Error('Activity must be 1–120 characters.');
    return { action, data: { text } };
  }
  if (action === 'jam') {
    const name = String(data.name || '').trim();
    const theme = String(data.theme || '').trim();
    const url = String(data.url || '').trim();
    if (!name || name.length > 100 || !theme || theme.length > 200 || !/^https:\/\//.test(url)) throw new Error('Enter a name, theme, and HTTPS jam link.');
    return { action, data: { name, theme, url } };
  }
  if (action === 'settings') {
    const result = {};
    for (const key of ['announcementChannelId', 'voteChannelId', 'verifiedRoleId']) {
      const value = String(data[key] || '').trim();
      if (value && !/^\d{10,30}$/.test(value)) throw new Error(`${key} must be a Discord ID.`);
      result[key] = value || null;
    }
    for (const key of ['rules', 'resources']) {
      const value = String(data[key] || '').trim();
      if (!value || value.length > 1800) throw new Error(`${key} must be 1–1800 characters.`);
      result[key] = value;
    }
    return { action, data: result };
  }
  if (action === 'poll.create') {
    const question = String(data.question || '').trim();
    const choices = Array.isArray(data.choices) ? data.choices.map(choice => String(choice).trim()).filter(Boolean) : [];
    const channelId = String(data.channelId || '').trim();
    if (!question || question.length > 200 || choices.length < 2 || choices.length > 10 || choices.some(choice => choice.length > 80) || !/^\d{10,30}$/.test(channelId)) throw new Error('Enter a question, 2–10 answers, and a Discord channel ID.');
    return { action, data: { question, choices, channelId, allowText: Boolean(data.allowText) } };
  }
  if (action === 'poll.close') {
    const pollId = String(data.pollId || '');
    if (!/^[0-9a-f-]{36}$/.test(pollId)) throw new Error('Invalid poll ID.');
    return { action, data: { pollId } };
  }
  throw new Error('Unknown dashboard action.');
}
