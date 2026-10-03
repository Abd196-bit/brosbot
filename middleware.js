import { NextResponse } from 'next/server';
export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/') || pathname === '/login' || pathname === '/verify') return NextResponse.next();
  if (request.cookies.get('bros_dashboard')?.value === process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
