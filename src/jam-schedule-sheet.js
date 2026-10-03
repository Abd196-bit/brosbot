const DEFAULT_SHEET_ID = '1eUQWqHJRcVSBGduZP5l0s2BhcjzTksbIfwp8tgO02CY';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(field.trim()); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function isoDate(year, month, value, timezone) {
  const day = Number.parseInt(String(value || '').match(/\d{1,2}/)?.[0], 10);
  const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  if (!Number.isInteger(day) || monthIndex < 0) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00${timezone}`;
}

function chooseSchedule(rows, now, timezone) {
  const [header, ...body] = rows;
  const column = Object.fromEntries(header.map((name, index) => [name.toLowerCase().trim(), index]));
  const schedules = body.map(row => {
    const year = Number(row[column.year]);
    const month = row[column.month];
    return {
      start: isoDate(year, month, row[column['jam start day']], timezone),
      themeVotingStart: isoDate(year, month, row[column['jam theme vote start day']], timezone),
      votingEnd: isoDate(year, month, row[column['theme vote end day']], timezone),
    };
  }).filter(item => item.start || item.themeVotingStart || item.votingEnd);
  return schedules.find(item => Date.parse(item.votingEnd || item.start) >= now) || schedules.at(-1) || null;
}

export async function loadJamSchedule(config, fetcher = fetch, now = Date.now()) {
  const sheetId = process.env.JAM_SCHEDULE_SHEET_ID || DEFAULT_SHEET_ID;
  const timezone = process.env.JAM_SCHEDULE_TIMEZONE || '+05:30';
  const response = await fetcher(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`);
  if (!response.ok) throw new Error(`Schedule sheet returned HTTP ${response.status}`);
  const schedule = chooseSchedule(parseCsv(await response.text()), now, timezone);
  if (!schedule) throw new Error('Schedule sheet has no dated jam row.');
  return { ...config, jam: { ...config.jam, ...Object.fromEntries(Object.entries(schedule).filter(([, value]) => value)) } };
}
