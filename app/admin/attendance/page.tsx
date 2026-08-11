'use client';

import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import CustomPopup, { PopupState } from '../../components/CustomPopup';

// 정모 데이터 구조 인터페이스
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
  const [allDbMembers, setAllDbMembers] = useState<any[]>([]);                        

  // 명단 로딩 상태 추가
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  // 제출(등록/수정) 중 상태 (더블 클릭 방지용)
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [gatheringDate, setGatheringDate] = useState(todayStr());
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [memo, setMemo] = useState('');

  const [searchInput, setSearchInput] = useState(''); 
  const [searchDate, setSearchDate] = useState('');   
  
  const [appliedSearchInput, setAppliedSearchInput] = useState('');
  const [appliedSearchDate, setAppliedSearchDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  const [editingGathering, setEditingGathering] = useState<Gathering | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editMemo, setEditMemo] = useState('');

  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [editAttendees, setEditAttendees] = useState<any[]>([]); 

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

  const fetchGatherings = async () => {
    const { data } = await supabase.from('gatherings').select('*').order('gathering_date', { ascending: false });
    if (data) setGatheringList(data);
  };

  const fetchAllMembers = async () => {
    const { data } = await supabase.from('members').select('id, name, age, gender, grade, role, created_at').eq('del_type', 'N');
    if (data) setAllDbMembers(data);
  };

  const handleSearch = () => {
    setAppliedSearchInput(searchInput);
    setAppliedSearchDate(searchDate);
    setCurrentPage(1);
  };

  const hasActiveFilter = appliedSearchInput || appliedSearchDate;

  // 팝업 닫을 때 폼 데이터 완벽 초기화 함수
  const closeRegisterModal = () => {
    setGatheringDate(todayStr());
    setLocation('');
    setStartTime('');
    setMemo('');
    setIsRegisterModalOpen(false);
  };

  const handleCreateGathering = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // 더블 클릭 차단

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

    setIsSubmitting(true);

    try {
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
        closeRegisterModal(); // 등록 성공 시 초기화 후 창 닫기
        fetchGatherings();
      }
    } catch (error) {
      showPopup('alert', '오류', '예기치 못한 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
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
    if (isSubmitting) return; 

    if (!editLocation.trim() || !editStartTime.trim()) {
      return showPopup('alert', '입력 오류', '장소와 시간을 모두 입력해주세요.');
    }

    setIsSubmitting(true);

    try {
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
    } catch (error) {
      showPopup('alert', '오류', '예기치 못한 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
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

  const handleSelectGathering = async (gathering: Gathering) => {
    setSelectedGathering(gathering);
    setIsEditingAttendance(false); 
    setAttendanceSearchTerm('');
    setEditAttendees([]);
    setGatheringAttendees([]); 
    setIsLoadingAttendees(true); 

    try {
      const [memberResponse, guestResponse] = await Promise.all([
        supabase
          .from('attendances')
          .select('id, members(id, name, age, gender, grade, role, created_at)')
          .eq('gathering_id', gathering.id),
        supabase
          .from('guest_attendances')
          .select('*')
          .eq('gathering_id', gathering.id)
      ]);

      let allAttendees: any[] = [];

      if (memberResponse.data) {
        const regulars = memberResponse.data.map((item: any) => {
          if (!item.members) return null;
          return {
            ...item.members,
            attendance_id: item.id,
            is_guest: false
          };
        }).filter(Boolean);
        allAttendees = [...allAttendees, ...regulars];
      }

      if (guestResponse.data) {
        const guests = guestResponse.data.map(g => ({
          ...g,
          attendance_id: g.id, 
          role: '게스트',
          is_guest: true
        }));
        allAttendees = [...allAttendees, ...guests];
      }

      setGatheringAttendees(allAttendees);
    } catch (error) {
      console.error("데이터 로드 오류:", error);
    } finally {
      setIsLoadingAttendees(false); 
    }
  };

  const handleDeleteAttendeeLocal = (attendanceId: string) => {
    setEditAttendees(prev => prev.filter(a => a.attendance_id !== attendanceId));
  };

  const handleAddAttendeeLocal = (member: any) => {
    setEditAttendees(prev => [...prev, {
      ...member,
      attendance_id: `temp_${Date.now()}_${member.id}`,
      is_guest: false,
      is_new: true
    }]);
  };

  const handleSaveAttendanceChanges = async () => {
    if (!selectedGathering) return;
    if (isSubmitting) return; // 명단 저장 더블클릭 방지

    const currentIds = editAttendees.map(a => a.attendance_id);
    const deletedOriginals = gatheringAttendees.filter(a => !currentIds.includes(a.attendance_id));
    const addedMembers = editAttendees.filter(a => a.is_new);

    setIsSubmitting(true);

    try {
      for (const del of deletedOriginals) {
        const tableName = del.is_guest ? 'guest_attendances' : 'attendances';
        await supabase.from(tableName).delete().eq('id', del.attendance_id);
      }

      if (addedMembers.length > 0) {
        const inserts = addedMembers.map(m => ({
          gathering_id: selectedGathering.id,
          member_id: m.id,
          attended_date: selectedGathering.gathering_date
        }));
        await supabase.from('attendances').insert(inserts);
      }

      showPopup('alert', '수정 완료', '명단이 성공적으로 저장되었습니다.');
      setIsEditingAttendance(false);
      handleSelectGathering(selectedGathering); 
    } catch (error) {
      showPopup('alert', '오류', '명단 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${String(date.getFullYear()).substring(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
  };

  const filteredGatherings = gatheringList.filter(g => {
    if (appliedSearchInput) {
      const term = appliedSearchInput.toLowerCase();
      if (!g.location.toLowerCase().includes(term) && !(g.memo && g.memo.toLowerCase().includes(term))) {
        return false;
      }
    }
    if (appliedSearchDate) {
      if (!g.gathering_date.startsWith(appliedSearchDate)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredGatherings.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentGatherings = filteredGatherings.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const displayAttendees = isEditingAttendance ? editAttendees : gatheringAttendees;

  const regulars = displayAttendees.filter(m => !m.is_guest).sort((a: any, b: any) => {
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

  const guests = displayAttendees.filter(m => m.is_guest).sort((a, b) => a.name.localeCompare(b.name));

  const availableMembers = allDbMembers
    .filter(m => !displayAttendees.some(a => a.id === m.id))
    .filter(m => m.name.includes(attendanceSearchTerm))
    .sort((a: any, b: any) => {
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

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto min-h-screen">
      
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">정모 정보 및 일정 관리</h1>
          <p className="text-sm text-slate-500 mt-1">정모 일자별 장소와 시간을 관리하고, 각 정모에 참여한 참석 인원을 확인하세요.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={handleSearch}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm transition-colors whitespace-nowrap"
          >
            조회
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap"
          >
            신규 등록
          </button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex flex-col w-full sm:w-1/2 md:w-64">
          <span className="text-xs font-bold text-slate-500 mb-1 ml-1">장소 및 비고 검색</span>
          <div className="relative">
            <input
              type="text"
              placeholder="장소 또는 비고 입력..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col w-full sm:w-1/2 md:w-48">
          <span className="text-xs font-bold text-slate-500 mb-1 ml-1">정모 날짜(월) 검색</span>
          <input
            type="month"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all text-slate-600"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 정모 수 : <span className="text-indigo-600">{gatheringList.length}</span> 건
            {hasActiveFilter && <span className="text-sm text-slate-400 ml-2">(조회 결과: {filteredGatherings.length}건)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
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
                    {hasActiveFilter ? '검색 조건에 맞는 정모가 없습니다.' : '등록된 정모 일정이 없습니다.'}
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

      {/* 신규 정모 등록 모달 */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">신규 정모 등록</h3>
              {/* 팝업 닫기 버튼에 초기화 함수 연결 */}
              <button
                onClick={closeRegisterModal}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateGathering} className="p-6 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">정모 일자</span>
                <input 
                  type="date" 
                  max={todayStr()} 
                  value={gatheringDate} 
                  onChange={e => setGatheringDate(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">장소</span>
                <input 
                  type="text" 
                  placeholder="예: 영등포다목적배드민턴체육관" 
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">시간</span>
                <input 
                  type="text" 
                  placeholder="예: 18:20 - 21:30" 
                  value={startTime} 
                  onChange={e => setStartTime(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고</span>
                <input 
                  type="text" 
                  placeholder="예: 정기 정모" 
                  value={memo} 
                  onChange={e => setMemo(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700" 
                />
              </div>

              <div className="pt-4 flex gap-2 justify-end border-t border-slate-100 mt-6">
                {/* 팝업 닫기(취소) 버튼에 초기화 함수 연결 */}
                <button 
                  type="button" 
                  onClick={closeRegisterModal} 
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                {/* 등록 버튼 더블클릭 방지 & 텍스트 고정 */}
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                    isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 정모 정보 수정 모달 */}
      {editingGathering && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 animate-fade-in p-4">
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
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-bold cursor-not-allowed text-sm" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">장소</span>
                <input 
                  type="text" 
                  value={editLocation} 
                  onChange={e => setEditLocation(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all text-sm font-medium" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">시간</span>
                <input 
                  type="text" 
                  value={editStartTime} 
                  onChange={e => setEditStartTime(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all text-sm font-medium" 
                />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고</span>
                <input 
                  type="text" 
                  value={editMemo} 
                  onChange={e => setEditMemo(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-lg transition-all text-sm font-medium" 
                />
              </div>

              <div className="pt-4 flex gap-2 justify-end border-t border-slate-100 mt-6">
                <button 
                  type="button"
                  onClick={() => setEditingGathering(null)}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                {/* 수정 버튼 더블클릭 방지 & 텍스트 고정 */}
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                    isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 명단 확인 팝업 (Dynamic Width 변경 방식) */}
      {selectedGathering && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 animate-fade-in p-4">
          <div 
            className={`bg-white rounded-2xl shadow-2xl w-full ${isEditingAttendance ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden animate-scale-up flex flex-col h-[80vh] transition-all duration-300 ease-in-out`}
          >
            {/* 팝업 헤더 */}
            <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">{formatDateString(selectedGathering.gathering_date)} 정모 명단</h3>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">{selectedGathering.location} ({selectedGathering.start_time}) · 총 {displayAttendees.length}명 참석</p>
              </div>
              <div className="flex items-center gap-2">
                {isEditingAttendance ? (
                  // 명단 수정 버튼 더블클릭 방지 & 텍스트 고정
                  <button
                    onClick={handleSaveAttendanceChanges}
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors text-white shadow-sm ${
                      isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    수정 완료
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsEditingAttendance(true);
                      setEditAttendees([...gatheringAttendees]); 
                      setAttendanceSearchTerm('');
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg transition-colors bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 shadow-sm"
                  >
                    명단 수정
                  </button>
                )}

                <button 
                  onClick={() => {
                    setSelectedGathering(null);
                    setIsEditingAttendance(false);
                    setEditAttendees([]);
                    setAttendanceSearchTerm(''); // 창 닫을 때 검색어 초기화
                  }}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors ml-2 shadow-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* 팝업 바디 영역 */}
            {isLoadingAttendees ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 text-sm font-bold animate-pulse">명단을 불러오는 중입니다...</p>
              </div>
            ) : isEditingAttendance ? (
              // 수정 모드: 2단 분할 레이아웃 (Side-by-Side)
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-slate-50">
                
                {/* 좌측: 현재 참석자 명단 */}
                <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <span className="font-bold text-slate-700 text-sm">현재 참석 명단</span>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{displayAttendees.length}명</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-slate-50">
                    {regulars.map((member: any, idx: number) => (
                      <div key={`regular-${idx}`} className="py-2.5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-xs font-bold text-slate-400 text-center">{idx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-sm">{member.name}</span>
                            {member.is_new && <span className="bg-orange-100 text-orange-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">New</span>}
                            {member.role === '모임장' && <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">모임장</span>}
                            {member.role === '운영진' && <span className="bg-blue-100 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">운영진</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className={`font-bold px-1.5 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-50' : 'text-yellow-800 bg-yellow-50'}`}>{member.gender}</span>
                          <span className="font-bold text-slate-600">{member.grade}조</span>
                          <button
                            onClick={() => handleDeleteAttendeeLocal(member.attendance_id)}
                            className="ml-1 w-6 h-6 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {guests.map((member: any, idx: number) => (
                      <div key={`guest-${idx}`} className="py-2.5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-xs font-bold text-slate-400 text-center">{regulars.length + idx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-sm">{member.name}</span>
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">게스트</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className={`font-bold px-1.5 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-50' : 'text-yellow-800 bg-yellow-50'}`}>{member.gender}</span>
                          <span className="font-bold text-slate-600">{member.grade}조</span>
                          <button
                            onClick={() => handleDeleteAttendeeLocal(member.attendance_id)}
                            className="ml-1 w-6 h-6 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {displayAttendees.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-sm font-medium">참석 명단이 비어 있습니다.</div>
                    )}
                  </div>
                </div>

                {/* 우측: 전체 회원 추가 리스트 */}
                <div className="w-full md:w-1/2 flex flex-col bg-slate-50">
                  <div className="p-4 bg-white border-b border-slate-200 shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="전체 회원 명단 검색..."
                        value={attendanceSearchTerm}
                        onChange={e => setAttendanceSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                      <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {availableMembers.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                            {m.role === '모임장' && <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">모임장</span>}
                            {m.role === '운영진' && <span className="bg-blue-100 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">운영진</span>}
                          </div>
                          <span className="text-xs text-slate-500 mt-0.5 font-medium">{m.gender} · {m.grade}조</span>
                        </div>
                        <button 
                          onClick={() => handleAddAttendeeLocal(m)}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          추가
                        </button>
                      </div>
                    ))}
                    {availableMembers.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-sm font-medium">검색된 회원이 없거나 이미 모두 추가되었습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // 조회 모드 (기존의 1단 세로 리스트)
              <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
                {regulars.map((member: any, idx: number) => (
                  <div key={`regular-${idx}`} className="py-3 flex justify-between items-center px-1">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-xs font-bold text-slate-400 text-center">{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-base">{member.name}</span>
                        {member.role === '모임장' && <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">모임장</span>}
                        {member.role === '운영진' && <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">운영진</span>}
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
                      <span className="w-6 text-xs font-bold text-slate-400 text-center">{regulars.length + idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-base">{member.name}</span>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">게스트</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>{member.gender}</span>
                      <span className="font-bold text-slate-700">{member.grade}조</span>
                    </div>
                  </div>
                ))}

                {displayAttendees.length === 0 && (
                  <div className="text-center py-10 text-slate-400 font-medium">이 날짜에 출석 체크된 인원이 없습니다.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
    </div>
  );
}