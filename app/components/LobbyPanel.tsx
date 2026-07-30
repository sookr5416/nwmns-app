'use client';

import { FormEvent, DragEvent, RefObject } from 'react';
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
}

export default function LobbyPanel({
  isRegOpen, setIsRegOpen, name, setName, age, setAge, gender, setGender, grade, setGrade,
  nameInputRef, handleRegister, players, selectedPlayerId, handleDragStart, handlePlayerClick,
  handleDelete, handleDragOver, handleDrop, handleSlotClick,
}: LobbyPanelProps) {
  return (
    <div className="order-2 md:order-1 w-full md:w-80 h-[45vh] md:h-full flex-shrink-0 bg-white border-t md:border-t-0 md:border-r border-slate-200 flex flex-col shadow-[0_-5px_15px_rgba(0,0,0,0.05)] md:shadow-xl z-20">
      
      {/* 🌟 당일 출석/대기 등록 폼 */}
      <div className="p-4 md:p-6 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">게스트 현장 등록</h2>
          {/* 🌟 토글 버튼 (onClick 시 부모의 setIsRegOpen 실행) */}
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

      {/* 🌟 로비(대기석) 리스트 */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'lobby')} onClick={() => handleSlotClick('lobby')}>
        <h3 className="text-sm font-bold text-slate-500 mb-3 flex justify-between items-center">
          전체 대기 선수 (로비) 
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">
            {players.filter(p => p.status === 'lobby').length} / {players.length}명
          </span>
        </h3>
        
        <ul className="space-y-2 min-h-[200px]">
          {players.filter(p => p.status === 'lobby').sort((a, b) => a.count - b.count).map((player) => (
            <li key={player.id} draggable onDragStart={(e) => handleDragStart(e, player.id)} onClick={(e) => handlePlayerClick(player.id, e)} className={`flex items-center justify-between border p-3 rounded-lg shadow-sm transition-all group cursor-pointer ${player.gender === '남' ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'} ${selectedPlayerId === player.id ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="text-slate-300 group-hover:text-indigo-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path></svg>
                </div>
                <div>
                  <span className="font-bold text-slate-700">{player.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{player.grade}조 · {player.count}게임</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(player.id); }} className="w-7 h-7 flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors">✕</button>
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
  );
}