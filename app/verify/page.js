'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function VerifyForm() {
  const token = useSearchParams().get('token') || '';
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function sendCode(event) { event.preventDefault(); setBusy(true); setMessage(''); const response = await fetch('/api/verify/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, email }) }); const body = await response.json(); setBusy(false); if (!response.ok) return setMessage(body.error); setSent(true); setMessage('Code sent. Check your inbox and spam folder.'); }
  async function confirm(event) { event.preventDefault(); setBusy(true); setMessage(''); const response = await fetch('/api/verify/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, code }) }); const body = await response.json(); setBusy(false); if (!response.ok) return setMessage(body.error); setMessage('Verified! Return to Discord in a moment—the bot will give you access.'); }
  return <main className="login"><form className="card" onSubmit={sent ? confirm : sendCode}><p className="eyebrow">BRO’S JAM</p><h1>Verify your email</h1><p className="muted">We use your email only to confirm you control it and record your verified membership.</p>{sent ? <label>Six-digit code<input inputMode="numeric" maxLength="6" value={code} onChange={event => setCode(event.target.value)} required autoFocus /></label> : <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoFocus /></label>}<button disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify email' : 'Send verification code'}</button>{message && <p role="status" className={message.startsWith('Verified') || message.startsWith('Code sent') ? 'muted' : 'error'}>{message}</p>}</form></main>;
}

export default function VerifyPage() { return <Suspense fallback={<main className="login"><p className="muted">Loading verification…</p></main>}><VerifyForm /></Suspense>; }
