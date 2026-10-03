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
    rules: process.env.JAM_RULES || 'Keep the scope tiny, be kind to fellow jammers, credit any third-party assets, disclose AI-generated assets in your submission notes, and submit before the deadline.',
    resources: process.env.JAM_RESOURCES || 'Free jam-friendly resources:\n• [Kenney](https://kenney.nl/assets) — game assets\n• [OpenGameArt](https://opengameart.org/) — community assets\n• [Freesound](https://freesound.org/) — sound effects\n• [Google Fonts](https://fonts.google.com/) — fonts',
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
