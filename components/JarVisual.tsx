
import React, { useState } from 'react';
import { JarType, JarInfo } from '../types';

interface JarVisualProps {
  jar: JarInfo;
  balance: number;
  currency: 'VND' | 'JPY' | 'USD';
  convertValue: (v: number) => number;
  onTransferClick: () => void;
}

const JarVisual: React.FC<JarVisualProps> = ({ 
  jar, 
  balance, 
  currency, 
  convertValue,
  onTransferClick
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const displayBalance = convertValue(balance);
  const decimals = currency === 'USD' ? 2 : 0;
  const currencySymbol = currency === 'VND' ? 'đ' : currency === 'JPY' ? '¥' : '$';

  // Assume 10M is full for visualization purposes
  const fillPercentage = Math.min(Math.max((balance / 10000000) * 100, 5), 95); 

  return (
    <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-4 shadow-lg hover:shadow-xl transition-all group relative overflow-hidden flex flex-col items-center min-h-[180px]">
      {/* Action buttons overlay */}
      <button 
        onClick={onTransferClick} 
        className="absolute top-2 left-2 w-7 h-7 bg-white/90 backdrop-blur shadow-sm rounded-full hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-opacity z-20 border border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100"
        title="Chuyển tiền"
      >
        <span className="text-[10px]">⇄</span>
      </button>
      <button 
        onClick={() => setShowInfo(!showInfo)} 
        className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center backdrop-blur shadow-sm rounded-full transition-all z-20 border border-slate-100 ${showInfo ? 'bg-indigo-600 text-white border-indigo-600 opacity-100' : 'bg-white/90 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100'}`}
        title="Thông tin hũ"
      >
        <span className="text-[10px] font-bold">i</span>
      </button>

      {/* Info Overlay */}
      {showInfo && (
        <div className="absolute inset-0 bg-indigo-600/95 backdrop-blur-sm z-30 p-5 flex flex-col justify-center animate-in fade-in zoom-in duration-200">
          <button onClick={() => setShowInfo(false)} className="absolute top-3 right-3 text-white/70 hover:text-white text-xs">✕</button>
          <h5 className="text-[10px] font-black text-white uppercase mb-2 border-b border-white/20 pb-1">{jar.name}</h5>
          <p className="text-[9px] font-medium text-indigo-50 leading-relaxed italic">{jar.description}</p>
        </div>
      )}

      {/* Jar Container - Increased Size */}
      <div className="relative w-24 h-32 mb-3 mt-2">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-14 h-2 bg-slate-200 rounded-full z-10 border border-slate-300" />
        <div className="w-full h-full relative rounded-t-2xl rounded-b-2xl border-4 border-slate-200 overflow-hidden bg-slate-50/50 backdrop-blur-sm shadow-inner">
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] transition-all duration-1000 ease-out liquid-wave"
            style={{ 
              height: `${fillPercentage}%`, 
              backgroundColor: jar.color,
              opacity: 0.6,
              borderRadius: '35%'
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-4xl drop-shadow-sm select-none">
            {jar.icon}
          </div>
        </div>
      </div>

      <div className="text-center w-full flex flex-col items-center">
        <div className="flex flex-col items-center mb-1">
          <h4 className="text-[9px] font-black uppercase tracking-wider text-black leading-tight line-clamp-1">
            {jar.name}
          </h4>
          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">
            ({(jar.ratio * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-xl border border-white/50 px-2.5 py-1 shadow-sm w-fit max-w-full">
          <p className="text-[11px] font-black truncate" style={{ color: jar.color }}>
            {currency === 'USD' ? currencySymbol : ''}
            {displayBalance.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
            {currency !== 'USD' ? currencySymbol : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default JarVisual;
