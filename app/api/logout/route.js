import { NextResponse } from 'next/server';
export async function GET(request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('bros_dashboard');
  return response;
}
