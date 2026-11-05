'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AdminActivityTracker() {
  const pathname = usePathname();
  const lastPathRef = useRef<string>('');

  // 현재 로그인된 관리자 ID (세션 스토리지나 로컬 스토리지에 저장된 값 추출)
  const getAdminId = () => {
    if (typeof window === 'undefined') return 'ADMIN';
    return localStorage.getItem('adminId') || sessionStorage.getItem('adminId') || 'ADMIN';
  };

  // 1. 메뉴/페이지 이동 감지 (PAGE_VIEW)
  useEffect(() => {
    if (!pathname || pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const adminId = getAdminId();

    fetch('/api/admin/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId,
        actionType: 'PAGE_VIEW',
        path: pathname,
      }),
    }).catch((err) => console.error('페이지 이동 로그 실패:', err));
  }, [pathname]);

  // 2. 창 닫기 / 탭 종료 감지 (WINDOW_CLOSE)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const adminId = getAdminId();
      const payload = JSON.stringify({
        adminId,
        actionType: 'WINDOW_CLOSE',
        path: window.location.pathname,
      });

      // 창이 닫힐 때는 fetch 대신 브라우저 백그라운드 전송 보장 기술인 sendBeacon 사용
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/admin/log', blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}