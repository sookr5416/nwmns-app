'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string>('ADMIN');

  const lastLoggedPathRef = useRef<string>('');

  const logActivity = (actionType: 'PAGE_VIEW' | 'LOGOUT' | 'WINDOW_CLOSE', targetPath?: string) => {
    const adminId = sessionStorage.getItem('adminId') || currentAdminId || 'ADMIN';
    const path = targetPath || pathname;

    fetch('/api/admin/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, actionType, path }),
    }).catch((err) => console.error('활동 로그 전송 실패:', err));
  };

  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/admin/auth', { method: 'GET' });
        const data = await res.json();
        if (res.ok && data.isValid) {
          setIsAuthorized(true);
          setCurrentAdminId(data.adminId);
        } else {
          alert('세션이 만료되었습니다.');
          router.replace('/');
        }
      } catch {
        router.replace('/');
      }
    };
    verifySession();
  }, [router]);

  useEffect(() => {
    if (!isAuthorized || !pathname) return;
    if (lastLoggedPathRef.current === pathname) return;
    lastLoggedPathRef.current = pathname;

    logActivity('PAGE_VIEW', pathname);
  }, [pathname, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;

    const handleBeforeUnload = () => {
      const adminId = sessionStorage.getItem('adminId') || 'ADMIN';
      const payload = JSON.stringify({
        adminId,
        actionType: 'WINDOW_CLOSE',
        path: window.location.pathname,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/admin/log', blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthorized]);

  const menuItems = [
    { name: '코트 및 대기 배정', href: '/admin/courts' },
    { name: '회원 명단 관리', href: '/admin/members' },
    { name: '정모 일정 관리', href: '/admin/attendance' },
    { name: '회원별 출석 관리', href: '/admin/member-attendance' },
    { name: '탈퇴 회원 관리', href: '/admin/member-delete' },
    { name: '로그 관리', href: '/admin/access-logs' },
  ];

  if (!isAuthorized) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">
        인증 확인 중...
      </div>
    );
  }

  const handleLogout = async () => {
    logActivity('LOGOUT', pathname);
    await fetch('/api/admin/auth', { method: 'POST' }); // 쿠키 및 DB 무효화
    router.replace('/');
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