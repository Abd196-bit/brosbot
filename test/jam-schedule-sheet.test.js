import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJamSchedule } from '../src/jam-schedule-sheet.js';

test('loads the next active jam calendar row from Google Sheet CSV', async () => {
  const csv = 'Year,Month,Jam start Day,Jam theme vote start day,,theme vote end day\n2026,October,31st October,2nd October,,29th October\n2027,January,10th January,1st January,,20th January\n';
  const config = { jam: { name: "BRO'S JAM", start: null, end: null, votingEnd: null } };
  const result = await loadJamSchedule(config, async () => ({ ok: true, text: async () => csv }), Date.parse('2026-10-03T00:00:00+05:30'));
  assert.equal(result.jam.start, '2026-10-31T12:00:00+05:30');
  assert.equal(result.jam.themeVotingStart, '2026-10-02T12:00:00+05:30');
  assert.equal(result.jam.votingEnd, '2026-10-29T12:00:00+05:30');
});
