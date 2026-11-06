import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const DUMMY_HASH = '$2a$10$wN9iL6L/n1oA8P4Z1C6B4.zXQYmP3rK5vT8eU7wI9oL4jK2mN0pQe';

function getClientIp(headersList: Headers): string {
  const rawIp = headersList.get('x-vercel-forwarded-for') || headersList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  return (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp;
}

export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const userAgent = headersList.get('user-agent') || 'unknown';

  let inputAdminId = '';

  try {
    const body = await request.json();
    inputAdminId = body.adminId?.trim() || '';
    const adminPw = body.adminPw || '';

    // 1. 아이디/비밀번호 미입력
    if (!inputAdminId || !adminPw) {
      await supabaseAdmin.from('admin_access_logs').insert([{ 
        admin_id: inputAdminId || 'UNKNOWN', action_type: 'LOGIN', status: 'FAILED', ip_address: ip, user_agent: userAgent, 
        failure_reason: '아이디 또는 비밀번호 미입력' // ⬅️ 상세 사유 기록
      }]);
      return NextResponse.json({ message: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    // 2. 브루트포스 방어 (5분 내 5회 실패 시 차단)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: failCount } = await supabaseAdmin
      .from('admin_access_logs')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', inputAdminId)
      .eq('status', 'FAILED')
      .gte('created_at', fiveMinutesAgo);

    if ((failCount || 0) >= 5) {
      await supabaseAdmin.from('admin_access_logs').insert([{ 
        admin_id: inputAdminId, action_type: 'LOGIN', status: 'FAILED', ip_address: ip, user_agent: userAgent, 
        failure_reason: '5분간 계정 잠금 (연속 5회 실패)' // ⬅️ 상세 사유 기록
      }]);
      return NextResponse.json({ message: '연속된 실패로 5분간 계정이 잠겼습니다.' }, { status: 429 });
    }

    // 3. 타이밍 공격 방어 및 계정 검증
    const { data: adminUser } = await supabaseAdmin.from('admin').select('admin_id, admin_pw').eq('admin_id', inputAdminId).single();
    const isPasswordValid = await bcrypt.compare(adminPw, adminUser ? adminUser.admin_pw : DUMMY_HASH);

    if (!adminUser || !isPasswordValid) {
      // ▼ DB 로그용으로만 사유를 상세하게 분리
      const exactReason = !adminUser ? '존재하지 않는 관리자 계정' : '비밀번호 불일치';
      
      await supabaseAdmin.from('admin_access_logs').insert([{ 
        admin_id: inputAdminId, action_type: 'LOGIN', status: 'FAILED', ip_address: ip, user_agent: userAgent, 
        failure_reason: exactReason // ⬅️ 상세 사유 기록 (로그 확인용)
      }]);

      // ▼ 화면에는 무엇이 틀렸는지 모르게 통합 메시지 전달
      return NextResponse.json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 4. 로그인 성공: 토큰 발급 및 쿠키 굽기 (12시간 유효)
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const { error: updateError } = await supabaseAdmin
      .from('admin')
      .update({ session_token: sessionToken, token_expires_at: expiresAt.toISOString() })
      .eq('admin_id', inputAdminId);

    if (updateError) {
      console.error("🔥 DB 토큰 저장 실패:", updateError);
      throw new Error("DB 업데이트 실패");
    }

    await supabaseAdmin.from('admin_access_logs').insert([{ 
      admin_id: inputAdminId, action_type: 'LOGIN', status: 'SUCCESS', ip_address: ip, user_agent: userAgent 
    }]);

    const response = NextResponse.json({ success: true }, { status: 200 });
    const cookieStore = await cookies();
    cookieStore.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    console.error('🔥 500 에러 상세 원인:', err);
    return NextResponse.json({ message: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}



/*

1. 웹페이지 원천 차단 (미들웨어 도입)

이전: 일단 관리자 화면의 UI(디자인)와 코드가 브라우저로 다운. (뒤늦게 쫓아내는 방식) 
      해커가 화면이 깜빡이는 틈을 타 스크립트를 조작하면 화면을 강제로 띄워볼 수 있는 틈이 있음.

변경: Next.js 서버가 문지기 (미들웨어) 아예 화면 자체를 내려보내지 않음. 
      권한이 없으면 관리자 페이지의 버튼 하나, 텍스트 하나조차 구경할 수 없이 로그인 페이지로 즉각 튕겨냄。


2. 방문증(토큰) 보관 장소의 변경 (sessionStorage ➔ httpOnly 쿠키)

이전: 로그인 성공 시 발급받은 토큰을 브라우저의 서랍장(sessionStorage)에 보관. 
      이 서랍장은 누구나 F12를 눌러 열어볼 수 있고, 악성 자바스크립트 (XSS 공격)가 침투하면 토큰을 훔쳐 갈 수 있는 위험한 장소

변경： 토큰을 httpOnly라는 특수한 보안 쿠키에 담아 서버가 직접 브라우저에 구워줌. 
      이 쿠키는 브라우저가 통신할 때 서버에 자동으로 제시되지만, 해커는 물론이고 브라우저의 자바스크립트조차 절대 값을 읽거나 꺼내볼 수 없는 투명 금고에 보관.


3. 데이터베이스 직통 연결 끊기 (서버 검증으로 이관)

이전: 브라우저(클라이언트)가 직접 Supabase 데이터베이스에 물어봄. 
변경: 브라우저는 절대 DB와 직접 대화할 수 없습니다. 
      무조건 Next.js 백엔드 서버(API)에게 "나 방문증(쿠키) 있는데 확인 좀 해줘"라고 요청합니다. 
      그러면 마스터 키(Service Role Key)를 쥔 백엔드 서버만이 굳게 닫힌 DB 문을 열고 들어가 토큰을 대조한 뒤, 브라우저에게 "통과" 혹은 "탈락"이라는 결과만 통보합니다.


4. 무차별 로그인 공격(Brute Force) 완전 방어

이전: 해커가 매크로 프로그램을 돌려 1초에 100번씩 비밀번호를 무작위로 찍어 맞춰도 시스템이 이를 막지 못했음.
변경: 5분 안에 비밀번호를 5번 틀리면 계정이 즉시 잠깁니다. 


5. 무한정 유효한 방문증 폐기 (세션 만료 시간 부여)

이전: 한 번 로그인하면, 로그아웃 버튼을 누르지 않는 이상 그 토큰은 1년이 지나도 계속 유효.
변경: 토큰에 12시간이라는 명확한 수명(TTL)이 생김。

*/