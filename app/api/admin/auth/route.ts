import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// 세션 유효성 검증 (GET)
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (!token) return NextResponse.json({ isValid: false }, { status: 401 });

  const { data: adminUser } = await supabaseAdmin
    .from('admin')
    .select('admin_id, token_expires_at')
    .eq('session_token', token)
    .single();

  if (!adminUser || (adminUser.token_expires_at && new Date(adminUser.token_expires_at) < new Date())) {
    const response = NextResponse.json({ isValid: false }, { status: 401 });
    response.cookies.delete('admin_session');
    return response;
  }

  return NextResponse.json({ isValid: true, adminId: adminUser.admin_id }, { status: 200 });
}

// 로그아웃 처리 (POST)
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (token) {
    await supabaseAdmin.from('admin').update({ session_token: null, token_expires_at: null }).eq('session_token', token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_session');
  return response;
}