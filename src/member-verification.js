import { PermissionFlagsBits } from 'discord.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createVerificationToken } from '../lib/verification-token.js';

let database;
function db() {
  if (database) return database;
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps().find(item => item.name === 'bros-jam-member-verification') || initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID }, 'bros-jam-member-verification');
  database = getFirestore(app); return database;
}
export function memberVerificationConfigured(config) { return Boolean(config.dashboardUrl && config.verifiedRoleId && process.env.VERIFICATION_LINK_SECRET && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
function isAdmin(member) { return member.permissions.has(PermissionFlagsBits.Administrator); }
export async function sendVerificationDm(member, config) {
  if (member.user.bot || isAdmin(member) || member.roles.cache.has(config.verifiedRoleId)) return false;
  const token = createVerificationToken({ guildId: member.guild.id, userId: member.id, username: member.user.username });
  const link = `${config.dashboardUrl.replace(/\/$/, '')}/verify?token=${encodeURIComponent(token)}`;
  await member.send({ content: `Welcome to **${member.guild.name}**! Verify your email to unlock the server:\n${link}`, allowedMentions: { parse: [] } });
  return true;
}
async function saveToSheet(session) {
  if (!process.env.VERIFICATION_SHEETS_WEBHOOK_URL || !process.env.VERIFICATION_SHEETS_WEBHOOK_SECRET) throw new Error('Verification Sheet webhook is not configured.');
  const response = await fetch(process.env.VERIFICATION_SHEETS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: process.env.VERIFICATION_SHEETS_WEBHOOK_SECRET, type: 'verification.completed', data: { discordUserId: session.userId, discordUsername: session.username, email: session.email, verifiedAt: session.emailVerifiedAt } }) });
  const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || `Sheet HTTP ${response.status}`);
}
export async function grantVerifiedMembers(client, config) {
  if (!memberVerificationConfigured(config) || !process.env.VERIFICATION_SHEETS_WEBHOOK_URL || !process.env.VERIFICATION_SHEETS_WEBHOOK_SECRET) return;
  const approved = await db().collection('verificationSessions').where('status', '==', 'pending_role').limit(25).get();
  for (const document of approved.docs) {
    const session = document.data();
    try {
      const guild = await client.guilds.fetch(session.guildId); const member = await guild.members.fetch(session.userId);
      if (!isAdmin(member) && !member.roles.cache.has(config.verifiedRoleId)) await member.roles.add(config.verifiedRoleId, 'BRO’S JAM email verified');
      await saveToSheet(session);
      await document.ref.update({ status: 'completed', completedAt: new Date().toISOString() });
    } catch (error) { console.error('Could not complete member verification:', error.message); }
  }
}

export async function runVerificationCampaign(client, config) {
  if (!memberVerificationConfigured(config)) return;
  const campaign = db().collection('verificationCampaigns').doc('current');
  const claimed = await db().runTransaction(async transaction => {
    const requested = await transaction.get(campaign);
    if (!requested.exists || requested.data().status !== 'requested') return false;
    transaction.update(campaign, { status: 'running', startedAt: new Date().toISOString(), sent: 0, failed: 0, skipped: 0 });
    return true;
  });
  if (!claimed) return;
  let sent = 0, failed = 0, skipped = 0;
  for (const guild of client.guilds.cache.values()) {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      if (member.user.bot || isAdmin(member) || member.roles.cache.has(config.verifiedRoleId)) { skipped += 1; continue; }
      try { if (await sendVerificationDm(member, config)) sent += 1; else skipped += 1; }
      catch { failed += 1; }
      // A gentle pace prevents a campaign from hammering Discord's DM API.
      await new Promise(resolve => setTimeout(resolve, 750));
      if ((sent + failed) % 20 === 0) await campaign.update({ sent, failed, skipped });
    }
  }
  await campaign.update({ status: 'completed', completedAt: new Date().toISOString(), sent, failed, skipped });
}
