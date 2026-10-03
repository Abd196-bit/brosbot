import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { commandData, handleCommand } from '../src/commands.js';
import { readVerificationToken } from '../lib/verification-token.js';

test('/verify gives the requesting member a private, optional link', async () => {
  assert.ok(commandData.some(command => command.name === 'verify'));
  const keys = ['VERIFICATION_LINK_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.VERIFICATION_LINK_SECRET = 'test-only-secret';
  process.env.FIREBASE_PROJECT_ID = 'test-only-project';
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
  try {
    let reply;
    const interaction = {
      commandName: 'verify', guildId: '111111111111111111',
      guild: { roles: { cache: new Map([['222222222222222222', {}]]) } },
      user: { id: '333333333333333333', username: 'Jammer' },
      reply: async payload => { reply = payload; },
    };
    await handleCommand(interaction, { jam: {}, dashboardUrl: 'https://example.vercel.app/', verifiedRoleId: '222222222222222222' });
    assert.equal(reply.flags, MessageFlags.Ephemeral);
    const url = new URL(reply.content.match(/https:\/\/\S+/)[0]);
    assert.equal(url.origin, 'https://example.vercel.app');
    assert.equal(readVerificationToken(url.searchParams.get('token')).userId, interaction.user.id);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
