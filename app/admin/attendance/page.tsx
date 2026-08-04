'use client';

import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import CustomPopup, { PopupState } from '../../components/CustomPopup';

interface Gathering {
  id: string;
  gathering_date: string;
  location: string;
  start_time: string;
  memo: string;
}

interface AttendanceRecord {
  id: string;
  gathering_id: string;
  attended_date: string;
  members: {
    id: string;
    name: string;
    age: string;
    gender: string;
    grade: string;
    role: string;
    created_at: string;
  };
}

export default function GatheringManagementPage() {
  const [gatheringList, setGatheringList] = useState<Gathering[]>([]);
  const [selectedGathering, setSelectedGathering] = useState<Gathering | null>(null);
  const [gatheringAttendees, setGatheringAttendees] = useState<any[]>([]);

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [gatheringDate, setGatheringDate] = useState(todayStr());
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [memo, setMemo] = useState('');

  // 🌟 수정 모달 관련 상태 추가
  const [editingGathering, setEditingGathering] = useState<Gathering | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editMemo, setEditMemo] = useState('');

  const [popup, setPopup] = useState<PopupState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showPopup = (type: 'alert' | 'confirm', title: string, message: string, onConfirm: () => void = closePopup) => {
    setPopup({ isOpen: true, type, title, message, onConfirm });
  };
  const closePopup = () => setPopup(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    fetchGatherings();
  }, []);

  const fetchGatherings = async () => {
    const { data } = await supabase.from('gatherings').select('*').order('gathering_date', { ascending: false });
    if (data) setGatheringList(data);
  };

  const handleCreateGathering = async (e: FormEvent) => {
    e.preventDefault();
    if (!gatheringDate || !location.trim() || !startTime.trim()) {
      return showPopup('alert', '입력 오류', '정모 일자, 장소, 시간을 모두 입력해주세요.');
    }

    if (gatheringDate > todayStr()) {
      return showPopup('alert', '등록 불가', '오늘 이후의 일자로는 정모를 등록할 수 없습니다.');
    }

    const isAlreadyExists = gatheringList.some(g => g.gathering_date === gatheringDate);
    if (isAlreadyExists) {
      return showPopup('alert', '등록 불가', `선택하신 날짜(${gatheringDate})에 이미 등록된 정모 일정이 있습니다.`);
    }

    const { error } = await supabase.from('gatherings').insert([{
      gathering_date: gatheringDate,
      location: location.trim(),
      start_time: startTime.trim(),
      memo: memo.trim()
    }]);

    if (error) {
      showPopup('alert', '오류', '정모 등록 중 오류가 발생했습니다.');
    } else {
      showPopup('alert', '등록 완료', '새로운 정모 일정이 등록되었습니다.');
      setGatheringDate(todayStr());
      setLocation('');
      setStartTime('');
      setMemo('');
      fetchGatherings();
    }
  };

  // 🌟 정모 정보 수정 클릭 핸들러
  const handleEditClick = (gathering: Gathering) => {
    setEditingGathering(gathering);
    setEditLocation(gathering.location);
    setEditStartTime(gathering.start_time);
    setEditMemo(gathering.memo || '');
  };

  // 🌟 정모 정보 업데이트 (DB 저장) 핸들러
  const handleUpdateGathering = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingGathering) return;

    if (!editLocation.trim() || !editStartTime.trim()) {
      return showPopup('alert', '입력 오류', '장소와 시간을 모두 입력해주세요.');
    }

    const { error } = await supabase
      .from('gatherings')
      .update({
        location: editLocation.trim(),
        start_time: editStartTime.trim(),
        memo: editMemo.trim()
      })
      .eq('id', editingGathering.id);

    if (error) {
      showPopup('alert', '오류', '정모 수정 중 오류가 발생했습니다.');
    } else {
      showPopup('alert', '수정 완료', '정모 정보가 성공적으로 수정되었습니다.');
      setEditingGathering(null);
      fetchGatherings();
    }
  };

  const handleDeleteGathering = (e: React.MouseEvent, id: string, dateStr: string) => {
    e.stopPropagation();
    
    showPopup('confirm', '정모 삭제', `${formatDateString(dateStr)} 정모 일정을 삭제하시겠습니까?\n(해당 일자의 정회원 및 게스트 출석 기록도 함께 모두 삭제됩니다.)`, async () => {
      closePopup();
      
      await supabase.from('attendances').delete().eq('gathering_id', dateStr);
      await supabase.from('guest_attendances').delete().eq('gathering_id', dateStr);
      const { error } = await supabase.from('gatherings').delete().eq('id', id);
      
      if (error) {
        showPopup('alert', '오류', '정모 삭제 중 오류가 발생했습니다.');
      } else {
        setGatheringList(gatheringList.filter(g => g.id !== id));
        if (selectedGathering?.id === id) setSelectedGathering(null);
        showPopup('alert', '삭제 완료', '정모 일정 및 관련 출석 기록이 성공적으로 삭제되었습니다.');
      }
    });
  };

  const handleSelectGathering = async (gathering: Gathering) => {
    setSelectedGathering(gathering);
    let allAttendees: any[] = [];

    const { data: memberData } = await supabase
      .from('attendances')
      .select('members(id, name, age, gender, grade, role, created_at)')
      .eq('gathering_id', gathering.id);

    if (memberData) {
      const regulars = memberData.map((item: any) => item.members).filter(Boolean);
      
      regulars.sort((a: any, b: any) => {
        const getRoleRank = (role: string) => {
          if (role === '모임장') return 1;
          if (role === '운영진') return 2;
          return 3; 
        };

        const rankA = getRoleRank(a.role);
        const rankB = getRoleRank(b.role);

        if (rankA !== rankB) return rankA - rankB;

        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      });

      allAttendees = [...allAttendees, ...regulars];
    }

    const { data: guestData } = await supabase
      .from('guest_attendances')
      .select('*')
      .eq('gathering_id', gathering.id);

    if (guestData) {
      const guests = guestData.map(g => ({
        id: g.id,
        name: g.name,
        age: g.age,
        gender: g.gender,
        grade: g.grade,
        role: '게스트' 
      }));
      guests.sort((a, b) => a.name.localeCompare(b.name));
      allAttendees = [...allAttendees, ...guests];
    }

    setGatheringAttendees(allAttendees);
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${String(date.getFullYear()).substring(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
  };

  const formatDOB = (dobStr: string) => {
    if (!dobStr) return '';
    const clean = dobStr.replace(/[^0-9]/g, ''); 
    if (clean.length === 8) return `${clean.substring(2, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`;
    return dobStr;
  };

  const regulars = gatheringAttendees.filter(m => m.role !== '게스트');
  const guests = gatheringAttendees.filter(m => m.role === '게스트');

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">정모 정보 및 일정 관리</h1>
        <p className="text-sm text-slate-500 mt-1">정모 일자별 장소와 시간을 관리하고, 각 정모에 참여한 참석 인원을 확인하세요.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-700 mb-4">신규 정모 일정 등록</h2>
          <form onSubmit={handleCreateGathering} className="flex flex-col md:flex-row gap-4 w-full">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500 mb-1 ml-1">정모 일자</span>
              <input 
                type="date" 
                max={todayStr()} 
                value={gatheringDate} 
                onChange={e => setGatheringDate(e.target.value)} 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 w-44 font-bold" 
              />
            </div>

            <div className="flex flex-col flex-[1]">
              <span className="text-xs font-bold text-slate-500 mb-1 ml-1">장소</span>
              <input 
                type="text" 
                placeholder="영등포다목적배드민턴체육관" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" 
              />
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500 mb-1 ml-1">시간</span>
              <input 
                type="text" 
                placeholder="18:20 - 21:30" 
                value={startTime} 
                onChange={e => setStartTime(e.target.value)} 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg w-48" 
              />
            </div>

            <div className="flex flex-col flex-[1.5]">
              <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고</span>
              <input 
                type="text" 
                placeholder="정기 정모" 
                value={memo} 
                onChange={e => setMemo(e.target.value)} 
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" 
              />
            </div>

            <div className="flex flex-col justify-end">
              <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">정모 등록</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-700">전체 정모 목록</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <tr>
                  <th className="px-6 py-4 font-bold">정모 일자</th>
                  <th className="px-6 py-4 font-bold">장소</th>
                  <th className="px-6 py-4 font-bold">시간</th>
                  <th className="px-6 py-4 font-bold">비고</th>
                  <th className="px-6 py-4 font-bold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gatheringList.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{formatDateString(g.gathering_date)}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{g.location}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{g.start_time}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{g.memo || '-'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleSelectGathering(g)}
                        className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        명단 확인 →
                      </button>
                      
                      {/* 🌟 수정 버튼 추가 */}
                      <button 
                        onClick={() => handleEditClick(g)}
                        className="px-2.5 py-1.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        수정
                      </button>

                      <button 
                        onClick={(e) => handleDeleteGathering(e, g.id, g.gathering_date)}
                        className="px-2.5 py-1.5 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {gatheringList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      등록된 정모 일정이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🌟 정모 정보 수정 모달 */}
      {editingGathering && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">정모 정보 수정</h3>
              <button 
                onClick={() => setEditingGathering(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleUpdateGathering} className="p-6 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">정모 일자 (수정 불가)</span>
                <input 
                  type="text" 
                  value={formatDateString(editingGathering.gathering_date)} 
                  disabled
                  className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-bold cursor-not-allowed" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">장소</span>
                <input 
                  type="text" 
                  value={editLocation} 
                  onChange={e => setEditLocation(e.target.value)} 
                  className="px-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">시간</span>
                <input 
                  type="text" 
                  value={editStartTime} 
                  onChange={e => setEditStartTime(e.target.value)} 
                  className="px-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고</span>
                <input 
                  type="text" 
                  value={editMemo} 
                  onChange={e => setEditMemo(e.target.value)} 
                  className="px-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all" 
                />
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button 
                  type="button"
                  onClick={() => setEditingGathering(null)}
                  className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGathering && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">{formatDateString(selectedGathering.gathering_date)} 정모 명단</h3>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">{selectedGathering.location} ({selectedGathering.start_time}) · 총 {gatheringAttendees.length}명 참석</p>
              </div>
              <button 
                onClick={() => setSelectedGathering(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
              
              {regulars.map((member: any, idx: number) => (
                <div key={`regular-${idx}`} className="py-3 flex justify-between items-center px-1">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-base">{member.name}</span>
                      {member.role === '모임장' && (
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-purple-200">
                          모임장
                        </span>
                      )}
                      {member.role === '운영진' && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200">
                          운영진
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>{member.gender}</span>
                    <span className="font-bold text-slate-700">{member.grade}조</span>
                  </div>
                </div>
              ))}

              {guests.map((member: any, idx: number) => (
                <div key={`guest-${idx}`} className="py-3 flex justify-between items-center px-1">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{regulars.length + idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-base">{member.name}</span>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">
                        게스트
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>{member.gender}</span>
                    <span className="font-bold text-slate-700">{member.grade}조</span>
                  </div>
                </div>
              ))}

              {gatheringAttendees.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-medium">
                  이 날짜에 출석 체크된 인원이 없습니다.
                </div>
              )}

            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
              <button onClick={() => setSelectedGathering(null)} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">확인</button>
            </div>
          </div>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
    </div>
  );
}