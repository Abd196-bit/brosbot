let syncing = false;

export function sheetsConfigured() {
  return Boolean((process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) || (process.env.THEME_SHEETS_WEBHOOK_URL && process.env.THEME_SHEETS_WEBHOOK_SECRET));
}

export async function flushSheetEvents(repository) {
  if (!sheetsConfigured() || syncing) return;
  syncing = true;
  try {
    const events=[
      ...(process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_WEBHOOK_SECRET ? repository.pendingSheetEvents(25,'poll') : []),
      ...(process.env.THEME_SHEETS_WEBHOOK_URL && process.env.THEME_SHEETS_WEBHOOK_SECRET ? repository.pendingSheetEvents(25,'theme') : []),
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
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || 'Webhook rejected the event');
        repository.completeSheetEvent(event.id);
      } catch (error) {
        console.error('Google Sheets sync paused:', error.message);
        continue;
      } finally { clearTimeout(timeout); }
    }
  } finally { syncing = false; }
}
