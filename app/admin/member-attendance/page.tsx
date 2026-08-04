'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

interface AttendanceRecord {
  id: string;
  gathering_id: string;
  attended_date: string; // YYYY-MM-DD
  members: {
    id: string;
    name: string;
  };
}

interface Member {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  role: string;
  created_at: string; 
}

export default function MonthlyMemberAttendancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  
  const [showWarningOnly, setShowWarningOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 페이징 및 '개수씩 보기' 상태
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  useEffect(() => {
    fetchData();
  }, []);

  // 필터나 보기 옵션이 변경될 때마다 1페이지로 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, searchTerm, showWarningOnly, itemsPerPage]);

  const fetchData = async () => {
    const { data: attData, error: attError } = await supabase
      .from('attendances')
      .select('id, gathering_id, attended_date, members(id, name)');
    
    if (attError) console.error('출석 데이터 조회 에러:', attError);

    const { data: memData, error: memError } = await supabase
      .from('members')
      .select('id, name, age, gender, grade, role, created_at')
      .order('name');

    if (memError) console.error('회원 데이터 조회 에러:', memError);

    if (memData) setMembers(memData as Member[]);
    if (attData) setAllAttendances(attData as unknown as AttendanceRecord[]);
  };

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
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const processedMembers = useMemo(() => {
    return members.map(member => {
      const monthlyCount = allAttendances.filter(
        a => 
          a.members && 
          (a as any).members.id === member.id && 
          a.attended_date.startsWith(selectedMonth)
      ).length;

      return {
        ...member,
        monthlyCount
      };
    });
  }, [members, allAttendances, selectedMonth]);

  const filteredMembers = useMemo(() => {
    let result = processedMembers;

    if (searchTerm) {
      result = result.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (showWarningOnly) {
      result = result.filter(m => m.monthlyCount <= 2);
    }

    result.sort((a, b) => {
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
  }, [processedMembers, searchTerm, showWarningOnly]);

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
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">월별 회원 출석 현황</h1>
          <p className="text-sm text-slate-500 mt-1">월별 참석 횟수를 확인하고, 활동이 저조한 회원을 관리하세요.</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 w-full md:w-auto focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

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

      {/* 회원 명단 테이블 */}
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
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        모임장
                      </span>
                    )}
                    {member.role === '운영진' && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
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
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${member.monthlyCount <= 2 ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-700'}`}>
                      {member.monthlyCount}
                    </span>
                  </td>
                </tr>
              ))}
              
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
  );
}