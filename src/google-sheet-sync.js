let syncing = false;

function webhookConfigured(url, secret) {
  if (!url || !secret) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (!parsed.hostname.endsWith('script.google.com') || parsed.pathname.endsWith('/exec'));
  } catch { return false; }
}

export function pollSheetsConfigured() {
  return webhookConfigured(process.env.GOOGLE_SHEETS_WEBHOOK_URL, process.env.GOOGLE_SHEETS_WEBHOOK_SECRET);
}

export function themeSheetsConfigured() {
  return webhookConfigured(process.env.THEME_SHEETS_WEBHOOK_URL, process.env.THEME_SHEETS_WEBHOOK_SECRET);
}

export function sheetsConfigured() {
  return pollSheetsConfigured() || themeSheetsConfigured();
}

export async function flushSheetEvents(repository) {
  if (!sheetsConfigured() || syncing) return;
  syncing = true;
  try {
    const events=[
      ...(pollSheetsConfigured() ? repository.pendingSheetEvents(25,'poll') : []),
      ...(themeSheetsConfigured() ? repository.pendingSheetEvents(25,'theme') : []),
    ];
    for (const event of events) {
      const themeEvent=event.type.startsWith('theme.');
      const url=themeEvent ? process.env.THEME_SHEETS_WEBHOOK_URL : process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      const secret=themeEvent ? process.env.THEME_SHEETS_WEBHOOK_SECRET : process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
      if (!url || !secret) continue;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret, ...event }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let result;
        try { result = JSON.parse(await response.text()); }
        catch { throw new Error('Webhook returned a web page instead of JSON. Use the published Apps Script /exec URL with access set to Anyone.'); }
        if (!result.ok) throw new Error(result.error || 'Webhook rejected the event');
        repository.completeSheetEvent(event.id);
      } catch (error) {
        console.error(`${themeEvent ? 'Theme' : 'Poll'} Google Sheets sync paused:`, error.message);
        continue;
      } finally { clearTimeout(timeout); }
    }
  } finally { syncing = false; }
}
