'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import CustomPopup, { PopupState } from '../../components/CustomPopup';

interface AccessLog {
  id: string;
  admin_id: string;
  status: 'SUCCESS' | 'FAILED' | 'INFO';
  action_type?: 'LOGIN' | 'LOGOUT' | 'PAGE_VIEW' | 'WINDOW_CLOSE' | string;
  path?: string | null;
  ip_address: string;
  user_agent: string;
  failure_reason?: string | null;
  created_at: string;
}

type SortOrder = 'asc' | 'desc';

// 경로 영문 URL을 한글 메뉴명으로 변환하는 매퍼
const PATH_NAME_MAP: Record<string, string> = {
  '/admin/courts': '코트 및 대기 배정',
  '/admin/members': '회원 명단 관리',
  '/admin/attendance': '정모 일정 관리',
  '/admin/member-attendance': '회원별 출석 관리',
  '/admin/member-delete': '탈퇴 회원 관리',
  '/admin/member-deleter': '탈퇴 회원 관리',
  '/admin/access-logs': '로그 관리',
  '/': '메인/로그인 화면',
};

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 검색 조건 입력값
  const [inputAdminId, setInputAdminId] = useState<string>('');
  const [inputActionType, setInputActionType] = useState<string>('all');
  const [inputStatus, setInputStatus] = useState<string>('all');
  const [inputDate, setInputDate] = useState<string>('');

  // 적용된 검색 조건
  const [searchAdminId, setSearchAdminId] = useState<string>('');
  const [searchActionType, setSearchActionType] = useState<string>('all');
  const [searchStatus, setSearchStatus] = useState<string>('all');
  const [searchDate, setSearchDate] = useState<string>('');

  // 정렬 및 페이징 상태
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // 공통 팝업 상태
  const [popup, setPopup] = useState<PopupState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showPopup = (type: 'alert' | 'confirm', title: string, message: string) => {
    setPopup({ isOpen: true, type, title, message, onConfirm: closePopup });
  };
  const closePopup = () => setPopup((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('admin_access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('로그 조회 에러:', error);
      showPopup('alert', '조회 실패', '접속 및 활동 기록을 불러오는 중 오류가 발생했습니다.');
    } else if (data) {
      setLogs(data as AccessLog[]);
    }
    setIsLoading(false);
  };

  const handleSearch = () => {
    setSearchAdminId(inputAdminId.trim());
    setSearchActionType(inputActionType);
    setSearchStatus(inputStatus);
    setSearchDate(inputDate);
    setCurrentPage(1);
  };

  const handleResetSearch = () => {
    setInputAdminId('');
    setInputActionType('all');
    setInputStatus('all');
    setInputDate('');
    setSearchAdminId('');
    setSearchActionType('all');
    setSearchStatus('all');
    setSearchDate('');
    setCurrentPage(1);
  };

  // 날짜/시각 포맷터 (YY.MM.DD HH:mm:ss)
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const pad = (n: number) => String(n).padStart(2, '0');
    const y = String(date.getFullYear()).substring(2);
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return `${y}.${m}.${d} ${hh}:${mm}:${ss}`;
  };

  // 브라우저/기기 간이 식별
  const parseUserAgent = (ua: string) => {
    if (!ua || ua === 'unknown') return '알 수 없음';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Macintosh')) return 'Mac OS';
    if (ua.includes('Windows')) return 'Windows';
    return '기타 기기';
  };

  // 활동 구분 뱃지 렌더러
  const renderActionBadge = (actionType?: string) => {
    switch (actionType) {
      case 'LOGIN':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">로그인</span>;
      case 'LOGOUT':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">로그아웃</span>;
      case 'PAGE_VIEW':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">메뉴 이동</span>;
      case 'WINDOW_CLOSE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">창 닫기</span>;
      case 'MEMBER_CREATE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">회원 등록</span>;
      case 'MEMBER_UPDATE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">회원 수정</span>;
      case 'MEMBER_DELETE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">회원 삭제</span>;
        case 'GATHERING_CREATE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700 border border-teal-200">정모 등록</span>;
      case 'GATHERING_UPDATE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">정모 수정</span>;
      case 'GATHERING_DELETE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">정모 삭제</span>;
      case 'MEMBER_RESTORE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">회원 복구</span>;
      case 'MEMBER_HARD_DELETE':
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-800 border border-red-300">영구 삭제</span>;
      default:
        return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{actionType || '접속'}</span>;
    }
  };

  // 필터링 및 정렬 처리
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (searchAdminId) {
      result = result.filter((log) =>
        log.admin_id.toLowerCase().includes(searchAdminId.toLowerCase())
      );
    }

    if (searchActionType !== 'all') {
      result = result.filter((log) => (log.action_type || 'LOGIN') === searchActionType);
    }

    if (searchStatus !== 'all') {
      result = result.filter((log) => log.status === searchStatus);
    }

    if (searchDate) {
      result = result.filter((log) => log.created_at.startsWith(searchDate));
    }

    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [logs, searchAdminId, searchActionType, searchStatus, searchDate, sortOrder]);

  const hasActiveFilter = searchAdminId !== '' || searchActionType !== 'all' || searchStatus !== 'all' || searchDate !== '';
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="p-6 w-full flex-1 overflow-y-auto space-y-6 bg-slate-50 min-h-screen">
      {/* 1. 상단 타이틀 및 액션 버튼 영역 (새로고침 삭제, 초기화/조회 버튼 배치) */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">관리자 활동 및 접속 로그</h1>
          <p className="text-sm text-slate-500 mt-1">
            로그인 이력뿐만 아니라 메뉴 이동, 로그아웃, 브라우저 종료 기록을 통합 조회합니다.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto self-end">
          <button
            onClick={handleResetSearch}
            className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 shadow-sm transition-colors whitespace-nowrap"
          >
            초기화
          </button>
          <button
            onClick={handleSearch}
            className="flex-1 md:flex-none px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap"
          >
            조회
          </button>
        </div>
      </div>

      {/* 2. 검색 조건 인풋 카드 영역 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">로그 다중 검색</h2>
        <div className="flex flex-col sm:flex-row gap-4 w-full items-end flex-wrap">
          {/* 발생 일자 */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">발생 일자</span>
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            />
          </div>

          {/* 활동 구분 */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">활동 구분</span>
            <select
              value={inputActionType}
              onChange={(e) => setInputActionType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체</option>
              <option value="LOGIN">로그인</option>
              <option value="PAGE_VIEW">메뉴 이동</option>
              <option value="LOGOUT">로그아웃</option>
              <option value="WINDOW_CLOSE">창 닫기</option>
              <option disabled>──────────</option>
              <option value="MEMBER_CREATE">회원 등록</option>
              <option value="MEMBER_UPDATE">회원 수정</option>
              <option value="MEMBER_DELETE">회원 삭제</option>
              <option disabled>──────────</option>
              <option value="GATHERING_CREATE">정모 등록</option>
              <option value="GATHERING_UPDATE">정모 수정</option>
              <option value="GATHERING_DELETE">정모 삭제</option>
              <option disabled>──────────</option>
              <option value="MEMBER_RESTORE">회원 복구</option>
              <option value="MEMBER_HARD_DELETE">영구 삭제</option>
            </select>
          </div>

          {/* 결과 상태 */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">상태</span>
            <select
              value={inputStatus}
              onChange={(e) => setInputStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="all">전체 상태</option>
              <option value="SUCCESS">성공</option>
              <option value="FAILED">실패</option>
            </select>
          </div>

          {/* 관리자 ID */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mb-1 ml-1">관리자 ID</span>
            <input
              type="text"
              placeholder="아이디 검색..."
              value={inputAdminId}
              onChange={(e) => setInputAdminId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 3. 건수 카운트 & 페이지당 개수 컨트롤 */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="text-slate-700 font-bold text-lg">
          총 기록 수 : <span className="text-indigo-600">{logs.length}</span> 건
          {hasActiveFilter && (
            <span className="text-sm text-slate-400 ml-2">
              (검색 결과: {filteredLogs.length}건)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="w-full md:w-auto px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm"
          >
            <option value={10}>10개씩 보기</option>
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
            <option value={100}>100개씩 보기</option>
          </select>
        </div>
      </div>

      {/* 4. 고정 너비 테이블 (Hydration 에러 방지 map 적용) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed text-center whitespace-nowrap">
            <colgroup>
              {['w-16', 'w-44', 'w-32', 'w-28', 'w-48', 'w-24', 'w-36', 'w-28', 'w-auto'].map((w, idx) => (
                <col key={idx} className={w} />
              ))}
            </colgroup>

            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm select-none">
              <tr>
                <th className="px-3 py-4 font-bold">No</th>
                <th
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-4 font-bold cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  일시 {sortOrder === 'desc' ? '▼' : '▲'}
                </th>
                <th className="px-3 py-4 font-bold">관리자 ID</th>
                <th className="px-3 py-4 font-bold">활동 구분</th>
                <th className="px-3 py-4 font-bold text-left">대상 메뉴 / 경로</th>
                <th className="px-3 py-4 font-bold">결과</th>
                <th className="px-3 py-4 font-bold">접속 IP</th>
                <th className="px-3 py-4 font-bold">기기</th>
                <th className="px-4 py-4 font-bold text-left">실패 사유 / 상세</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 font-medium">
                    로그 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : currentLogs.length > 0 ? (
                currentLogs.map((log, idx) => {
                  const isSuccess = log.status === 'SUCCESS';
                  const pathKorean = log.path ? (PATH_NAME_MAP[log.path] || log.path) : '-';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* No */}
                      <td className="px-3 py-3.5 font-bold text-slate-400 text-xs">
                        {startIndex + idx + 1}
                      </td>

                      {/* 일시 */}
                      <td className="px-3 py-3.5 text-xs font-medium text-slate-600">
                        {formatDateTime(log.created_at)}
                      </td>

                      {/* 관리자 ID */}
                      <td className="px-3 py-3.5 font-bold text-slate-800 text-xs truncate" title={log.admin_id}>
                        {log.admin_id}
                      </td>

                      {/* 활동 구분 뱃지 */}
                      <td className="px-3 py-3.5">
                        {renderActionBadge(log.action_type)}
                      </td>

                      {/* 대상 메뉴/경로 */}
                      <td className="px-3 py-3.5 text-left text-xs font-semibold text-slate-700 truncate" title={log.path || '-'}>
                        {pathKorean}
                        {log.path && PATH_NAME_MAP[log.path] && (
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({log.path})</span>
                        )}
                      </td>

                      {/* 상태 뱃지 */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-black ${
                            isSuccess
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {isSuccess ? '성공' : '실패'}
                        </span>
                      </td>

                      {/* IP 주소 */}
                      <td className="px-3 py-3.5 text-xs font-mono text-slate-600 truncate" title={log.ip_address}>
                        {log.ip_address || '-'}
                      </td>

                      {/* 기기 환경 */}
                      <td className="px-3 py-3.5 text-xs text-slate-500 font-medium truncate" title={log.user_agent}>
                        {parseUserAgent(log.user_agent)}
                      </td>

                      {/* 실패 사유 / 상세 */}
                      <td
                        className="px-4 py-3.5 text-left text-xs text-slate-500 font-medium truncate"
                        title={log.failure_reason || (isSuccess ? '정상 처리' : '-')}
                      >
                        {log.failure_reason ? (
                          <span className={isSuccess ? "text-indigo-600 font-bold" : "text-red-500 font-bold"}>
                            {log.failure_reason}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {isSuccess ? '정상 처리' : '알 수 없는 오류'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 font-medium">
                    {hasActiveFilter ? '검색 조건에 일치하는 로그가 없습니다.' : '기록이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            이전
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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