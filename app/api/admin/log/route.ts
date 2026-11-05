import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const rawIp =
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';
    const ip = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp;
    const userAgent = headersList.get('user-agent') || 'unknown';

    const body = await request.json();
    const { adminId, actionType, path, reason } = body;

    await supabase.from('admin_access_logs').insert([
      {
        admin_id: adminId || 'GUEST',
        status: actionType === 'LOGIN_FAILED' ? 'FAILED' : 'SUCCESS',
        action_type: actionType || 'PAGE_VIEW',
        path: path || null,
        ip_address: ip,
        user_agent: userAgent,
        failure_reason: reason || null,
      },
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('활동 로그 저장 오류:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}