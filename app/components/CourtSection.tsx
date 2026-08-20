'use client';

import { DragEvent } from 'react';
import { Player, Court } from '../types';

interface CourtSectionProps {
  viewMode: 'admin' | 'user';
  courts: Court[];
  players: Player[];
  selectedPlayerId?: string | null;
  processingCourtId?: string | null;
  formatTime: (startTime: number) => number | string;
  handleCourtRenameChange?: (id: string, newTitle: string) => void;
  handleCourtRenameSave?: (id: string, newTitle: string) => void;
  handleDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop?: (e: DragEvent<HTMLDivElement>, targetSlotId: string) => void;
  handleSlotClick?: (targetSlotId: string) => void;
  handleDragStart?: (e: DragEvent<HTMLElement>, playerId: string) => void;
  handlePlayerClick?: (playerId: string, e: React.MouseEvent) => void;
  resetSlot?: (slotId: string) => void;
  finishGame?: (slotId: string) => void;
  startGame?: (slotId: string) => void;
  isFinishingRef?: React.MutableRefObject<Record<string, boolean>>;
  handleDayClose?: () => void;
  onDeleteCourt?: (courtId: string) => void;
  pairCounts?: Record<string, Record<string, number>>;
  handleMoveTeam?: (fromSlotId: string, toSlotId: string) => void;
}

export default function CourtSection({
  viewMode, courts, players, selectedPlayerId, processingCourtId, formatTime,
  handleCourtRenameChange, handleCourtRenameSave, handleDragOver, handleDrop, handleSlotClick,
  handleDragStart, handlePlayerClick, resetSlot, finishGame, startGame, isFinishingRef,
  handleDayClose, onDeleteCourt, pairCounts, handleMoveTeam 
}: CourtSectionProps) {
  
  const gameCourts = courts.filter(c => c.type === 'game').sort((a, b) => a.order_idx - b.order_idx);

  return (
    <div className="order-1 md:order-2 flex-1 flex flex-col h-full overflow-y-auto p-3 md:p-8 bg-slate-50 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-3 md:gap-4">
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
          {viewMode === 'admin' ? '코트 및 대기 배정' : '실시간 코트 현황'}
        </h1>

        <div className="flex items-center gap-2 md:gap-4 self-end md:self-auto">
          {viewMode === 'admin' && handleDayClose && (
            <button onClick={handleDayClose} className="px-3 md:px-4 py-1.5 md:py-2 bg-red-500 hover:bg-red-600 text-white text-xs md:text-sm font-bold rounded-lg shadow-md shadow-red-200 transition-colors flex items-center gap-1.5 md:gap-2 active:scale-95">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              오늘의 정모 종료
            </button>
          )}
        </div>
      </div>
      
      {/* 🌟 모바일(기본) grid-cols-2 로 변경, 간격(gap)도 모바일에선 좁게(gap-3) 설정 */}
      <div className={`grid gap-3 md:gap-6 ${viewMode === 'user' ? 'grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto w-full' : 'grid-cols-2 xl:grid-cols-4'}`}>
        {[...courts]
          .sort((a, b) => {
            const orderWeight: Record<string, number> = { game: 1, wait: 2, lesson: 3, end: 4 };
            return (orderWeight[a.type] || 99) - (orderWeight[b.type] || 99) || (a.order_idx - b.order_idx);
          })
          .map((slot) => {
            if (viewMode === 'user' && (slot.type === 'lesson' || slot.type === 'end')) return null;

            const slotPlayers = players.filter(p => p.status === slot.id);
            const isGameCourt = slot.type === 'game';
            const isLesson = slot.type === 'lesson';
            const isWaitCourt = slot.type === 'wait';
            const isEnd = slot.type === 'end';
            
            const hasNoLimit = isLesson || isEnd;

            return (
              <div key={slot.id} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all hover:shadow-md">
                
                {/* 🌟 헤더 영역: 모바일 폰트 및 패딩 축소 */}
                <div className={`${isGameCourt ? 'bg-slate-800' : isLesson ? 'bg-emerald-600' : isEnd ? 'bg-red-500' : 'bg-indigo-500'} px-2.5 md:px-3.5 py-2 md:py-2.5 flex items-center justify-between gap-1.5 md:gap-2`}>
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {viewMode === 'admin' && isGameCourt && handleCourtRenameChange && handleCourtRenameSave ? (
                      <input
                        type="text" value={slot.title}
                        onChange={(e) => handleCourtRenameChange(slot.id, e.target.value)}
                        onBlur={(e) => handleCourtRenameSave(slot.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className="bg-transparent text-white font-bold text-sm md:text-base focus:outline-none border-b border-dashed border-white/50 w-full max-w-[5rem] md:max-w-[6rem] px-0.5 md:px-1 placeholder-white/50 truncate"
                      />
                    ) : (
                      <h3 className="text-white font-bold text-sm md:text-base truncate">{slot.title}</h3>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <span className={`text-[10px] md:text-xs font-bold ${(!hasNoLimit && slotPlayers.length >= 4) ? 'text-red-300' : 'text-slate-200'}`}>
                      {hasNoLimit ? `${slotPlayers.length}명` : `${slotPlayers.length}/4명`}
                    </span>

                    {viewMode === 'admin' && isGameCourt && onDeleteCourt && (
                      <button
                        onClick={() => onDeleteCourt(slot.id)}
                        className="text-[10px] md:text-[11px] font-bold text-red-300 hover:text-white bg-red-900/40 hover:bg-red-600 px-1 md:px-1.5 py-0.5 rounded transition-colors"
                        title="코트 삭제"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                {/* 🌟 명단 드롭 영역: 모바일 패딩 축소 */}
                <div 
                  className={`flex-1 p-2 md:p-4 flex flex-col gap-1.5 md:gap-2 min-h-[160px] md:min-h-[240px] ${slotPlayers.length === 0 ? 'justify-center items-center' : ''} ${selectedPlayerId ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                  onDragOver={viewMode === 'admin' && handleDragOver ? handleDragOver : undefined}
                  onDrop={viewMode === 'admin' && handleDrop ? (e) => handleDrop(e, slot.id) : undefined}
                  onClick={handleSlotClick ? () => handleSlotClick(slot.id) : undefined}
                >
                  {slotPlayers.length === 0 ? (
                    <div className="text-slate-300 text-xs md:text-sm font-medium border-2 border-dashed border-slate-200 rounded-lg w-full h-full flex items-center justify-center bg-slate-50/50 pointer-events-none text-center px-2">
                      {viewMode === 'admin' ? '선수를 드래그하세요' : '비어 있음'}
                    </div>
                  ) : (
                    slotPlayers.map(p => {
                      
                      const hasDuplicatePair = slotPlayers.some(other => {
                        if (other.id === p.id) return false;
                        const countA = pairCounts?.[p.id]?.[other.id] || 0;
                        const countB = pairCounts?.[other.id]?.[p.id] || 0;
                        return countA > 2 && countB > 2;
                      });

                      return (
                        <div 
                          key={p.id} 
                          draggable={viewMode === 'admin' && !slot.start_time}
                          onDragStart={viewMode === 'admin' && handleDragStart ? (e) => handleDragStart(e, p.id) : undefined}
                          onClick={handlePlayerClick ? (e) => handlePlayerClick(p.id, e) : undefined}
                          className={`border px-2 py-1.5 md:px-3 md:py-2 rounded-md flex justify-between items-center transition-all ${
                            viewMode === 'admin' && !slot.start_time ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default opacity-80'
                          } ${
                            p.gender === '남' ? 'bg-blue-50 border-blue-200 hover:border-blue-300' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300' 
                          } ${selectedPlayerId === p.id ? 'ring-4 ring-indigo-500 scale-105 shadow-md' : ''}`}
                        >
                          <span className="font-bold text-slate-800 text-xs md:text-sm truncate mr-1">{p.name}</span>

                          <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                            {hasDuplicatePair && (
                              <span className="text-red-500 text-[10px] md:text-xs font-bold md:ml-2">
                                ⚠️ 중복
                              </span>
                            )}

                            <span className={`text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded ${p.gender === '남' ? 'text-blue-700 bg-blue-200' : 'text-yellow-800 bg-yellow-200'}`}>
                              {p.grade}조
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 🌟 하단 버튼 영역: 모바일 폰트 및 여백 축소 */}
                {viewMode === 'admin' && resetSlot && finishGame && startGame && (
                  <div className="p-2.5 md:p-4 border-t border-slate-100 flex flex-col gap-1.5 md:gap-2 bg-slate-50 mt-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 md:gap-2">
                      <button onClick={() => resetSlot(slot.id)} disabled={!!slot.start_time} className={`flex-1 py-1.5 md:py-2 bg-white border rounded-md md:rounded-lg font-medium transition-colors text-xs md:text-sm ${slot.start_time ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                        초기화
                      </button>
                      {isGameCourt && (
                        <button 
                          onClick={() => {
                            if (isFinishingRef?.current[slot.id]) return;
                            if (slot.start_time) { finishGame(slot.id); } else { startGame(slot.id); }
                          }} 
                          disabled={processingCourtId === slot.id} 
                          className={`flex-1 py-1.5 md:py-2 text-white rounded-md md:rounded-lg font-bold transition-colors shadow-sm text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 ${
                            processingCourtId === slot.id ? 'bg-slate-400 cursor-not-allowed' : slot.start_time ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                          }`}
                        >
                          {processingCourtId === slot.id ? '처리 중...' : slot.start_time ? (
                            <><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-200 animate-pulse"></span>종료 ({formatTime(slot.start_time)})</>
                          ) : '경기 시작'}
                        </button>
                      )}
                    </div>

                    {isWaitCourt && slotPlayers.length > 0 && handleMoveTeam && (
                      <div className="flex flex-wrap gap-1 md:gap-1.5 mt-1 border-t border-slate-200 pt-2 md:pt-3">
                        <span className="w-full text-[10px] md:text-xs font-bold text-slate-500 mb-0.5 md:mb-1">코트로 이동:</span>
                        {gameCourts.map(gc => {
                          const isGcPlaying = !!gc.start_time; 
                          return (
                            <button
                              key={gc.id}
                              onClick={() => handleMoveTeam(slot.id, gc.id)}
                              disabled={isGcPlaying}
                              className={`flex-1 min-w-[30%] py-1 md:py-1.5 rounded text-[10px] md:text-[11px] font-bold transition-colors ${
                                isGcPlaying 
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white shadow-sm'
                              }`}
                            >
                              {gc.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}