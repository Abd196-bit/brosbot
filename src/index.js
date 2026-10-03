import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { getConfig } from './config.js';
import { handleCommand } from './commands.js';
import { handlePollInteraction, pollMessage } from './poll-ui.js';
import { getRepository } from './poll-repository.js';
import { handleThemeVote, themeMessage } from './theme-vote.js';
import { flushSheetEvents, sheetsConfigured } from './google-sheet-sync.js';
import { firebaseConfigured, flushFirebaseEvents } from './firebase-sync.js';
import { loadJamSchedule } from './jam-schedule-sheet.js';
import { grantVerifiedMembers, memberVerificationConfigured, runVerificationCampaign, sendVerificationDm } from './member-verification.js';

let config = getConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, async (readyClient) => {
  readyClient.user.setActivity(process.env.BOT_ACTIVITY || 'BRO’S JAM • /poll', { type: ActivityType.Playing });
  console.log(`Ready as ${readyClient.user.tag}.`);
  try {
    config = await loadJamSchedule(config);
    console.log(`Jam schedule loaded from Google Sheet: starts ${config.jam.start}.`);
  } catch (error) {
    console.error('Google Sheet schedule unavailable; using .env dates:', error.message);
  }
  const repository = getRepository();
  console.log(sheetsConfigured() ? 'Google Sheets sync enabled.' : 'Google Sheets sync disabled; webhook variables are not set.');
  console.log(firebaseConfigured() ? 'Firebase vote sync enabled.' : 'Firebase vote sync disabled; Firebase variables are not set.');
  console.log(memberVerificationConfigured(config) ? 'Email member verification enabled.' : 'Email member verification disabled; verification variables are not set.');
  await flushSheetEvents(repository);
  await flushFirebaseEvents(repository);
  setInterval(() => flushSheetEvents(repository), 30_000).unref();
  setInterval(() => flushFirebaseEvents(repository), 30_000).unref();
  await grantVerifiedMembers(readyClient, config);
  setInterval(() => grantVerifiedMembers(readyClient, config), 15_000).unref();
  await runVerificationCampaign(readyClient, config);
  setInterval(() => runVerificationCampaign(readyClient, config), 15_000).unref();
  for (const poll of repository.list()) {
    if (!poll.messageId) continue;
    try {
      const channel=await readyClient.channels.fetch(poll.channelId);
      await channel.messages.edit(poll.messageId,poll.kind==='theme' ? themeMessage(poll) : pollMessage(poll));
      console.log('Updated poll message',poll.messageId);
    } catch(error) { console.error('Could not refresh poll message',poll.messageId,error.code || error.name); }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try { if (await sendVerificationDm(member, config)) console.log(`Sent verification DM to ${member.user.id}.`); }
  catch (error) { console.error(`Could not send verification DM to ${member.user.id}:`, error.code || error.message); }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) await handleCommand(interaction, config);
    else if (interaction.isButton() && interaction.customId.startsWith('theme:')) await handleThemeVote(interaction);
    else if (interaction.customId && /^(draft|edit|poll|vote|polltext):/.test(interaction.customId)) await handlePollInteraction(interaction);
    else return;
  } catch (error) {
    console.error('Interaction failed:', error.code || error.name, error.message);
    try {
      const payload = { content: error.message?.slice(0, 1500) || 'Unable to complete this action. Please try again.', allowedMentions: { parse: [] } };
      if (interaction.deferred) await interaction.editReply(payload);
      else if (!interaction.replied) await interaction.reply({ ...payload, flags: 64 });
    } catch { console.error('Could not respond to expired interaction.'); }
  }
});

client.login(config.token);
