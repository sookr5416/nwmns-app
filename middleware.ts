import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin 하위 경로 전체 보호
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('admin_session');

    // 세션 쿠키가 없으면 관리자 화면 소스코드 자체를 전송하지 않고 튕겨냄
    if (!sessionCookie || !sessionCookie.value) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};