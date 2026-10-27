import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const { adminId, adminPw } = await request.json();

    if (!adminId || !adminPw) {
      return NextResponse.json(
        { message: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // admin 테이블에서 해당 아이디의 정보 가져오기
    const { data: adminUser, error } = await supabase
      .from('admin')
      .select('admin_id, admin_pw')
      .eq('admin_id', adminId)
      .single();

    if (error || !adminUser) {
      return NextResponse.json({ message: '인증 실패' }, { status: 401 });
    }

    // 입력된 비밀번호(adminPw)와 DB에 저장된 bcrypt 해시(admin_pw) 비교
    const isPasswordValid = await bcrypt.compare(adminPw, adminUser.admin_pw);
    if (!isPasswordValid) {
      return NextResponse.json({ message: '인증 실패' }, { status: 401 });
    }

    // 일치하면 난수 세션 토큰 생성 후 DB 갱신
    const sessionToken = crypto.randomUUID();
    await supabase
      .from('admin')
      .update({ session_token: sessionToken })
      .eq('admin_id', adminId);

    // 클라이언트에 토큰 전달
    return NextResponse.json({ token: sessionToken }, { status: 200 });
  } catch (err) {
    console.error('Login API Error:', err);
    return NextResponse.json({ message: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}