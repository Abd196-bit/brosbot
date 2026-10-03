import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verificationDb } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST() {
  const jar = await cookies();
  if (!process.env.DASHBOARD_PASSWORD || jar.get('bros_dashboard')?.value !== process.env.DASHBOARD_PASSWORD) return NextResponse.json({ error: 'Organiser login required.' }, { status: 401 });
  try {
    await verificationDb().collection('verificationCampaigns').doc('current').set({ status: 'requested', requestedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error.message || 'Firebase is not configured.' }, { status: 400 }); }
}
