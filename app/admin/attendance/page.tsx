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

export default function GatheringManagementPage() {
  const [gatheringList, setGatheringList] = useState<Gathering[]>([]);
  const [selectedGathering, setSelectedGathering] = useState<Gathering | null>(null);
  const [gatheringAttendees, setGatheringAttendees] = useState<any[]>([]);
  const [allDbMembers, setAllDbMembers] = useState<any[]>([]);                         // DB 전체 회원 목록 (명단 수정 - 인원 추가 시 사용)

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [gatheringDate, setGatheringDate] = useState(todayStr());
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [memo, setMemo] = useState('');

  // 검색 및 페이징 상태 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 수정 모달 관련 상태 추가
  const [editingGathering, setEditingGathering] = useState<Gathering | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // 명단 팝업 수정 모드 상태
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');

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
    fetchAllMembers(); 
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const fetchGatherings = async () => {
    const { data } = await supabase.from('gatherings').select('*').order('gathering_date', { ascending: false });
    if (data) setGatheringList(data);
  };

  // 전체 회원 목록 로드 함수
  const fetchAllMembers = async () => {
    const { data } = await supabase.from('members').select('id, name, age, gender, grade, role, created_at');
    if (data) setAllDbMembers(data);
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

  const handleEditClick = (gathering: Gathering) => {
    setEditingGathering(gathering);
    setEditLocation(gathering.location);
    setEditStartTime(gathering.start_time);
    setEditMemo(gathering.memo || '');
  };

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
      
      await supabase.from('attendances').delete().eq('gathering_id', id);
      await supabase.from('guest_attendances').delete().eq('gathering_id', id);
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

  // 명단 팝업을 열 때 호출 (attendance_id 포함해서 조회)
  const handleSelectGathering = async (gathering: Gathering) => {
    setSelectedGathering(gathering);
    setIsEditingAttendance(false); // 창 열 때 수정 모드 초기화
    setAttendanceSearchTerm('');

    let allAttendees: any[] = [];

    // 정회원 (attendances 테이블의 id 도 함께 select)
    const { data: memberData } = await supabase
      .from('attendances')
      .select('id, members(id, name, age, gender, grade, role, created_at)')
      .eq('gathering_id', gathering.id);

    if (memberData) {
      const regulars = memberData.map((item: any) => {
        if (!item.members) return null;
        return {
          ...item.members,
          attendance_id: item.id, // 삭제할 때 사용할 고유 키
          is_guest: false
        };
      }).filter(Boolean);
      
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

    // 게스트
    const { data: guestData } = await supabase
      .from('guest_attendances')
      .select('*')
      .eq('gathering_id', gathering.id);

    if (guestData) {
      const guests = guestData.map(g => ({
        ...g,
        attendance_id: g.id, // 삭제할 때 사용할 고유 키
        role: '게스트',
        is_guest: true
      }));
      guests.sort((a, b) => a.name.localeCompare(b.name));
      allAttendees = [...allAttendees, ...guests];
    }

    setGatheringAttendees(allAttendees);
  };

  // 명단에서 개별 삭제 함수
  const handleDeleteAttendee = (attendanceId: string, isGuest: boolean, memberName: string) => {
    showPopup('confirm', '명단 삭제', `${memberName} 님을 참석 명단에서 삭제하시겠습니까?`, async () => {
      closePopup();
      
      const tableName = isGuest ? 'guest_attendances' : 'attendances';
      const { error } = await supabase.from(tableName).delete().eq('id', attendanceId);
      
      if (error) {
        showPopup('alert', '오류', '삭제 중 오류가 발생했습니다.');
      } else {
        // UI에서 즉시 제거
        setGatheringAttendees(prev => prev.filter(a => a.attendance_id !== attendanceId));
      }
    });
  };

  // 명단에 새로운 인원(정회원) 추가 함수
  const handleAddAttendee = async (member: any) => {
    if (!selectedGathering) return;

    const { data, error } = await supabase.from('attendances').insert([{
      gathering_id: selectedGathering.id,
      member_id: member.id,
      attended_date: selectedGathering.gathering_date
    }]).select('id').single();

    if (error || !data) {
      showPopup('alert', '오류', '명단 추가 중 오류가 발생했습니다.');
    } else {
      setAttendanceSearchTerm(''); // 검색창 초기화
      // DB에 반영되었으므로 명단을 재조회해서 깔끔하게 정렬 적용
      handleSelectGathering(selectedGathering);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${String(date.getFullYear()).substring(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
  };

  const filteredGatherings = gatheringList.filter(g => {
    const term = searchTerm.toLowerCase();
    return (
      g.location.toLowerCase().includes(term) ||
      (g.memo && g.memo.toLowerCase().includes(term)) ||
      g.gathering_date.includes(term)
    );
  });

  const totalPages = Math.ceil(filteredGatherings.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentGatherings = filteredGatherings.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const regulars = gatheringAttendees.filter(m => !m.is_guest);
  const guests = gatheringAttendees.filter(m => m.is_guest);

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">정모 정보 및 일정 관리</h1>
        <p className="text-sm text-slate-500 mt-1">정모 일자별 장소와 시간을 관리하고, 각 정모에 참여한 참석 인원을 확인하세요.</p>
      </div>

      <div className="space-y-8">
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

        <div>
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <div className="flex items-center gap-4">
              <div className="text-slate-700 font-bold text-lg">
                총 정모 수 : <span className="text-indigo-600">{gatheringList.length}</span> 건
                {searchTerm && <span className="text-sm text-slate-400 ml-2">(검색 결과: {filteredGatherings.length}건)</span>}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-48 lg:w-56">
                <input 
                  type="text" 
                  placeholder="장소, 날짜, 비고 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full md:w-auto px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm"
              >
                <option value={10}>10건씩 보기</option>
                <option value={20}>20건씩 보기</option>
                <option value={50}>50건씩 보기</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                  {currentGatherings.map((g) => (
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
                          명단 확인
                        </button>
                        
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
                  {currentGatherings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                        {searchTerm ? '검색 조건에 맞는 정모가 없습니다.' : '등록된 정모 일정이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                이전
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                      currentPage === page 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>

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
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 명단 팝업 부분 */}
      {selectedGathering && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">{formatDateString(selectedGathering.gathering_date)} 정모 명단</h3>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">{selectedGathering.location} ({selectedGathering.start_time}) · 총 {gatheringAttendees.length}명 참석</p>
              </div>
              <div className="flex items-center gap-2">
                {/* 명단 수정 토글 버튼 */}
                <button
                  onClick={() => {
                    setIsEditingAttendance(!isEditingAttendance);
                    setAttendanceSearchTerm('');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    isEditingAttendance 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  {isEditingAttendance ? '수정 완료' : '명단 수정'}
                </button>
                <button 
                  onClick={() => setSelectedGathering(null)}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* 수정 모드일 때만 보이는 인원 추가 검색 바 */}
            {isEditingAttendance && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="추가할 기존 회원 이름 검색..."
                    value={attendanceSearchTerm}
                    onChange={e => setAttendanceSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                {/* 검색 결과 드롭다운 */}
                {attendanceSearchTerm && (
                  <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-48 overflow-y-auto z-10">
                    {allDbMembers
                      .filter(m => m.name.includes(attendanceSearchTerm) && !gatheringAttendees.some(a => a.id === m.id))
                      .map(m => (
                        <div key={m.id} className="flex justify-between items-center p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => handleAddAttendee(m)}>
                          <div>
                            <span className="text-sm font-bold text-slate-700">{m.name}</span>
                            <span className="text-xs text-slate-500 ml-2">{m.gender} · {m.grade}조</span>
                          </div>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-100">추가</span>
                        </div>
                      ))}
                    {allDbMembers.filter(m => m.name.includes(attendanceSearchTerm) && !gatheringAttendees.some(a => a.id === m.id)).length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">검색된 회원이 없거나 이미 명단에 있습니다.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
              
              {regulars.map((member: any, idx: number) => (
                <div key={`regular-${idx}`} className="py-3 flex justify-between items-center px-1">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400">{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-base">{member.name}</span>
                      {member.role === '모임장' && (
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-purple-200">
                          모임장
                        </span>
                      )}
                      {member.role === '운영진' && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-blue-200">
                          운영진
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>{member.gender}</span>
                    <span className="font-bold text-slate-700">{member.grade}조</span>
                    
                    {/* 수정 모드일 때 삭제 버튼 표시 */}
                    {isEditingAttendance && (
                      <button
                        onClick={() => handleDeleteAttendee(member.attendance_id, member.is_guest, member.name)}
                        className="ml-2 px-2.5 py-1 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-md text-xs font-bold transition-colors border border-red-100 hover:border-red-500"
                      >
                        삭제
                      </button>
                    )}
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

                    {/* 수정 모드일 때 삭제 버튼 표시 */}
                    {isEditingAttendance && (
                      <button
                        onClick={() => handleDeleteAttendee(member.attendance_id, member.is_guest, member.name)}
                        className="ml-2 px-2.5 py-1 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-md text-xs font-bold transition-colors border border-red-100 hover:border-red-500"
                      >
                        삭제
                      </button>
                    )}
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
              <button onClick={() => setSelectedGathering(null)} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
    </div>
  );
}