import { NextResponse } from 'next/server';
export async function POST(request) {
  const { password } = await request.json();
  if (!process.env.DASHBOARD_PASSWORD || password !== process.env.DASHBOARD_PASSWORD) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('bros_dashboard', password, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
  return response;
}
