'use client';

import { useCallback, useEffect, useState } from 'react';
import VerificationCampaign from './verification-campaign';

export default function DashboardControls() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [announcement, setAnnouncement] = useState(''), [activity, setActivity] = useState('');
  const [jam, setJam] = useState({ name: '', theme: '', url: '' });
  const [settings, setSettings] = useState({ announcementChannelId: '', voteChannelId: '', verifiedRoleId: '', rules: '', resources: '' });
  const [poll, setPoll] = useState({ channelId: '', question: '', choices: ['', ''], allowText: true });
  const refresh = useCallback(async () => {
    try { const response = await fetch('/api/admin/dashboard', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(''); }
    catch (failure) { setError(failure.message); }
  }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { if (data?.state?.jam) setJam(current => current.name ? current : { name: data.state.jam.name || '', theme: data.state.jam.theme || '', url: data.state.jam.url || '' }); }, [data?.state?.jam?.name]);
  useEffect(() => { if (data?.state?.rules) setSettings(current => current.rules ? current : { announcementChannelId: data.state.announcementChannelId || '', voteChannelId: data.state.voteChannelId || '', verifiedRoleId: data.state.verifiedRoleId || '', rules: data.state.rules || '', resources: data.state.resources || '' }); }, [data?.state?.rules]);
  async function act(action, payload) {
    setNotice('');
    try { const response = await fetch('/api/admin/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, data: payload }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setNotice('Queued. The bot should run this within 10 seconds.'); await refresh(); }
    catch (failure) { setNotice(failure.message); }
  }
  const online = data?.state && Date.now() - Date.parse(data.state.lastSeen) < 45000;
  return <>
    <div className="statusbar"><strong>{online ? '● Bot online' : '○ Bot offline or not connected'}</strong><span>{data?.state?.botName || 'Waiting for bot'} · Updated {data?.state?.lastSeen ? new Date(data.state.lastSeen).toLocaleTimeString() : 'never'}</span><button type="button" className="secondary" onClick={refresh}>Refresh</button></div>
    {error && <p className="notice">Dashboard data: {error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    <section className="grid">
      <div className="card"><p className="eyebrow">DISCORD ANNOUNCEMENT</p><h2>Send an update</h2><p className="muted">Channel: {data?.state?.announcementChannelId || 'Set ANNOUNCEMENT_CHANNEL_ID'}</p><textarea value={announcement} onChange={event => setAnnouncement(event.target.value)} maxLength={1800} placeholder="Jam starts tomorrow!"/><button type="button" onClick={() => act('announce', { message: announcement })}>Post announcement</button></div>
      <div className="card"><p className="eyebrow">BOT ACTIVITY</p><h2>Set Playing text</h2><p className="muted">Current: {data?.state?.activity || 'unknown'}</p><input value={activity} onChange={event => setActivity(event.target.value)} maxLength={120} placeholder="BRO’S JAM • /poll"/><button type="button" onClick={() => act('activity', { text: activity })}>Update activity</button></div>
    </section>
    <section className="grid">
      <div className="card"><p className="eyebrow">/JAM AND /SUBMIT</p><h2>Jam details</h2><label>Name<input value={jam.name} onChange={event => setJam({ ...jam, name: event.target.value })}/></label><label>Theme<input value={jam.theme} onChange={event => setJam({ ...jam, theme: event.target.value })}/></label><label>Jam URL<input type="url" value={jam.url} onChange={event => setJam({ ...jam, url: event.target.value })}/></label><button type="button" onClick={() => act('jam', jam)}>Save jam details</button><p className="hint">Schedule dates come from your calendar Sheet. Details saved here last until the bot restarts.</p></div>
      <div className="card"><p className="eyebrow">PUBLISH TO DISCORD</p><h2>New poll</h2><label>Channel ID<input value={poll.channelId} onChange={event => setPoll({ ...poll, channelId: event.target.value })} placeholder="123456789012345678"/></label><label>Question<input value={poll.question} onChange={event => setPoll({ ...poll, question: event.target.value })}/></label>{poll.choices.map((choice, index) => <label key={index}>Answer {index + 1}<input value={choice} onChange={event => setPoll({ ...poll, choices: poll.choices.map((item, i) => i === index ? event.target.value : item) })}/></label>)}<div className="two"><button type="button" className="secondary" disabled={poll.choices.length >= 10} onClick={() => setPoll({ ...poll, choices: [...poll.choices, ''] })}>Add answer</button><button type="button" className="secondary" disabled={poll.choices.length <= 2} onClick={() => setPoll({ ...poll, choices: poll.choices.slice(0, -1) })}>Remove answer</button></div><label className="check"><input type="checkbox" checked={poll.allowText} onChange={event => setPoll({ ...poll, allowText: event.target.checked })}/>Allow private written ideas</label><button type="button" onClick={() => act('poll.create', poll)}>Publish poll</button></div>
    </section>
    <section className="grid"><VerificationCampaign/><div className="card"><p className="eyebrow">VERIFICATION CAMPAIGN</p><h2>{data?.campaign?.status || 'Not started'}</h2><p className="muted">Sent {data?.campaign?.sent || 0} · Failed {data?.campaign?.failed || 0} · Skipped {data?.campaign?.skipped || 0}</p></div></section>
    <section className="grid"><div className="card"><p className="eyebrow">COMMAND SETTINGS</p><h2>Channels and role</h2>{[['announcementChannelId','Announcements channel'],['voteChannelId','Theme vote channel'],['verifiedRoleId','Verified role']].map(([key,label]) => <label key={key}>{label} ID<input value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })}/></label>)}<button type="button" onClick={() => act('settings', settings)}>Save command settings</button></div><div className="card"><p className="eyebrow">COMMAND TEXT</p><h2>/rules and /resources</h2><label>/rules<textarea value={settings.rules} onChange={event => setSettings({ ...settings, rules: event.target.value })}/></label><label>/resources<textarea value={settings.resources} onChange={event => setSettings({ ...settings, resources: event.target.value })}/></label><button type="button" onClick={() => act('settings', settings)}>Save command text</button></div></section>
    <section className="polls"><h2>Live Discord votes</h2>{data?.polls?.length ? data.polls.map(item => <article className="poll" key={item.id}><div className="poll-top"><div><p className="eyebrow">{item.kind === 'theme' ? 'THEME VOTE' : 'POLL'}</p><h3>{item.question}</h3><p className="muted">{item.totalVotes} votes · {new Date(item.createdAt).toLocaleString()}</p></div><span>{item.closed ? 'Closed' : 'Open'}</span></div>{item.choices.map((choice, index) => <div className="result" key={index}><div><b>{choice}</b><span>{item.counts[index] || 0}</span></div><i style={{ width: `${item.totalVotes ? (item.counts[index] || 0) / item.totalVotes * 100 : 0}%` }}/></div>)}{item.kind !== 'theme' && !item.closed && <button type="button" className="secondary" onClick={() => act('poll.close', { pollId: item.id })}>Close poll</button>}</article>) : <p className="empty">No bot polls yet.</p>}</section>
    <section className="polls"><h2>Recent actions</h2>{data?.jobs?.length ? data.jobs.map(job => <p key={job.id} className="job">{job.action} · {job.status}{job.error ? ` · ${job.error}` : ''}{job.messageUrl ? <> · <a href={job.messageUrl} target="_blank" rel="noreferrer">Open Discord message</a></> : null}</p>) : <p className="empty">No dashboard actions yet.</p>}</section>
  </>;
}
