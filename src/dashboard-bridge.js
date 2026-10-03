import { ActivityType } from 'discord.js';
import { verificationDb } from '../lib/firebase-admin.js';
import { pollMessage } from './poll-ui.js';

const root = () => verificationDb().collection(process.env.FIREBASE_COLLECTION || 'october').doc('jam-data');
let busy = false;

export async function publishDashboardState(client, config, repository) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
  const store = root();
  const polls = repository.list().filter(poll => poll.messageId);
  await Promise.all(polls.map(poll => store.collection('dashboardPolls').doc(poll.id).set({
    id: poll.id, kind: poll.kind || 'poll', question: poll.question, choices: poll.choices,
    counts: poll.counts, totalVotes: poll.totalVotes, createdAt: poll.createdAt,
    channelId: poll.channelId, messageId: poll.messageId, closed: Boolean(poll.closed),
    suggestedBy: poll.suggestedBy || null,
  })));
  const guilds = [];
  for (const guild of client.guilds.cache.values()) {
    const channels = [...guild.channels.cache.values()];
    let publicChannels = 0;
    for (const channel of channels) if (!channel.isThread() && channel.permissionsFor(guild.roles.everyone)?.has('ViewChannel')) publicChannels += 1;
    guilds.push({ id: guild.id, name: guild.name, channels: channels.length, publicChannels });
  }
  await store.collection('dashboardState').doc('current').set({ online: true, lastSeen: new Date().toISOString(), botName: client.user.tag, guildCount: client.guilds.cache.size, guilds, jam: config.jam, activity: client.user.presence.activities[0]?.name || '', announcementChannelId: config.announcementChannelId, voteChannelId: config.voteChannelId, verifiedRoleId: config.verifiedRoleId, verifyChannelId: config.verifyChannelId, rules: config.rules, resources: config.resources });
}

export async function loadDashboardSettings(client, config) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
  try {
    const settings = (await root().collection('dashboardConfig').doc('current').get()).data();
    if (!settings) return;
    Object.assign(config.jam, settings.jam || {});
    for (const key of ['announcementChannelId', 'voteChannelId', 'verifiedRoleId', 'verifyChannelId', 'rules', 'resources']) if (settings[key] !== undefined) config[key] = settings[key];
    if (settings.activity) client.user.setActivity(settings.activity, { type: ActivityType.Playing });
  } catch (error) { console.error('Could not load dashboard settings:', error.message); }
}

async function perform(job, client, config, repo) {
  const { action, data } = job;
  if (action === 'announce') {
    if (!config.announcementChannelId) throw new Error('ANNOUNCEMENT_CHANNEL_ID is missing on the bot.');
    const channel = await client.channels.fetch(config.announcementChannelId);
    if (!channel?.isSendable()) throw new Error('Announcement channel is unavailable.');
    const message = await channel.send({ content: data.message, allowedMentions: { parse: [] } });
    return { messageUrl: message.url };
  }
  if (action === 'activity') {
    client.user.setActivity(data.text, { type: ActivityType.Playing });
    await root().collection('dashboardConfig').doc('current').set({ activity: data.text }, { merge: true });
    return {};
  }
  if (action === 'jam') {
    Object.assign(config.jam, data);
    await root().collection('dashboardConfig').doc('current').set({ jam: data }, { merge: true });
    return {};
  }
  if (action === 'settings') {
    Object.assign(config, data);
    await root().collection('dashboardConfig').doc('current').set(data, { merge: true });
    return {};
  }
  if (action === 'poll.create') {
    const channel = await client.channels.fetch(data.channelId);
    if (!channel?.isSendable() || !channel.guildId) throw new Error('Poll channel is unavailable.');
    const poll = repo.create({ kind: 'poll', question: data.question, choices: data.choices, allowText: data.allowText, guildId: channel.guildId, channelId: channel.id, createdBy: client.user.id });
    const message = await channel.send(pollMessage(poll));
    const live = repo.update(poll.id, { messageId: message.id });
    repo.queueSheetEvent('poll.published', { id: live.id, guildId: live.guildId, channelId: live.channelId, messageId: live.messageId, question: live.question, choices: live.choices, allowText: live.allowText, totalVotes: 0 });
    return { messageUrl: message.url, pollId: live.id };
  }
  if (action === 'poll.close') {
    const poll = repo.get(data.pollId);
    if (poll.kind === 'theme') throw new Error('Theme voting cannot be closed here.');
    if (poll.closed) return {};
    const closed = repo.update(poll.id, { closed: true });
    const channel = await client.channels.fetch(closed.channelId);
    await channel.messages.edit(closed.messageId, pollMessage(closed));
    repo.queueSheetEvent('poll.closed', { id: closed.id, guildId: closed.guildId, channelId: closed.channelId, messageId: closed.messageId, question: closed.question, totalVotes: closed.totalVotes });
    return {};
  }
  throw new Error('Unknown action.');
}

export async function runDashboardBridge(client, config, repository) {
  if (busy || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
  busy = true;
  try {
    const jobs = await root().collection('dashboardJobs').where('status', '==', 'queued').limit(10).get();
    for (const doc of jobs.docs) {
      // The bot is a single instance. Claim before doing Discord side effects.
      await doc.ref.update({ status: 'running', startedAt: new Date().toISOString() });
      try {
        const result = await perform(doc.data(), client, config, repository);
        await doc.ref.update({ status: 'done', completedAt: new Date().toISOString(), ...result });
      } catch (error) {
        await doc.ref.update({ status: 'failed', completedAt: new Date().toISOString(), error: error.message });
      }
    }
    await publishDashboardState(client, config, repository);
  } catch (error) { console.error('Dashboard bridge:', error.message); }
  finally { busy = false; }
}
