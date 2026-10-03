'use client';

import { useState } from 'react';

export default function VerificationCampaign() {
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  async function start() { setBusy(true); setStatus(''); const response = await fetch('/api/admin/verification-dm', { method: 'POST' }); const body = await response.json(); setBusy(false); setStatus(response.ok ? 'Campaign queued. The bot will DM eligible members shortly.' : body.error || 'Could not queue the campaign.'); }
  return <div className="card"><p className="eyebrow">OPTIONAL MEMBER VERIFICATION</p><h2>Invite members to verify</h2><p className="muted">Members can use the server without verifying. If you choose, send one optional verification DM to current non-admin members who do not have the Verified role. Members with closed DMs are counted as failed.</p><button type="button" disabled={busy} onClick={start}>{busy ? 'Queuing…' : 'Send optional verification invites'}</button>{status && <p role="status" className={status.startsWith('Campaign') ? 'muted' : 'error'}>{status}</p>}</div>;
}
