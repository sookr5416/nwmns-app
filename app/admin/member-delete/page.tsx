'use client';

import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import CustomPopup, { PopupState } from '../../components/CustomPopup'; 

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
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 다중 검색 조건
  const [searchName, setSearchName] = useState('');
  const [searchBirthMonth, setSearchBirthMonth] = useState(''); 
  const [searchGender, setSearchGender] = useState('all');
  const [searchGrade, setSearchGrade] = useState('all');
  const [searchJoinMonth, setSearchJoinMonth] = useState('');   

  const [appliedSearchName, setAppliedSearchName] = useState('');
  const [appliedSearchBirthMonth, setAppliedSearchBirthMonth] = useState('');
  const [appliedSearchGender, setAppliedSearchGender] = useState('all');
  const [appliedSearchGrade, setAppliedSearchGrade] = useState('all');
  const [appliedSearchJoinMonth, setAppliedSearchJoinMonth] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  // 날짜 입력용 복구 모달 상태
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreType, setRestoreType] = useState<'single' | 'batch' | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string>(''); 
  const [restoreTargetName, setRestoreTargetName] = useState<string>(''); 
  const [restoreDate, setRestoreDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  
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

  const fetchDeletedMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*, attendances(id, attended_date)')
      .eq('del_type', 'Y'); 

    if (data) setDeletedMembers(data);
    if (error) console.error("데이터 로드 에러:", error);
  };

  const handleSearch = () => {
    setAppliedSearchName(searchName);
    setAppliedSearchBirthMonth(searchBirthMonth);
    setAppliedSearchGender(searchGender);
    setAppliedSearchGrade(searchGrade);
    setAppliedSearchJoinMonth(searchJoinMonth);
    setCurrentPage(1);
  };

  const hasActiveFilter = appliedSearchName || appliedSearchBirthMonth || appliedSearchGender !== 'all' || appliedSearchGrade !== 'all' || appliedSearchJoinMonth;

  // [복구 로직] 모달 띄우기
  const openSingleRestore = (id: string, name: string) => {
    setRestoreType('single');
    setRestoreTargetId(id);
    setRestoreTargetName(name);
    setIsRestoreModalOpen(true);
  };

  const openBatchRestore = () => {
    if (selectedMemberIds.length === 0) {
      return showPopup('alert', '선택 오류', '복구할 회원을 체크박스로 선택해주세요.');
    }
    setRestoreType('batch');
    setIsRestoreModalOpen(true);
  };

  const closeRestoreModal = () => {
    setIsRestoreModalOpen(false);
    setRestoreType(null);
  };

  const executeRestore = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!restoreDate) return showPopup('alert', '오류', '복구할 가입일자를 지정해주세요.');

    setIsSubmitting(true);
    // 가입일자 정렬을 위해 무조건 해당 일자의 23시 59분 59초(한국시간)로 설정
    const customCreatedAt = `${restoreDate}T23:59:59+09:00`;

    try {
      if (restoreType === 'single') {
        const { error } = await supabase
          .from('members')
          .update({ del_type: 'N', del_reason: null, created_at: customCreatedAt })
          .eq('id', restoreTargetId);
        if (error) throw error;
        
        setDeletedMembers(deletedMembers.filter(m => m.id !== restoreTargetId));
        setSelectedMemberIds(selectedMemberIds.filter(id => id !== restoreTargetId));
        showPopup('alert', '복구 완료', `${restoreTargetName} 회원이 성공적으로 복구되었습니다.`);
      } else if (restoreType === 'batch') {
        const { error } = await supabase
          .from('members')
          .update({ del_type: 'N', del_reason: null, created_at: customCreatedAt })
          .in('id', selectedMemberIds);
        if (error) throw error;

        showPopup('alert', '처리 완료', '선택한 회원들이 성공적으로 일괄 복구되었습니다.');
        setSelectedMemberIds([]); 
        fetchDeletedMembers();
      }
    } catch (error) {
      showPopup('alert', '오류', '복구 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
      closeRestoreModal();
    }
  };

  // [영구 삭제 로직]
  const handleHardDelete = (id: string, name: string) => {
    showPopup('confirm', '영구 삭제 경고', `⚠️ ${name} 회원을 정말 영구 삭제하시겠습니까?\n이 작업은 절대 되돌릴 수 없으며, 기존의 모든 출석 기록도 삭제됩니다.`, async () => {
      closePopup();
      setIsSubmitting(true);
      
      // 출석 기록 먼저 삭제 후, 회원 삭제 (외래키 무결성 방지)
      await supabase.from('attendances').delete().eq('member_id', id);
      const { error } = await supabase.from('members').delete().eq('id', id);
      
      setIsSubmitting(false);

      if (error) {
        return showPopup('alert', '오류', '영구 삭제 중 오류가 발생했습니다.');
      }

      setDeletedMembers(deletedMembers.filter(m => m.id !== id));
      setSelectedMemberIds(selectedMemberIds.filter(selId => selId !== id)); 
      showPopup('alert', '삭제 완료', `${name} 회원이 시스템에서 영구 삭제되었습니다.`);
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

  const filteredMembers = deletedMembers.filter(member => {
    if (appliedSearchName && !member.name.toLowerCase().includes(appliedSearchName.toLowerCase())) return false;
    if (appliedSearchGender !== 'all' && member.gender !== appliedSearchGender) return false;
    if (appliedSearchGrade !== 'all' && member.grade !== appliedSearchGrade) return false;
    
    if (appliedSearchBirthMonth) {
      const cleanMonth = appliedSearchBirthMonth.replace(/-/g, ''); 
      if (!member.age.startsWith(cleanMonth)) return false;
    }

    if (appliedSearchJoinMonth) {
      if (!member.created_at.startsWith(appliedSearchJoinMonth)) return false;
    }
    return true;
  });

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
      
      {/* 타이틀 영역 */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">탈퇴자 명단 관리</h1>
          <p className="text-sm text-slate-500 mt-1">비활성화 처리된 탈퇴 회원을 다시 복구하거나, 데이터를 영구 삭제할 수 있습니다.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 w-full">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름</span>
            <input type="text" placeholder="이름 입력" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">생년월</span>
            <input type="month" value={searchBirthMonth} onChange={(e) => setSearchBirthMonth(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">성별</span>
            <select value={searchGender} onChange={(e) => setSearchGender(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all">
              <option value="all">전체</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">조(급수)</span>
            <select value={searchGrade} onChange={(e) => setSearchGrade(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all">
              <option value="all">전체</option>
              {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => <option key={lvl} value={lvl}>{lvl}조</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">가입월</span>
            <input type="month" value={searchJoinMonth} onChange={(e) => setSearchJoinMonth(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" />
          </div>
        </div>
      </div>

      {/* 테이블 컨트롤 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 탈퇴자 수 : <span className="text-red-500">{deletedMembers.length}</span> 명
            {hasActiveFilter && <span className="text-sm text-slate-400 ml-2">(조회 결과: {filteredMembers.length}명)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <button 
            onClick={openBatchRestore}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap active:scale-95"
          >
            선택 일괄 복구 {selectedMemberIds.length > 0 ? `(${selectedMemberIds.length}명)` : ''}
          </button>

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
              <th className="px-4 py-4 font-bold text-slate-500">성별</th>
              <th className="px-4 py-4 font-bold text-slate-500">조(급수)</th>
              <th onClick={() => handleSort('created_at')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                가입일자 {sortField === 'created_at' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-6 py-4 font-bold text-slate-500">최근 참여일</th>
              <th className="px-6 py-4 font-bold text-slate-500">탈퇴 사유</th>
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
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm truncate max-w-[150px]">
                    {member.del_reason || '-'}
                  </td>
                  {/* 관리 버튼 (기존처럼 복구 / 영구 삭제 2가지 노출) */}
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => openSingleRestore(member.id, member.name)}
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
                <td colSpan={9} className="px-6 py-16 text-center text-slate-400 font-medium">
                  {hasActiveFilter ? '검색 조건에 맞는 탈퇴 회원이 없습니다.' : '탈퇴 처리된 회원이 없습니다.'}
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

      {/* 가입일자 재설정 및 복구 실행 팝업 모달 */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-up">
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-indigo-800">회원 복구</h3>
              <button onClick={closeRestoreModal} className="w-8 h-8 rounded-full bg-white border border-indigo-200 flex items-center justify-center font-bold text-indigo-500 hover:bg-indigo-100">✕</button>
            </div>
            <form onSubmit={executeRestore} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {restoreType === 'single' ? (
                  <><strong className="text-slate-800 text-base">{restoreTargetName}</strong> 회원을 복구합니다.</>
                ) : (
                  <>선택한 <strong className="text-slate-800 text-base">{selectedMemberIds.length}</strong>명의 회원을 일괄 복구합니다.</>
                )}
                <br/>복구 시 반영될 <strong className="text-indigo-600">새로운 가입일자</strong>를 지정해주세요.
              </p>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-2">가입일자 (재등록일)</label>
                <input 
                  type="date" 
                  value={restoreDate} 
                  onChange={e => setRestoreDate(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700" 
                />
                <p className="text-xs text-slate-400 mt-2">* 데이터 정렬을 위해 시간은 자동으로 23:59:59 로 입력됩니다.</p>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4 mt-6">
                <button type="button" onClick={closeRestoreModal} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">취소</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">복구 실행</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
      
    </div>
  );
}