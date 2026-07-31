'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { Player, Court } from './types';
import CourtSection from './components/CourtSection';

export default function UserHomePage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [now, setNow] = useState(Date.now());

  // 🌟 로그인 팝업 상태 관리
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [loginError, setLoginError] = useState(false);

  // 타이머
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (startTime: number) => {
    const diff = Math.floor((now - startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // 실시간 데이터 구독
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase.from('players').select('*');
      if (data) setPlayers(data);
    };

    const fetchCourts = async () => {
      const { data } = await supabase.from('courts').select('*').order('order_idx', { ascending: true });
      if (data) setCourts(data);
    };

    fetchPlayers();
    fetchCourts();

    const playersSub = supabase.channel('players_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchPlayers).subscribe();

    const courtsSub = supabase.channel('courts_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, fetchCourts).subscribe();

    return () => {
      supabase.removeChannel(playersSub);
      supabase.removeChannel(courtsSub);
    };
  }, []);

  // Supabase admin 테이블 연동 로그인 처리
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    
    // admin 테이블에서 입력한 id와 password가 일치하는 데이터 조회
    const { data, error } = await supabase
      .from('admin')
      .select('*')
      .eq('admin_id', adminId)     // DB 컬럼명 확인 (id)
      .eq('admin_pw', adminPw);    // DB 컬럼명 확인 (password)

    if (data && data.length > 0) {
      // 로그인 성공
      sessionStorage.setItem('isAdmin', 'true');
      
      setShowLoginModal(false);
      setAdminId('');
      setAdminPw('');
      setLoginError(false);
      router.push('/admin/courts'); // 관리자 페이지로 이동
    } else {
      // 로그인 실패
      setLoginError(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      
      {/* 우측 하단 관리자 모드 접속 버튼 */}
      <button
        onClick={() => {
          setShowLoginModal(true);
          setAdminId('');
          setAdminPw('');
          setLoginError(false);
        }}
        className="fixed bottom-6 right-6 bg-slate-800 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-600 transition-all z-[50] hover:scale-110 active:scale-95 cursor-pointer"
        title="관리자 모드 접속"
      >
        ⚙️
      </button>

      <CourtSection 
        viewMode="user" 
        courts={courts} 
        players={players} 
        formatTime={formatTime} 
      />

      {/* 🌟 로그인 팝업 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">관리자 로그인</h2>
              <button 
                onClick={() => setShowLoginModal(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {/* 아이디 입력란 추가 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">아이디</label>
                <input 
                  type="text" 
                  value={adminId}
                  onChange={(e) => {
                    setAdminId(e.target.value);
                    setLoginError(false);
                  }}
                  autoFocus
                  placeholder="아이디를 입력하세요" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">비밀번호</label>
                <input 
                  type="password" 
                  value={adminPw}
                  onChange={(e) => {
                    setAdminPw(e.target.value);
                    setLoginError(false);
                  }}
                  placeholder="비밀번호를 입력하세요" 
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                    loginError ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'
                  }`}
                />
                {loginError && (
                  <p className="text-red-500 text-xs font-bold mt-2">아이디 또는 비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
              
              <button 
                type="submit" 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                접속하기
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}