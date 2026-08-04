'use client';

import { useEffect, useRef } from 'react';

export interface PopupState {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm: () => void;
}

interface CustomPopupProps {
  popup: PopupState;
  onClose: () => void;
}

export default function CustomPopup({ popup, onClose }: CustomPopupProps) {
  // 첫 번째 버튼을 가리키기 위한 Ref 생성
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (popup.isOpen && firstButtonRef.current) {
      // 팝업이 열리자마자 확인 버튼에 포커스 지정
      firstButtonRef.current.focus();
    }
  }, [popup.isOpen]);

  if (!popup.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up outline-none">
        
        <div className={`px-6 py-4 border-b ${popup.type === 'alert' ? 'bg-red-50/50 border-red-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <h3 className={`text-lg font-bold ${popup.type === 'alert' ? 'text-red-700' : 'text-indigo-700'}`}>
            {popup.title}
          </h3>
        </div>
        
        <div className="p-6">
          <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
            {popup.message}
          </p>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 flex gap-2 justify-end">
          {popup.type === 'confirm' ? (
            <>
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-slate-400 outline-none"
              >
                취소
              </button>
              <button 
                ref={firstButtonRef}
                onClick={popup.onConfirm}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors focus:ring-2 focus:ring-emerald-400 outline-none"
              >
                확인
              </button>
            </>
          ) : (
            <button 
              ref={firstButtonRef}
              onClick={popup.onConfirm}
              className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              확인
            </button>
          )}
        </div>

      </div>
    </div>
  );
}