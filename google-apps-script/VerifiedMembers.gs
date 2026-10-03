// Paste this whole file into Extensions -> Apps Script in the
// "BRO'S JAM — Verified Members" spreadsheet, then deploy it as a Web app.
// Set the WEBHOOK_SECRET Script property before deploying.

const VERIFIED_TAB = 'Verified members';
const HEADERS = ['Discord user ID', 'Discord username', 'Email', 'Verified at', 'Status'];

function doGet() {
  return reply_({
    ok: true,
    service: 'BRO’S JAM verified-member sync',
    secretConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET')),
  });
}

// Select testSave in the Apps Script Run menu to confirm the sheet connection.
// It creates a clearly labelled fake row that you can delete afterward.
function testSave() {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret) throw new Error('Add WEBHOOK_SECRET in Script properties first.');
  const result = doPost({ postData: { contents: JSON.stringify({
    secret: secret,
    type: 'verification.completed',
    data: {
      discordUserId: '123456789012345678',
      discordUsername: 'TestUser',
      email: 'test@example.com',
      verifiedAt: new Date().toISOString(),
    },
  }) } });
  Logger.log(result.getContent());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData && e.postData.contents || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || body.secret !== secret) return reply_({ ok: false, error: 'Unauthorized' });
    if (body.type !== 'verification.completed') return reply_({ ok: false, error: 'Unexpected event type' });

    const data = body.data || {};
    const userId = String(data.discordUserId || '').trim();
    const username = String(data.discordUsername || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const verifiedAt = String(data.verifiedAt || new Date().toISOString());
    if (!/^\d{10,30}$/.test(userId) || !username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply_({ ok: false, error: 'Invalid verification data' });
    }

    lock.waitLock(10000);
    const sheet = getSheet_();
    const row = findUserRow_(sheet, userId);
    const values = [[safe_(userId), safe_(username), safe_(email), safe_(verifiedAt), 'Verified']];
    if (row) sheet.getRange(row, 1, 1, HEADERS.length).setValues(values);
    else sheet.appendRow(values[0]);
    return reply_({ ok: true, updated: Boolean(row) });
  } catch (error) {
    return reply_({ ok: false, error: error.message || 'Unable to save verification' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(VERIFIED_TAB);
  if (!sheet) sheet = book.insertSheet(VERIFIED_TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#5865F2').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findUserRow_(sheet, userId) {
  const rows = sheet.getLastRow();
  if (rows < 2) return 0;
  const values = sheet.getRange(2, 1, rows - 1, 1).getDisplayValues();
  const index = values.findIndex(row => row[0] === userId);
  return index < 0 ? 0 : index + 2;
}

function safe_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
