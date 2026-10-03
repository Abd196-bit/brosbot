import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { startPoll } from './poll-ui.js';
import { submitTheme } from './theme-vote.js';
import { createVerificationToken } from '../lib/verification-token.js';
import { memberVerificationConfigured } from './member-verification.js';

export const commandData = [
  new SlashCommandBuilder().setName('vote').setDescription('Suggest a jam theme in the voting channel.').setDMPermission(false)
    .addStringOption(option=>option.setName('theme').setDescription('Your theme idea').setRequired(true).setMinLength(1).setMaxLength(200)),
  new SlashCommandBuilder().setName('jam').setDescription('See the BRO\'S JAM schedule, theme, and link.'),
  new SlashCommandBuilder().setName('rules').setDescription('Read the essential BRO\'S JAM guidelines.'),
  new SlashCommandBuilder().setName('resources').setDescription('Find free game-development resources.'),
  new SlashCommandBuilder()
    .setName('teamup').setDescription('Post a template to find a jam teammate.')
    .addStringOption((option) => option.setName('role').setDescription('What you are looking for or offering.').setRequired(true))
    .addStringOption((option) => option.setName('skills').setDescription('Your skills or the skills needed.').setRequired(true))
    .addStringOption((option) => option.setName('timezone').setDescription('Your timezone or availability.').setRequired(true)),
  new SlashCommandBuilder().setName('submit').setDescription('Open the jam submission page.'),
  new SlashCommandBuilder().setName('verify').setDescription('Get your private email-verification link.').setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('poll').setDescription('Create a rich interactive poll.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('announce').setDescription('Post an event announcement in the announcements channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('message').setDescription('Announcement text.').setRequired(true)),
].map((command) => command.toJSON());

function timestamp(date) {
  const seconds = Math.floor(new Date(date).getTime() / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:F> (<t:${seconds}:R>)` : 'not set';
}

function phase(jam) {
  const now = Date.now();
  const start = Date.parse(jam.start);
  const end = Date.parse(jam.end);
  const votingEnd = Date.parse(jam.votingEnd);
  if (Number.isFinite(start) && now < start) return 'Upcoming';
  if (Number.isFinite(end) && now < end) return 'Making games';
  if (Number.isFinite(votingEnd) && now < votingEnd) return 'Voting';
  return 'See the jam page';
}

export async function handleCommand(interaction, config) {
  const { jam } = config;
  switch (interaction.commandName) {
    case 'vote': return submitTheme(interaction,config);
    case 'jam':
      return interaction.reply({ embeds: [{ color: 0xf4a261, title: jam.name, url: jam.url, description: `**Theme:** ${jam.theme}\n**Phase:** ${phase(jam)}`, fields: [
        { name: 'Starts', value: jam.start ? timestamp(jam.start) : 'To be announced', inline: false },
        { name: 'Theme voting starts', value: jam.themeVotingStart ? timestamp(jam.themeVotingStart) : 'To be announced', inline: false },
        { name: 'Submission deadline', value: jam.end ? timestamp(jam.end) : 'To be announced', inline: false },
        { name: 'Voting ends', value: jam.votingEnd ? timestamp(jam.votingEnd) : 'To be announced', inline: false },
      ] }] });
    case 'rules':
      return interaction.reply(config.rules + ' The jam page is the source of truth: ' + jam.url);
    case 'resources':
      return interaction.reply(config.resources);
    case 'teamup': {
      const role = interaction.options.getString('role', true);
      const skills = interaction.options.getString('skills', true);
      const timezone = interaction.options.getString('timezone', true);
      return interaction.reply({ content: `📣 **Team-up post from ${interaction.user}**\n**Looking for / offering:** ${role}\n**Skills:** ${skills}\n**Timezone / availability:** ${timezone}\nReact or message them if you want to make something together!` });
    }
    case 'submit':
      return interaction.reply(`Ready to share your game? Submit it here: ${jam.url}`);
    case 'verify': {
      if (!interaction.guildId || !interaction.guild) return interaction.reply({ content: 'Use `/verify` in the BRO’S JAM server.', flags: MessageFlags.Ephemeral });
      if (!memberVerificationConfigured(config)) return interaction.reply({ content: 'Email verification is not configured yet. Please contact an organiser.', flags: MessageFlags.Ephemeral });
      if (!interaction.guild.roles.cache.has(config.verifiedRoleId)) return interaction.reply({ content: 'The Verified role is not set up in this server. Please contact an organiser.', flags: MessageFlags.Ephemeral });
      const token = createVerificationToken({ guildId: interaction.guildId, userId: interaction.user.id, username: interaction.user.username });
      const link = `${config.dashboardUrl.replace(/\/$/, '')}/verify?token=${encodeURIComponent(token)}`;
      return interaction.reply({ content: `Verify your email here (only you can see this link):\n${link}\nThis link expires in 7 days. Verification is optional.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
    case 'poll': return startPoll(interaction);
    case 'announce': {
      if (!config.announcementChannelId) return interaction.reply({ content: 'Set `ANNOUNCEMENT_CHANNEL_ID` in `.env` before using this command.', ephemeral: true });
      const channel = await interaction.client.channels.fetch(config.announcementChannelId);
      if (!channel?.isTextBased()) return interaction.reply({ content: 'The configured announcements channel is not a text channel.', ephemeral: true });
      await channel.send({ embeds: [{ color: 0xe76f51, title: jam.name, description: interaction.options.getString('message', true) }] });
      return interaction.reply({ content: 'Announcement posted.', ephemeral: true });
    }
  }
}
