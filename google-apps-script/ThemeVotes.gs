// Deploy in its OWN Apps Script project, bound to the theme spreadsheet.
const THEME_SPREADSHEET_ID = '1CIf5U46grjMLybCjV33xhQQTnnG2uVpSnYfXNx8Y5Ew';

function doGet() {
  const configured=Boolean(PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET'));
  return ContentService.createTextOutput(JSON.stringify({ok:true,service:'BRO’S JAM theme vote sync',secretConfigured:configured,spreadsheetId:THEME_SPREADSHEET_ID}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock=LockService.getScriptLock();
  try {
    const body=JSON.parse(e.postData.contents);
    const secret=PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || body.secret!==secret) return reply_({ok:false,error:'Unauthorized. Set WEBHOOK_SECRET in Script properties and use the same value in Wispbyte.'});
    if (!['theme.submitted','theme.voted'].includes(body.type) || typeof body.id!=='string' || !body.data?.id) return reply_({ok:false,error:'Invalid event'});
    lock.waitLock(10000);
    const book=SpreadsheetApp.openById(THEME_SPREADSHEET_ID);
    const headers=['Event ID','Timestamp','Event type','Theme ID','Theme','Suggested by','Server ID','Source channel ID','Voting channel ID','Message ID','Aye','Nay','No opinion','Total votes','Voter hash','Vote'];
    let sheet=book.getSheetByName('Theme vote events');
    if (!sheet) sheet=book.insertSheet('Theme vote events');
    if (sheet.getLastRow()===0) {
      sheet.appendRow(headers);
      sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#5865f2').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(5,300);
    } else if (sheet.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|')) {
      throw new Error('Theme vote events tab has different headers. Rename it before enabling sync.');
    }
    if (sheet.getRange('A:A').createTextFinder(body.id).matchEntireCell(true).useRegularExpression(false).findNext()) return reply_({ok:true,duplicate:true});
    const d=body.data;
    const values=[body.id,body.timestamp,body.type,d.id,d.theme,d.suggestedBy,d.guildId,d.sourceChannelId,d.channelId,d.messageId,d.aye,d.nay,d.noOpinion,d.totalVotes,d.voterHash,d.answer];
    // Force user strings and Discord IDs to literal text: no formulas or rounding.
    sheet.appendRow(values.map(value=>typeof value==='number' ? value : "'"+String(value ?? '')));
    return reply_({ok:true});
  } catch(error) { return reply_({ok:false,error:String(error.message || error)}); }
  finally { if (lock.hasLock()) lock.releaseLock(); }
}

function reply_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
