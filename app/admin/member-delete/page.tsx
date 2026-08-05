'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase'; // 경로에 맞게 ../ 개수 조정 필요
import CustomPopup, { PopupState } from '../../components/CustomPopup'; // 경로에 맞게 조정 필요

interface Attendance {
  id: string;
  attended_date: string; 
}

interface Member {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
  role: string;
  created_at: string;
  del_type?: string; 
  del_reason?: string;
  attendances?: Attendance[]; 
}

type SortField = 'name' | 'age' | 'gender' | 'grade' | 'created_at' | 'last_attendance' | 'monthly_count';
type SortOrder = 'asc' | 'desc' | null;

export default function MemberDeletePage() {
  const [deletedMembers, setDeletedMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  
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
    fetchDeletedMembers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchDeletedMembers = async () => {
    // 삭제 처리된 회원(del_type = 'Y')만 조회
    const { data, error } = await supabase
      .from('members')
      .select('*, attendances(id, attended_date)')
      .eq('del_type', 'Y'); 

    if (data) setDeletedMembers(data);
    if (error) console.error("데이터 로드 에러:", error);
  };

  // 선택한 회원 일괄 복구
  const handleBatchRestore = async () => {
    if (selectedMemberIds.length === 0) {
      return showPopup('alert', '선택 오류', '복구할 회원을 체크박스로 선택해주세요.');
    }

    showPopup('confirm', '일괄 복구', `선택한 ${selectedMemberIds.length}명의 회원을 일반 회원으로 복구하시겠습니까?`, async () => {
      closePopup(); 
      
      try {
        const { error } = await supabase
          .from('members')
          .update({ del_type: 'N' })
          .in('id', selectedMemberIds);

        if (error) throw error;
        
        showPopup('alert', '처리 완료', '성공적으로 복구되었습니다.');
        setSelectedMemberIds([]); 
        fetchDeletedMembers();
      } catch (error) {
        showPopup('alert', '오류', '복구 처리 중 오류가 발생했습니다.');
      }
    });
  };

  // 개별 회원 복구
  const handleRestore = (id: string, memberName: string) => {
    showPopup('confirm', '회원 복구', `${memberName} 회원을 일반 회원으로 복구하시겠습니까?`, async () => {
      closePopup();
      const { error } = await supabase.from('members').update({ del_type: 'N' }).eq('id', id);
      
      if (error) {
        showPopup('alert', '오류', '복구 중 오류가 발생했습니다.');
      } else {
        setDeletedMembers(deletedMembers.filter(m => m.id !== id));
        setSelectedMemberIds(selectedMemberIds.filter(selId => selId !== id)); 
        showPopup('alert', '복구 완료', `${memberName} 회원이 성공적으로 복구되었습니다.`);
      }
    });
  };

  // 영구 삭제 (Hard Delete) - 출석 기록까지 모두 지워짐
  const handleHardDelete = (id: string, memberName: string) => {
    showPopup('confirm', '영구 삭제 경고', `⚠️ ${memberName} 회원을 정말 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 해당 회원의 모든 출석 기록도 함께 삭제됩니다.`, async () => {
      closePopup();

      // 외래키 무결성을 위해 출석 기록 먼저 삭제
      await supabase.from('attendances').delete().eq('member_id', id);
      
      // 회원 완전 삭제
      const { error } = await supabase.from('members').delete().eq('id', id);

      if (error) {
        return showPopup('alert', '오류', '영구 삭제 중 오류가 발생했습니다.');
      }

      setDeletedMembers(deletedMembers.filter(m => m.id !== id));
      setSelectedMemberIds(selectedMemberIds.filter(selId => selId !== id)); 
      showPopup('alert', '삭제 완료', `${memberName} 회원이 영구 삭제되었습니다.`);
    });
  };

  const formatDOB = (dobStr: string) => {
    if (!dobStr) return '';
    const clean = dobStr.replace(/[^0-9]/g, ''); 
    if (clean.length === 8) return `${clean.substring(2, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`;
    else if (clean.length === 6) return `${clean.substring(0, 2)}.${clean.substring(2, 4)}.${clean.substring(4, 6)}`;
    return dobStr; 
  };

  const formatJoinDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${String(date.getFullYear()).substring(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const getLastAttendance = (attendances?: Attendance[]) => {
    if (!attendances || attendances.length === 0) return '기록 없음';
    const sorted = [...attendances].sort((a, b) => new Date(b.attended_date).getTime() - new Date(a.attended_date).getTime());
    const date = new Date(sorted[0].attended_date);
    return `${String(date.getFullYear()).substring(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const getMonthlyCount = (attendances?: Attendance[]) => {
    if (!attendances) return 0;
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; 
    return attendances.filter(a => a.attended_date.startsWith(currentMonthPrefix)).length;
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

  const filteredMembers = deletedMembers.filter(member => member.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const roleWeight: Record<string, number> = { '모임장': 1, '운영진': 2, '일반': 3 };
    const weightA = roleWeight[a.role || '일반'] || 3;
    const weightB = roleWeight[b.role || '일반'] || 3;

    if (sortField && sortOrder) {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') { valA = a.name; valB = b.name; }
      else if (sortField === 'age') { valA = a.age; valB = b.age; }
      else if (sortField === 'gender') { valA = a.gender; valB = b.gender; }
      else if (sortField === 'grade') { valA = a.grade; valB = b.grade; }
      else if (sortField === 'created_at') { valA = new Date(a.created_at).getTime(); valB = new Date(b.created_at).getTime(); }
      else if (sortField === 'last_attendance') { 
        valA = a.attendances && a.attendances.length > 0 ? Math.max(...a.attendances.map(att => new Date(att.attended_date).getTime())) : 0; 
        valB = b.attendances && b.attendances.length > 0 ? Math.max(...b.attendances.map(att => new Date(att.attended_date).getTime())) : 0; 
      }
      else if (sortField === 'monthly_count') { valA = getMonthlyCount(a.attendances); valB = getMonthlyCount(b.attendances); }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }

    if (weightA !== weightB) return weightA - weightB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMembers = sortedMembers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">탈퇴자 명단 관리</h1>
        <p className="text-sm text-slate-500 mt-1">비활성화 처리된 탈퇴 회원을 다시 복구하거나, 데이터를 영구 삭제할 수 있습니다.</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 탈퇴자 수 : <span className="text-red-500">{deletedMembers.length}</span> 명
            {searchTerm && <span className="text-sm text-slate-400 ml-2">(검색 결과: {filteredMembers.length}명)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <button 
            onClick={handleBatchRestore}
            className="w-full md:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap active:scale-95"
          >
            선택 일괄 복구 {selectedMemberIds.length > 0 ? `(${selectedMemberIds.length}명)` : ''}
          </button>

          <div className="relative w-full md:w-64">
            <input 
              type="text" 
              placeholder="이름으로 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm select-none">
            <tr>
              <th className="px-4 py-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={currentMembers.length > 0 && currentMembers.every(m => selectedMemberIds.includes(m.id))}
                  onChange={(e) => {
                    const currentIds = currentMembers.map(m => m.id);
                    if (e.target.checked) {
                      setSelectedMemberIds(prev => Array.from(new Set([...prev, ...currentIds])));
                    } else {
                      setSelectedMemberIds(prev => prev.filter(id => !currentIds.includes(id)));
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              
              <th onClick={() => handleSort('name')} className="px-4 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                이름 {sortField === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('age')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                생년월일 {sortField === 'age' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('gender')} className="px-4 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                성별 {sortField === 'gender' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('grade')} className="px-4 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                조(급수) {sortField === 'grade' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('created_at')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                가입일자 {sortField === 'created_at' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('last_attendance')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                최근 참여일 {sortField === 'last_attendance' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-6 py-4 font-bold text-slate-500">
                탈퇴 사유
              </th>
              <th className="px-6 py-4 font-bold text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentMembers.map(member => {
              const joinDate = formatJoinDate(member.created_at);
              const lastAttendance = getLastAttendance(member.attendances);
              const isSelected = selectedMemberIds.includes(member.id);

              return (
                <tr key={member.id} className={`transition-colors opacity-80 ${isSelected ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-4 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMemberIds(prev => [...prev, member.id]);
                        else setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                      }}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-600 text-base flex items-center gap-2 line-through decoration-slate-400">
                    {member.name}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm">{formatDOB(member.age)}</td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-500">
                      {member.gender}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500 font-bold">
                    {member.grade}조
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm">{joinDate}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm">{lastAttendance}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm">
                    {member.del_reason || '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleRestore(member.id, member.name)}
                      className="px-3 py-1.5 text-sm font-bold bg-indigo-100 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-md transition-colors"
                    >
                      복구
                    </button>
                    <button 
                      onClick={() => handleHardDelete(member.id, member.name)} 
                      className="px-2 py-1.5 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                    >
                      영구 삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {currentMembers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {searchTerm ? `'${searchTerm}'(으)로 검색된 탈퇴 회원이 없습니다.` : '탈퇴 처리된 회원이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            이전
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
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
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            다음
          </button>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
      
    </div>
  );
}