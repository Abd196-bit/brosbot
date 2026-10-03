import { listPolls } from '../lib/poll-store';
import PollComposer from './poll-composer';
import VerificationCampaign from './verification-campaign';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let polls = [];
  let storageError = false;
  try { polls = await listPolls(); } catch { storageError = true; }
  return <main>
    <header><div><p className="eyebrow">BRO’S JAM · ORGANISER CONTROL ROOM</p><h1>Make the next jam loud.</h1><p className="sub">Compose rich Discord polls, then see every result in one place.</p></div><a className="logout" href="/api/logout">Sign out</a></header>
    <p className="notice">New Discord polls are saved on the bot host. Create them with /poll; their results appear directly in Discord. The analytics below show only legacy cloud polls.</p>
    {storageError && <p className="notice">Legacy cloud analytics are not connected.</p>}
    <section className="grid"><PollComposer /><VerificationCampaign /></section>
    <section className="grid"><div className="card"><p className="eyebrow">LIVE POLLS</p><h2>{polls.length} poll{polls.length === 1 ? '' : 's'}</h2><p className="muted">Results update whenever the dashboard reloads.</p></div></section>
    <section className="polls"><h2>Poll analytics</h2>{polls.length ? polls.map((poll) => <article className="poll" key={poll.id}><div className="poll-top"><div><h3>{poll.question}</h3><p>{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'} · created {new Date(poll.createdAt).toLocaleString()}</p></div>{poll.closesAt && <span>{Date.parse(poll.closesAt) > Date.now() ? 'Open' : 'Closed'}</span>}</div>{poll.choices.map((choice, i) => <div className="result" key={choice}><div><b>{choice}</b><span>{poll.counts[i]}</span></div><i style={{ width: `${poll.totalVotes ? (poll.counts[i] / poll.totalVotes) * 100 : 0}%` }} /></div>)}</article>) : <p className="empty">No polls yet. Use the composer to create a command for Discord.</p>}</section>
  </main>;
}
