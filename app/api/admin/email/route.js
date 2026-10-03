import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { verificationDb } from '../../../../lib/firebase-admin';
import { listVerifiedMembers } from '../../../../lib/verified-members';

export const runtime = 'nodejs';

async function authorised() {
  const jar = await cookies();
  return Boolean(process.env.DASHBOARD_PASSWORD && jar.get('bros_dashboard')?.value === process.env.DASHBOARD_PASSWORD);
}

export async function GET() {
  if (!await authorised()) return Response.json({ error: 'Organiser login required.' }, { status: 401 });
  try { return Response.json({ members: await listVerifiedMembers() }); }
  catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
}

export async function POST(request) {
  if (!await authorised()) return Response.json({ error: 'Organiser login required.' }, { status: 401 });
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) throw new Error('Gmail SMTP is not configured on Vercel.');
    const body = await request.json();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    if (!subject || subject.length > 150 || !message || message.length > 5000) throw new Error('Enter a subject and message.');
    const members = await listVerifiedMembers();
    const selected = body.recipient === 'all' ? members : members.filter(member => member.userId === body.recipient);
    const emails = [...new Set(selected.map(member => member.email))];
    if (!emails.length) throw new Error('Choose a verified member.');
    if (emails.length > 50) throw new Error('This email has over 50 recipients. Send smaller batches.');
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE !== 'false', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD } });
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await transport.sendMail({ from, to: body.recipient === 'all' ? from : emails[0], ...(body.recipient === 'all' ? { bcc: emails } : {}), subject, text: message });
    await verificationDb().collection('organiserEmails').doc(randomUUID()).set({ subject, recipientCount: emails.length, audience: body.recipient === 'all' ? 'all' : 'one', sentAt: new Date().toISOString() });
    return Response.json({ ok: true, sent: emails.length });
  } catch (error) { return Response.json({ error: error.message || 'Email could not be sent.' }, { status: 400 }); }
}
