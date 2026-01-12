
import React, { useState } from 'react';
import { JarInfo, JarType } from '../types';

interface JarVisualProps {
  jar: JarInfo;
  balance: number;
  currencySymbol: string;
  convertValue: (v: number) => number;
  onTransferClick?: (type: JarType) => void;
  onEditBalance?: (type: JarType) => void;
  onClick?: () => void;
}

const JarVisual: React.FC<JarVisualProps> = ({ jar, balance, currencySymbol, convertValue, onTransferClick, onEditBalance, onClick }) => {
  const [showInfo, setShowInfo] = useState(false);

  const maxVisualValue = 10000000; // Baseline for visual fill
  const fillPercentage = Math.min((balance / maxVisualValue) * 100, 100);

  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };

  const handleTransfer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTransferClick) onTransferClick(jar.type);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditBalance) {
      onEditBalance(jar.type);
    }
  };

  const displayVal = convertValue(balance);
  const formatted = displayVal.toLocaleString(undefined, { 
    minimumFractionDigits: currencySymbol === '$' ? 2 : 0, 
    maximumFractionDigits: currencySymbol === '$' ? 2 : 0 
  });

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[1.5rem] p-4 shadow-lg border-2 border-slate-100 flex flex-col items-center gap-2 transition-all hover:shadow-xl hover:border-indigo-100 cursor-pointer group relative overflow-hidden"
    >
      {/* Nút Chuyển hũ - Hiện khi hover */}
      <button 
        onClick={handleTransfer}
        className="absolute top-2 left-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
      </button>

      {/* Nút Thông tin - Hiện khi hover */}
      <button 
        onClick={toggleInfo}
        className="absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </button>

      {/* Nút Sửa số dư - Hiện khi hover */}
      <button 
        onClick={handleEdit}
        className="absolute bottom-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:text-indigo-500 transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
      >
        <span className="text-[11px]">✏️</span>
      </button>

      {showInfo && (
        <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200" onClick={toggleInfo}>
          <div className="text-2xl mb-2">{jar.icon}</div>
          <h4 className="font-black text-[10px] uppercase tracking-wider mb-2" style={{ color: jar.color }}>{jar.name}</h4>
          <p className="text-[9px] font-bold leading-relaxed text-slate-600">{jar.description}</p>
        </div>
      )}

      <div className="relative w-20 h-28 bg-slate-50 border-2 border-slate-100 rounded-b-3xl rounded-t-lg overflow-hidden shadow-inner">
        <div className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out" style={{ height: `${fillPercentage}%`, backgroundColor: jar.color, opacity: 0.7 }} />
        <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-60 group-hover:scale-110 transition-transform">{jar.icon}</div>
      </div>
      
      <div className="text-center mt-1">
        <h3 className="font-black text-slate-800 text-[10px] leading-tight uppercase tracking-tighter">{jar.name}</h3>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-0.5">({(jar.ratio * 100).toFixed(0)}%)</p>
        <p className="text-[11px] font-black mt-1 py-1 px-3 rounded-full bg-slate-50 inline-block border border-slate-100" style={{ color: jar.color }}>
          {currencySymbol === '$' ? `${currencySymbol}${formatted}` : `${formatted}${currencySymbol}`}
        </p>
      </div>
    </div>
  );
};

export default JarVisual;
