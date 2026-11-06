import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const rawIp = headersList.get('x-forwarded-for')?.split(',')[0].trim() || headersList.get('x-real-ip') || '127.0.0.1';
    const ip = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp;
    const userAgent = headersList.get('user-agent') || 'unknown';

    // 1. 안전한 httpOnly 쿠키에서 관리자 토큰 꺼내기
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    
    let adminId = 'UNKNOWN';
    
    // 2. 토큰이 있으면 서버 마스터키(supabaseAdmin)로 관리자 ID 조회
    if (token) {
      const { data } = await supabaseAdmin
        .from('admin')
        .select('admin_id')
        .eq('session_token', token)
        .single();
        
      if (data) adminId = data.admin_id;
    }

    const body = await request.json();
    const { actionType, path, reason } = body;

    // 3. 로그 저장 (actionType에 MEMBER_CREATE 등 상세 사유도 그대로 저장)
    await supabaseAdmin.from('admin_access_logs').insert([{
      admin_id: adminId,
      status: (actionType || '').includes('FAILED') ? 'FAILED' : 'SUCCESS',
      action_type: actionType || 'PAGE_VIEW',
      path: path || null,
      ip_address: ip,
      user_agent: userAgent,
      failure_reason: reason || null,
    }]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('활동 로그 저장 오류:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}