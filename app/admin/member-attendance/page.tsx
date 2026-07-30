'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

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
  };
}

interface Member {
  id: string;
  name: string;
  age: string;
  gender: string;
  grade: string;
}

export default function MemberAttendanceSearchPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: attData } = await supabase
      .from('attendances')
      .select('id, gathering_id, attended_date, members(id, name, age, gender, grade, role)');
    
    const { data: memData } = await supabase.from('members').select('id, name, age, gender, grade').order('name');
    const { data: gathData } = await supabase.from('gatherings').select('*');

    if (memData) setMembers(memData);
    if (attData) setAllAttendances(attData as unknown as AttendanceRecord[]);
    if (gathData) setGatherings(gathData);
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

  const filteredMemberAttendances = selectedMemberId 
    ? allAttendances.filter(a => a.members && (a as any).members?.id === selectedMemberId)
    : [];

  // 출석 날짜를 기준으로 해당 정모 정보 매핑 및 최신순 정렬
  const attendedGatherings = filteredMemberAttendances
    .map(att => {
      const gatheringInfo = gatherings.find(g => g.gathering_date === att.attended_date);
      return {
        attendanceId: att.id,
        date: att.attended_date,
        location: gatheringInfo?.location || '장소 정보 없음',
        startTime: gatheringInfo?.start_time || '-',
        memo: gatheringInfo?.memo || '-'
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedMemberInfo = members.find(m => m.id === selectedMemberId);

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">회원별 출석 검색</h1>
        <p className="text-sm text-slate-500 mt-1">회원을 선택하여 지금까지 참여한 정모 내역을 그리드 형태로 확인하세요.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-700 mb-3">회원 선택 및 검색</h2>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <input 
            type="text" 
            placeholder="회원 이름 검색..." 
            value={memberSearchTerm}
            onChange={(e) => setMemberSearchTerm(e.target.value)}
            className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
          <select 
            value={selectedMemberId} 
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full md:flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700"
          >
            <option value="">-- 회원을 선택하세요 --</option>
            {members
              .filter(m => m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()))
              .map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatDOB(m.age)} / {m.gender} / {m.grade}조)
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {selectedMemberId && selectedMemberInfo && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
            <h3 className="text-xl font-extrabold text-indigo-900">
              {selectedMemberInfo.name} <span className="text-sm font-normal text-slate-600">({selectedMemberInfo.gender} · {selectedMemberInfo.grade}조 · 생년월일 {formatDOB(selectedMemberInfo.age)})</span>
            </h3>
            <div className="bg-indigo-600 text-white font-bold px-4 py-1.5 rounded-xl text-sm shadow-sm">
              총 누적 참석 : {attendedGatherings.length}회
            </div>
          </div>

          {/* 🌟 그리드(테이블) 형태로 정모 내역 출력 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <tr>
                  <th className="px-6 py-4 font-bold w-16 text-center">번호</th>
                  <th className="px-6 py-4 font-bold">정모 일자</th>
                  <th className="px-6 py-4 font-bold">장소</th>
                  <th className="px-6 py-4 font-bold">시간</th>
                  <th className="px-6 py-4 font-bold">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendedGatherings.map((item, idx) => (
                  <tr key={item.attendanceId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{formatDateString(item.date)}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{item.location}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{item.startTime}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{item.memo}</td>
                  </tr>
                ))}
                {attendedGatherings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      해당 회원의 참석 정모 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}