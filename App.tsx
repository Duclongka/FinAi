
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  // --- Constants ---
  const APP_VERSION = "3.4.0";
  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const defaultRatios: Record<JarType, number> = {
    [JarType.NEC]: 0.55, [JarType.LTS]: 0.10, [JarType.EDU]: 0.10,
    [JarType.PLAY]: 0.10, [JarType.FFA]: 0.10, [JarType.GIVE]: 0.05,
  };

  const defaultSettings: AppSettings = {
    pin: '',
    pinEnabled: false,
    faceIdEnabled: false,
    currency: 'VND',
    language: 'vi',
    notificationsEnabled: true,
    jarRatios: defaultRatios
  };

  // --- States ---
  const [balances, setBalances] = useState<JarBalance>(() => {
    const saved = localStorage.getItem('jars_balances');
    return saved ? JSON.parse(saved) : {
      [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0,
      [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0,
    };
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('jars_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [loans, setLoans] = useState<Loan[]>(() => {
    const saved = localStorage.getItem('jars_loans');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('jars_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('jars_user');
    return saved ? JSON.parse(saved) : null;
  });

  // UI States
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info' | 'danger'} | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'export' | 'info' | 'connect'>('info');
  
  // Pay/Recover Loan Modal States
  const [isPayLoanModalOpen, setIsPayLoanModalOpen] = useState(false);
  const [activeLoanForPay, setActiveLoanForPay] = useState<Loan | null>(null);
  const [payLoanAmount, setPayLoanAmount] = useState('');
  const [payLoanJar, setPayLoanJar] = useState<JarType>(JarType.NEC);

  // History & Chart UI states
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [historyJarFilter, setHistoryJarFilter] = useState<JarType | 'all'>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);
  const [chartTab, setChartTab] = useState<'week' | 'month' | 'year'>('week');

  // Form States
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState('Chào bạn! Nhập thu nhập hoặc chi tiêu để bắt đầu.');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualJar, setManualJar] = useState<JarType>(JarType.NEC);
  const [manualDate, setManualDate] = useState(getTodayString());
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  
  // Loan Form State (Extended with loanJar)
  const [loanForm, setLoanForm] = useState<Partial<Loan> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO'
  });
  const [feedbackForm, setFeedbackForm] = useState({ name: '', phone: '', opinion: '' });

  // Transfer States
  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const manualFormRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => localStorage.setItem('jars_balances', JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem('jars_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('jars_loans', JSON.stringify(loans)), [loans]);
  useEffect(() => localStorage.setItem('jars_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => {
    if (currentUser) localStorage.setItem('jars_user', JSON.stringify(currentUser));
    else localStorage.removeItem('jars_user');
  }, [currentUser]);

  // --- Helpers ---
  const formatNumber = (num: number | string) => {
    if (!num) return "";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseFormattedNumber = (str: string) => {
    return parseInt(str.toString().replace(/\./g, "")) || 0;
  };

  const showToast = (msg: string, type: 'success' | 'info' | 'danger' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatCurrency = (val: number) => {
    const symbols = { 'VND': 'đ', 'JPY': '¥', 'USD': '$' };
    return val.toLocaleString() + (symbols[settings.currency] || 'đ');
  };

  const formatYAxis = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'tr';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toString();
  };

  const updateBalances = (prevTrans: Transaction | null, nextTrans: Transaction) => {
    const newBalances = { ...balances };
    const ratios = settings.jarRatios;

    // Revert old transaction
    if (prevTrans) {
      if (prevTrans.type === 'income') {
        if (prevTrans.jarType) {
          newBalances[prevTrans.jarType] -= prevTrans.amount;
        } else {
          Object.values(JarType).forEach(type => {
            newBalances[type as JarType] -= prevTrans.amount * ratios[type as JarType];
          });
        }
      } else {
        if (prevTrans.jarType) {
          newBalances[prevTrans.jarType] += prevTrans.amount;
        } else {
          Object.values(JarType).forEach(type => {
            newBalances[type as JarType] += prevTrans.amount * ratios[type as JarType];
          });
        }
      }
    }

    // Apply new transaction
    if (nextTrans.type === 'income') {
      if (nextTrans.jarType) {
        newBalances[nextTrans.jarType] += nextTrans.amount;
      } else {
        Object.values(JarType).forEach(type => {
          newBalances[type as JarType] += nextTrans.amount * ratios[type as JarType];
        });
      }
    } else {
      if (nextTrans.jarType) {
        newBalances[nextTrans.jarType] -= nextTrans.amount;
      } else {
        Object.values(JarType).forEach(type => {
          newBalances[type as JarType] -= nextTrans.amount * ratios[type as JarType];
        });
      }
    }

    setBalances(newBalances);
  };

  // --- Handlers ---
  const handleProcessInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const result = await analyzeTransactionText(input, transactions);
      if (result && result.action === 'create' && (result.amount || 0) > 0) {
        const isExpense = result.isExpense !== false;
        const newTrans: Transaction = {
          id: Date.now().toString(), type: isExpense ? 'expense' : 'income',
          amount: result.amount!, description: result.description || input,
          jarType: isExpense ? (result.jarType || JarType.NEC) : undefined,
          timestamp: Date.now(), rawText: input
        };
        setTransactions(prev => [newTrans, ...prev]);
        updateBalances(null, newTrans);
        showToast(`Đã thêm: ${newTrans.description}`);
        setAdvice(await getFinancialAdvice(balances, `Đã thêm: ${newTrans.description}`));
      } else showToast("AI không hiểu ý bạn.", "info");
    } catch (e) { showToast("Lỗi AI.", "danger"); }
    finally { setIsLoading(false); setInput(''); }
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prevTransactions => {
      const t = prevTransactions.find(item => item.id === id);
      if (!t) return prevTransactions;

      setBalances(prevBalances => {
        const nb = { ...prevBalances };
        if (t.type === 'income') {
          if (t.jarType) {
            nb[t.jarType] -= t.amount;
          } else {
            Object.values(JarType).forEach(type => {
              nb[type as JarType] -= t.amount * settings.jarRatios[type as JarType];
            });
          }
        } else {
          if (t.jarType) {
            nb[t.jarType] += t.amount;
          } else {
            Object.values(JarType).forEach(type => {
              nb[type as JarType] += t.amount * settings.jarRatios[type as JarType];
            });
          }
        }
        return nb;
      });

      showToast("Đã xóa giao dịch.", "info");
      return prevTransactions.filter(item => item.id !== id);
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFormattedNumber(manualAmount);
    if (amount <= 0 || !manualDesc.trim()) return;
    const newTrans: Transaction = {
      id: editingTransactionId || Date.now().toString(), type: manualType,
      amount, description: manualDesc, jarType: manualType === 'expense' ? manualJar : undefined,
      timestamp: new Date(manualDate).getTime(),
      imageUrl: manualImage || undefined
    };
    if (editingTransactionId) {
      const old = transactions.find(t => t.id === editingTransactionId) || null;
      setTransactions(prev => prev.map(t => t.id === editingTransactionId ? newTrans : t));
      updateBalances(old, newTrans);
      setEditingTransactionId(null);
    } else {
      setTransactions(prev => [newTrans, ...prev]);
      updateBalances(null, newTrans);
    }
    setManualAmount(''); setManualDesc(''); setManualImage(null); showToast("Đã lưu!");
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransactionId(t.id);
    setManualAmount(t.amount.toString());
    setManualDesc(t.description);
    setManualType(t.type);
    if (t.jarType) setManualJar(t.jarType);
    setManualDate(new Date(t.timestamp).toISOString().split('T')[0]);
    setManualImage(t.imageUrl || null);
    manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleResetData = () => {
    if (window.confirm("BẠN CHẮC CHỨ? Toàn bộ dữ liệu (Số dư, Giao dịch, Vay nợ) sẽ bị xóa sạch và không thể khôi phục!")) {
      setTransactions([]);
      setBalances({ 
        [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, 
        [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 
      });
      setLoans([]);
      setSettings({...defaultSettings});
      localStorage.clear();
      showToast("Đã khôi phục cài đặt gốc.", "danger");
      setIsSettingsOpen(false);
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFormattedNumber(transferAmount);
    if (amount <= 0 || amount > balances[transferFrom]) return showToast("Số tiền không hợp lệ.", "danger");
    const nb = { ...balances };
    nb[transferFrom] -= amount;
    nb[transferTo] += amount;
    setBalances(nb);
    const t: Transaction = { id: Date.now().toString(), type: 'expense', amount, description: `Chuyển: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferFrom, timestamp: Date.now() };
    const t2: Transaction = { id: (Date.now()+1).toString(), type: 'income', amount, description: `Nhận: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferTo, timestamp: Date.now() };
    setTransactions(p => [t, t2, ...p]);
    setIsTransferModalOpen(false);
    showToast("Điều chuyển thành công!");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanForm.principal) return;
    const principal = parseFormattedNumber(loanForm.principal.toString());
    const paidAmount = parseFormattedNumber((loanForm.paidAmount || 0).toString());
    
    // Create actual loan object
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : loanForm.loanJar;
    const newLoan: Loan = { ...(loanForm as Loan), id: Date.now().toString(), principal, paidAmount };
    
    if (newLoan.type === LoanType.BORROW) {
      const t: Transaction = { 
        id: Date.now().toString(), 
        type: 'income', 
        amount: principal, 
        description: `Vay từ ${newLoan.lenderName}`, 
        timestamp: Date.now(), 
        jarType: finalLoanJar 
      };
      setTransactions(p => [t, ...p]);
      updateBalances(null, t);
    } else {
      const t: Transaction = { 
        id: Date.now().toString(), 
        type: 'expense', 
        amount: principal, 
        jarType: finalLoanJar, 
        description: `Cho vay ${newLoan.lenderName}`, 
        timestamp: Date.now() 
      };
      setTransactions(p => [t, ...p]);
      updateBalances(null, t);
    }
    setLoans(p => [newLoan, ...p]);
    setIsLoanModalOpen(false);
    showToast("Đã lưu vay nợ!");
  };

  const handleOpenPayLoanModal = (loan: Loan) => {
    setActiveLoanForPay(loan);
    setPayLoanAmount((loan.principal - loan.paidAmount).toString());
    setPayLoanJar(loan.type === LoanType.BORROW ? JarType.NEC : JarType.FFA);
    setIsPayLoanModalOpen(true);
  };

  const handleConfirmPayLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoanForPay) return;
    const amount = parseFormattedNumber(payLoanAmount);
    if (amount <= 0) return showToast("Số tiền không hợp lệ.", "danger");

    const loan = activeLoanForPay;
    const isRecovery = loan.type === LoanType.LEND;
    const remaining = loan.principal - loan.paidAmount;
    const actualPay = Math.min(amount, remaining);

    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, paidAmount: l.paidAmount + actualPay } : l));
    
    const t: Transaction = { 
      id: Date.now().toString(), 
      type: isRecovery ? 'income' : 'expense', 
      amount: actualPay, 
      description: `${isRecovery ? 'Thu hồi' : 'Thanh toán'} nợ: ${loan.lenderName}`, 
      timestamp: Date.now(),
      jarType: payLoanJar
    };
    setTransactions(p => [t, ...p]);
    updateBalances(null, t);
    
    setIsPayLoanModalOpen(false);
    showToast(`${isRecovery ? 'Thu hồi' : 'Thanh toán'} thành công!`);
  };

  const scrollToAi = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => aiInputRef.current?.focus(), 500);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return showToast("Không có dữ liệu.", "info");
    const headers = ["ID", "Loại", "Số tiền", "Mô tả", "Hũ", "Thời gian"];
    const rows = transactions.map(t => [t.id, t.type === 'income' ? 'Thu nhập' : 'Chi tiêu', t.amount, t.description.replace(/,/g, " "), t.jarType ? JAR_CONFIG[t.jarType as JarType].name : 'Tự động', new Date(t.timestamp).toLocaleString()]);
    const csvContent = ["\ufeff" + headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finai_export_${Date.now()}.csv`;
    link.click();
    showToast("Đã xuất CSV!");
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Cảm ơn góp ý!");
    setFeedbackForm({ name: '', phone: '', opinion: '' });
  };

  // --- Calculations ---
  const totalInJars = (Object.values(balances) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalBorrowed = loans.filter(l => l.type === LoanType.BORROW).reduce((a: number, l) => a + (l.principal - l.paidAmount), 0);
  const totalLent = loans.filter(l => l.type === LoanType.LEND).reduce((a: number, l) => a + (l.principal - l.paidAmount), 0);
  const netAssets = totalInJars - totalBorrowed + totalLent;

  // Chart Data
  const chartData = useMemo(() => {
    const data: { name: string; Thu: number; Chi: number }[] = [];
    let count = chartTab === 'week' ? 7 : chartTab === 'month' ? 30 : 12;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      let label = "";
      let dayT: Transaction[] = [];
      if (chartTab === 'year') {
        d.setMonth(d.getMonth() - i);
        label = `T${d.getMonth() + 1}`;
        dayT = transactions.filter(t => { const td = new Date(t.timestamp); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); });
      } else {
        d.setDate(d.getDate() - i);
        label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        dayT = transactions.filter(t => new Date(t.timestamp).toDateString() === d.toDateString());
      }
      
      const thu = dayT.filter(t => t.type === 'income').reduce((s: number, t: Transaction) => s + t.amount, 0);
      const chi = dayT.filter(t => t.type === 'expense').reduce((s: number, t: Transaction) => s + t.amount, 0);
      
      data.push({ name: label, Thu: thu, Chi: chi });
    }
    return data;
  }, [transactions, chartTab]);

  const filteredTransactions = transactions.filter(t => {
    const isType = historyFilter === 'all' || t.type === historyFilter;
    const isJar = historyJarFilter === 'all' || t.jarType === historyJarFilter;
    const isDate = !historyDateFilter || new Date(t.timestamp).toISOString().split('T')[0] === historyDateFilter;
    return isType && isJar && isDate;
  });

  const displayedHistory = filteredTransactions.slice(0, visibleHistoryCount);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pt-16 pb-32 font-sans flex flex-col items-center overflow-x-hidden">
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'success' ? 'bg-indigo-600' : toast.type === 'danger' ? 'bg-red-600' : 'bg-slate-800'} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xl animate-in slide-in-from-top-4 duration-300`}>
          {toast.msg}
        </div>
      )}

      {/* --- AI INPUT BAR --- */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-slate-200 p-2 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <form onSubmit={handleProcessInput} className="relative flex-1">
            <input ref={aiInputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Nhập giao dịch bằng AI (vd: Sáng ăn 50k hũ thiết yếu)..." className="w-full bg-slate-100 border-2 border-slate-200 rounded-full px-5 py-2 text-[11px] font-bold outline-none focus:border-indigo-400 shadow-inner" />
            <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 shadow-lg">
              {isLoading ? <div className="w-2 h-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨"}
            </button>
          </form>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto px-4 space-y-8 mt-4">
        {/* STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ label: 'Tiền hũ', val: totalInJars, icon: '💰' }, { label: 'Nợ phải trả', val: totalBorrowed, icon: '📉' }, { label: 'Đang cho vay', val: totalLent, icon: '🤝' }, { label: 'Tài sản ròng', val: netAssets, icon: '💎', dark: true }].map((s, i) => (
            <div key={i} className={`${s.dark ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200' : 'bg-white border-slate-200 shadow-slate-200'} p-4 rounded-2xl border-2 shadow-lg transition-all hover:-translate-y-1`}>
              <div className="flex justify-between items-start mb-1">
                <p className={`${s.dark ? 'text-indigo-100' : 'text-slate-400'} text-[8px] font-black uppercase tracking-wider`}>{s.label}</p>
                <span className="text-sm opacity-50">{s.icon}</span>
              </div>
              <h3 className="text-base font-black truncate">{formatCurrency(s.val)}</h3>
            </div>
          ))}
        </section>

        {/* AI ADVICE */}
        <section className="bg-white rounded-[1.5rem] p-5 border-2 border-indigo-100 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl border border-indigo-100 shrink-0">💡</div>
          <div className="flex-1"><p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Lời khuyên từ chuyên gia</p><p className="text-xs font-bold text-slate-700 italic">"{advice}"</p></div>
        </section>

        {/* JARS VISUAL */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.values(JarType).map(type => (
            <JarVisual key={type} jar={JAR_CONFIG[type as JarType]} balance={balances[type as JarType]} onTransferClick={() => { setTransferFrom(type as JarType); setIsTransferModalOpen(true); }} />
          ))}
        </section>

        {/* CHART SECTION */}
        <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl h-[460px] flex flex-col w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📊</span> BIỂU ĐỒ THU CHI</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">{['week', 'month', 'year'].map(t => <button key={t} onClick={() => setChartTab(t as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${chartTab === t ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{t === 'week' ? 'Tuần' : t === 'month' ? 'Tháng' : 'Năm'}</button>)}</div>
          </div>
          <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: -25, bottom: 0, right: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={formatYAxis} /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', fontSize: '9px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} /><Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>

        {/* MANUAL FORM */}
        <section ref={manualFormRef} className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-xl transition-all ${editingTransactionId ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200'}`}>
          <div className="flex justify-between items-center mb-6"><h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📝</span> {editingTransactionId ? "ĐANG SỬA GIAO DỊCH" : "GHI CHÉP THỦ CÔNG"}</h3>{editingTransactionId && <button onClick={() => setEditingTransactionId(null)} className="text-[9px] font-black text-red-500">HỦY SỬA</button>}</div>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loại giao dịch</label><div className="flex bg-slate-100 p-1 rounded-xl h-12"><button type="button" onClick={() => setManualType('expense')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${manualType === 'expense' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>CHI TIÊU</button><button type="button" onClick={() => setManualType('income')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${manualType === 'income' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>THU NHẬP</button></div></div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Số tiền & Nội dung</label>
              <input required type="text" inputMode="numeric" value={formatNumber(manualAmount)} onChange={e => setManualAmount(e.target.value.replace(/\./g, ""))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[11px] font-bold outline-none h-12" />
              <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Nội dung giao dịch..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[11px] font-bold outline-none h-12" />
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phân bổ & Hình ảnh</label>
              {manualType === 'income' ? (
                <div className="w-full bg-indigo-50 border-2 border-indigo-100 text-indigo-600 rounded-xl p-3 text-[11px] font-black flex items-center justify-center h-12 uppercase italic">✨ Tự động phân bổ 6 hũ</div>
              ) : (
                <div className="flex gap-2 h-12">
                  <select value={manualJar} onChange={e => setManualJar(e.target.value as JarType)} className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-2 text-[10px] font-bold outline-none">{Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type as JarType].name}</option>)}</select>
                  <label className="w-12 bg-slate-100 border-2 border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors">
                    <span className="text-lg">📷</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              )}
              {manualImage && (
                <div className="relative w-full h-12 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50">
                  <img src={manualImage} alt="preview" className="w-full h-full object-cover" />
                  <button onClick={() => setManualImage(null)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg text-[8px] font-black">✕</button>
                </div>
              )}
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[11px] font-bold outline-none h-12" />
            </div>
            <div className="space-y-3 flex flex-col justify-end"><button type="submit" className="w-full h-12 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">{editingTransactionId ? "LƯU THAY ĐỔI" : "LƯU GIAO DỊCH"}</button></div>
          </form>
        </section>

        {/* HISTORY SECTION */}
        <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl flex flex-col h-fit w-full">
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📜</span> LỊCH SỬ GIAO DỊCH</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bộ lọc giao dịch</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Loại giao dịch</label>
                  <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none">
                    <option value="all">Tất cả</option>
                    <option value="income">Chỉ Thu</option>
                    <option value="expense">Chỉ Chi</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Loại hũ</label>
                  <select value={historyJarFilter} onChange={e => setHistoryJarFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none">
                    <option value="all">Tất cả hũ</option>
                    {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type as JarType].name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">Ngày tháng</label>
                  <input type="date" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none"/>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? <div className="py-20 text-center text-slate-300 italic text-[11px] font-bold">Không tìm thấy giao dịch.</div> : displayedHistory.map(t => (
              <div key={t.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-inner relative overflow-hidden">
                    {t.imageUrl ? <img src={t.imageUrl} className="w-full h-full object-cover" alt="tx" /> : (t.type === 'income' ? '💰' : JAR_CONFIG[t.jarType as JarType]?.icon || '🏦')}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 leading-tight">{t.description}</p>
                    <p className="text-[8px] text-slate-400 font-black uppercase">{new Date(t.timestamp).toLocaleDateString()} • {t.jarType ? JAR_CONFIG[t.jarType as JarType].name : 'Tự động'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-[11px] font-black ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}đ
                  </p>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={() => handleEditClick(t)} className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 shadow-sm" title="Sửa">✏️</button>
                    <button onClick={() => deleteTransaction(t.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-red-100 shadow-sm" title="Xóa">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredTransactions.length > visibleHistoryCount && <button onClick={() => setVisibleHistoryCount(prev => prev + 5)} className="mt-6 w-full py-3 bg-slate-50 text-slate-500 text-[10px] font-black uppercase rounded-xl border-2 border-dashed border-slate-200 hover:bg-slate-100 transition-all">Xem thêm ↓</button>}
        </section>

        {/* LOANS SECTION */}
        <section className="bg-white p-8 rounded-[2.5rem] border-2 border-orange-500/20 shadow-xl space-y-6 w-full">
          <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📉</span> QUẢN LÝ VAY NỢ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loans.length === 0 ? <div className="col-span-full py-16 text-center border-2 border-dashed border-orange-100 rounded-3xl text-slate-300 italic text-[11px] font-bold">Chưa có khoản vay nợ nào.</div> : loans.map(loan => (
              <div key={loan.id} className="p-6 rounded-[1.5rem] border-2 border-slate-100 bg-white hover:border-indigo-200 transition-all shadow-md relative group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${loan.type === LoanType.BORROW ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{loan.type === LoanType.BORROW ? '💸' : '🤝'}</div><div><h4 className="text-[13px] font-black text-slate-800">{loan.lenderName}</h4><div className="flex gap-1.5 mt-0.5"><span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${loan.type === LoanType.BORROW ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{loan.type === LoanType.BORROW ? 'Tôi nợ' : 'Nợ tôi'}</span></div></div></div>
                  <div className="flex flex-col items-end shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"><button onClick={() => handleOpenPayLoanModal(loan)} className={`flex items-center gap-1 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all border shadow-sm ${loan.type === LoanType.BORROW ? 'text-indigo-600 border-indigo-100 hover:bg-indigo-50' : 'text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}>✏️ {loan.type === LoanType.BORROW ? 'THANH TOÁN' : 'THU HỒI'}</button><p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Còn: {formatCurrency(loan.principal - loan.paidAmount)}</p></div>
                </div>
                <div className="space-y-2"><div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-1000 ${loan.type === LoanType.BORROW ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${(loan.paidAmount/loan.principal)*100}%` }}/></div><div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-tighter"><span>Đã trả: {formatCurrency(loan.paidAmount)}</span><span>Hạn: {new Date(loan.startDate).toLocaleDateString()}</span></div></div>
              </div>
            ))}
          </div>
          <div className="flex justify-center"><button onClick={() => setIsLoanModalOpen(true)} className="px-10 py-4 bg-white border-2 border-indigo-100 text-indigo-600 text-[11px] font-black uppercase rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2"><span className="text-xl">➕</span> GHI VAY NỢ MỚI</button></div>
        </section>
      </main>

      {/* --- GLOSSY CENTER FAB --- */}
      <button 
        onClick={scrollToAi}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-16 h-16 bg-gradient-to-tr from-indigo-700 to-indigo-400 text-white rounded-full flex items-center justify-center shadow-[0_15px_30px_rgba(79,70,229,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] hover:scale-110 active:scale-90 transition-all border-4 border-white"
      >
        <span className="text-4xl text-white font-light">＋</span>
      </button>

      {/* --- UTILITY BAR --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t-2 border-slate-200 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4">
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-tighter text-slate-900 uppercase">FINAI</span>
            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">by Loong Lee</span>
          </div>
          <div className="flex items-center gap-6">
            {currentUser ? (
              <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 p-1 hover:bg-indigo-50 rounded-full border border-indigo-100 transition-all group shrink-0">
                <img src={currentUser.avatarUrl} className="w-5 h-5 rounded-full bg-slate-200" alt="avatar" />
                <span className="text-[8px] font-black text-slate-600 uppercase max-w-[60px] truncate group-hover:text-indigo-600">{currentUser.displayName}</span>
              </button>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="text-[8px] font-black uppercase bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg active:scale-95 transition-all">TÊN BẠN</button>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-500 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-200 transition-all"><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div></button>
          </div>
        </div>
      </div>

      {/* --- SETTINGS SIDE DRAWER --- */}
      <div className={`fixed inset-0 z-[200] transition-opacity duration-300 ${isSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 transform flex flex-col ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b-2 border-slate-100 flex items-center justify-between bg-slate-50"><h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">CÀI ĐẶT ỨNG DỤNG</h2><button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button></div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {settingsTab === 'export' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 text-center py-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">DỮ LIỆU & KHÔI PHỤC</h4>
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-inner border border-emerald-100 mb-2">📁</div>
                <div className="space-y-3">
                  <button onClick={exportToCSV} className="w-full py-4 bg-emerald-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all">XUẤT BẢNG TÍNH CSV</button>
                  <button onClick={handleResetData} className="w-full py-4 bg-red-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all">KHÔI PHỤC CÀI ĐẶT GỐC</button>
                </div>
              </div>
            )}
            {settingsTab === 'info' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 text-center py-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">THÔNG TIN</h4>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                   <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-2xl mb-4">✨</div>
                   <h4 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">FINAI</h4>
                   <p className="text-[10px] font-bold text-slate-500 italic mt-2">Quản lý tài chính của bạn bằng Ai theo quy tắc 6 hũ của T. Harv Eker</p>
                   <div className="mt-8 space-y-2"><p className="text-[11px] font-bold text-slate-500 italic">Phiên bản <span className="text-slate-800 not-italic">{APP_VERSION}</span></p><p className="text-[11px] font-bold text-slate-500 italic">Thiết kế bởi <span className="text-indigo-600 not-italic uppercase font-black">Loong Lee</span></p></div>
                </div>
              </div>
            )}
            {settingsTab === 'connect' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">LIÊN HỆ</h4><div className="grid grid-cols-1 gap-3"><a href="https://www.facebook.com/duclongka" target="_blank" className="flex items-center gap-4 p-5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 group"><div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-lg">📘</div><div><p className="text-[11px] font-black uppercase tracking-tight">Facebook</p><p className="text-[10px] font-medium opacity-60">duclongka</p></div></a><div className="flex items-center gap-4 p-5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 group"><div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-lg">💬</div><div><p className="text-[11px] font-black uppercase tracking-tight">Zalo</p><p className="text-[10px] font-medium opacity-60">0964 855 899</p></div></div></div><form onSubmit={handleFeedbackSubmit} className="space-y-4 pt-4 border-t border-slate-100"><input required type="text" value={feedbackForm.name} onChange={e => setFeedbackForm({...feedbackForm, name: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-[11px] font-bold outline-none" placeholder="Họ tên..." /><textarea required rows={4} value={feedbackForm.opinion} onChange={e => setFeedbackForm({...feedbackForm, opinion: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-[11px] font-bold outline-none resize-none" placeholder="Góp ý..." /><button type="submit" className="w-full py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all">GỬI</button></form></div>
            )}
          </div>
          <div className="p-4 border-t-2 border-slate-100 flex items-center justify-around bg-slate-50 shadow-inner">{[{ id: 'export', icon: '📁', label: 'Dữ liệu' }, { id: 'info', icon: 'ℹ️', label: 'Tin' }, { id: 'connect', icon: '💬', label: 'Góp ý' }].map(tab => (<button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${settingsTab === tab.id ? 'bg-white shadow-lg text-indigo-600 scale-110' : 'text-slate-400'}`}><span className="text-xl">{tab.icon}</span><span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span></button>))}</div>
        </div>
      </div>

      {/* --- LOAN MODAL --- */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 custom-scrollbar">
            <div className="flex items-center justify-between mb-8"><h2 className="text-base font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter"><span className="text-xl">🏦</span> Thêm vay nợ mới</h2><button onClick={() => setIsLoanModalOpen(false)} className="text-slate-300 hover:text-slate-900 text-2xl">✕</button></div>
            <form onSubmit={handleSaveLoan} className="space-y-6">
               <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loại hình</label><div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2 border shadow-inner"><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loanForm.type === LoanType.BORROW ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>Tôi Vay</button><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loanForm.type === LoanType.LEND ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Cho Vay</button></div></div>
               <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đối tượng</label><input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold outline-none" placeholder="Tên chủ nợ / người vay..." /></div>
               <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ngày phát sinh</label><input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none" /></div><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phân loại</label><select value={loanForm.category} onChange={e => setLoanForm({...loanForm, category: e.target.value as LoanCategory})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none"><option value={LoanCategory.BANK}>Ngân hàng</option><option value={LoanCategory.PERSONAL}>Cá nhân</option></select></div></div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Số tiền gốc (đ)</label>
                   <input required type="text" inputMode="numeric" value={formatNumber(loanForm.principal || '')} onFocus={() => { if (loanForm.principal === 0) setLoanForm({...loanForm, principal: undefined}); }} onChange={e => setLoanForm({...loanForm, principal: parseFormattedNumber(e.target.value)})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-black outline-none" placeholder="0" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đã trả / Đã thu (đ)</label>
                   <input type="text" inputMode="numeric" value={formatNumber(loanForm.paidAmount || '')} onFocus={() => { if (loanForm.paidAmount === 0) setLoanForm({...loanForm, paidAmount: undefined}); }} onChange={e => setLoanForm({...loanForm, paidAmount: parseFormattedNumber(e.target.value)})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-black outline-none" placeholder="0" />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   {loanForm.type === LoanType.BORROW ? 'Mục đích / Hũ nhận tiền' : 'Nguồn tiền / Hũ cho vay'}
                 </label>
                 <select 
                    value={loanForm.loanJar} 
                    onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as JarType | 'AUTO'})} 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none shadow-inner"
                  >
                    <option value="AUTO">✨ Tự động phân bổ (Theo tỷ lệ hũ)</option>
                    {Object.values(JarType).map(type => (
                      <option key={type} value={type}>{JAR_CONFIG[type as JarType].icon} {JAR_CONFIG[type as JarType].name}</option>
                    ))}
                  </select>
               </div>

               <div className="flex items-center justify-between gap-6 pt-6"><button type="button" onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Hủy</button><button type="submit" className="w-[200px] py-4 bg-indigo-600 text-white font-black uppercase text-[11px] rounded-full shadow-lg active:scale-95 transition-all">LƯU VAY NỢ</button></div>
            </form>
          </div>
        </div>
      )}

      {/* --- PAY/RECOVER LOAN MODAL --- */}
      {isPayLoanModalOpen && activeLoanForPay && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter mb-6">
              <span className="text-lg">💳</span> {activeLoanForPay.type === LoanType.BORROW ? 'THANH TOÁN CHO' : 'THU HỒI TỪ'} {activeLoanForPay.lenderName.toUpperCase()}
            </h2>
            
            <form onSubmit={handleConfirmPayLoan} className="space-y-6">
               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">SỐ TIỀN (đ)</label>
                  <input 
                    required 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumber(payLoanAmount)} 
                    onChange={e => setPayLoanAmount(e.target.value.replace(/\./g, ""))} 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none shadow-inner" 
                    placeholder="0" 
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {activeLoanForPay.type === LoanType.BORROW ? 'LẤY TỪ HŨ' : 'THU VÀO HŨ'}
                  </label>
                  <select 
                    value={payLoanJar} 
                    onChange={e => setPayLoanJar(e.target.value as JarType)} 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none h-12 shadow-inner"
                  >
                    {Object.values(JarType).map(type => (
                      <option key={type} value={type}>{JAR_CONFIG[type as JarType].icon} {JAR_CONFIG[type as JarType].name}</option>
                    ))}
                  </select>
               </div>

               <div className="flex items-center justify-between gap-4 pt-4">
                  <button type="button" onClick={() => setIsPayLoanModalOpen(false)} className="flex-1 py-3.5 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-all">HỦY</button>
                  <button type="submit" className="flex-[2] py-3.5 bg-indigo-600 text-white font-black uppercase text-[11px] rounded-xl shadow-lg active:scale-95 transition-all">XÁC NHẬN</button>
               </div>
            </form>
            <button onClick={() => setIsPayLoanModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* --- AUTH MODAL --- */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-[280px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-black text-slate-800 mb-6 text-center uppercase tracking-tight">NHẬP TÊN BẠN</h2>
            <form onSubmit={(e) => { e.preventDefault(); const nameInput = (e.currentTarget.elements[0] as HTMLInputElement).value; setCurrentUser({ id: '1', email: 'user@finai.app', displayName: nameInput || 'Người dùng', provider: 'local', avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nameInput}` }); setIsAuthModalOpen(false); }} className="space-y-4">
              <input required type="text" className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[10px] font-bold outline-none" placeholder="Tên..." />
              <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-[9px] transition-all">BẮT ĐẦU</button>
            </form>
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 text-slate-300">✕</button>
          </div>
        </div>
      )}

      {/* --- TRANSFER MODAL --- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative">
            <h2 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-tight">⇄ ĐIỀU CHUYỂN HŨ</h2>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">SANG HŨ</label><select value={transferTo} onChange={e => setTransferTo(e.target.value as JarType)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-bold outline-none">{Object.values(JarType).filter(t => t !== transferFrom).map(t => <option key={t} value={t}>{JAR_CONFIG[t as JarType].name}</option>)}</select></div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">SỐ TIỀN</label><input required type="text" inputMode="numeric" value={formatNumber(transferAmount)} onFocus={() => { if (Number(transferAmount) === 0) setTransferAmount(''); }} onChange={e => setTransferAmount(e.target.value.replace(/\./g, ""))} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-bold outline-none" placeholder="0" /></div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all">XÁC NHẬN</button>
            </form>
            <button onClick={() => setIsTransferModalOpen(false)} className="absolute top-8 right-8 text-slate-300">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
