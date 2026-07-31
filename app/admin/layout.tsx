'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { name: '코트 및 대기 배정', href: '/admin/courts' },
    { name: '회원 명단 관리', href: '/admin/members' },
    { name: '정모 일정 관리', href: '/admin/attendance' },
    { name: '회원별 출석 관리', href: '/admin/member-attendance' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* 좌측 메뉴 영역: 모바일에서는 아예 안 뜨고(hidden), PC(md 이상)에서만 flex로 나타납니다 */}
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
      </aside>

      {/* 🌟 우측 메인 콘텐츠 영역: 모바일에서는 전체 화면을 가득 채웁니다 */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 relative">
        {children}
      </main>

    </div>
  );
}



/*

1. 코트 및 대기 배정
2. 회원 명단
3. 정모 정보 게시판 (어디서 몇 시, 게스트 몇 명, 정원 몇 명)
4. 전체 출석 게시판


*/