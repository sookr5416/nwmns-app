'use client';

import { useState, FormEvent, DragEvent, RefObject } from 'react';
import { Player } from '../types';

interface LobbyPanelProps {
  isRegOpen: boolean;
  setIsRegOpen: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  age: string;
  setAge: (age: string) => void;
  gender: string;
  setGender: (gender: string) => void;
  grade: string;
  setGrade: (grade: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  handleRegister: (e: FormEvent<HTMLFormElement>) => void;
  players: Player[];
  selectedPlayerId: string | null;
  handleDragStart: (e: DragEvent<HTMLElement>, playerId: string) => void;
  handlePlayerClick: (playerId: string, e: React.MouseEvent) => void;
  handleDelete: (id: string) => void;
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetSlotId: string) => void;
  handleSlotClick: (targetSlotId: string) => void;
  onOpenMemberPopup?: () => void;
  now?: number; // 부모 컴포넌트(AdminCourtsPage)에서 1초마다 갱신되는 현재 시간을 받아옴
}

export default function LobbyPanel({
  isRegOpen, setIsRegOpen, name, setName, age, setAge, gender, setGender, grade, setGrade,
  nameInputRef, handleRegister, players, selectedPlayerId, handleDragStart, handlePlayerClick,
  handleDelete, handleDragOver, handleDrop, handleSlotClick, onOpenMemberPopup, now = Date.now(),
}: LobbyPanelProps) {

  const [sortMode, setSortMode] = useState<'count' | 'time' | 'name'>('count'); // 정렬 방식 상태 관리
  const [isSortOpen, setIsSortOpen] = useState(false);                          // 정렬 드롭다운 메뉴 열림 여부

  // 휴식 시간 계산 함수
  const getRestTime = (lastEndTime?: number) => {
    if (!lastEndTime) return null; // 한 번도 게임을 안 한 경우
    
    const diffMs = now - lastEndTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return '방금전';
    return `${diffMin}분전`;
  };

  return (
    <div className="order-2 md:order-1 w-full md:w-80 h-[45vh] md:h-full flex-shrink-0 bg-white border-t md:border-t-0 md:border-r border-slate-200 flex flex-col shadow-[0_-5px_15px_rgba(0,0,0,0.05)] md:shadow-xl z-20">
      
      {/* 당일 출석/대기 등록 폼 */}
      <div className="p-4 md:p-6 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">게스트 현장 등록</h2>
          <button 
            type="button" 
            onClick={() => setIsRegOpen(!isRegOpen)} 
            className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100 transition-colors"
          >
            {isRegOpen ? '접기 ▲' : '펼치기 ▼'}
          </button>
        </div>

        {isRegOpen && (
          <form onSubmit={handleRegister} className="space-y-4 mt-5">
            <div className="space-y-2">
              <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} ref={nameInputRef} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="number" placeholder="출생년도" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-2">
              {['남', '여'].map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gender === g ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{g}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['A', 'B', 'C', 'D', 'E', 'F'].map((lvl) => (
                <button key={lvl} type="button" onClick={() => setGrade(lvl)} className={`w-9.5 h-10 rounded-lg font-bold transition-colors flex items-center justify-center ${grade === lvl ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{lvl}</button>
              ))}
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-200 transition-all active:scale-[0.98]">등록하기</button>
          </form>
        )}
      </div>

      {/* 로비(대기석) 리스트 */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'lobby')} onClick={() => handleSlotClick('lobby')}>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-600">전체 대기 선수 (로비)</h3>
          
          <div className="flex items-center gap-2">
            {/* 정렬 필터 추가 */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortOpen(!isSortOpen);
                }}
                className={`w-6 h-6 rounded-md flex items-center justify-center text-sm transition-colors border shadow-sm ${isSortOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                title="대기 명단 정렬"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              </button>
              
              {/* 드롭다운 메뉴 */}
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setIsSortOpen(false); }} />
                  <div className="absolute right-0 top-full mt-1.5 w-36 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-40">
                    <button onClick={() => { setSortMode('count'); setIsSortOpen(false); }} className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${sortMode === 'count' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      경기수 오름차순
                    </button>
                    <button onClick={() => { setSortMode('time'); setIsSortOpen(false); }} className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors border-t border-slate-100 ${sortMode === 'time' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      대기 시간 내림차순
                    </button>
                    <button onClick={() => { setSortMode('name'); setIsSortOpen(false); }} className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors border-t border-slate-100 ${sortMode === 'name' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      이름순
                    </button>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={(e) => { 
                e.stopPropagation();
                if(onOpenMemberPopup) onOpenMemberPopup(); 
              }}
              className="bg-indigo-600 text-white hover:bg-indigo-700 w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold transition-colors shadow-sm cursor-pointer"
              title="회원 불러오기"
            >
              +
            </button>
            <span className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold">
              {players.filter(p => p.status === 'lobby').length} / {players.length}명
            </span>
          </div>
        </div>
        
        <ul className="space-y-2 min-h-[200px]">
          {players
            .filter(p => p.status === 'lobby')
            .sort((a, b) => {
              // 경기수 오름차순 정렬 (경기수가 같을 경우 대기 시간이 긴 사람 우선)
              if (sortMode === 'count') {
                if (a.count !== b.count) return a.count - b.count;
                return (a.last_game_end_time || 0) - (b.last_game_end_time || 0);
              }
              // 대기 시간 내림차순 (마지막으로 뛴 시간이 오래된 사람 = 값이 작은 사람이 우선)
              if (sortMode === 'time') {
                return (a.last_game_end_time || 0) - (b.last_game_end_time || 0);
              }
              // 이름순 정렬
              if (sortMode === 'name') {
                return a.name.localeCompare(b.name);
              }
              return 0;
            })
            .map((player) => {
            const restTime = getRestTime(player.last_game_end_time);

            return (
              <li key={player.id} draggable onDragStart={(e) => handleDragStart(e, player.id)} onClick={(e) => handlePlayerClick(player.id, e)} className={`flex items-center justify-between border p-3 rounded-lg shadow-sm transition-all group cursor-pointer ${player.gender === '남' ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'} ${selectedPlayerId === player.id ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`}>
                
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-bold text-slate-700">{player.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{player.grade}조 · {player.count}게임</span>
                    
                    {player.role === 'guest' && (
                      <span className="ml-2 bg-emerald-100 text-emerald-700 text-[11px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                        G
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {restTime && (
                    <span className="text-xs font-bold text-orange-500 whitespace-nowrap">
                      ⏱ { restTime }
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(player.id); }} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                    ✕
                  </button>
                </div>

              </li>
            );
          })}
          {players.filter(p => p.status === 'lobby').length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg pointer-events-none">
              등록된 선수가 없거나 모두 코트에 있습니다.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}