import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../../lib/supabase';

// 접속 로그 기록 공통 헬퍼 함수
async function insertAccessLog(params: {
  adminId: string;
  status: 'SUCCESS' | 'FAILED';
  ip: string;
  userAgent: string;
  reason?: string;
}) {
  try {
    await supabase.from('admin_access_logs').insert([
      {
        admin_id: params.adminId || 'UNKNOWN',
        status: params.status,
        ip_address: params.ip,
        user_agent: params.userAgent,
        failure_reason: params.reason || null,
      },
    ]);
  } catch (logErr) {
    console.error('접속 로그 기록 실패:', logErr);
  }
}

export async function POST(request: Request) {
  // 요청 헤더에서 실제 IP 및 브라우저/기기 정보(User-Agent) 추출
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = headersList.get('user-agent') || 'unknown';

  let inputAdminId = '';

  try {
    const body = await request.json();
    inputAdminId = body.adminId?.trim() || '';
    const adminPw = body.adminPw || '';

    // 1. 아이디 / 비밀번호 미입력
    if (!inputAdminId || !adminPw) {
      await insertAccessLog({
        adminId: inputAdminId,
        status: 'FAILED',
        ip,
        userAgent,
        reason: '아이디 또는 비밀번호 미입력',
      });

      return NextResponse.json(
        { message: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 2. admin 테이블에서 계정 조회
    const { data: adminUser, error } = await supabase
      .from('admin')
      .select('admin_id, admin_pw')
      .eq('admin_id', inputAdminId)
      .single();

    // 존재하지 않는 계정인 경우
    if (error || !adminUser) {
      await insertAccessLog({
        adminId: inputAdminId,
        status: 'FAILED',
        ip,
        userAgent,
        reason: '존재하지 않는 관리자 계정',
      });

      return NextResponse.json({ message: '인증 실패' }, { status: 401 });
    }

    // 3. 비밀번호(bcrypt) 검증
    const isPasswordValid = await bcrypt.compare(adminPw, adminUser.admin_pw);
    if (!isPasswordValid) {
      await insertAccessLog({
        adminId: inputAdminId,
        status: 'FAILED',
        ip,
        userAgent,
        reason: '비밀번호 불일치',
      });

      return NextResponse.json({ message: '인증 실패' }, { status: 401 });
    }

    // 4. 인증 성공: 난수 세션 토큰 생성 및 DB 갱신
    const sessionToken = crypto.randomUUID();
    await supabase
      .from('admin')
      .update({ session_token: sessionToken })
      .eq('admin_id', inputAdminId);

    // 성공 로그 INSERT
    await insertAccessLog({
      adminId: inputAdminId,
      status: 'SUCCESS',
      ip,
      userAgent,
      reason: undefined,
    });

    // 클라이언트에 토큰 전달
    return NextResponse.json({ token: sessionToken }, { status: 200 });
  } catch (err) {
    console.error('Login API Error:', err);

    // 5. 서버 예외 발생 시 실패 로그 INSERT
    await insertAccessLog({
      adminId: inputAdminId,
      status: 'FAILED',
      ip,
      userAgent,
      reason: '서버 내부 처리 오류',
    });

    return NextResponse.json(
      { message: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}