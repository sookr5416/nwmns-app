'use client';

import { useState, useEffect, FormEvent, DragEvent, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { Player, Court } from './types';
import AdminSidebar from './components/AdminSidebar';
import CourtSection from './components/CourtSection';

export default function Home() {
  /* ==================================
     상태 관리 영역
     ================================== */

  // UI 뷰 모드 및 모달 상태
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('user');               // 현재 화면 모드
  const [showLogin, setShowLogin] = useState(false);                                // 관리자 로그인 팝업 표시
  const [isRegOpen, setIsRegOpen] = useState(true);                                 // 좌측 선수 등록 폼 접기/펼치기 상태

  // 선수 클릭/이동 상태
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);    // 클릭하여 선택된 선수 ID

  // 로그인 폼 입력값
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // 데이터 상태 (DB 연동)
  const [players, setPlayers] = useState<Player[]>([]);                             // 전체 선수 목록
  const [courts, setCourts] = useState<Court[]>([]);                                // 전체코트 목록

  // 선수 등록 폼 입력값
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('남');
  const [grade, setGrade] = useState<string>('A');
  
  // 기타 기능 제어 상태 및 Refs
  const nameInputRef = useRef<HTMLInputElement>(null);                              // 등록 후 이름 입력칸으로 자동 포커스를 주기 위한 Ref
  const [now, setNow] = useState(Date.now());                                       // 경기 진행 시간(타이머)을 실시간으로 보여주기 위한 현재 시간
  const [processingCourtId, setProcessingCourtId] = useState<string | null>(null);  // 현재 DB처리 중인 코트 ID (버튼 비활성화용)
  const isFinishingRef = useRef<Record<string, boolean>>({});                       // 더블클릭 방지를 위한 자물쇠 (리액트 렌더링 무관하게 즉시 방어)

  /* ==================================
     생명주기 및 실시간 구독
     ================================== */

  // 1초마다 현재 시간 업데이트 => 경기 타이머 렌더링용
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Supabase 실시간 구독 및 초기 데이터 불러오기
  useEffect(() => {
    fetchPlayers(); // 초기 선수 데이터 set
    fetchCourts();  // 초기 코트 데이터 set

    // 선수 테이블에 변화가 생기면 즉시 다시 불러옴 (실시간 동기화)
    const playersubscription = supabase
      .channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchPlayers(); })
      .subscribe();

    // 코트 테이블에 변화가 생기면 즉시 다시 불러옴 (실시간 동기화)
    const courtSubscription = supabase
      .channel('courts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, () => { fetchCourts(); })
      .subscribe();

    // 컴포넌트 종료 시 구독 해제하여 메모리 누수 방지
    return () => {
      supabase.removeChannel(playersubscription);
      supabase.removeChannel(courtSubscription);
    };
  }, []);

  /* ==================================
     일반 유틸리티 함수
     ================================== */

  // 밀리초(ms)를 분:초 (MM:SS) 포맷으로 변환하는 함수 (타이머용)
  const formatTime = (startTime: number) => {
    const diff = Math.floor((now - startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  /* ==================================
     데이터 CRUD (가져오기/수정/삭제) 함수
     ================================== */

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*');
    if (data) setPlayers(data);
  };

  const fetchCourts = async () => {
    const { data } = await supabase.from('courts').select('*').order('order_idx', { ascending: true });
    if (data) setCourts(data);
  };

  // 코트 이름 변경 입력 중 (로컬 상태만 변경)
  const handleCourtRenameChange = (id: string, newTitle: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  // 코트 이름 변경 완료 DB 저장 (onBlur 시 발동)
  const handleCourtRenameSave = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { fetchCourts(); return; }
    await supabase.from('courts').update({ title: newTitle }).eq('id', id);
  };

  // 관리자 로그인 처리 (관리자 테이블과 연동)
  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('admin').select('*').eq('admin_id', loginId).eq('admin_pw', loginPw);
    if (data && data.length > 0) {
      setViewMode('admin');
      setShowLogin(false);
      setLoginId('');
      setLoginPw('');
    } else {
      alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  // 신규 선수 등록 처리
  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return alert('이름을 입력해주세요.');
    if (!age.trim()) return alert('출생년도를 입력해주세요.');

    // 중복 등록 방지 로직 (이름, 나이, 성별이 모두 같으면 차단)
    const isDuplicate = players.some(p => p.name.trim() === name.trim() && String(p.age) === String(age) && p.gender === gender);
    if (isDuplicate) return alert('이미 동일한 정보(이름, 나이, 성별)로 등록된 선수가 있습니다.');

    const newPlayer: Player = { id: Date.now().toString(), name: name.trim(), age, gender, grade, count: 0, status: 'lobby' };
    setPlayers([...players, newPlayer]);                // UI 즉시 반영
    setName('');
    setAge('');
    nameInputRef.current?.focus();                      // 등록 후 다시 이름칸으로 포커스 이동 (연속 등록 편의성)
    await supabase.from('players').insert([newPlayer]); // DB 실제 반영
  };

  // 선수 삭제 처리
  const handleDelete = async (id: string) => {
    const targetPlayer = players.find(p => p.id === id);
    
    // 1게임 이상 진행한 선수는 실수로 지우지 않도록 경고창 띄움
    if (targetPlayer && targetPlayer.count >= 1) {
      if (!confirm(`${targetPlayer.name} 선수는 이미 ${targetPlayer.count}게임을 진행했습니다. 정말 목록에서 삭제하시겠습니까?`)) return;
    }
    setPlayers(players.filter(p => p.id !== id));
    await supabase.from('players').delete().eq('id', id);
  };

  /* ==================================
     드래그 앤 드롭 (Drag & Drop) 및 클릭 이동 로직
     ================================== */

  // 드래그 시작 시 호출
  const handleDragStart = (e: DragEvent<HTMLElement>, playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);

    // 진행 중인 경기 코트의 선수는 드래그 불가
    if (player && playerCourt?.start_time) { e.preventDefault(); return; }
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  // 선수를 특정 코트나 로비에 드롭했을 때 처리
  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetSlotId: string) => {
    e.preventDefault();

    const playerId = e.dataTransfer.getData('playerId');
    const currentPlayer = players.find(p => p.id === playerId);

    // 본인이 없거나, 이미 같은 장소면 무시
    if (!currentPlayer || currentPlayer.status === targetSlotId) return;

    // 타겟 코트나 로비나 레슨 코트가 아닐 경우 최대 인원 (4명) 초과 여부 검사
    const targetCourt = courts.find(c => c.id === targetSlotId);
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson') {
      if (players.filter(p => p.status === targetSlotId).length >= 4) return alert('최대 4명까지만 배치할 수 있습니다.');
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  // 선수 카드 클릭 시 처리 (선택 상태 토글)
  const handlePlayerClick = (playerId: string, e: React.MouseEvent) => {
    // 코트 빈 공간 클릭(이동) 이벤트로 전파되는 것을 방지
    e.stopPropagation();
    if (viewMode !== 'admin') return;

    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);

    // 진행 중인 경기 선수는 클릭 금지
    if (player && playerCourt?.start_time) {
      alert('진행 중인 경기에서는 선수를 뺄 수 없습니다.\n(변경이 필요하다면 먼저 코트를 [초기화] 해주세요.)');
      return;
    }

    // 이미 선택된 선수를 다시 클릭하면 선택 해제, 아니면 새롭게 선택
    setSelectedPlayerId(prev => (prev === playerId ? null : playerId));
  };

  // 빈 공간(로비/코트) 클릭 시 선택된 선수를 해당 위치로 이동
  const handleSlotClick = async (targetSlotId: string) => {
    // 선택된 선수가 없으면 무시
    if (viewMode !== 'admin' || !selectedPlayerId) return;

    const playerId = selectedPlayerId;
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status === targetSlotId) { setSelectedPlayerId(null); return; }

    // 최대 4명 인원 제한 검사 (레슨/로비 제외)
    const targetCourt = courts.find(c => c.id === targetSlotId);
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson') {
      if (players.filter(p => p.status === targetSlotId).length >= 4) {
        alert('최대 4명까지만 배치할 수 있습니다.');
        setSelectedPlayerId(null);
        return;
      }
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    setSelectedPlayerId(null); // 이동 후 상태 초기화
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  /* ==================================
     경기 진행 제어 (시작/종료/초기화/마감) 로직
     ================================== */

  // 코트 초기화 (타이머 해제 및 인원 전원 로비로 이동)
  const resetSlot = async (slotId: string) => {
    const updatedPlayers = players.map(p => p.status === slotId ? { ...p, status: 'lobby' } : p);
    setPlayers(updatedPlayers);   // UI 즉시 반영
    await supabase.from('courts').update({ start_time: null }).eq('id', slotId);  // 타이머 끄기
    
    // 상태가 변한 선수들만 추려서 DB 한 번에 업데이트
    const changed = updatedPlayers.filter((p, i) => p.status !== players[i].status);
    if (changed.length > 0) await supabase.from('players').upsert(changed);
  };
  
  // 경기 시작
  const startGame = async (slotId: string) => {
    if (players.filter(p => p.status === slotId).length !== 4) return alert('코트에 4명이 모두 모여야 경기를 시작할 수 있습니다.');
    setSelectedPlayerId(null);  // 선수가 선택된 상태라면 버그 방지를 위해 강제 해제
    await supabase.from('courts').update({ start_time: Date.now() }).eq('id', slotId);
  };

  // 경기 종료
  const finishGame = async (slotId: string) => {
    // 더블클릭 방어: 이미 처리 중이면 함수 실행 거부
    if (isFinishingRef.current[slotId]) return;

    const court = courts.find(c => c.id === slotId);
    if (!court?.start_time) return; 
    if (players.filter(p => p.status === slotId).length !== 4) return alert('경기 코트에 4명이 없습니다.');

    // 자물쇠 잠금 및 선택 버튼 상태 '처리 중'으로 변경
    isFinishingRef.current[slotId] = true;
    setProcessingCourtId(slotId);

    try {
      await supabase.from('courts').update({ start_time: null }).eq('id', slotId);  // 타이머 정지

      // 선수들 상태 업데이트 (현재 선수 로비로 이동, 게임 횟수 + 1 증가)
      const updatedPlayers = players.map(p => {
        if (p.status === slotId) return { ...p, status: 'lobby', count: p.count + 1 };
        if (p.status === 'wait-1') return { ...p, status: slotId };
        if (p.status === 'wait-2') return { ...p, status: 'wait-1'};
        if (p.status === 'wait-3') return { ...p, status: 'wait-2'};
        if (p.status === 'wait-4') return { ...p, status: 'wait-3'};
        return p;
      });

      setPlayers(updatedPlayers);

      const changed = updatedPlayers.filter((p, i) => p.status !== players[i].status || p.count !== players[i].count);
      if (changed.length > 0) await supabase.from('players').upsert(changed);
    } finally {
      // 처리 완료 후 1초 뒤에 자물쇠 해제 (실시간 구독 새로고침 충돌 방지)
      setTimeout(() => {
        isFinishingRef.current[slotId] = false;
        setProcessingCourtId(null);
      }, 1000);
    }
  };

  // 하루 마감 (구글 시트로 데이터 쏘고 모두 초기화)
  const handleDayClose = async () => {
    // 타이머가 켜져있는 코트가 있는 경우
    const isGamePlaying = courts.some(court => court.start_time);
    if (isGamePlaying) {
      return alert('현재 진행 중인 경기가 있습니다.\n모든 코트의 경기를 완전히 종료한 후 마감해주세요.');
    }
    
    if (players.length === 0) return alert('전송할 선수 데이터가 없습니다.');
    
    if (confirm('오늘의 모임을 마감하고 구글 시트로 데이터를 전송하시겠습니까?\n(※ 저장 후 현재 등록된 모든 선수 데이터는 초기화됩니다.)')) {
      try {
        const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVTU_PigUSIB3feaXPEQO1YrCl2nlMc7X4TjHmQ-ndqshlpdE5woev5NccE0n1gJGhVA/exec";
        await fetch(GOOGLE_WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(players) });

        await supabase.from('players').delete().neq("id", '0');
        setPlayers([]);
        alert('성공적으로 데이터를 전송하고 모임을 마감했습니다.');
      } catch (error) {
        console.error('마감 에러:', error);
        alert('데이터 전송 중 오류가 발생했습니다.');
      }
    }
  };

   /* ==================================
     메인 화면 렌더링 (UI)
     ================================== */
  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">

      {/* 팝업: 관리자 로그인 모달 */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
            <h2 className="text-xl font-bold mb-4 text-center text-slate-800">관리자 로그인</h2>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input type="text" placeholder="아이디" value={loginId} onChange={e => setLoginId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="password" placeholder="비밀번호" value={loginPw} onChange={e => setLoginPw(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200">취소</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">로그인</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 왼쪽 패널: 관리자 모드일 때만 보이는 선수 등록 폼 및 대기 로비 (AdminSiebar 컴포넌트) */}
      {viewMode === 'admin' && (
        <AdminSidebar 
          isRegOpen={isRegOpen}
          setIsRegOpen={setIsRegOpen}
          name={name}
          setName={setName}
          age={age}
          setAge={setAge}
          gender={gender}
          setGender={setGender}
          grade={grade}
          setGrade={setGrade}
          nameInputRef={nameInputRef}
          handleRegister={handleRegister}
          players={players}
          selectedPlayerId={selectedPlayerId}
          handleDragStart={handleDragStart}
          handlePlayerClick={handlePlayerClick}
          handleDelete={handleDelete}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleSlotClick={handleSlotClick}
        />
      )}

      {/* 오른쪽 패널: 코트 및 현황판 및 상단 컨트롤러 (CourtlSection 컴포넌트) */}
      <CourtSection 
        viewMode={viewMode}
        courts={courts}
        players={players}
        selectedPlayerId={selectedPlayerId}
        processingCourtId={processingCourtId}
        formatTime={formatTime}
        handleCourtRenameChange={handleCourtRenameChange}
        handleCourtRenameSave={handleCourtRenameSave}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleSlotClick={handleSlotClick}
        handleDragStart={handleDragStart}
        handlePlayerClick={handlePlayerClick}
        resetSlot={resetSlot}
        finishGame={finishGame}
        startGame={startGame}
        isFinishingRef={isFinishingRef}
        handleDayClose={handleDayClose}
        setShowLogin={setShowLogin}
        setViewMode={setViewMode}
      />
    </div>
  );
}