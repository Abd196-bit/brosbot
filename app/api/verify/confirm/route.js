import { NextResponse } from 'next/server';
import { verificationDb } from '../../../../lib/firebase-admin';
import { hashVerificationCode, readVerificationToken, verificationSessionId } from '../../../../lib/verification-token';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { token, code } = await request.json();
    const member = readVerificationToken(token);
    const id = verificationSessionId(token);
    const ref = verificationDb().collection('verificationSessions').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Send a verification code first.');
    const session = snapshot.data();
    if (Date.parse(session.expiresAt) <= Date.now()) throw new Error('That code expired. Send a new one.');
    if (session.codeHash !== hashVerificationCode(String(code || '').trim())) throw new Error('That code is not correct.');
    await ref.update({ status: 'pending_role', emailVerifiedAt: new Date().toISOString(), codeHash: null });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error.message || 'Unable to verify code.' }, { status: 400 }); }
}
