'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false); 

  // 방문증(토큰) DB 검증 로직
  useEffect(() => {
    const verifySession = async () => {
      // 브라우저에서 토큰 꺼내기
      const token = sessionStorage.getItem('adminToken');
      
      // 1차 방어: 아예 토큰이 없으면 쫓아냄
      if (!token) {
        alert('관리자 로그인이 필요한 페이지입니다.');
        router.push('/');
        return;
      }

      // 2차 방어: 브라우저의 토큰과 DB에 저장된 토큰이 일치하는지 검사
      const { data, error } = await supabase
        .from('admin')
        .select('admin_id')
        .eq('session_token', token);

      if (data && data.length > 0) {
        // 일치하는 데이터가 있으면 진짜 관리자로 인정!
        setIsAuthorized(true); 
      } else {
        // 해커가 F12로 'true'나 가짜 값을 넣고 들어온 경우 쫓아냄
        alert('비정상적인 접근이거나 세션이 만료되었습니다.');
        sessionStorage.removeItem('adminToken');
        router.push('/');
      }
    };

    verifySession();
  }, [router]);

  const menuItems = [
    { name: '코트 및 대기 배정', href: '/admin/courts' },
    { name: '회원 명단 관리', href: '/admin/members' },
    { name: '정모 일정 관리', href: '/admin/attendance' },
    { name: '회원별 출석 관리', href: '/admin/member-attendance' },
    { name: '탈퇴 회원 관리', href: '/admin/member-delete' },
  ];

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">인증 확인 중...</div>;
  }

  // 로그아웃 함수: DB의 토큰도 폐기
  const handleLogout = async () => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      // DB에 저장된 토큰을 비워버림 (null 처리)
      await supabase.from('admin').update({ session_token: null }).eq('session_token', token);
    }
    sessionStorage.removeItem('adminToken');
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col flex-shrink-0 shadow-xl z-30">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-extrabold tracking-tight text-indigo-400">클럽 관리 시스템</h1>
          <p className="text-xs text-slate-400 mt-1">배드민턴 모임 운영 솔루션</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* 로그아웃 버튼 */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full py-2 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 relative">
        {children}
      </main>

    </div>
  );
}