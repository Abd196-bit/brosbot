import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDashboardAction } from '../lib/dashboard-firestore.js';

test('dashboard actions reject malformed channel IDs and invalid poll content', () => {
  assert.throws(() => validateDashboardAction({ action: 'poll.create', data: { channelId: 'general', question: 'Pick one', choices: ['A', 'B'] } }), /Discord channel ID/);
  assert.throws(() => validateDashboardAction({ action: 'poll.create', data: { channelId: '123456789012345678', question: 'Pick one', choices: ['A'] } }), /2–10 answers/);
  const result = validateDashboardAction({ action: 'poll.create', data: { channelId: '123456789012345678', question: ' Pick one ', choices: [' A ', ' B '], allowText: true } });
  assert.deepEqual(result.data.choices, ['A', 'B']);
  assert.equal(result.data.question, 'Pick one');
});
