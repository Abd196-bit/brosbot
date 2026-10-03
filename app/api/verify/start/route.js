import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verificationDb } from '../../../../lib/firebase-admin';
import { hashVerificationCode, readVerificationToken, verificationCode, verificationSessionId } from '../../../../lib/verification-token';

export const runtime = 'nodejs';

function mailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) throw new Error('Email sending is not configured.');
  return nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE !== 'false', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD } });
}

export async function POST(request) {
  try {
    const { token, email } = await request.json();
    const member = readVerificationToken(token);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) throw new Error('Enter a valid email address.');
    const code = verificationCode();
    const id = verificationSessionId(token);
    await verificationDb().collection('verificationSessions').doc(id).set({ ...member, email: cleanEmail, codeHash: hashVerificationCode(code), status: 'email_sent', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    await mailer().sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: cleanEmail, subject: 'Your BRO’S JAM verification code', text: `Your BRO’S JAM verification code is ${code}. It expires in 15 minutes. Do not share this code.` });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error.message || 'Unable to send code.' }, { status: 400 }); }
}
