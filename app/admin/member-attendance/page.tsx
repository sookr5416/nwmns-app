'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

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
}

// 출석 통계 데이터 구조 인터페이스
interface ProcessedMember extends Member {
  monthlyCount: number;
  attendedDates: string[];
}

export default function MonthlyMemberAttendancePage() {

  // 원본 데이터 상태
  const [members, setMembers] = useState<Member[]>([]);
  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  
  // 조회 조건 상태
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  
  // 필터링 조건 상태
  const [showWarningOnly, setShowWarningOnly] = useState<boolean>(false); // 2회 이하 출석자만 보기 여부
  const [searchTerm, setSearchTerm] = useState<string>('');               // 이름 검색

  // 페이징 처리 상태
  const [currentPage, setCurrentPage] = useState<number>(1);    // 현재 페이지 번호
  const [itemsPerPage, setItemsPerPage] = useState<number>(20); // 한 페이지당 보여줄 목로 개수

  // 모달(팝업) 상태
  const [selectedMemberModal, setSelectedMemberModal] = useState<ProcessedMember | null>(null);

  // 조회 월(selectedMonth)이 변경될 때마다 데이터를 다시 불러옴
  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // 검색어, 필터 조건, 페이지당 개수 등이 변경되면 항상 1페이지로 돌아감
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, searchTerm, showWarningOnly, itemsPerPage]);

  const fetchData = async () => {
    
    // 선택된 월의 1일과 마지막 일자를 계산
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const startDate = `${selectedMonth}-01`;

    // 다음 달의 0일째를 구하면 이번 달의 마지막 날짜를 얻을 수 있음
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Supabase의 기본 1,000건 응답 제한을 우회하기 위해, 해당 월에 속한 데이터만 조회
    const { data: attData, error: attError } = await supabase
      .from('attendances')
      .select('id, gathering_id, attended_date, members(id, name)')
      .gte('attended_date', startDate)
      .lte('attended_date', `${endDate}T23:59:59.999Z`)
      .limit(5000);
    
    if (attError) console.error('출석 데이터 조회 에러:', attError);

    // 삭제되지 않은 회원만 조회
    const { data: memData, error: memError } = await supabase
      .from('members')
      .select('id, name, age, gender, grade, role, created_at')
      .eq('del_type', 'N')
      .order('name');

    if (memError) console.error('회원 데이터 조회 에러:', memError);

    if (memData) setMembers(memData as Member[]);
    if (attData) setAllAttendances(attData as unknown as AttendanceRecord[]);
  };

  // 생년월일 포맷 (YY.MM.DD)
  const formatDOB = (dobStr: string) => {
    if (!dobStr) return '-';
    const clean = dobStr.replace(/[^0-9]/g, ''); 
    if (clean.length === 8) return `${clean.substring(2, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`;
    return dobStr;
  };

  // 가입일자 포맷 (YY.MM.DD)
  const formatJoinDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${String(date.getFullYear()).substring(2,4)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  // 날짜를 받아 한글 요일 반환
  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  // 개인별 출석 통계 계산
  const processedMembers = useMemo<ProcessedMember[]>(() => {
    return members.map(member => {
      
      // 해당 회원의 이번 달 출석 기록만 필터링
      const monthAttendances = allAttendances.filter(
        a => a.members && (a as any).members.id === member.id
      );

      // 날짜 문자열만 추출 후 시간 오름차순으로 정렬
      const attendedDates = monthAttendances
        .map(a => a.attended_date.substring(0, 10))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      // 중복 제거
      const uniqueAttendedDates = Array.from(new Set(attendedDates));

      return {
        ...member,
        monthlyCount: uniqueAttendedDates.length,
        attendedDates: uniqueAttendedDates 
      };
    });
  }, [members, allAttendances]);

  // 가공된 데이터에 검색어, 필터조건, 정렬 적용
  const filteredMembers = useMemo(() => {
    let result = processedMembers;

    // 이름 검색 필터
    if (searchTerm) {
      result = result.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 출석 경고자 (2회 이하) 필터
    if (showWarningOnly) {
      result = result.filter(m => m.monthlyCount <= 2);
    }

    // 목록 정렬
    result.sort((a, b) => {

      // 직책에 따른 우선순위 부여
      const getRoleRank = (role: string) => {
        if (role === '모임장') return 1;
        if (role === '운영진') return 2;
        return 3; 
      };

      const rankA = getRoleRank(a.role);
      const rankB = getRoleRank(b.role);

      // 직책이 다르면 직책 우선순위로 정렬
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // 직책이 같으면 가입일 순으로 정렬 (오름차순)
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

      return dateA - dateB;
    });

    return result;
  }, [processedMembers, searchTerm, showWarningOnly]);

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage) || 1;             // 전체 페이지 수
  const startIndex = (currentPage - 1) * itemsPerPage;                                  // 현재 페이지에서 보여줄 배열 시작 인덱스
  const currentMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);  // 현재 페이지에 랜더링될 멤버들

  // 페이지 이동 핸들러
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto space-y-6 bg-slate-50 min-h-screen">
      {/* 헤더 영역 */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">월별 회원 출석 현황</h1>
          <p className="text-sm text-slate-500 mt-1">월별 참석 횟수를 확인하고, 활동이 저조한 회원을 관리하세요.</p>
        </div>
      </div>

      {/* 검색 및 필터 컨트롤 패널 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 w-full md:w-auto focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* 이름 검색 및 경고자 보기 체크박스 */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="이름 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-48 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="flex items-center gap-2 cursor-pointer bg-red-50 text-red-700 px-4 py-2.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors w-full sm:w-auto justify-center font-bold text-sm">
            <input 
              type="checkbox" 
              checked={showWarningOnly}
              onChange={(e) => setShowWarningOnly(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
            />
            2회 이하 참석자만 보기
          </label>
        </div>
      </div>

      {/* 리스트 요약 및 개수 선택기 */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 회원 수 : <span className="text-indigo-600">{members.length}</span> 명
            {(searchTerm || showWarningOnly) && <span className="text-sm text-slate-400 ml-2">(검색 결과: {filteredMembers.length}명)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-bold w-16">No</th>
                <th className="px-6 py-4 font-bold text-left">이름</th>
                <th className="px-6 py-4 font-bold">생년월일</th>
                <th className="px-6 py-4 font-bold">성별</th>
                <th className="px-6 py-4 font-bold">조(급수)</th>
                <th className="px-6 py-4 font-bold">가입일자</th>
                <th className="px-6 py-4 font-bold">월 참석 횟수</th>
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
                  <td className="px-6 py-4 font-bold text-slate-700">
                    <button
                      onClick={() => setSelectedMemberModal(member)}
                      title="상세 참석 날짜 보기"
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80 transition-opacity ring-1 ring-inset ${
                        member.monthlyCount <= 2 
                          ? 'bg-red-50 text-red-600 ring-red-200 hover:bg-red-100' 
                          : 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      {member.monthlyCount}
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* 필터 결과가 없을 때 보여주는 빈 상태 */}
              {currentMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 (페이지가 1개 초과일 때만 노출) */}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedMemberModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-800">
                <span className="text-indigo-600">{selectedMemberModal.name}</span> 회원 참석 내역
              </h3>
              <button 
                onClick={() => setSelectedMemberModal(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                      {/* 날짜 옆에 요일 추가 */}
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
            {/* ✅ 하단 닫기 버튼 영역 완전히 제거됨 */}
          </div>
        </div>
      )}
    </div>
  );
}