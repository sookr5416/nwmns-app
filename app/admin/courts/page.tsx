'use client';

import { useState, useEffect, FormEvent, DragEvent, useRef } from 'react';
import { supabase } from '../../../lib/supabase'; 
import { Player, Court } from '../../types';
import LobbyPanel from '../../components/LobbyPanel';
import CourtSection from '../../components/CourtSection';
import CustomPopup, { PopupState } from '../../components/CustomPopup';

// DB에서 불러오는 회원 정보 타입 정의
interface DbMember {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  role: string;
  created_at: string;
}

export default function AdminCourtsPage() {
  // UI 상태 관리
  const [isRegOpen, setIsRegOpen] = useState(false);                                // 게스트 등록 폼 열림/닫힘 상태
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);    // 현재 선택된 선수 ID
  const [isMemberPopupOpen, setIsMemberPopupOpen] = useState(false);                // 회원 불러오기 팝업 열림/닫힘 선택
  const [memberSearchTerm, setMemberSearchTerm] = useState('');                     // 회원 검색어
  const [isEditingInfo, setIsEditingInfo] = useState(false);                        // 정모 정보 (장소, 시간 등) 수정 모드 여부
  
  // 데이터 상태 관리
  const [players, setPlayers] = useState<Player[]>([]);                             // 현재 출석하여 로비나 코트에 있는 전체 선수 목록
  const [dbMembers, setDbMembers] = useState<DbMember[]>([]);                       // DB에 등록된 정회원 목록 전체
  const [courts, setCourts] = useState<Court[]>([]);                                // 생성된 코트 목록 (게임용, 대기용, 레슨용 등)
  
  // 신규 게스트 등록 폼 상태
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('남');
  const [grade, setGrade] = useState<string>('A');
  
  // 정모 기본 정보 상태
  const [locationTitle, setLocationTitle] = useState('영등포다목적배드민턴체육관');
  const [timeTitle, setTimeTitle] = useState('18:20 - 21:30');
  const [memoTitle, setMemoTitle] = useState('정기 정모');
  
  // 시스템 및 타이머 관련 상태
  const nameInputRef = useRef<HTMLInputElement>(null);                              // 이름 입력칸에 포커스를 주기 위한 Ref
  const [now, setNow] = useState(Date.now());                                       // 실시간 타이머 (1초마다 갱신)
  const [processingCourtId, setProcessingCourtId] = useState<string | null>(null);  // 현재 경기 종료 처리 중인 코트 ID
  const isFinishingRef = useRef<Record<string, boolean>>({});                       // 코트별 중복 종료 방지용 Ref (빠른 클릭 방지)

  // 데이터 전송 로딩 상태 (이탈 방지용)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 선수들 간 같이 뛴 횟수를 추적하는 객체 (중복 매칭 경고용)
  const [pairCounts, setPairCounts] = useState<Record<string, Record<string, number>>>({});

  // 공통 팝업 상태
  const [popup, setPopup] = useState<PopupState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 팝업 열기/닫기 함수
  const showPopup = (type: 'alert' | 'confirm', title: string, message: string, onConfirm: () => void = closePopup) => {
    setPopup({ isOpen: true, type, title, message, onConfirm });
  };

  const closePopup = () => setPopup(prev => ({ ...prev, isOpen: false }));

  // 1초마다 실시간 시간 갱신 (경기 타이머 및 휴식 시간 계산용)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 최초 랜더링 시 데이터 세팅 및 실시간 DB 구독 (Realtime)
  useEffect(() => {
    fetchPlayers();
    fetchCourts();
    fetchDbMembers();
    
    // 다른 기기에서 선수를 수정하면 내 화면도 실시간 갱신
    const playersubscription = supabase.channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchPlayers(); }).subscribe();

    // 다른 기기에서 코트를 수정하면 내 화면도 실시간 갱신
    const courtSubscription = supabase.channel('courts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, () => { fetchCourts(); }).subscribe();

    return () => { supabase.removeChannel(playersubscription); supabase.removeChannel(courtSubscription); };
  }, []);

  // 당일 참석 선수 목록 가져오기
  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*');
    
    if (data) setPlayers(data);
  };

  // 코트 목록 가져오기 및 정렬 (게임 → 대기 → 레슨 순)
  const fetchCourts = async () => {
    const { data } = await supabase.from('courts').select('*');
    if (data) {
      const sortedCourts = data.sort((a, b) => {
        const orderWeight: Record<string, number> = { game: 1, wait: 2, lesson: 3 };
        return (orderWeight[a.type] || 99) - (orderWeight[b.type] || 99) || (a.order_idx - b.order_idx);
      });
      setCourts(sortedCourts);
    }
  };

  // 기존 정회원 목록 가져오기 (운영진 최상단, 가입일순 정렬)
  const fetchDbMembers = async () => {
    const { data } = await supabase.from('members').select('id, name, age, gender, grade, role, created_at, role');
    
    if (data) {
      const membersData = data as DbMember[];
      
      // 정렬: 1순위 모임장/운영진, 2순위 가입일자 오름차순
      membersData.sort((a, b) => {
        const getRoleRank = (role: string) => {
          if (role === '모임장') return 1;
          if (role === '운영진') return 2;
          return 3; 
        };

        const rankA = getRoleRank(a.role);
        const rankB = getRoleRank(b.role);

        if (rankA !== rankB) {
          return rankA - rankB;
        }

        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

        return dateA - dateB;
      });

      setDbMembers(membersData);
    }
  };

  // 타이머 시간 포맷 변환 (밀리초 → 00:00 형식)
  const formatTime = (startTime: number) => {
    const diff = Math.floor((now - startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    
    return `${m}:${s}`;
  };

  // 코트 이름 즉시 수정 (로컬 상태 갱신)
  const handleCourtRenameChange = (id: string, newTitle: string) => {
     setCourts(courts.map(c => c.id === id ? { ...c, title: newTitle } : c)); 
  };

  // 코트 이름 DB 저장 (포커스 잃었을 때)
  const handleCourtRenameSave = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { fetchCourts(); return; }
    await supabase.from('courts').update({ title: newTitle }).eq('id', id);
  };

  // 새로운 게임 코트 추가 함수
  const handleAddGameCourt = async () => {
    const gameCourts = courts.filter(c => c.type === 'game');
    
    if (gameCourts.length >= 8) {
      return showPopup('alert', '알림', '게임 코트는 최대 8개까지만 추가할 수 있습니다.');
    }

    const newIndex = gameCourts.length + 1;
    const newCourtId = `court-${Date.now()}`;
    const newCourtTitle = `${newIndex}번 코트`;
    const maxOrder = Math.max(...courts.map(c => c.order_idx || 0), 0);
    const newCourt: Court = { id: newCourtId, title: newCourtTitle, type: 'game', order_idx: maxOrder + 1, start_time: null };

    setCourts([...courts, newCourt]);
    await supabase.from('courts').insert([newCourt]);
  };

  // 기존 게임 코트 삭제 함수
  const handleDeleteGameCourt = async (courtId: string) => {
    const gameCourts = courts.filter(c => c.type === 'game');
    
    if (gameCourts.length <= 2) {
      return showPopup('alert', '알림', '게임 코트는 최소 2개 이상 유지되어야 합니다.');
    }
    const targetCourt = courts.find(c => c.id === courtId);
    
    if (targetCourt?.start_time) {
      return showPopup('alert', '알림', '현재 경기가 진행 중인 코트는 삭제할 수 없습니다.');
    }
    const playersInCourt = players.filter(p => p.status === courtId);
    
    if (playersInCourt.length > 0) {
      return showPopup('alert', '알림', `해당 코트에 선수가 ${playersInCourt.length}명 등록되어 있어 삭제할 수 없습니다. 선수를 먼저 비워주세요.`);
    }

    setCourts(courts.filter(c => c.id !== courtId));
    await supabase.from('courts').delete().eq('id', courtId);
  };

  // 게스트 신규 등록 (현장 등록)
  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !age.trim()) return showPopup('alert', '입력 오류', '이름과 출생년도를 입력해주세요.');
    
    const isAlreadyInPlayers = players.some(p => p.name.trim() === name.trim() && String(p.age) === String(age) && p.gender === gender);
    if (isAlreadyInPlayers) return showPopup('alert', '중복 등록', '이미 현장에 등록된 선수입니다.');

    const isExistingMember = dbMembers.some(m => m.name.trim() === name.trim() && m.gender === gender);

    const addNewPlayer = async () => {
      const newPlayer: Player = { id: Date.now().toString(), name: name.trim(), age, gender, grade, count: 0, status: 'lobby', role: 'guest'};
      setPlayers(prev => [...prev, newPlayer]);
      setName(''); setAge(''); nameInputRef.current?.focus();
      await supabase.from('players').insert([newPlayer]);
    };

    if (isExistingMember) {
      showPopup('confirm', '회원 중복 확인', '기존 회원 명단에 동일한 이름과 성별을 가진 회원이 있습니다. 정말로 새로운 게스트로 등록하시겠습니까?', () => {
        closePopup();
        addNewPlayer();
      });
    } else {
      addNewPlayer();
    }
  };

  // 정회원 목록에서 로비로 불러오기 (출석체크)
  const handleAddMemberToLobby = async (member: DbMember) => {
    const newPlayer: Player = { 
      id: Date.now().toString() + Math.floor(Math.random() * 1000), 
      name: member.name, 
      age: member.age, 
      gender: member.gender, 
      grade: member.grade, 
      count: 0, 
      status: 'lobby',
      role: member.role
    };
    setPlayers(prev => [...prev, newPlayer]);
    await supabase.from('players').insert([newPlayer]);
  };

  // 참석 취소 (목록에서 완전히 제거)
  const handleDelete = async (id: string) => {
    const targetPlayer = players.find(p => p.id === id);
    if (targetPlayer && targetPlayer.count >= 1) {
      showPopup('confirm', '선수 삭제', `이미 ${targetPlayer.count}게임을 진행했습니다. 삭제하시겠습니까?`, async () => {
        closePopup();
        setPlayers(players.filter(p => p.id !== id));
        await supabase.from('players').delete().eq('id', id);
      });
      return;
    }
    setPlayers(players.filter(p => p.id !== id));
    await supabase.from('players').delete().eq('id', id);
  };

  // 드래그 시작 함수
  const handleDragStart = (e: DragEvent<HTMLElement>, playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);
    if (player && playerCourt?.start_time) { e.preventDefault(); return; }
    e.dataTransfer.setData('playerId', playerId);
  };

  // 드래그 중인 아이템이 위를 지날 때 기본 이벤트 방지 (필수)
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  // 드래그 종료 시 함수 (코트에 배정)
  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetSlotId: string) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    const currentPlayer = players.find(p => p.id === playerId);

    if (!currentPlayer || currentPlayer.status === targetSlotId) return;
    const targetCourt = courts.find(c => c.id === targetSlotId);
    
    // 코트 4명 초과 검사 (로비와 레슨 코트는 예외)
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson' && players.filter(p => p.status === targetSlotId).length >= 4) {
      return showPopup('alert', '배정 불가', '최대 4명입니다.');
    }

    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  // 모바일 클릭 환경을 위한 클릭 배정 (선수 클릭 → 코트 클릭)
  const handlePlayerClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const player = players.find(p => p.id === playerId);
    const playerCourt = courts.find(c => c.id === player?.status);
    if (player && playerCourt?.start_time) return showPopup('alert', '작업 불가', '진행 중인 경기에서는 뺄 수 없습니다.');
    setSelectedPlayerId(prev => (prev === playerId ? null : playerId));
  };

  const handleSlotClick = async (targetSlotId: string) => {
    if (!selectedPlayerId) return;
    const playerId = selectedPlayerId;
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status === targetSlotId) { setSelectedPlayerId(null); return; }
    const targetCourt = courts.find(c => c.id === targetSlotId);
    if (targetSlotId !== 'lobby' && targetCourt?.type !== 'lesson' && players.filter(p => p.status === targetSlotId).length >= 4) {
      showPopup('alert', '배정 불가', '최대 4명입니다.'); setSelectedPlayerId(null); return;
    }
    setPlayers(players.map(p => p.id === playerId ? { ...p, status: targetSlotId } : p));
    setSelectedPlayerId(null); 
    await supabase.from('players').update({ status: targetSlotId }).eq('id', playerId);
  };

  // 코트에 배정된 선수를 다시 로비로 되돌리기 (초기화)
  const resetSlot = async (slotId: string) => {
    const updatedPlayers = players.map(p => p.status === slotId ? { ...p, status: 'lobby' } : p);
    setPlayers(updatedPlayers);
    await supabase.from('courts').update({ start_time: null }).eq('id', slotId);
    
    const changed = updatedPlayers.filter((p, i) => p.status !== players[i].status);
    if (changed.length > 0) await supabase.from('players').upsert(changed);
  };
  
  // 경기 시작 (타이머 작동)
  const startGame = async (slotId: string) => {
    if (players.filter(p => p.status === slotId).length !== 4) return showPopup('alert', '시작 불가', '4명이 모여야 시작할 수 있습니다.');
    setSelectedPlayerId(null);
    await supabase.from('courts').update({ start_time: Date.now() }).eq('id', slotId);
  };

  // 경기 종료 (선수들 로비로 복귀, 경기수 증가, 휴식 타이머 시작)
  const finishGame = async (slotId: string) => {
    if (isFinishingRef.current[slotId]) return;
    const court = courts.find(c => c.id === slotId);
    if (!court?.start_time || players.filter(p => p.status === slotId).length !== 4) return;
    
    isFinishingRef.current[slotId] = true;
    setProcessingCourtId(slotId);

    try {
      await supabase.from('courts').update({ start_time: null }).eq('id', slotId);

      // 같이 뛴 선수 기록 (pairCounts update)
      const courtPlayers = players.filter(p => p.status === slotId);

      setPairCounts(prev => {
        const next = { ...prev };
        courtPlayers.forEach(p1 => {
          if (!next[p1.id]) next[p1.id] = {};
          courtPlayers.forEach(p2 => {
            if (p1.id !== p2.id) {
              next[p1.id][p2.id] = (next[p1.id][p2.id] || 0) + 1;
            }
          });
        });
        return next;
      });

      // 경기 종료 시점 기록
      const currentTime = Date.now();

      const updatedPlayers = players.map(p => {
        if (p.status === slotId) return { ...p, status: 'lobby', count: p.count + 1, last_game_end_time: currentTime };
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
      setTimeout(() => { isFinishingRef.current[slotId] = false; setProcessingCourtId(null); }, 1000);
    }
  };

  // 오늘의 정모 최종 마감 및 DB에 출석 데이터 대량 전송 (Bulk Insert)
  const handleDayClose = async () => {
    // 이미 전송 중이면 클릭무시 (이탈 방지)
    if (isSubmitting) return;

    if (courts.some(court => court.start_time)) return showPopup('alert', '마감 불가', '현재 진행 중인 경기가 있습니다.');
    if (players.length === 0) return showPopup('alert', '마감 불가', '참여한 선수가 없습니다.');

    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      // 당일 등록된 정모가 있는지 미리 확인
      const { data: existingGatherings } = await supabase
        .from('gatherings')
        .select('id')
        .eq('gathering_date', todayDate);

      if (existingGatherings && existingGatherings.length > 0) {
        return showPopup('alert', '중복 마감', '오늘 일자로 이미 등록된 정모 기록이 있습니다. 마감을 중단합니다.');
      }

      // 화면 이동 경고가 포함된 마감 컨펌 창 띄우기
      showPopup('confirm', '정모 마감', `[${locationTitle} / ${timeTitle}] 정모 기록을 저장하고 참석 회원들을 출석 처리하시겠습니까?`, async () => {
        closePopup();

        // 전송 시작 (로딩 상태 On)
        setIsSubmitting(true);
        
        try {
          // 정모(gathering) 테이블에 정보 생성
          const { data: newGathering, error: gatheringError } = await supabase.from('gatherings').insert([{
            gathering_date: todayDate,
            location: locationTitle,
            start_time: timeTitle,
            memo: memoTitle
          }]).select().single();

          if (gatheringError || !newGathering) throw new Error('정모 생성 실패');
          
          const currentGatheringId = newGathering.id;
          const { data: allMembers } = await supabase.from('members').select('id, name, age, gender');
          
          if (allMembers && allMembers.length > 0) {
            const { data: existingAttendances } = await supabase.from('attendances').select('member_id').eq('attended_date', todayDate);
            const alreadyCheckedMemberIds = new Set(existingAttendances?.map(a => a.member_id) || []);
            
            // Bulk Insert용 배열 준비
            const attendanceInserts: { gathering_id: string; member_id: string; attended_date: string }[] = [];
            const guestAttendanceInserts: { name: string; age: string; gender: string; grade: string; gathering_id: string; attended_date: string }[] = [];

            // 배열에 데이터 차곡차곡 쌓기
            players.forEach(p => {
              const matchedMember = allMembers.find(m => 
                m.name.trim() === p.name.trim() && 
                String(m.age).replace(/[^0-9]/g, '') === String(p.age).replace(/[^0-9]/g, '') && 
                m.gender === p.gender
              );

              if (matchedMember) {
                if (!alreadyCheckedMemberIds.has(matchedMember.id)) {
                  attendanceInserts.push({
                    gathering_id: currentGatheringId,
                    member_id: matchedMember.id,
                    attended_date: todayDate
                  });
                  alreadyCheckedMemberIds.add(matchedMember.id);
                }
              } else {
                guestAttendanceInserts.push({
                  name: p.name,
                  age: p.age,
                  gender: p.gender,
                  grade: p.grade,
                  gathering_id: currentGatheringId,
                  attended_date: todayDate
                });
              }
            });

            // 한 번의 통신으로 배열(Bulk) 전송
            if (attendanceInserts.length > 0) {
              await supabase.from('attendances').insert(attendanceInserts);
            }
            if (guestAttendanceInserts.length > 0) {
              await supabase.from('guest_attendances').insert(guestAttendanceInserts);
            }
          }

          // 전송 끝 (화면 비우기)
          await supabase.from('players').delete().neq("id", '0');
          setPlayers([]);
          
          showPopup('alert', '마감 완료', '성공적으로 데이터 전송 및 마감이 완료되었습니다.\n이제 이동하셔도 됩니다.');
        } catch (innerError) {
          console.error('마감 전송 에러:', innerError);
          showPopup('alert', '오류', '데이터 전송 중 통신 오류가 발생했습니다. 다시 시도해 주세요.');
        } finally {
          setIsSubmitting(false); // 전송 완료 시 무조건 로딩 해제
        }
      });
    } catch (error) {
      console.error('마감 사전 체크 에러:', error);
      showPopup('alert', '오류', '마감 준비 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between shadow-xs z-10">
        
        {/* 상단 좌측: 정보 수정 모드 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md">관리자 모드</span>
          
          {isEditingInfo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" value={locationTitle} onChange={(e) => setLocationTitle(e.target.value)} placeholder="장소 입력" className="text-xs font-bold text-slate-800 border border-indigo-500 rounded px-2 py-1 outline-none w-44" />
              <input type="text" value={timeTitle} onChange={(e) => setTimeTitle(e.target.value)} placeholder="시간 입력" className="text-xs font-bold text-slate-800 border border-indigo-500 rounded px-2 py-1 outline-none w-28" />
              <input type="text" value={memoTitle} onChange={(e) => setMemoTitle(e.target.value)} placeholder="비고 입력" className="text-xs font-bold text-slate-800 border border-indigo-500 rounded px-2 py-1 outline-none w-28" />
              <button onClick={() => setIsEditingInfo(false)} className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-indigo-700">저장</button>
            </div>
          ) : (
            <h1 onClick={() => setIsEditingInfo(true)} className="text-sm font-extrabold text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-2" title="클릭하여 장소, 시간, 비고 수정">
              📍 {locationTitle} <span className="text-slate-500 font-medium">({timeTitle} / {memoTitle})</span>
              <span className="text-xs text-indigo-500 font-normal">(수정)</span>
            </h1>
          )}
        </div>

        {/* 상단 우측: 코트 추가 버튼 등 */}
        <div className="flex items-center gap-2">
          <button onClick={handleAddGameCourt} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1">
            + 코트 추가
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* 좌측 로비 패널 */}
        <LobbyPanel 
          isRegOpen={isRegOpen} setIsRegOpen={setIsRegOpen}
          name={name} setName={setName} age={age} setAge={setAge}
          gender={gender} setGender={setGender} grade={grade} setGrade={setGrade}
          nameInputRef={nameInputRef} handleRegister={handleRegister}
          players={players} selectedPlayerId={selectedPlayerId}
          handleDragStart={handleDragStart} handlePlayerClick={handlePlayerClick}
          handleDelete={handleDelete} handleDragOver={handleDragOver}
          handleDrop={handleDrop} handleSlotClick={handleSlotClick}
          onOpenMemberPopup={() => setIsMemberPopupOpen(true)}
          now={now}
        />
        
        {/* 우측 코트 섹션 */}
        <CourtSection 
          viewMode="admin"
          courts={courts} players={players}
          selectedPlayerId={selectedPlayerId} processingCourtId={processingCourtId} formatTime={formatTime}
          handleCourtRenameChange={handleCourtRenameChange} handleCourtRenameSave={handleCourtRenameSave}
          handleDragOver={handleDragOver} handleDrop={handleDrop} handleSlotClick={handleSlotClick}
          handleDragStart={handleDragStart} handlePlayerClick={handlePlayerClick}
          resetSlot={resetSlot} finishGame={finishGame} startGame={startGame}
          isFinishingRef={isFinishingRef} handleDayClose={handleDayClose}
          onDeleteCourt={handleDeleteGameCourt}
          pairCounts={pairCounts}
        />
      </div>

      <CustomPopup popup={popup} onClose={closePopup} />

      {/* 회원 불러오기 팝업 창 */}
      {isMemberPopupOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">기존 회원 불러오기</h2>
              <button onClick={() => setIsMemberPopupOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <input 
                type="text" 
                placeholder="이름 검색..." 
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {dbMembers
                .filter(m => m.name.includes(memberSearchTerm))
                .map(member => {
                  const isAdded = players.some(p => p.name === member.name && p.gender === member.gender && p.role === member.role);
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          {member.name}
                          {member.role === '모임장' && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-extrabold px-2 py-0.5 rounded-full border border-purple-200">모임장</span>
                          )}
                          {member.role === '운영진' && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-extrabold px-2 py-0.5 rounded-full border border-blue-200">운영진</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{member.gender} · {member.grade}조</div>
                      </div>
                      <button
                        onClick={() => handleAddMemberToLobby(member)}
                        disabled={isAdded}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isAdded 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                      >
                        {isAdded ? '추가됨' : '추가'}
                      </button>
                    </div>
                  );
                })}
              {dbMembers.filter(m => m.name.includes(memberSearchTerm)).length === 0 && (
                <div className="text-center text-slate-400 text-sm py-10">검색된 회원이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 전체 화면 로딩 오버레이 (마감 전송 시 다른 행동 완벽 차단) */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-white font-bold text-lg">데이터를 전송하고 있습니다...</p>
          <p className="text-indigo-200 text-sm mt-2">완료될 때까지 창을 닫거나 이동하지 마세요.</p>
        </div>
      )}
    </div>
  );
}