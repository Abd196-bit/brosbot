import { vote } from '../../../../../lib/poll-store';
export async function POST(request, { params }) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.BOT_API_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try { const body = await request.json(); return Response.json(await vote((await params).id, body.userId, body.choice, body.text)); }
  catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}
