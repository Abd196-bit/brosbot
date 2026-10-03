import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

export function getConfig() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);

  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
    announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID || null,
    voteChannelId: process.env.VOTE_CHANNEL_ID || null,
    verifiedRoleId: process.env.VERIFIED_ROLE_ID || null,
    dashboardUrl: process.env.DASHBOARD_URL || null,
    botApiSecret: process.env.BOT_API_SECRET || null,
    jam: {
      name: process.env.JAM_NAME || "BRO'S JAM",
      url: process.env.JAM_URL || 'https://itch.io/jams',
      theme: process.env.JAM_THEME || 'To be revealed',
      start: process.env.JAM_START || null,
      end: process.env.JAM_END || null,
      votingEnd: process.env.VOTING_END || null,
    },
  };
}
