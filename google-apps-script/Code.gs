const SPREADSHEET_ID = '1vRXH96L9whUmVb5leykCxpx22IyqlPZp-RgLXUgN4bc';

function doGet() {
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    return json_({ ok: true, service: 'BRO’S JAM poll sync', sheetAccessible: Boolean(book), secretConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET')) });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!expected || body.secret !== expected) return json_({ ok: false, error: 'Unauthorized' });
    lock.waitLock(10000);
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    const target = body.type === 'vote.saved' ? votesSheet_(book) : pollsSheet_(book);
    if (target.createTextFinder(body.id).matchEntireCell(true).findNext()) return json_({ ok: true, duplicate: true });
    target.appendRow(body.type === 'vote.saved' ? voteRow_(body) : pollRow_(body));
    target.setFrozenRows(1);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}

function pollsSheet_(book) {
  return sheet_(book, 'Polls', ['Event ID','Timestamp','Event','Poll ID','Guild ID','Channel ID','Message ID','Question','Answers','Emojis','Description','Custom ideas enabled','Closes at','Total votes']);
}

function votesSheet_(book) {
  return sheet_(book, 'Votes', ['Event ID','Timestamp','Poll ID','Answer type','Answer or private idea','Total votes','Voter hash']);
}

function sheet_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#5865F2').setFontColor('#FFFFFF');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function pollRow_(event) {
  const d = event.data || {};
  return [event.id,event.timestamp,event.type,d.id || '',d.guildId || '',d.channelId || '',d.messageId || '',d.question || '',(d.choices || []).join('\n'),(d.emojis || []).join(' '),d.description || '',Boolean(d.allowText),d.closesAt || '',d.totalVotes || 0];
}

function voteRow_(event) {
  const d = event.data || {};
  return [event.id,event.timestamp,d.pollId || '',d.answerType || '',d.answer || '',d.totalVotes || 0,d.voterHash || ''];
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
