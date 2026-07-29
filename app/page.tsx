'use client';

import { useState, useEffect, FormEvent, DragEvent, useRef } from 'react';
import { supabase } from '../lib/supabase'; 
import { Player, Court } from './types';
import AdminSidebar from './components/AdminSidebar';
import CourtSection from './components/CourtSection';

export default function Home() {
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('user');
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
  const [now, setNow] = useState(Date.now());
  const [processingCourtId, setProcessingCourtId] = useState<string | null>(null);
  const isFinishingRef = useRef<Record<string, boolean>>({});

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

  useEffect(() => {
    fetchPlayers();
    fetchCourts();

    const playersubscription = supabase
      .channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchPlayers(); })
      .subscribe();

    const courtSubscription = supabase
      .channel('courts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, () => { fetchCourts(); })
      .subscribe();

    return () => {
      supabase.removeChannel(playersubscription);
      supabase.removeChannel(courtSubscription);
    };
  }, []);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*');
    if (data) setPlayers(data);
  };

  const fetchCourts = async () => {
    const { data } = await supabase.from('courts').select('*').order('order_idx', { ascending: true });
    if (data) setCourts(data);
  };

  const handleCourtRenameChange = (id: string, newTitle: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleCourtRenameSave = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { fetchCourts(); return; }
    await supabase.from('courts').update({ title: newTitle }).eq('id', id);
  };

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

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return alert('이름을 입력해주세요.');
    if (!age.trim()) return alert('출생년도를 입력해주세요.');

    const isDuplicate = players.some(p => p.name.trim() === name.trim() && String(p.age) === String(age) && p.gender === gender);
    if (isDuplicate) return alert('이미 동일한 정보(이름, 나이, 성별)로 등록된 선수가 있습니다.');

    const newPlayer: Player = { id: Date.now().toString(), name: name.trim(), age, gender, grade, count: 0, status: 'lobby' };
    setPlayers([...players, newPlayer]);
    setName('');
    setAge('');
    nameInputRef.current?.focus();
    await supabase.from('players').insert([newPlayer]);
  };

  const handleDelete = async (id: string) => {
    const targetPlayer = players.find(p => p.id === id);
    if (targetPlayer && targetPlayer.count >= 1) {
      if (!confirm(`${targetPlayer.name} 선수는 이미 ${targetPlayer.count}게임을 진행했습니다. 정말 목록에서 삭제하시겠습니까?`)) return;
    }
    setPlayers(players.filter(p => p.id !== id));
    await supabase.from('players').delete().eq('id', id);
  };

  const handleDragStart = (e: DragEvent<HTMLElement>, playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);
    if (player && playerCourt?.start_time) { e.preventDefault(); return; }
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetSlotId: string) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status === targetSlotId) return;

    const targetCourt = courts.find(c => c.id === targetSlotId);
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson') {
      if (players.filter(p => p.status === targetSlotId).length >= 4) return alert('최대 4명까지만 배치할 수 있습니다.');
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  const handlePlayerClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMode !== 'admin') return;

    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);
    if (player && playerCourt?.start_time) {
      alert('진행 중인 경기에서는 선수를 뺄 수 없습니다.\n(변경이 필요하다면 먼저 코트를 [초기화] 해주세요.)');
      return;
    }
    setSelectedPlayerId(prev => (prev === playerId ? null : playerId));
  };

  const handleSlotClick = async (targetSlotId: string) => {
    if (viewMode !== 'admin' || !selectedPlayerId) return;

    const playerId = selectedPlayerId;
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status === targetSlotId) { setSelectedPlayerId(null); return; }

    const targetCourt = courts.find(c => c.id === targetSlotId);
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson') {
      if (players.filter(p => p.status === targetSlotId).length >= 4) {
        alert('최대 4명까지만 배치할 수 있습니다.');
        setSelectedPlayerId(null);
        return;
      }
    }
    
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    setSelectedPlayerId(null); 
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  const resetSlot = async (slotId: string) => {
    const updatedPlayers = players.map(p => p.status === slotId ? { ...p, status: 'lobby' } : p);
    setPlayers(updatedPlayers);
    await supabase.from('courts').update({ start_time: null }).eq('id', slotId);
    
    const changed = updatedPlayers.filter((p, i) => p.status !== players[i].status);
    if (changed.length > 0) await supabase.from('players').upsert(changed);
  };
  
  const startGame = async (slotId: string) => {
    if (players.filter(p => p.status === slotId).length !== 4) return alert('코트에 4명이 모두 모여야 경기를 시작할 수 있습니다.');
    setSelectedPlayerId(null);
    await supabase.from('courts').update({ start_time: Date.now() }).eq('id', slotId);
  };

  const finishGame = async (slotId: string) => {
    if (isFinishingRef.current[slotId]) return;
    const court = courts.find(c => c.id === slotId);
    if (!court?.start_time) return; 
    if (players.filter(p => p.status === slotId).length !== 4) return alert('경기 코트에 4명이 없습니다.');

    isFinishingRef.current[slotId] = true;
    setProcessingCourtId(slotId);

    try {
      await supabase.from('courts').update({ start_time: null }).eq('id', slotId);

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
      setTimeout(() => {
        isFinishingRef.current[slotId] = false;
        setProcessingCourtId(null);
      }, 1000);
    }
  };

  const handleDayClose = async () => {
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

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
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

      {/* 원본과 똑같이 AdminSidebar가 무조건 DOM 구조상의 첫 번째 자식으로 렌더링되도록 배치 */}
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