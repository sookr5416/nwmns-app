'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // useRouter 추가
import { ReactNode, useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false); // 인증 여부 상태

  // 방문증(세션) 검사 로직
  useEffect(() => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    
    if (!isAdmin) {
      alert('관리자 로그인이 필요한 페이지입니다.');
      router.push('/'); // 방문증이 없으면 메인 화면으로 튕겨냄
    } else {
      setIsAuthorized(true); // 방문증이 있으면 화면을 보여주도록 허가
    }
  }, [router]);

  const menuItems = [
    { name: '코트 및 대기 배정', href: '/admin/courts' },
    { name: '회원 명단 관리', href: '/admin/members' },
    { name: '정모 일정 관리', href: '/admin/attendance' },
    { name: '회원별 출석 관리', href: '/admin/member-attendance' },
    { name: '탈퇴 회원 관리', href: '/admin/member-delete' },
  ];

  // 인증을 확인하는 동안에는 빈 화면(또는 로딩)을 띄워 깜빡임 방지
  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">인증 확인 중...</div>;
  }

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
        
        {/* 로그아웃 버튼 추가 */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => {
              sessionStorage.removeItem('isAdmin'); // 방문증 파기
              router.push('/');
            }}
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