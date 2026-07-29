'use client';

import { useState, useEffect, FormEvent, DragEvent, useRef } from 'react';
import { supabase } from '../lib/supabase'; 

interface Player {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  count: number;
  status: string;
}

interface Court {
  id: string;
  title: string;
  type: string;
  order_idx: number;
}

export default function Home() {
  // 기본값을 'user'(사용자 모드)로 변경했습니다.
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('user');
  
  // 관리자 로그인 팝업 상태
  const [showLogin, setShowLogin] = useState(false);
  const [isRegOpen, setIsRegOpen] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('남');
  const [grade, setGrade] = useState<string>('A');
  const [courts, setCourts] = useState<Court[]>([]);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPlayers();
    fetchCourts();

    // 선수 실시간 구독
    const playersubscription = supabase
      .channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers(); 
      })
      .subscribe();

    // 코트 실시간 구독
    const courtSubscription = supabase
      .channel('courts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, () => {
        fetchCourts(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersubscription);
      supabase.removeChannel(courtSubscription);
    };
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase.from('players').select('*');
    if (data) setPlayers(data);
    if (error) console.error('데이터 불러오기 에러:', error);
  };

  const fetchCourts = async () => {
    const { data, error } = await supabase.from('courts').select('*').order('order_idx', { ascending: true });
    if (data) setCourts(data);
    if (error) console.error('코트 데이터 에러:', error);
  };

  const handleCourtRenameChange = (id: string, newTitle: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleCourtRenameSave = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      fetchCourts(); 
      return;
    }
    await supabase.from('courts').update({ title: newTitle }).eq('id', id);
  };

  // 관리자 로그인 처리 함수 (DB 연동 버전)
  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    
    // Supabase의 admins 테이블에서 입력한 아이디/비밀번호와 똑같은 줄이 있는지 검색합니다.
    const { data, error } = await supabase
      .from('admin')
      .select('*')
      .eq('admin_id', loginId)
      .eq('admin_pw', loginPw);

    if (error) {
      console.error('로그인 에러:', error);
      alert('로그인 처리 중 오류가 발생했습니다.');
      return;
    }

    // 일치하는 데이터가 있다면 (배열 안에 값이 있다면) 로그인 성공!
    if (data && data.length > 0) {
      setViewMode('admin');
      setShowLogin(false);
      setLoginId('');
      setLoginPw('');
    } else {
      alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  // 등록하기 버튼 클릭 이벤트
  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return alert('이름을 입력해주세요.');
    if (!age.trim()) return alert('출생년도를 입력해주세요.');

    const isDuplicate = players.some(
      (p) => 
        p.name.trim() === name.trim() && 
        String(p.age) === String(age) &&
        p.gender === gender
    );

    if (isDuplicate) return alert('이미 동일한 정보(이름, 나이, 성별)로 등록된 선수가 있습니다.');

    const newPlayer: Player = {
      id: Date.now().toString(),
      name: name.trim(),
      age,
      gender,
      grade,
      count: 0,
      status: 'lobby',
    };
    
    setPlayers([...players, newPlayer]);
    setName('');
    setAge('');

    nameInputRef.current?.focus();
    await supabase.from('players').insert([newPlayer]);
  };

  // 전체 대기 선수 (로비)에서 X 버튼 클릭 이벤트
  const handleDelete = async (id: string) => {
    // 삭제 하려는 선수 정보 찾기
    const targetPlayer = players.find((p) => p.id === id);

    // 선수가 존재하고, 게임 수가 1 이상인 경우
    if (targetPlayer && targetPlayer.count >= 1) {
      if (!confirm(`${targetPlayer.name} 선수는 이미 ${targetPlayer.count}게임을 진행했습니다. 정말 목록에서 삭제하시겠습니까?`)) {
        return;
      }
    }

    // 게임 수가 0 이거나, 위에서 [확인]을 누른 경우에만 삭제
    setPlayers(players.filter((p) => p.id !== id));
    await supabase.from('players').delete().eq('id', id);
  };

  const handleDragStart = (e: DragEvent<HTMLElement>, playerId: string) => {
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetSlotId: string) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status === targetSlotId) return;

    if (targetSlotId !== 'lobby') {
      const playersInTarget = players.filter(p => p.status === targetSlotId);
      if (playersInTarget.length >= 4) {
        return alert('최대 4명까지만 배치할 수 있습니다.');
      }
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  const handlePlayerClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMode !== 'admin') return;

    // 이미 선택된 선수를 다시 누르면 선택 해제, 아니면 새롭게 선택
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  // 코트나 로비 빈 공간을 클릭했을 때
  const handleSlotClick = async (targetSlotId: string) => {
    if (viewMode !== 'admin' || !selectedPlayerId) return;

    const playerId = selectedPlayerId;
    const currentPlayer = players.find(p => p.id === playerId);
    
    if (!currentPlayer || currentPlayer.status === targetSlotId) {
      setSelectedPlayerId(null);
      return;
    }

    if (targetSlotId !== 'lobby') {
      const playersInTarget = players.filter(p => p.status === targetSlotId);
      if (playersInTarget.length >= 4) {
        alert('최대 4명까지만 배치할 수 있습니다.');
        setSelectedPlayerId(null);
        return;
      }
    }
    
    // 이동 처리
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    setSelectedPlayerId(null); // 이동 후 선택 해제
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  // 초기화 버튼 클릭 이벤트
  const resetSlot = async (slotId: string) => {
    const updatedPlayers = players.map(p => p.status === slotId ? { ...p, status: 'lobby' } : p);
    setPlayers(updatedPlayers);

    const changedPlayers = updatedPlayers.filter((p, i) => p.status !== players[i].status);
    if (changedPlayers.length > 0) {
      await supabase.from('players').upsert(changedPlayers);
    }
  };

  // 경기 종료 버튼 클릭 이벤트
  const finishGame = async (slotId: string) => {
    
    // 해당 코트에 있는 인원 확인
    const courtPlayers = players.filter(p => p.status === slotId);
    
    // 4명이 아닌 경우
    if (courtPlayers.length !== 4) {
      return alert('경기 코트에 4명이 없습니다.');
    }

    const updatedPlayers = players.map(p => {
      if (p.status === slotId) return { ...p, status: 'lobby', count: p.count + 1 };
      if (p.status === 'wait-1') return { ...p, status: slotId };
      if (p.status === 'wait-2') return { ...p, status: 'wait-1'};
      if (p.status === 'wait-3') return { ...p, status: 'wait-2'};
      if (p.status === 'wait-4') return { ...p, status: 'wait-3'};
      return p;
    });

    setPlayers(updatedPlayers);

    const changedPlayers = updatedPlayers.filter((p, i) => p.status !== players[i].status || p.count !== players[i].count);
    if (changedPlayers.length > 0) {
      await supabase.from('players').upsert(changedPlayers);
    }
  }

  // 경기 종료 (구글 시트로 이동) 버튼 클릭 이벤트
  const handleDayClose = async () => {
    if (players.length === 0) {
      return alert('전송할 선수 데이터가 없습니다.');
    }
    
    if (confirm('오늘의 모임을 마감하고 구글 시트로 데이터를 전송하시겠습니까?\n(※ 저장 후 현재 등록된 모든 선수 데이터는 초기화됩니다.)')) {
      try {
        const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVTU_PigUSIB3feaXPEQO1YrCl2nlMc7X4TjHmQ-ndqshlpdE5woev5NccE0n1gJGhVA/exec";

        // 구글 시트로 데이터 쏘기 (CORS 에러 방지를 위해 text/plain 사용)
        const response = await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors', // 브라우저 보안 에러 우회
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(players),
        });

        // 브라우저 보안 에러 우회하기 위해 response를 받지 않음.
        // if (!response.ok) throw new Error('구글 시트로 데이터 전송 실패!');

        // 수파베이스 (DB)에서 모든 선수 데이터 깔끔하게 지우기
        const { error } = await supabase.from('players').delete().neq("id", '0');
        if (error) throw error;

        // 화면 상태 초기화
        setPlayers([]);

        alert('성공적으로 데이터를 전송하고 모임을 마감했습니다.');
      } catch (error) {
        console.error('마감 에러:', error);
        alert('데이터 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 관리자 로그인 팝업 (모달) */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
            <h2 className="text-xl font-bold mb-4 text-center text-slate-800">관리자 로그인</h2>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input 
                type="text" 
                placeholder="아이디" 
                value={loginId} 
                onChange={e => setLoginId(e.target.value)} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input 
                type="password" 
                placeholder="비밀번호" 
                value={loginPw} 
                onChange={e => setLoginPw(e.target.value)} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200">
                  취소
                </button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">
                  로그인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 좌측/하단: 선수 등록 및 목록 패널 (관리자 모드만 표시) ================= */}
      {viewMode === 'admin' && (
        <div className="order-2 md:order-1 w-full md:w-83 h-[45vh] md:h-full flex-shrink-0 bg-white border-t md:border-t-0 md:border-r border-slate-200 flex flex-col shadow-[0_-5px_15px_rgba(0,0,0,0.05)] md:shadow-xl z-20">
          <div className="p-4 md:p-6 border-b border-slate-100">
            {/* 제목 및 접기/펼치기 버튼 */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">선수 등록</h2>
              <button 
                type="button"
                onClick={() => setIsRegOpen(!isRegOpen)}
                className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100 transition-colors"
              >
                {isRegOpen ? '접기 ▲' : '펼치기 ▼'}
              </button>
            </div>

            {/* 폼 영역 (이름부터 등록하기 버튼까지) - isRegOpen이 true일 때만 렌더링됨 */}
            {isRegOpen && (
              <form onSubmit={handleRegister} className="space-y-4 mt-5">
                <div className="space-y-2">
                  <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} ref={nameInputRef} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                  <input type="number" placeholder="출생년도" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>

                <div className="flex gap-2">
                  {['남', '여'].map((g) => (
                    <button key={g} type="button" onClick={() => setGender(g)} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gender === g ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{g}</button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((lvl) => (
                    <button key={lvl} type="button" onClick={() => setGrade(lvl)} className={`w-10 h-10 rounded-lg font-bold transition-colors flex items-center justify-center ${grade === lvl ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{lvl}</button>
                  ))}
                </div>

                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-200 transition-all active:scale-[0.98]">등록하기</button>
              </form>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'lobby')} onClick={() => handleSlotClick('lobby')}>
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex justify-between items-center">
              전체 대기 선수 (로비) 
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">
                {players.filter(p => p.status === 'lobby').length} / {players.length}명
              </span>
            </h3>
            
            <ul className="space-y-2 min-h-[200px]">
              {players.filter(p => p.status === 'lobby').map((player) => (
                <li key={player.id} draggable onDragStart={(e) => handleDragStart(e, player.id)} onClick={(e) => handlePlayerClick(player.id, e)} className={`flex items-center justify-between border p-3 rounded-lg shadow-sm transition-all group ${viewMode === 'admin' ? 'cursor-pointer' : ''} ${player.gender === '남' ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'} ${selectedPlayerId === player.id ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-slate-300 group-hover:text-indigo-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path></svg>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">{player.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{player.grade}조 · {player.count}게임</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(player.id)} className="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors">✕</button>
                </li>
              ))}
              {players.filter(p => p.status === 'lobby').length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg pointer-events-none">
                  등록된 선수가 없거나 모두 코트에 있습니다.
                </div>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ================= 우측/상단: 코트 & 대기 배정 패널 ================= */}
      <div className="order-1 md:order-2 flex-1 overflow-y-auto p-4 md:p-8 relative">
        
        {/* ================= 우측 상단 컨트롤 패널 ================= */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 md:gap-4 z-10 scale-90 md:scale-100 origin-top-right">
          
          {/* 하루 마감 버튼 (관리자 모드일 때만 토글 버튼 왼쪽에 표시) */}
          {viewMode === 'admin' && (
          <button
            onClick={handleDayClose}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg shadow-md shadow-red-200 transition-colors flex items-center gap-2 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            경기 종료 (구글 시트로 이동)
          </button>
        )}

          {/* 🌟 모드 전환 버튼 */}
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button 
              onClick={() => { if(viewMode !== 'admin') setShowLogin(true); }}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'admin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              관리자
            </button>
            <button 
              onClick={() => setViewMode('user')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'user' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              사용자
            </button>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-6 md:mb-8 mt-12 md:mt-0 tracking-tight">
          {viewMode === 'admin' ? '코트 및 대기 배정' : '코트 현황'}
        </h1>
        
        <div className={`grid gap-6 ${viewMode === 'user' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'}`}>
          {courts.map((slot) => {
            const slotPlayers = players.filter(p => p.status === slot.id);
            const isCourt = slot.type === 'court';
            
            return (
              <div key={slot.id} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all hover:shadow-md">
                
                <div className={`${isCourt ? 'bg-slate-800' : 'bg-indigo-500'} px-4 py-3 flex justify-between items-center`}>
                  {/* 👇 관리자 & 경기 코트일 때 입력칸 표시 */}
                  {viewMode === 'admin' && isCourt ? (
                    <input
                      type="text"
                      value={slot.title}
                      onChange={(e) => handleCourtRenameChange(slot.id, e.target.value)}
                      onBlur={(e) => handleCourtRenameSave(slot.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="bg-transparent text-white font-bold text-lg focus:outline-none border-b-2 border-dashed border-white/50 w-28 px-1 placeholder-white/50"
                    />
                  ) : (
                    <h3 className="text-white font-bold text-lg">{slot.title}</h3>
                  )}

                  <span className={`text-sm font-bold ${slotPlayers.length >= 4 ? 'text-red-300' : 'text-slate-200'}`}>
                    {slotPlayers.length} / 4 명
                  </span>
                </div>

                <div 
                  className={`flex-1 p-4 flex flex-col gap-2 min-h-[240px] ${slotPlayers.length === 0 ? 'justify-center items-center' : ''} ${selectedPlayerId ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                  onDragOver={viewMode === 'admin' ? handleDragOver : undefined}
                  onDrop={viewMode === 'admin' ? (e) => handleDrop(e, slot.id) : undefined}
                  onClick={() => handleSlotClick(slot.id)}
                >
                  {slotPlayers.length === 0 ? (
                    <div className="text-slate-300 text-sm font-medium border-2 border-dashed border-slate-200 rounded-lg w-full h-full flex items-center justify-center bg-slate-50/50">
                      {viewMode === 'admin' ? '선수를 드래그하세요' : '비어 있음'}
                    </div>
                  ) : (
                    slotPlayers.map(p => (
                      <div 
                        key={p.id} 
                        draggable={viewMode === 'admin'}
                        onDragStart={viewMode === 'admin' ? (e) => handleDragStart(e, p.id) : undefined}
                        onClick={(e) => handlePlayerClick(p.id, e)}
                        className={`border px-3 py-2 rounded-md flex justify-between items-center transition-all ${viewMode === 'admin' ? 'cursor-pointer' : 'cursor-default'} ${
                          p.gender === '남'
                            ? 'bg-blue-50 border-blue-200 hover:border-blue-300' 
                            : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300' 
                        } ${selectedPlayerId === p.id ? 'ring-4 ring-indigo-500 scale-105 shadow-md' : ''}`}
                      >
                        <span className="font-bold text-slate-800">
                          {p.name} <span className="text-sm font-normal text-slate-500"></span>
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          p.gender === '남'
                            ? 'text-blue-700 bg-blue-200'
                            : 'text-yellow-800 bg-yellow-200'
                        }`}>
                          {p.grade}조
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {viewMode === 'admin' && (
                  <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50 mt-auto">
                    <button onClick={() => resetSlot(slot.id)} className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors text-sm">
                      초기화
                    </button>
                    {isCourt && (
                      <button onClick={() => finishGame(slot.id)} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 text-sm">
                        경기 종료
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}