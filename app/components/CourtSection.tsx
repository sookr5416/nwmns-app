'use client';

import { DragEvent } from 'react';
import { Player, Court } from '../types';

/* ==================================
     Props 인터페이스 정의
     부모 컴포넌트(page.tsx)로부터 코트 렌더링 및 제어에 필요한 모든 데이터를 전달 받음.
     ================================== */

interface CourtSectionProps {
  // 상태 및 데이터
  viewMode: 'admin' | 'user';       // 햔제 화면 모드 (관리자/사용자)
  courts: Court[];                  // 코트 목록 데이터
  players: Player[];                // 전체 선수 목록 데이터
  selectedPlayerId: string | null;  // 현재 클릭(선택)된 선수 ID
  processingCourtId: string | null; // 현재 DB 통신 처리 중인 코트 ID

  // 유틸리티 함수
  formatTime: (startTime: number) => number | string;   // 시작 시간을 분:초 형식으로 변환

  // 코트 이름 변경 핸들러
  handleCourtRenameChange: (id: string, newTitle: string) => void;
  handleCourtRenameSave: (id: string, newTitle: string) => void;

  // 드래그 앤 드롭 및 클릭 핸들러
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetSlotId: string) => void;
  handleSlotClick: (targetSlotId: string) => void;
  handleDragStart: (e: DragEvent<HTMLElement>, playerId: string) => void;
  handlePlayerClick: (playerId: string, e: React.MouseEvent) => void;

  // 경기 제어 핸들러
  resetSlot: (slotId: string) => void;  // 코트 초기화
  finishGame: (slotId: string) => void; // 경기 종료
  startGame: (slotId: string) => void;  // 경기 시작
  isFinishingRef: React.MutableRefObject<Record<string, boolean>>;  // 경기 종료 더블클릭 방지용 Ref

  // 상단 컨트롤 핸들러
  handleDayClose: () => void;                       // 하루 마감 (구글 시트 전송)
  setShowLogin: (show: boolean) => void;            // 로그인 모달 열기
  setViewMode: (mode: 'admin' | 'user') => void;    // 뷰 모드 전환
}

export default function CourtSection({
  viewMode,
  courts,
  players,
  selectedPlayerId,
  processingCourtId,
  formatTime,
  handleCourtRenameChange,
  handleCourtRenameSave,
  handleDragOver,
  handleDrop,
  handleSlotClick,
  handleDragStart,
  handlePlayerClick,
  resetSlot,
  finishGame,
  startGame,
  isFinishingRef,
  handleDayClose,
  setShowLogin,
  setViewMode,
}: CourtSectionProps) {
  return (
    // 우측 메인 컨테이너
    // order-1 md:order-2: 모바일에서는 위로, PC에서는 우측으로 강제 고정
    <div className="order-1 md:order-2 flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-8 bg-slate-50 relative">
      
      { /* ==================================
            상단 헤더 및 컨트롤 버튼 영역
           ================================== */ }
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">

        { /* 타이틀: 모드에 따라 다르게 표시 */ }
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
          {viewMode === 'admin' ? '코트 및 대기 배정' : '코트 현황'}
        </h1>

        <div className="flex items-center gap-2 md:gap-4 self-end md:self-auto">
          
          { /* 하루 마감 버튼 (관리자 모드일 때만 렌더링) */ }
          {viewMode === 'admin' && (
            <button 
              onClick={handleDayClose} 
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg shadow-md shadow-red-200 transition-colors flex items-center gap-2 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              경기 종료 (구글 시트로 이동)
            </button>
          )}

          { /* 관리자/사용자 모드 전환 토글 버튼 */ }
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
      </div>
      
      { /* ==================================
            하단 영역: 코트 카드 그리드 목록
           ================================== */ }
      <div className={`grid gap-6 ${viewMode === 'user' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto w-full' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'}`}>
        {courts.map((slot) => {
          
          // 사용자 모드일 때는 레슨 코트를 화면에서 아예 숨김
          if (viewMode === 'user' && slot.type === 'lesson') return null;

          // 현재 코트에 소속된 선수들만 필터링
          const slotPlayers = players.filter(p => p.status === slot.id);
          const isCourt = slot.type === 'court';
          const isLesson = slot.type === 'lesson';
          
          return (
            <div key={slot.id} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all hover:shadow-md">

              { /* 코트 헤더 (배경색으로 코트 타입 구분) */ }  
              <div className={`${isCourt ? 'bg-slate-800' : isLesson ? 'bg-emerald-600' : 'bg-indigo-500'} px-4 py-3 flex justify-between items-center`}>

                { /* 관리자 모드 + 일반 코트일 경우 이름 수정 가능한 input 렌더링 */ }
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
                  // 그 외의 경우는 단순 텍스트 렌더링
                  <h3 className="text-white font-bold text-lg">{slot.title}</h3>
                )}

                { /* 현재 인원 현황 (일반 코트는 ' / 4명', 레슨 코트는 제한 없이 '명'만 표시) */ }
                <span className={`text-sm font-bold ${(!isLesson && slotPlayers.length >= 4) ? 'text-red-300' : 'text-slate-200'}`}>
                  {isLesson ? `${slotPlayers.length} 명` : `${slotPlayers.length} / 4 명`}
                </span>
              </div>

              { /* 코트 내부 (선수 목록 및 드롭 존) */ }
              { /* 빈 공간을 누르면 선택된 선수가 이동해오는 클릭 이벤트(handleSlotClick) 포함 */ }
              <div 
                className={`flex-1 p-4 flex flex-col gap-2 min-h-[240px] ${slotPlayers.length === 0 ? 'justify-center items-center' : ''} ${selectedPlayerId ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                onDragOver={viewMode === 'admin' ? handleDragOver : undefined}
                onDrop={viewMode === 'admin' ? (e) => handleDrop(e, slot.id) : undefined}
                onClick={() => handleSlotClick(slot.id)}
              >
                { /* 코트가 비어있을 때 표시하는 안내 문구 */ }
                {slotPlayers.length === 0 ? (
                  <div className="text-slate-300 text-sm font-medium border-2 border-dashed border-slate-200 rounded-lg w-full h-full flex items-center justify-center bg-slate-50/50 pointer-events-none">
                    {viewMode === 'admin' ? '선수를 드래그하세요' : '비어 있음'}
                  </div>
                ) : (
                  // 코트에 선수가 있을 때 카드 렌더링
                  slotPlayers.map(p => (
                    <div 
                      key={p.id} 
                      // 경기가 진행 중이면 드래그 불가
                      draggable={viewMode === 'admin' && !slot.start_time}
                      onDragStart={viewMode === 'admin' ? (e) => handleDragStart(e, p.id) : undefined}
                      onClick={(e) => handlePlayerClick(p.id, e)}
                      // 성별에 따른 색상 구분 및 경기 진행 중일 시 반투명(opacity-80) 처리
                      className={`border px-3 py-2 rounded-md flex justify-between items-center transition-all ${
                        viewMode === 'admin' && !slot.start_time ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default opacity-80'
                      } ${
                        p.gender === '남'
                          ? 'bg-blue-50 border-blue-200 hover:border-blue-300' 
                          : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300' 
                      } ${selectedPlayerId === p.id ? 'ring-4 ring-indigo-500 scale-105 shadow-md' : ''}`}
                    >
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${p.gender === '남' ? 'text-blue-700 bg-blue-200' : 'text-yellow-800 bg-yellow-200'}`}>
                        {p.grade}조
                      </span>
                    </div>
                  ))
                )}
              </div>

              { /* 코트 하단 제어 버튼 (관리자 모드에서만 렌더링) */ }
              {viewMode === 'admin' && (
                <div 
                  className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50 mt-auto"
                  onClick={(e) => e.stopPropagation()}  // 이 버튼 영역을 눌렀을 때 코트 전체 클릭 이벤트가 발동하지 않도록 차단
                >
                  { /* 초기화 버튼 (타이머가 돌아가고 있으면 비활성화) */ }
                  <button 
                    onClick={() => resetSlot(slot.id)} 
                    disabled={!!slot.start_time} 
                    className={`flex-1 py-2 bg-white border rounded-lg font-medium transition-colors text-sm ${
                      slot.start_time
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100' 
                    }`}
                  >
                    초기화
                  </button>

                  { /* 대기 코트가 아닌 경기 코트일 경우에만 시작/종료 버튼 렌더링 */ }
                  {isCourt && (
                    <button 
                      onClick={() => {
                        // wndqhr zmfflr dnjscjs ckeks
                        if (isFinishingRef.current[slot.id]) return;
                        if (slot.start_time) {
                          finishGame(slot.id);  // 타이머가 켜져있으면 종료 함수 호출
                        } else {
                          startGame(slot.id);   // 꺼져있으면 시작 함수 호출
                        }
                      }} 
                      // DB 통신 중일 때는 버튼 락킹
                      disabled={processingCourtId === slot.id} 
                      className={`flex-1 py-2 text-white rounded-lg font-bold transition-colors shadow-sm text-sm flex items-center justify-center gap-2 ${
                        processingCourtId === slot.id
                          ? 'bg-slate-400 cursor-not-allowed' 
                          : slot.start_time 
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                      }`}
                    >
                      { /* 상태에 따른 버튼 텍스트 변경 */ }  
                      {processingCourtId === slot.id ? (
                        '처리 중...'
                      ) : slot.start_time ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-200 animate-pulse"></span>
                          종료 ({formatTime(slot.start_time)})
                        </>
                      ) : (
                        '경기 시작'
                      )}
                    </button>
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