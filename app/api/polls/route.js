import { createPoll, listPolls } from '../../../lib/poll-store';

function authorised(request) { return request.headers.get('authorization') === `Bearer ${process.env.BOT_API_SECRET}`; }
export async function GET(request) {
  if (!authorised(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await listPolls());
}
export async function POST(request) {
  if (!authorised(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.question || !Array.isArray(body.choices) || body.choices.length < 2 || body.choices.length > 10) return Response.json({ error: 'Invalid poll' }, { status: 400 });
  return Response.json(await createPoll(body), { status: 201 });
}
