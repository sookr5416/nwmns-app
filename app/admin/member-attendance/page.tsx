'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import CustomPopup, { PopupState } from '../../components/CustomPopup'; 

// 출석 데이터 구조 인터페이스
interface AttendanceRecord {
  id: string;
  gathering_id: string;
  attended_date: string;
  members: {
    id: string;
    name: string;
  };
}

// 회원 데이터 구조 인터페이스
interface Member {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  role: string;
  created_at: string; 
  att_reason?: string; 
}

// 출석 통계 데이터 구조 인터페이스
interface ProcessedMember extends Member {
  monthlyCount: number;
  attendedDates: string[];
}

type SortField = 'name' | 'age' | 'gender' | 'grade' | 'created_at' | 'att_reason' | 'monthlyCount';
type SortOrder = 'asc' | 'desc' | null;

export default function MonthlyMemberAttendancePage() {

  // 원본 데이터 상태
  const [members, setMembers] = useState<Member[]>([]);
  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  
  // 입력 중인 조회 조건 상태
  const [inputMonth, setInputMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [inputName, setInputName] = useState<string>(''); 
  const [inputWarning, setInputWarning] = useState<boolean>(false); 
  const [inputWarningCount, setInputWarningCount] = useState<number | string>(2); 

  // 실제로 적용된 조회 조건 상태
  const [selectedMonth, setSelectedMonth] = useState<string>(inputMonth);
  const [searchTerm, setSearchTerm] = useState<string>(''); 
  const [showWarningOnly, setShowWarningOnly] = useState<boolean>(false); 
  const [warningCountThreshold, setWarningCountThreshold] = useState<number>(2); 

  // 정렬 상태
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  // 페이징 처리 상태
  const [currentPage, setCurrentPage] = useState<number>(1);    
  const [itemsPerPage, setItemsPerPage] = useState<number>(20); 

  // 모달(팝업) 상태
  const [selectedMemberModal, setSelectedMemberModal] = useState<ProcessedMember | null>(null);

  // 공통 팝업 상태 
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

  // 데이터 리패치 이펙트
  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // 검색 조건 등 변경 시 1페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, searchTerm, showWarningOnly, warningCountThreshold, itemsPerPage]);

  const fetchData = async () => {
    if (!selectedMonth) return;

    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const startDate = `${selectedMonth}-01`;

    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: attData, error: attError } = await supabase
      .from('attendances')
      .select('id, gathering_id, attended_date, members(id, name)')
      .gte('attended_date', startDate)
      .lte('attended_date', `${endDate}T23:59:59.999Z`)
      .limit(5000);
    
    if (attError) console.error('출석 데이터 조회 에러:', attError);

    const { data: memData, error: memError } = await supabase
      .from('members')
      .select('id, name, age, gender, grade, role, created_at, att_reason')
      .eq('del_type', 'N')
      .order('name');

    if (memError) console.error('회원 데이터 조회 에러:', memError);

    if (memData) setMembers(memData as Member[]);
    if (attData) setAllAttendances(attData as unknown as AttendanceRecord[]);
  };

  const handleSearch = () => {
    if (!inputMonth) {
      return showPopup('alert', '입력 오류', '조회할 월을 선택해주세요.');
    }

    setSelectedMonth(inputMonth);
    setSearchTerm(inputName);
    setShowWarningOnly(inputWarning);
    setWarningCountThreshold(inputWarningCount === '' ? 0 : Number(inputWarningCount));
    setCurrentPage(1);
  };

  // 엑셀 다운로드 핸들러
  const handleExportExcel = () => {
    if (filteredMembers.length === 0) {
      return showPopup('alert', '알림', '다운로드할 데이터가 없습니다.');
    }

    // 1. 엑셀의 헤더(첫 줄) 정의
    const headers = ['이름', '마지막 참여일자', '월 참석 횟수'];

    // 2. 검색/필터링 된 데이터를 엑셀 행 형태로 변환
    const csvData = filteredMembers.map(member => {
      // 참여 기록 배열의 마지막 요소가 마지막 참여일자 (정렬되어 있음)
      const lastAttendance = member.attendedDates.length > 0 
        ? member.attendedDates[member.attendedDates.length - 1] 
        : '';
      
      // 행 데이터 조합 (쉼표로 구분)
      return [
        member.name,
        lastAttendance,
        `${member.monthlyCount}`
      ].join(',');
    });

    // 3. 헤더와 데이터를 합침
    const csvContent = [headers.join(','), ...csvData].join('\n');

    // 4. 한글 깨짐 방지를 위한 BOM(\uFEFF) 추가 후 Blob 생성
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 5. 가상의 a 태그를 만들어 다운로드 트리거
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `월별출석통계_${selectedMonth}.csv`); // 파일명 설정
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilter = searchTerm !== '' || showWarningOnly;

  const formatDOB = (dobStr: string) => {
    if (!dobStr) return '-';
    const clean = dobStr.replace(/[^0-9]/g, ''); 
    if (clean.length === 8) return `${clean.substring(2, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`;
    return dobStr;
  };

  const formatJoinDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${String(date.getFullYear()).substring(2,4)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedMembers = useMemo<ProcessedMember[]>(() => {
    return members.map(member => {
      
      const monthAttendances = allAttendances.filter(
        a => a.members && (a as any).members.id === member.id
      );

      const attendedDates = monthAttendances
        .map(a => a.attended_date.substring(0, 10))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const uniqueAttendedDates = Array.from(new Set(attendedDates));

      return {
        ...member,
        monthlyCount: uniqueAttendedDates.length,
        attendedDates: uniqueAttendedDates 
      };
    });
  }, [members, allAttendances]);

  // 다중 조건 필터링 및 정렬
  const filteredMembers = useMemo(() => {
    let result = processedMembers;

    if (searchTerm) {
      result = result.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (showWarningOnly) {
      result = result.filter(m => m.monthlyCount <= warningCountThreshold);
    }

    result.sort((a, b) => {
      if (sortField && sortOrder) {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'name') { valA = a.name; valB = b.name; }
        else if (sortField === 'age') { valA = a.age; valB = b.age; }
        else if (sortField === 'gender') { valA = a.gender; valB = b.gender; }
        else if (sortField === 'grade') { valA = a.grade; valB = b.grade; }
        else if (sortField === 'att_reason') { valA = a.att_reason || ''; valB = b.att_reason || ''; } 
        else if (sortField === 'created_at') { valA = new Date(a.created_at).getTime(); valB = new Date(b.created_at).getTime(); }
        else if (sortField === 'monthlyCount') { valA = a.monthlyCount; valB = b.monthlyCount; }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }

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

    return result;
  }, [processedMembers, searchTerm, showWarningOnly, warningCountThreshold, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage) || 1;            
  const startIndex = (currentPage - 1) * itemsPerPage;                                  
  const currentMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);  

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto space-y-6 bg-slate-50 min-h-screen">
      
      {/* 타이틀 및 상단 공통 버튼 영역 */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">월별 회원 출석 현황</h1>
          <p className="text-sm text-slate-500 mt-1">월별 참석 횟수를 확인하고, 활동이 저조한 회원을 관리하세요.</p>
        </div>
        
        {/* 우측 상단 공통 액션 버튼 (엑셀 다운로드 버튼 추가) */}
        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            엑셀 다운로드
          </button>
          <button
            onClick={handleSearch}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm transition-colors whitespace-nowrap"
          >
            조회
          </button>
        </div>
      </div>

      {/* 다중 검색 조건 영역 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">상세 검색</h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full items-end">
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">조회 월</span>
            <input 
              type="month" 
              value={inputMonth}
              onChange={(e) => setInputMonth(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all text-slate-700 font-bold"
            />
          </div>

          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름</span>
            <input 
              type="text" 
              placeholder="이름 입력..." 
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            />
          </div>

          {/* 지정 횟수 이하 참석자 조회 커스텀 체크박스 */}
          <div className="flex flex-col w-full sm:w-auto pb-0.5 sm:ml-auto">
            <label className="flex items-center gap-2 cursor-pointer bg-red-50 text-red-700 pl-3 pr-4 py-2 rounded-lg border border-red-100 hover:bg-red-100 transition-colors w-full sm:w-auto justify-center font-bold text-sm h-[38px]">
              <input 
                type="checkbox" 
                checked={inputWarning}
                onChange={(e) => setInputWarning(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer"
              />
              <input 
                type="number"
                min="0"
                value={inputWarningCount}
                onChange={(e) => setInputWarningCount(e.target.value === '' ? '' : Number(e.target.value))}
                onClick={(e) => e.stopPropagation()} 
                className="w-12 h-6 px-1 text-center bg-white border border-red-200 rounded text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 font-bold shadow-sm"
              />
              <span className="whitespace-nowrap">회 이하 참석자 보기</span>
            </label>
          </div>
        </div>
      </div>

      {/* 테이블 컨트롤 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 회원 수 : <span className="text-indigo-600">{members.length}</span> 명
            {hasActiveFilter && <span className="text-sm text-slate-400 ml-2">(조회 결과: {filteredMembers.length}명)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="w-full md:w-auto px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm"
          >
            <option value={10}>10명씩 보기</option>
            <option value={20}>20명씩 보기</option>
            <option value={50}>50명씩 보기</option>
            <option value={100}>100명씩 보기</option>
          </select>
        </div>
      </div>

      {/* 회원 명단 데이터 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm select-none">
              <tr>
                <th className="px-6 py-4 font-bold w-16">No</th>
                <th onClick={() => handleSort('name')} className="px-6 py-4 font-bold text-left cursor-pointer hover:text-indigo-600 transition-colors">
                  이름 {sortField === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('age')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  생년월일 {sortField === 'age' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('gender')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  성별 {sortField === 'gender' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('grade')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  조(급수) {sortField === 'grade' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('created_at')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  가입일자 {sortField === 'created_at' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('att_reason')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  비고 {sortField === 'att_reason' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('monthlyCount')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                  월 참석 횟수 {sortField === 'monthlyCount' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentMembers.map((member, idx) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-400">
                    {startIndex + idx + 1}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 text-left">
                    {member.name}
                    {member.role === '모임장' && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        모임장
                      </span>
                    )}
                    {member.role === '운영진' && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        운영진
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                    {formatDOB(member.age)}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>
                      {member.gender}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-bold">
                    {member.grade}조
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                    {formatJoinDate(member.created_at)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                    {member.att_reason || '-'}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">
                    <button
                      onClick={() => setSelectedMemberModal(member)}
                      title="상세 참석 날짜 보기"
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80 transition-opacity ring-1 ring-inset ${
                        member.monthlyCount <= warningCountThreshold 
                          ? 'bg-red-50 text-red-600 ring-red-200 hover:bg-red-100' 
                          : 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      {member.monthlyCount}
                    </button>
                  </td>
                </tr>
              ))}
              
              {currentMembers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400 font-medium">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
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

      {/* 상세 출석 날짜 팝업 모달 */}
      {selectedMemberModal && (
        <div 
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedMemberModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-800">
                <span className="text-indigo-600">{selectedMemberModal.name}</span> 회원 참석 내역
              </h3>
              <button 
                onClick={() => setSelectedMemberModal(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200"
                title="닫기"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-sm font-bold text-slate-500 mb-4 flex items-center justify-between">
                <span>{selectedMonth.split('-')[0]}년 {selectedMonth.split('-')[1]}월</span>
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">총 {selectedMemberModal.monthlyCount}회</span>
              </div>
              
              {selectedMemberModal.monthlyCount > 0 ? (
                <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedMemberModal.attendedDates.map((date, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 font-bold shadow-sm">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black shrink-0">
                        {i + 1}
                      </span>
                      {date} ({getDayOfWeek(date)})
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  이번 달 참석 기록이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 경고창 팝업 */}
      <CustomPopup popup={popup} onClose={closePopup} />
    </div>
  );
}