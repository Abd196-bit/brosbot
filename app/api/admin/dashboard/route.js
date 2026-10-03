import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { dashboardRoot, validateDashboardAction } from '../../../../lib/dashboard-firestore';

export const runtime = 'nodejs';

async function authorised() {
  const jar = await cookies();
  return Boolean(process.env.DASHBOARD_PASSWORD && jar.get('bros_dashboard')?.value === process.env.DASHBOARD_PASSWORD);
}

export async function GET() {
  if (!await authorised()) return Response.json({ error: 'Organiser login required.' }, { status: 401 });
  try {
    const root = dashboardRoot();
    const [state, polls, jobs, campaign] = await Promise.all([
      root.collection('dashboardState').doc('current').get(),
      root.collection('dashboardPolls').limit(100).get(),
      root.collection('dashboardJobs').orderBy('createdAt', 'desc').limit(12).get(),
      root.firestore.collection('verificationCampaigns').doc('current').get(),
    ]);
    return Response.json({ state: state.data() || null, polls: polls.docs.map(doc => doc.data()).sort((a,b) => b.createdAt.localeCompare(a.createdAt)), jobs: jobs.docs.map(doc => ({ id: doc.id, ...doc.data() })), campaign: campaign.data() || null });
  } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
}

export async function POST(request) {
  if (!await authorised()) return Response.json({ error: 'Organiser login required.' }, { status: 401 });
  try {
    const { action, data } = validateDashboardAction(await request.json());
    const id = randomUUID();
    await dashboardRoot().collection('dashboardJobs').doc(id).create({ action, data, status: 'queued', createdAt: new Date().toISOString() });
    return Response.json({ ok: true, id }, { status: 202 });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}
