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
  att_reason?: string; 
  attendances?: Attendance[]; 
}

type SortField = 'name' | 'age' | 'gender' | 'grade' | 'att_reason' | 'created_at' | 'last_attendance' | 'monthly_count';
type SortOrder = 'asc' | 'desc' | null;

export default function MemberManagementPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  // 제출 중 상태 (더블 클릭 방지용)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 다중 검색 조건 입력 상태 
  const [searchName, setSearchName] = useState('');
  const [searchBirthMonth, setSearchBirthMonth] = useState('all'); 
  const [searchGender, setSearchGender] = useState('all');
  const [searchGrade, setSearchGrade] = useState('all');
  const [searchJoinMonth, setSearchJoinMonth] = useState('all');   

  // '조회' 버튼을 눌렀을 때만 실제 적용되는 검색 상태
  const [appliedSearchName, setAppliedSearchName] = useState('');
  const [appliedSearchBirthMonth, setAppliedSearchBirthMonth] = useState('all');
  const [appliedSearchGender, setAppliedSearchGender] = useState('all');
  const [appliedSearchGrade, setAppliedSearchGrade] = useState('all');
  const [appliedSearchJoinMonth, setAppliedSearchJoinMonth] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  
  // 신규 등록 폼 상태
  const [name, setName] = useState('');
  const [age, setAge] = useState('2000-01-01'); 
  const [gender, setGender] = useState('남');
  const [grade, setGrade] = useState('F'); 
  const [attReason, setAttReason] = useState(''); 
  const [joinDate, setJoinDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // 회원 수정 폼 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editAge, setEditAge] = useState(''); 
  const [editGender, setEditGender] = useState('');
  const [editGrade, setEditGrade] = useState(''); 
  const [editAttReason, setEditAttReason] = useState(''); 
  const [editJoinDate, setEditJoinDate] = useState('');

  // 모달 상태 관리
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
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

  const handleSearch = () => {
    setAppliedSearchName(searchName);
    setAppliedSearchBirthMonth(searchBirthMonth);
    setAppliedSearchGender(searchGender);
    setAppliedSearchGrade(searchGrade);
    setAppliedSearchJoinMonth(searchJoinMonth);
    setCurrentPage(1);
  };

  const hasActiveFilter = appliedSearchName || appliedSearchBirthMonth !== 'all' || appliedSearchGender !== 'all' || appliedSearchGrade !== 'all' || appliedSearchJoinMonth !== 'all';

  const resetForm = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setName(''); 
    setAge('2000-01-01'); 
    setGender('남');
    setGrade('F');
    setAttReason('');
    setJoinDate(today); 
  };

  const closeRegisterModal = () => {
    resetForm();
    setIsRegisterModalOpen(false);
  };

  const closeDeleteModal = () => {
    setMemberToDelete(null);
    setDeleteReason('');
    setIsDeleteModalOpen(false);
  };

  const closeEditModal = () => {
    setEditingMember(null);
    setIsEditModalOpen(false);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    
    let parsedAge = '2000-01-01';
    if (member.age && member.age.length === 8) {
      parsedAge = `${member.age.substring(0,4)}-${member.age.substring(4,6)}-${member.age.substring(6,8)}`;
    } else if (member.age && member.age.length === 6) {
      const prefix = parseInt(member.age.substring(0,2)) > 50 ? '19' : '20';
      parsedAge = `${prefix}${member.age.substring(0,2)}-${member.age.substring(2,4)}-${member.age.substring(4,6)}`;
    }
    
    setEditAge(parsedAge);
    setEditGender(member.gender || '남');
    setEditGrade(member.grade || 'F');
    setEditAttReason(member.att_reason || ''); 
    setEditJoinDate(member.created_at ? member.created_at.substring(0, 10) : '');
    
    setIsEditModalOpen(true);
  };

  const handleUpdateMember = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !editingMember) return;

    if (!editAge || !editJoinDate) return showPopup('alert', '입력 오류', '생년월일과 가입일자를 모두 입력해주세요.');

    setIsSubmitting(true);

    const cleanAge = editAge.replace(/-/g, ''); 
    const customCreatedAt = `${editJoinDate}T00:00:00.000Z`;

    const { error } = await supabase
      .from('members')
      .update({
        age: cleanAge,
        gender: editGender,
        grade: editGrade,
        att_reason: editAttReason.trim(), 
        created_at: customCreatedAt
      })
      .eq('id', editingMember.id);

    setIsSubmitting(false);

    if (error) {
      showPopup('alert', '오류', '회원 정보 수정 중 오류가 발생했습니다.');
    } else {
      showPopup('alert', '수정 완료', '회원 정보가 성공적으로 수정되었습니다.');
      closeEditModal();
      fetchMembers();
    }
  };

  const handleRegisterMember = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; 

    if (!name.trim() || !age || !joinDate) return showPopup('alert', '입력 오류', '이름, 생년월일, 가입일자를 모두 입력해주세요.');

    setIsSubmitting(true); 

    const cleanAge = age.replace(/-/g, ''); 
    const customCreatedAt = `${joinDate}T00:00:00.000Z`;
    
    const { data: existingData, error: searchError } = await supabase
      .from('members')
      .select('id, del_type')
      .eq('name', name.trim())
      .eq('age', cleanAge)
      .eq('gender', gender);
    
    if (searchError) {
      setIsSubmitting(false);
      return showPopup('alert', '오류', '회원 중복 조회 중 오류가 발생했습니다.');
    }

    if (existingData && existingData.length > 0) {
      const activeMember = existingData.find(m => m.del_type === 'N' || !m.del_type);
      const deleteMember = existingData.find(m => m.del_type === 'Y');

      if (activeMember) {
        setIsSubmitting(false);
        return showPopup('alert', '등록 불가', '이미 활동 중인 동일한 회원(이름, 생년월일, 성별 일치)이 존재합니다.');
      }

      if (deleteMember) {
        setIsSubmitting(false); 
        return showPopup('confirm', '탈퇴 회원 복구', '과거 탈퇴(비활성화) 이력이 있는 회원입니다.\n기존 출석 기록을 유지하며 계정을 복구하시겠습니까?', async () => {
          closePopup();
          setIsSubmitting(true); 

          const { error: restoreError } = await supabase
            .from('members')
            .update({
              del_type: 'N',
              del_reason: null,
              grade: grade, 
              att_reason: attReason.trim(), 
              created_at: customCreatedAt
            })
            .eq('id', deleteMember.id);

          setIsSubmitting(false);
          
          if (restoreError) {
            showPopup('alert', '오류', '회원 복구 중 오류가 발생했습니다.');
          } else {
            showPopup('alert', '복구 완료', '기존 회원 정보 및 출석 기록이 성공적으로 복구되었습니다.');
            closeRegisterModal(); 
            fetchMembers();
          }
        });
      }
      setIsSubmitting(false);
      return;
    }

    const newMember = { name: name.trim(), age: cleanAge, gender, grade, role: '일반', att_reason: attReason.trim(), created_at: customCreatedAt}; 
    
    const { error } = await supabase.from('members').insert([newMember]);
    setIsSubmitting(false); 

    if (error) {
      showPopup('alert', '오류', '회원 등록 중 오류가 발생했습니다.');
    } else {
      showPopup('alert', '등록 완료', '성공적으로 등록되었습니다.');
      closeRegisterModal(); 
      fetchMembers(); 
    }
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

  // 🌟 운영진 부여/해제 함수 (모달 안에서 사용하기 위해 로직 수정)
  const handleToggleRole = (id: string, currentRole: string, memberName: string) => {
    const newRole = currentRole === '일반' ? '운영진' : '일반';
    const msg = currentRole === '일반' ? `'운영진'으로 임명하시겠습니까?` : `운영진 권한을 해제하시겠습니까?`;
    
    showPopup('confirm', '권한 변경', `${memberName} 회원님을 ${msg}`, async () => {
      closePopup();
      await supabase.from('members').update({ role: newRole }).eq('id', id);
      
      // 만약 팝업 안에서 실행했다면 모달 데이터도 업데이트해서 바로 반영되게 함
      if (editingMember && editingMember.id === id) {
        setEditingMember(prev => prev ? { ...prev, role: newRole } : null);
      }
      fetchMembers();
    });
  };

  const handleDeleteMemberClick = (id: string, memberName: string) => {
    setMemberToDelete({ id, name: memberName });
    setDeleteReason(''); 
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!memberToDelete) return;
    if (isSubmitting) return; 

    setIsSubmitting(true);
    const { id, name } = memberToDelete;

    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendances')
      .select('id')
      .eq('member_id', id)
      .limit(1);

    if (attendanceError) {
      setIsSubmitting(false);
      closeDeleteModal();
      return showPopup('alert', '오류', '출석 기록 조회 중 오류가 발생했습니다.');
    }

    const hasAttendance = attendanceData && attendanceData.length > 0;

    if (hasAttendance) {
      const { error: updateError } = await supabase
        .from('members')
        .update({ del_type: 'Y', del_reason: deleteReason })
        .eq('id', id);

      setIsSubmitting(false);
      if (updateError) {
        closeDeleteModal();
        return showPopup('alert', '오류', '회원 비활성화 처리 중 오류가 발생했습니다.');
      }
    } else {
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      setIsSubmitting(false);
      if (deleteError) {
        closeDeleteModal();
        return showPopup('alert', '오류', '회원 삭제 처리 중 오류가 발생했습니다.');
      }
    }

    setMembers(members.filter(m => m.id !== id));
    setSelectedMemberIds(selectedMemberIds.filter(selId => selId !== id)); 
    closeDeleteModal(); 
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

  const filteredMembers = members.filter(member => {
    if (appliedSearchName && !member?.name?.toLowerCase().includes(appliedSearchName.toLowerCase())) return false;
    if (appliedSearchGender !== 'all' && member?.gender !== appliedSearchGender) return false;
    if (appliedSearchGrade !== 'all' && member?.grade !== appliedSearchGrade) return false;
    
    if (appliedSearchBirthMonth !== 'all') {
      const birthMonth = member?.age?.length >= 6 ? member.age.substring(4, 6) : '';
      if (birthMonth !== appliedSearchBirthMonth) return false;
    }

    if (appliedSearchJoinMonth !== 'all') {
      const joinMonth = member?.created_at?.length >= 7 ? member.created_at.substring(5, 7) : '';
      if (joinMonth !== appliedSearchJoinMonth) return false;
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
      else if (sortField === 'att_reason') { valA = a.att_reason || ''; valB = b.att_reason || ''; } 
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
      
      {/* 타이틀 및 상단 공통 버튼 영역 */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">회원 명단 및 출석 관리</h1>
          <p className="text-sm text-slate-500 mt-1">회원을 검색하고, 매 모임마다 출석을 체크해 통계를 확인하세요.</p>
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

      {/* 다중 검색 조건 영역 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">상세 검색</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 w-full">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름</span>
            <input
              type="text"
              placeholder="이름 입력"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">생일(월)</span>
            <select
              value={searchBirthMonth}
              onChange={(e) => setSearchBirthMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">성별</span>
            <select
              value={searchGender}
              onChange={(e) => setSearchGender(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">조(급수)</span>
            <select
              value={searchGrade}
              onChange={(e) => setSearchGrade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체</option>
              {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => <option key={lvl} value={lvl}>{lvl}조</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">가입월</span>
            <select
              value={searchJoinMonth}
              onChange={(e) => setSearchJoinMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
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
          <button 
            onClick={handleBatchAttend}
            className="w-full md:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap active:scale-95"
          >
            정모 참석 {selectedMemberIds.length > 0 ? `(${selectedMemberIds.length}명)` : ''}
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
              <th onClick={() => handleSort('att_reason')} className="px-6 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors">
                비고 {sortField === 'att_reason' && (sortOrder === 'asc' ? '▲' : '▼')}
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
                  <td className="px-6 py-4 text-slate-700 font-bold">
                    {member.grade}조
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{joinDate}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium text-sm">{lastAttendance}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                    {member.att_reason || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold w-8 h-8 rounded-full">{monthlyCount}</span>
                  </td>
                  {/* 🌟 버튼 순서 변경: 삭제 및 운영진 버튼 제거 & 수정 맨 우측 */}
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleCheckIn(member.id, member.name)}
                      disabled={isCheckedToday}
                      className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${isCheckedToday ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
                    >
                      {isCheckedToday ? '✓ 완료' : '출석'}
                    </button>
                    <button 
                      onClick={() => openEditModal(member)}
                      className="px-2.5 py-1.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {currentMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-16 text-center text-slate-400 font-medium">
                  {hasActiveFilter ? '검색 조건에 맞는 회원이 없습니다.' : '등록된 회원이 없습니다.'}
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

      {/* 신규 회원 등록 팝업 모달 */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">신규 회원 등록</h3>
              <button
                onClick={closeRegisterModal}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegisterMember} className="p-6 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름</span>
                <input type="text" placeholder="이름을 입력하세요" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">생년월일</span>
                <input type="date" value={age} onChange={e => setAge(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 text-sm font-medium" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">가입일자</span>
                <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 text-sm font-medium" />
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-slate-500 mb-1 ml-1">성별</span>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700">
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-slate-500 mb-1 ml-1">급수</span>
                  <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700">
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => <option key={lvl} value={lvl}>{lvl}조</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고 (선택사항)</span>
                <input type="text" placeholder="예: 활동 일시 중지 등" value={attReason} onChange={e => setAttReason(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
              </div>

              <div className="pt-4 flex gap-2 justify-end border-t border-slate-100 mt-6">
                <button 
                  type="button" 
                  onClick={closeRegisterModal} 
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
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

      {/* 🌟 회원 정보 수정 팝업 모달 */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">회원 정보 수정</h3>
              <button
                onClick={closeEditModal}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateMember} className="p-6 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">이름 (수정 불가)</span>
                <input 
                  type="text" 
                  value={editingMember.name} 
                  disabled 
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm font-bold cursor-not-allowed" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">생년월일</span>
                <input 
                  type="date" 
                  value={editAge} 
                  onChange={e => setEditAge(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 text-sm font-medium" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">가입일자</span>
                <input 
                  type="date" 
                  value={editJoinDate} 
                  onChange={e => setEditJoinDate(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 text-sm font-medium" 
                />
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-slate-500 mb-1 ml-1">성별</span>
                  <select 
                    value={editGender} 
                    onChange={e => setEditGender(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700"
                  >
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-bold text-slate-500 mb-1 ml-1">급수</span>
                  <select 
                    value={editGrade} 
                    onChange={e => setEditGrade(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-700"
                  >
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(lvl => <option key={lvl} value={lvl}>{lvl}조</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 mb-1 ml-1">비고</span>
                <input 
                  type="text" 
                  placeholder="예: 활동 일시 중지 등" 
                  value={editAttReason} 
                  onChange={e => setEditAttReason(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" 
                />
              </div>

              {/* 🌟 팝업 내 하단 액션 버튼 그룹 */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6">
                
                {/* 좌측: 삭제 및 운영진 부여/해제 버튼 */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const isStaff = editingMember.role === '모임장' || editingMember.role === '운영진';
                      if (isStaff) return; // 클릭 무시
                      const memberId = editingMember.id;
                      const memberName = editingMember.name;
                      closeEditModal();
                      handleDeleteMemberClick(memberId, memberName);
                    }}
                    disabled={editingMember.role === '모임장' || editingMember.role === '운영진' || isSubmitting}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                      editingMember.role === '모임장' || editingMember.role === '운영진' 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                    }`}
                    title={editingMember.role === '모임장' || editingMember.role === '운영진' ? '모임장/운영진은 삭제할 수 없습니다.' : '회원 삭제'}
                  >
                    삭제
                  </button>

                  {/* 🌟 운영진 부여/해제 버튼 팝업 내부로 이동 */}
                  {editingMember.role !== '모임장' && (
                    <button 
                      type="button"
                      onClick={() => handleToggleRole(editingMember.id, editingMember.role, editingMember.name)}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {editingMember.role === '일반' ? '운영진 부여' : '운영진 해제'}
                    </button>
                  )}
                </div>

                {/* 우측: 취소 및 저장 버튼 */}
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={closeEditModal} 
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    취소
                  </button>
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 사유를 입력받는 삭제 전용 모달창 */}
      {isDeleteModalOpen && memberToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-red-700">회원 삭제</h3>
              <button
                onClick={closeDeleteModal}
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
                onClick={closeDeleteModal}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={executeDelete}
                disabled={isSubmitting}
                className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                  isSubmitting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
                }`}
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