'use client';

import { useEffect, useState } from 'react';

export default function VerifiedEmail() {
  const [members, setMembers] = useState([]), [recipient, setRecipient] = useState(''), [subject, setSubject] = useState(''), [message, setMessage] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/admin/email').then(response => response.json()).then(body => { if (body.members) setMembers(body.members); else setStatus(body.error || 'Unable to load verified members.'); }).catch(error => setStatus(error.message)); }, []);
  async function send(event) {
    event.preventDefault();
    if (recipient === 'all' && !window.confirm(`Send this email to all ${members.length} verified members?`)) return;
    setBusy(true); setStatus('');
    try { const response = await fetch('/api/admin/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipient, subject, message }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setStatus(`Email sent to ${body.sent} verified ${body.sent === 1 ? 'member' : 'members'}.`); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  return <section className="card"><p className="eyebrow">VERIFIED MEMBER EMAIL</p><h2>Email members</h2><p className="muted">Only completed email verifications appear here. All-member mail uses BCC.</p><form onSubmit={send}><label>Recipient<select value={recipient} onChange={event => setRecipient(event.target.value)} required><option value="">Choose a member</option><option value="all">All verified members ({members.length})</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.username} — {member.email}</option>)}</select></label><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} maxLength={150} required/></label><label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={5000} required/></label><button disabled={busy || !members.length}>{busy ? 'Sending…' : 'Send email'}</button><p role="status" className="muted">{status}</p></form></section>;
}
