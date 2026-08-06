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

export default function MemberManagementPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('2000-01-01'); 
  const [gender, setGender] = useState('남');
  const [grade, setGrade] = useState('F'); 
  const [joinDate, setJoinDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // 삭제(탈퇴) 사유 입력 모달 상태 추가
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

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
    fetchMembers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*, attendances(id, attended_date)')
      .eq('del_type', 'N');

    if (data) setMembers(data);
    if (error) console.error("데이터 로드 에러:", error);
  };

  const checkTodayGatheringExists = async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const { data, error } = await supabase
      .from('gatherings')
      .select('id')
      .eq('gathering_date', today);

    if (error) {
      console.error("정모 조회 에러:", error);
      return false;
    }

    return data && data.length > 0;
  };

  // 회원 등록 함수
  const handleRegisterMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age || !joinDate) return showPopup('alert', '입력 오류', '이름, 생년월일, 가입일자를 모두 입력해주세요.');

    const cleanAge = age.replace(/-/g, ''); 
    const customCreatedAt = `${joinDate}T00:00:00.000Z`;
    
    // 탈퇴자 명단에 동일 인물 여부 확인
    const { data: existingData, error: searchError } = await supabase
      .from('members')
      .select('id, del_type')
      .eq('name', name.trim())
      .eq('age', cleanAge)
      .eq('gender', gender);
    
    if (searchError) return showPopup('alert', '오류', '회원 중복 조회 중 오류가 발생했습니다.');

    // 동일 인물이 존재하는 경우
    if (existingData && existingData.length > 0) {
      const activeMember = existingData.find(m => m.del_type === 'N' || !m.del_type);
      const deleteMember = existingData.find(m => m.del_type === 'Y');

      // 이미 활동 중인 회원의 경우 가입 차단
      if (activeMember) {
        return showPopup('alert', '등록 불가', '이미 활동 중인 동일한 회원(이름, 생년월일, 성별 일치)이 존재합니다.');
      }

      // 탈퇴한 이력이 있는 회원의 경우
      if (deleteMember) {
        return showPopup('confirm', '탈퇴 회원 복구', '과거 탈퇴(비활성화) 이력이 있는 회원입니다.\n기존 출석 기록을 유지하며 계정을 복구하시겠습니까?', async () => {
          closePopup();

          // 복구 처리: del_type을 'N'으로 변경, 새로 입력한 급수와 가입일(복구일)로 업데이트
          const { error: restoreError } = await supabase
            .from('members')
            .update({
              del_type: 'N',
              del_reason: null,
              created_at: customCreatedAt
            })
            .eq('id', deleteMember.id);

          if (restoreError) {
            showPopup('alert', '오류', '회원 복구 중 오류가 발생했습니다.');
          } else {
            showPopup('alert', '복구 완료', '기존 회원 정보 및 출석 기록이 성공적으로 복구되었습니다.');
            resetForm();
            fetchMembers();
          }
        });
      }
      return;
    }

    //  동일 인물이 없는 경우
    const newMember = { name: name.trim(), age: cleanAge, gender, grade, role: '일반', created_at: customCreatedAt}; 
    
    const { error } = await supabase.from('members').insert([newMember]);
    if (error) {
      showPopup('alert', '오류', '회원 등록 중 오류가 발생했습니다.');
    } else {
      showPopup('alert', '등록 완료', '성공적으로 등록되었습니다.');
      resetForm();
      fetchMembers(); 
    }
  };

  const resetForm = () => {
    const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      setName(''); 
      setAge('2000-01-01'); 
      setGrade('F');
      setJoinDate(today); 
  };

  const handleBatchAttend = async () => {
    if (selectedMemberIds.length === 0) {
      return showPopup('alert', '선택 오류', '코트 대기(로비) 명단에 추가할 회원을 체크박스로 선택해주세요.');
    }

    const targets = members.filter(m => selectedMemberIds.includes(m.id));

    const { data: currentPlayers } = await supabase.from('players').select('name, age, gender');
    if (currentPlayers) {
      const alreadyInLobby = targets.filter(target => 
        currentPlayers.some(p => 
          p.name.trim() === target.name.trim() && 
          String(p.age).trim() === String(target.age).trim() && 
          p.gender === target.gender
        )
      );
      
      if (alreadyInLobby.length > 0) {
        const names = alreadyInLobby.map(m => m.name).join(', ');
        return showPopup('alert', '로비 중복 경고', `이미 로비(코트 대기) 명단에 등록된 회원이 포함되어 있습니다.\n(${names})\n\n해당 회원을 체크 해제하거나 코트 현황판에서 먼저 삭제 후 다시 시도해주세요.`);
      }
    }

    showPopup('confirm', '정모 참석 확인', `총 ${targets.length}명을 정모 참석(코트 대기) 명단에 추가하시겠습니까?`, async () => {
      closePopup(); 
      
      const timeBase = Date.now();
      const playerInserts = targets.map((m, idx) => ({
        id: String(timeBase + idx), 
        name: m.name.trim(), 
        age: String(m.age).trim(), 
        gender: m.gender, 
        grade: m.grade, 
        count: 0, 
        status: 'lobby'
      }));

      try {
        if (playerInserts.length > 0) await supabase.from('players').insert(playerInserts);
        showPopup('alert', '처리 완료', '성공적으로 로비 명단에 추가되었습니다.');
        setSelectedMemberIds([]); 
      } catch (error) {
        showPopup('alert', '오류', '로비 추가 중 오류가 발생했습니다.');
      }
    });
  };

  const handleToggleRole = (id: string, currentRole: string, memberName: string) => {
    const newRole = currentRole === '일반' ? '운영진' : '일반';
    const msg = currentRole === '일반' ? `'운영진'으로 임명하시겠습니까?` : `운영진 권한을 해제하시겠습니까?`;
    
    showPopup('confirm', '권한 변경', `${memberName} 회원님을 ${msg}`, async () => {
      closePopup();
      await supabase.from('members').update({ role: newRole }).eq('id', id);
      fetchMembers();
    });
  };

  // 삭제 버튼 클릭 시 모달창 열기
  const handleDeleteMemberClick = (id: string, memberName: string) => {
    setMemberToDelete({ id, name: memberName });
    setDeleteReason(''); // 열 때마다 사유 입력칸 초기화
    setIsDeleteModalOpen(true);
  };

  // 모달창에서 '삭제하기' 버튼 클릭 시 실제 DB 처리 로직
  const executeDelete = async () => {
    if (!memberToDelete) return;
    const { id, name } = memberToDelete;

    // 해당 회원의 출석 기록이 있는지 확인
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendances')
      .select('id')
      .eq('member_id', id)
      .limit(1);

    if (attendanceError) {
      setIsDeleteModalOpen(false);
      return showPopup('alert', '오류', '출석 기록 조회 중 오류가 발생했습니다.');
    }

    const hasAttendance = attendanceData && attendanceData.length > 0;

    if (hasAttendance) {
      // 출석 기록이 있는 경우, del_type = 'Y' 및 del_reason 업데이트
      const { error: updateError } = await supabase
        .from('members')
        .update({ del_type: 'Y', del_reason: deleteReason })
        .eq('id', id);

      if (updateError) {
        setIsDeleteModalOpen(false);
        return showPopup('alert', '오류', '회원 비활성화 처리 중 오류가 발생했습니다.');
      }
    } else {
      // 출석 기록이 없는 경우, 실제로 DB에서 영구 삭제
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setIsDeleteModalOpen(false);
        return showPopup('alert', '오류', '회원 삭제 처리 중 오류가 발생했습니다.');
      }
    }

    // UI 화면에서 즉시 제거 및 모달 닫기
    setMembers(members.filter(m => m.id !== id));
    setSelectedMemberIds(selectedMemberIds.filter(selId => selId !== id)); 
    setIsDeleteModalOpen(false);
    setMemberToDelete(null);
    showPopup('alert', '삭제 완료', hasAttendance ? '출석 기록이 존재하여 안전하게 비활성화 처리되었습니다.' : '회원이 성공적으로 삭제되었습니다.');
  };

  const handleCheckIn = async (memberId: string, memberName: string) => {
    const hasGathering = await checkTodayGatheringExists();
    if (!hasGathering) {
      return showPopup('alert', '출석 불가', '오늘 등록된 정모 일정이 없어 출석 처리할 수 없습니다.\n[정모 정보 및 일정 관리] 메뉴에서 오늘 일정을 먼저 등록해주세요.');
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const targetMember = members.find(m => m.id === memberId);
    
    if (targetMember?.attendances?.some(a => a.attended_date === today)) {
      return showPopup('alert', '출석 완료', `이미 오늘 출석 처리되었습니다!`);
    }

    showPopup('confirm', '출석 확인', `${memberName} 회원님을 오늘 날짜(${today})로 출석 처리하시겠습니까?`, async () => {
      closePopup();
      const { error } = await supabase.from('attendances').insert([{ member_id: memberId, attended_date: today }]);
      if (error) {
        showPopup('alert', '오류', '출석 처리 중 오류가 발생했습니다.');
      } else {
        showPopup('alert', '출석 완료', `${memberName} 회원님의 출석 처리가 완료되었습니다.`);
        fetchMembers();
      }
    });
  };

  const formatDOB = (dobStr: string) => {
    const clean = dobStr.replace(/[^0-9]/g, ''); 
    if (clean.length === 8) return `${clean.substring(2, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`;
    else if (clean.length === 6) return `${clean.substring(0, 2)}.${clean.substring(2, 4)}.${clean.substring(4, 6)}`;
    return dobStr; 
  };

  const formatJoinDate = (isoString: string) => {
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

  const handleUpdateGrade = async (id: string, newGrade: string) => {
    const { error } = await supabase.from('members').update({ grade: newGrade }).eq('id', id);
    if (error) {
      showPopup('alert', '오류', '급수 수정 중 오류가 발생했습니다.');
    } else {
      setMembers(members.map(m => m.id === id ? { ...m, grade: newGrade } : m));
    }
  };

  const filteredMembers = members.filter(member => member.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">회원 명단 및 출석 관리</h1>
        <p className="text-sm text-slate-500 mt-1">회원을 등록하고, 매 모임마다 출석을 체크해 통계를 확인하세요.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <h2 className="text-lg font-bold text-slate-700 mb-4">신규 회원 등록</h2>
        <form onSubmit={handleRegisterMember} className="flex flex-col md:flex-row gap-4 w-full">
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름</span>
            <input type="text" placeholder="이름" value={name} onChange={e => setName(e.target.value)} className="w-full md:w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">생년월일</span>
            <input type="date" value={age} onChange={e => setAge(e.target.value)} className="w-full md:w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">가입일자</span>
            <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} className="w-full md:w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600" />
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">성별</span>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full md:w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">급수</span>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full md:w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => <option key={lvl} value={lvl}>{lvl}조</option>)}
            </select>
          </div>
          
          <div className="flex flex-col justify-end md:ml-auto">
            <button type="submit" className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">등록하기</button>
          </div>

        </form>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="text-slate-700 font-bold text-lg">
            총 회원 수 : <span className="text-indigo-600">{members.length}</span> 명
            {searchTerm && <span className="text-sm text-slate-400 ml-2">(검색 결과: {filteredMembers.length}명)</span>}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <button 
            onClick={handleBatchAttend}
            className="w-full md:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap active:scale-95"
          >
            정모 참석 {selectedMemberIds.length > 0 ? `(${selectedMemberIds.length}명)` : ''}
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
              <th onClick={() => handleSort('monthly_count')} className="px-6 py-4 font-bold text-center cursor-pointer hover:text-indigo-600 transition-colors">
                이번 달 출석 {sortField === 'monthly_count' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-6 py-4 font-bold text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentMembers.map(member => {
              const joinDate = formatJoinDate(member.created_at);
              const lastAttendance = getLastAttendance(member.attendances);
              const monthlyCount = getMonthlyCount(member.attendances);

              const now = new Date();
              const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isCheckedToday = member.attendances?.some(a => a.attended_date === today);
              const isSelected = selectedMemberIds.includes(member.id);

              const isStaff = member.role === '모임장' || member.role === '운영진';

              return (
                <tr key={member.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
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
                  <td className="px-4 py-4 font-bold text-slate-800 text-base flex items-center gap-2">
                    {member.name}
                    {member.role === '모임장' && <span className="bg-purple-100 text-purple-700 text-xs font-extrabold px-2 py-0.5 rounded-full border border-purple-200">모임장</span>}
                    {member.role === '운영진' && <span className="bg-blue-100 text-blue-700 text-xs font-extrabold px-2 py-0.5 rounded-full border border-blue-200">운영진</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{formatDOB(member.age)}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${member.gender === '남' ? 'text-blue-700 bg-blue-100' : 'text-yellow-800 bg-yellow-100'}`}>
                      {member.gender}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <select 
                      value={member.grade} 
                      onChange={(e) => handleUpdateGrade(member.id, e.target.value)}
                      className="bg-transparent font-bold text-slate-700 text-lg focus:outline-none cursor-pointer py-1 appearance-none min-w-[3.5rem] text-center"
                    >
                      {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}조</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{joinDate}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{lastAttendance}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold w-8 h-8 rounded-full">{monthlyCount}</span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleCheckIn(member.id, member.name)}
                      disabled={isCheckedToday}
                      className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${isCheckedToday ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
                    >
                      {isCheckedToday ? '✓ 완료' : '출석'}
                    </button>
                    {member.role !== '모임장' && (
                      <button onClick={() => handleToggleRole(member.id, member.role, member.name)} className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                        {member.role === '일반' ? '운영진 부여' : '운영진 해제'}
                      </button>
                    )}
                    <button onClick={() => handleDeleteMemberClick(member.id, member.name)}
                      disabled={isStaff}
                      title={isStaff ? '모임장/운영진은 삭제할 수 없습니다.' : '회원 삭제'} 
                      className={`px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        isStaff
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {currentMembers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {searchTerm ? `'${searchTerm}'(으)로 검색된 회원이 없습니다.` : '등록된 회원이 없습니다.'}
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

      {/* 사유를 입력받는 삭제 전용 모달창 */}
      {isDeleteModalOpen && memberToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-red-700">회원 삭제</h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-red-200 flex items-center justify-center font-bold text-red-500 hover:bg-red-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-800 text-base">{memberToDelete.name}</strong> 회원을 정말 삭제하시겠습니까?<br/>
                (과거 출석 기록이 있다면 안전하게 비활성화 처리됩니다.)
              </p>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-2">
                  삭제(탈퇴) 사유 <span className="text-slate-400 font-normal">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="예: 이사, 개인사정, 활동 중단 등"
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none rounded-lg transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomPopup popup={popup} onClose={closePopup} />
      
    </div>
  );
}