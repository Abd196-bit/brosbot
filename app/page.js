import DashboardControls from './dashboard-controls';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  return <main>
    <header><div><p className="eyebrow">BRO’S JAM · ORGANISER CONTROL ROOM</p><h1>Run the jam.</h1><p className="sub">Live votes, Discord commands, and member verification.</p></div><a className="logout" href="/api/logout">Sign out</a></header>
    <DashboardControls />
  </main>;
}
