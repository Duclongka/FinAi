
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice, getDeepFinancialAnalysis } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

const App: React.FC = () => {
  // --- Helpers ---
  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const formatDateDisplay = (timestamp: number | string) => {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // --- User Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('jars_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Auth Form Fields
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // AI Analysis State
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState('');

  // Feedback State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackPhone, setFeedbackPhone] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');

  // --- Financial State ---
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

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState('Chào bạn! Nhập thu nhập hoặc chi tiêu để bắt đầu.');
  
  // Filtering States
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterJar, setFilterJar] = useState<'all' | JarType>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Manual Form States
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualJar, setManualJar] = useState<JarType>(JarType.NEC);
  const [manualDate, setManualDate] = useState(getTodayString());
  const [manualNote, setManualNote] = useState('');
  const [manualImage, setManualImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing Transaction Modal States
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editJarType, setEditJarType] = useState<JarType>(JarType.NEC);
  const [editDate, setEditDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Loan/Debt Modal States
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanForm, setLoanForm] = useState<Partial<Loan>>({
    type: LoanType.BORROW,
    category: LoanCategory.BANK,
    lenderName: '',
    principal: 0,
    paidAmount: 0,
    startDate: getTodayString(),
    isUrgent: false
  });

  // Repay Modal States
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [repayLoanTarget, setRepayLoanTarget] = useState<Loan | null>(null);
  const [repayForm, setRepayForm] = useState({ amount: '', jarType: JarType.NEC });

  // Persistence
  useEffect(() => localStorage.setItem('jars_balances', JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem('jars_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('jars_loans', JSON.stringify(loans)), [loans]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('jars_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('jars_user');
    }
  }, [currentUser]);

  // --- Auth Handlers ---
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail || !authPass || (authMode === 'register' && !authName)) {
      setAuthError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    const savedUsersStr = localStorage.getItem('jars_registered_users');
    const savedUsers: User[] = savedUsersStr ? JSON.parse(savedUsersStr) : [];

    if (authMode === 'register') {
      const existingUser = savedUsers.find(u => u.email === authEmail);
      if (existingUser) {
        setAuthError('Email này đã được đăng ký.');
        return;
      }

      const newUser: User = {
        id: Date.now().toString(),
        email: authEmail,
        displayName: authName,
        password: authPass,
        provider: 'local',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authName}`
      };

      const updatedUsers = [...savedUsers, newUser];
      localStorage.setItem('jars_registered_users', JSON.stringify(updatedUsers));
      setCurrentUser(newUser);
      setIsAuthModalOpen(false);
      resetAuthFields();
      setAdvice(`Chào mừng ${authName}! Bắt đầu quản lý tài chính ngay nào.`);
    } else {
      const user = savedUsers.find(u => u.email === authEmail && u.password === authPass);
      if (user) {
        setCurrentUser(user);
        setIsAuthModalOpen(false);
        resetAuthFields();
        setAdvice(`Chào mừng trở lại, ${user.displayName}!`);
      } else {
        setAuthError('Email hoặc mật khẩu không đúng.');
      }
    }
  };

  const resetAuthFields = () => {
    setAuthEmail('');
    setAuthPass('');
    setAuthName('');
    setAuthError('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowUserMenu(false);
    setAdvice("Bạn đã đăng xuất.");
  };

  const handleDeepAnalysis = async () => {
    setIsAnalysisModalOpen(true);
    setIsAnalyzing(true);
    const result = await getDeepFinancialAnalysis(
      balances, 
      transactions, 
      loans, 
      currentUser?.displayName || 'Người dùng'
    );
    setDeepAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName || !feedbackContent) return;
    setAdvice(`Cảm ơn ${feedbackName} đã gửi góp ý! Chúng tôi sẽ xem xét sớm.`);
    setFeedbackName('');
    setFeedbackPhone('');
    setFeedbackContent('');
    setIsFeedbackModalOpen(false);
  };

  const loginWithGoogle = () => {
    const mockUser: User = {
      id: 'google_' + Date.now(),
      email: 'user@gmail.com',
      displayName: 'Google User',
      provider: 'google',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=google'
    };
    setCurrentUser(mockUser);
    setIsAuthModalOpen(false);
    setAdvice("Đăng nhập bằng Google thành công.");
  };

  // --- Export Logic ---
  const exportToCSV = () => {
    const BOM = "\uFEFF";
    let csvContent = BOM + "DANH SÁCH GIAO DỊCH\n";
    csvContent += "Ngày,Loại,Hũ,Nội dung,Số tiền,Ghi chú\n";

    transactions.forEach(t => {
      const date = formatDateDisplay(t.timestamp);
      const type = t.type === 'income' ? 'Thu nhập' : 'Chi tiêu';
      const jar = t.jarType ? JAR_CONFIG[t.jarType].name : 'Phân bổ 6 hũ';
      const row = [
        date,
        type,
        jar,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount,
        `"${(t.note || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tai_Chinh_FinAi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAdvice("Đã xuất file dữ liệu thành công!");
  };

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
      
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate.getDate() === d.getDate() && 
               tDate.getMonth() === d.getMonth() && 
               tDate.getFullYear() === d.getFullYear();
      });

      const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      data.push({
        name: dateStr,
        'Thu': income,
        'Chi': expense,
      });
    }
    return data;
  }, [transactions]);

  // --- Image Handling ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, mode: 'manual' | 'edit') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (mode === 'manual') setManualImage(reader.result as string);
        else setEditImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Financial Handlers ---
  const addIncome = (amount: number, description: string, raw: string, timestamp: number = Date.now(), note?: string, imageUrl?: string) => {
    const newBalances = { ...balances };
    Object.values(JarType).forEach(type => { newBalances[type] += amount * JAR_CONFIG[type].ratio; });
    setBalances(newBalances);
    setTransactions(prev => [{ id: Date.now().toString(), type: 'income', amount, description, timestamp, rawText: raw, note, imageUrl }, ...prev]);
  };

  const addExpense = (amount: number, jarType: JarType, description: string, raw: string, timestamp: number = Date.now(), note?: string, imageUrl?: string) => {
    setBalances(prev => ({ ...prev, [jarType]: prev[jarType] - amount }));
    setTransactions(prev => [{ id: Date.now().toString(), type: 'expense', amount, description, jarType, timestamp, rawText: raw, note, imageUrl }, ...prev]);
  };

  const handleProcessInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    const result = await analyzeTransactionText(input, transactions);
    if (result) {
      let actionSummary = "";
      if (result.action === 'create' && result.amount !== undefined) {
        if (result.isExpense) {
          addExpense(result.amount, result.jarType!, result.description!, input);
          actionSummary = `Đã chi: ${result.description}`;
        } else {
          addIncome(result.amount, result.description!, input);
          actionSummary = `Đã thu: ${result.description}`;
        }
      } else if (result.action === 'update' && result.targetId) {
        const t = transactions.find(item => item.id === result.targetId);
        if (t) handleOpenEdit(t);
      } else if (result.action === 'delete' && result.targetId) {
        deleteTransaction(result.targetId);
      }
      const newAdvice = await getFinancialAdvice(balances, actionSummary);
      setAdvice(newAdvice);
      setInput('');
    }
    setIsLoading(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(manualAmount);
    if (isNaN(amount) || amount <= 0 || !manualDesc.trim()) return;
    const timestamp = new Date(manualDate).getTime();
    if (manualType === 'income') {
      addIncome(amount, manualDesc, `Thủ công: ${manualDesc}`, timestamp, manualNote, manualImage || undefined);
    } else {
      addExpense(amount, manualJar, manualDesc, `Thủ công: ${manualDesc}`, timestamp, manualNote, manualImage || undefined);
    }
    setManualAmount(''); setManualDesc(''); setManualNote('');
    setManualDate(getTodayString());
    setManualImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setAdvice(manualType === 'income' ? `Đã thêm thu nhập ${amount.toLocaleString()}đ` : `Đã thêm chi tiêu ${amount.toLocaleString()}đ vào hũ ${JAR_CONFIG[manualJar].name}`);
  };

  const deleteTransaction = (id: string) => {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    const newBalances = { ...balances };
    if (t.type === 'income') { Object.values(JarType).forEach(type => { newBalances[type] -= t.amount * JAR_CONFIG[type].ratio; }); } 
    else if (t.jarType) { newBalances[t.jarType] += t.amount; }
    setBalances(newBalances);
    setTransactions(prev => prev.filter(item => item.id !== id));
    setAdvice("Đã xóa giao dịch.");
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setEditAmount(t.amount.toString());
    setEditDescription(t.description);
    setEditType(t.type);
    setEditJarType(t.jarType || JarType.NEC);
    setEditDate(new Date(t.timestamp).toISOString().split('T')[0]);
    setEditNote(t.note || '');
    setEditImage(t.imageUrl || null);
  };

  const handleManualSave = () => {
    if (!editingTransaction) return;
    const newAmount = parseInt(editAmount) || 0;
    const newTimestamp = new Date(editDate).getTime();
    const oldT = editingTransaction;
    const tempBalances = { ...balances };

    // 1. Hoàn trả tác động của giao dịch cũ
    if (oldT.type === 'income') { 
      Object.values(JarType).forEach(type => { tempBalances[type] -= oldT.amount * JAR_CONFIG[type].ratio; }); 
    } else if (oldT.jarType) { 
      tempBalances[oldT.jarType] += oldT.amount; 
    }

    // 2. Áp dụng tác động của giao dịch mới
    if (editType === 'income') { 
      Object.values(JarType).forEach(type => { tempBalances[type] += newAmount * JAR_CONFIG[type].ratio; }); 
    } else { 
      tempBalances[editJarType] -= newAmount; 
    }

    setBalances(tempBalances);
    setTransactions(prev => prev.map(item => item.id === oldT.id ? { 
      ...item, 
      type: editType,
      amount: newAmount, 
      description: editDescription, 
      timestamp: newTimestamp, 
      note: editNote,
      jarType: editType === 'expense' ? editJarType : undefined,
      imageUrl: editImage || undefined
    } : item));
    setEditingTransaction(null);
    setAdvice("Đã cập nhật giao dịch.");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanForm.principal) return;
    
    const principal = Number(loanForm.principal) || 0;
    const loanData: Loan = { 
      ...loanForm as Loan, 
      id: editingLoanId || Date.now().toString(), 
      principal,
      paidAmount: Number(loanForm.paidAmount) || 0 
    };

    if (!editingLoanId) {
      if (loanData.type === LoanType.BORROW) {
        addIncome(principal, `Khoản vay từ: ${loanData.lenderName}`, `Ghi nợ: Vay ${principal} từ ${loanData.lenderName}`);
      } else {
        addExpense(principal, JarType.FFA, `Cho vay: ${loanData.lenderName}`, `Ghi nợ: Cho ${loanData.lenderName} vay ${principal}`);
      }
    }

    if (editingLoanId) { 
      setLoans(loans.map(l => l.id === editingLoanId ? loanData : l)); 
    } else { 
      setLoans([...loans, loanData]); 
    }
    
    setIsLoanModalOpen(false); 
    setEditingLoanId(null);
    setAdvice(editingLoanId ? "Đã cập nhật khoản nợ." : `Đã ghi nhận khoản ${loanData.type === LoanType.BORROW ? 'vay' : 'cho vay'} mới.`);
  };

  const handleRepayment = () => {
    if (!repayLoanTarget || !repayForm.amount) return;
    const amount = parseInt(repayForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    
    setLoans(prev => prev.map(l => l.id === repayLoanTarget.id ? { ...l, paidAmount: l.paidAmount + amount } : l));
    
    if (repayLoanTarget.type === LoanType.BORROW) {
      addExpense(amount, repayForm.jarType, `Trả nợ: ${repayLoanTarget.lenderName}`, `Trả nợ ${repayLoanTarget.lenderName} ${amount}`);
    } else {
      addIncome(amount, `Thu hồi nợ: ${repayLoanTarget.lenderName}`, `Thu hồi nợ từ ${repayLoanTarget.lenderName} ${amount}`);
    }
    
    setIsRepayModalOpen(false); setRepayLoanTarget(null); setRepayForm({ amount: '', jarType: JarType.NEC });
    setAdvice(`Đã ${repayLoanTarget.type === LoanType.BORROW ? 'thanh toán' : 'thu hồi'} ${amount.toLocaleString()}đ từ ${repayLoanTarget.lenderName}.`);
  };

  const openNewLoanModal = () => {
    setEditingLoanId(null);
    setLoanForm({ 
      type: LoanType.BORROW,
      category: LoanCategory.BANK, 
      lenderName: '', 
      principal: 0, 
      paidAmount: 0, 
      startDate: getTodayString(), 
      isUrgent: false 
    });
    setIsLoanModalOpen(true);
  };

  const openEditLoanModal = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setLoanForm({ ...loan });
    setIsLoanModalOpen(true);
  };

  const totalInJars = (Object.values(balances) as number[]).reduce((acc: number, curr: number) => acc + curr, 0);
  
  const totalBorrowed = loans.filter(l => l.type === LoanType.BORROW).reduce((acc, l) => acc + (l.principal - l.paidAmount), 0);
  const totalLent = loans.filter(l => l.type === LoanType.LEND).reduce((acc, l) => acc + (l.principal - l.paidAmount), 0);
  
  const netAssets = totalInJars - totalBorrowed + totalLent;

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesJar = filterJar === 'all' || t.jarType === filterJar;
      const tDate = new Date(t.timestamp); tDate.setHours(0,0,0,0);
      let matchesStartDate = filterStartDate ? tDate >= new Date(filterStartDate) : true;
      let matchesEndDate = filterEndDate ? tDate <= new Date(filterEndDate) : true;
      return matchesType && matchesJar && matchesStartDate && matchesEndDate;
    });
  }, [transactions, filterType, filterJar, filterStartDate, filterEndDate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      {/* Top Account Header */}
      <div className="bg-white/70 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col leading-none">
              <span className="text-sm font-black tracking-tight text-slate-900 uppercase">FinAi</span>
              <span className="text-[7px] font-black text-indigo-600 uppercase tracking-[0.2em]">by Loong Lee</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-full transition-all text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-[10px] font-black uppercase tracking-tight hidden sm:inline">Xuất Excel</span>
            </button>
            
            <button onClick={() => setIsFeedbackModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-full transition-all text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              <span className="text-[10px] font-black uppercase tracking-tight hidden sm:inline">Góp ý</span>
            </button>

            <button onClick={handleDeepAnalysis} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-full transition-all text-indigo-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <span className="text-[10px] font-black uppercase tracking-tight hidden sm:inline">Phân tích</span>
            </button>

            {currentUser ? (
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-full transition-all border border-transparent hover:border-slate-100">
                  <img src={currentUser.avatarUrl} className="w-7 h-7 rounded-full bg-slate-100" alt="avatar" />
                  <span className="text-[10px] font-black text-slate-600 uppercase max-w-[80px] truncate">{currentUser.displayName}</span>
                  <svg className={`w-3 h-3 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden py-1 animate-in slide-in-from-top-2 duration-200">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">🏃 Thoát</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }} className="text-[10px] font-black uppercase bg-indigo-600 text-white px-4 py-1.5 rounded-full transition-transform active:scale-95 shadow-md shadow-indigo-100">Đăng nhập</button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Total Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-0.5">Tiền hũ</p>
            <h3 className="text-lg font-black text-slate-800">{totalInJars.toLocaleString()}đ</h3>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-0.5">Tổng nợ (Vay)</p>
            <h3 className="text-lg font-black text-red-500">{totalBorrowed.toLocaleString()}đ</h3>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-0.5">Tiền cho vay</p>
            <h3 className="text-lg font-black text-emerald-500">{totalLent.toLocaleString()}đ</h3>
          </div>
          <div className="bg-indigo-600 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md">
            <p className="text-indigo-100 text-[9px] font-black uppercase tracking-wider mb-0.5">Tài sản ròng</p>
            <h3 className="text-lg font-black text-white">{netAssets.toLocaleString()}đ</h3>
          </div>
        </section>

        {/* AI Advice Banner */}
        <section className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="text-3xl shrink-0">🤖</div>
          <p className="text-[12px] font-medium italic text-slate-600 leading-relaxed">"{(currentUser ? `Chào ${currentUser.displayName}! ` : '') + advice}"</p>
        </section>

        {/* Jars Visuals */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.values(JarType).map(type => (
              <JarVisual key={type} jar={JAR_CONFIG[type]} balance={balances[type]} />
            ))}
          </div>
        </section>

        {/* Manual Transaction Form */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest"><span className="text-lg">📝</span> Ghi chép thủ công</h3>
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Loại giao dịch</label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button type="button" onClick={() => setManualType('expense')} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all ${manualType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>CHI</button>
                    <button type="button" onClick={() => setManualType('income')} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all ${manualType === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>THU</button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Ngày (DD/MM/YY)</label>
                  <input required type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Số tiền (đ)</label>
                  <input required type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Nội dung</label>
                  <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Tên khoản thu/chi" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Phân loại hũ</label>
                  {manualType === 'expense' ? (
                    <select value={manualJar} onChange={e => setManualJar(e.target.value as JarType)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 h-[40px]">
                      {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {JAR_CONFIG[type].name}</option>)}
                    </select>
                  ) : (
                    <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black text-center border border-indigo-100 h-[40px] flex items-center justify-center">Tự động phân bổ 6 hũ</div>
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Ghi chú thêm</label>
                  <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="Mô tả chi tiết..." className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="space-y-4 flex flex-col items-center">
                 <div className="w-full">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 text-center">Ảnh đính kèm</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all overflow-hidden relative group"
                    >
                      {manualImage ? (
                        <>
                          <img src={manualImage} alt="receipt" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-[10px] font-black uppercase">Đổi ảnh</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl mb-1">📷</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Tải ảnh biên lai</span>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'manual')} className="hidden" />
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white text-[10px] font-black uppercase py-4 rounded-xl shadow-lg shadow-indigo-100 active:scale-95 transition-all mt-auto">Lưu giao dịch</button>
              </div>
            </div>
          </form>
        </section>

        {/* Chart and History */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm min-h-[500px]">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 uppercase text-[10px] tracking-widest"><span className="text-lg">📊</span> Phân tích thu chi (7 ngày)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-[500px] flex flex-col">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 uppercase text-[10px] tracking-widest"><span className="text-lg">📜</span> Lịch sử giao dịch</h3>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="all">Loại: Tất cả</option>
                    <option value="income">Thu nhập</option>
                    <option value="expense">Chi tiêu</option>
                  </select>
                  <select value={filterJar} onChange={e => setFilterJar(e.target.value as any)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="all">Hũ: Tất cả</option>
                    {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {JAR_CONFIG[type].name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase ml-1">Từ (DD/MM/YY)</span>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase ml-1">Đến (DD/MM/YY)</span>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredTransactions.length === 0 ? <div className="py-12 text-center text-slate-300 italic text-xs">Không tìm thấy giao dịch nào.</div> : filteredTransactions.map(t => (
                    <div key={t.id} className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {t.type === 'income' ? '💰' : JAR_CONFIG[t.jarType!]?.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="text-xs font-bold text-slate-700">{t.description}</p>
                             {t.imageUrl && <span className="text-[10px] grayscale hover:grayscale-0 cursor-pointer" title="Có ảnh đính kèm">🖼️</span>}
                          </div>
                          <p className="text-[8px] text-slate-400 font-bold uppercase">{formatDateDisplay(t.timestamp)} {t.jarType && `• ${JAR_CONFIG[t.jarType].name}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-black ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}đ</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
           </div>
        </section>

        {/* Loans Section */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest"><span className="text-lg">📉</span> Quản lý vay nợ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.length === 0 ? <div className="col-span-2 py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 italic text-xs">Chưa ghi nhận khoản vay/nợ nào.</div> : loans.map(loan => {
                const remaining = loan.principal - loan.paidAmount;
                const progress = (loan.paidAmount / loan.principal) * 100;
                const isBorrow = loan.type === LoanType.BORROW;
                return (
                  <div key={loan.id} className={`p-4 rounded-2xl border transition-all ${loan.isUrgent ? 'border-orange-100 bg-orange-50/10' : 'border-slate-100 bg-white'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isBorrow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isBorrow ? '💸' : '🤝'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-bold text-slate-800 text-xs">{loan.lenderName}</h4>
                             <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${isBorrow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                               {isBorrow ? 'Tôi nợ' : 'Nợ tôi'}
                             </span>
                          </div>
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                            {isBorrow ? 'Cần trả' : 'Cần thu'}: {remaining.toLocaleString()}đ • {formatDateDisplay(loan.startDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditLoanModal(loan)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { setRepayLoanTarget(loan); setIsRepayModalOpen(true); }} className={`text-[9px] font-black uppercase ${isBorrow ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {isBorrow ? 'Thanh toán' : 'Thu hồi'}
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                       <div className={`${isBorrow ? 'bg-indigo-500' : 'bg-emerald-500'} h-full transition-all`} style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                );
              })
            }
          </div>
          <div className="flex justify-center pt-2">
            <button onClick={openNewLoanModal} className="bg-white border border-indigo-200 text-indigo-600 text-[10px] font-black px-6 py-2 rounded-full hover:bg-indigo-50 flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-95">
              <span className="text-base">➕</span> GHI VAY NỢ MỚI
            </button>
          </div>
        </section>
      </main>

      {/* --- Edit Transaction Modal --- */}
      {editingTransaction && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <span className="text-2xl">✏️</span> Sửa giao dịch
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Loại giao dịch</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 h-[52px]">
                  <button onClick={() => setEditType('expense')} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${editType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>CHI TIÊU</button>
                  <button onClick={() => setEditType('income')} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${editType === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>THU NHẬP</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Số tiền (đ)</label>
                  <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Ngày (DD/MM/YY)</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Nội dung</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {editType === 'expense' && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Phân loại hũ</label>
                  <select value={editJarType} onChange={e => setEditJarType(e.target.value as JarType)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none">
                    {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {JAR_CONFIG[type].name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Ảnh đính kèm</label>
                  <div 
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-full h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
                  >
                    {editImage ? (
                      <img src={editImage} alt="edit-receipt" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl opacity-30">📷</span>
                    )}
                  </div>
                  <input ref={editFileInputRef} type="file" accept="image/*" onChange={(e) => handleImageChange(e, 'edit')} className="hidden" />
                </div>
                {editImage && (
                  <button onClick={() => setEditImage(null)} className="mb-2 p-2 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-100">Xóa ảnh</button>
                )}
              </div>

              <div className="flex gap-3 pt-6">
                <button onClick={() => setEditingTransaction(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 rounded-2xl">Hủy</button>
                <button onClick={handleManualSave} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs tracking-widest active:scale-95 transition-all">Cập nhật</button>
              </div>
            </div>
            <button onClick={() => setEditingTransaction(null)} className="absolute top-8 right-8 text-slate-300">✕</button>
          </div>
        </div>
      )}

      {/* --- Feedback Modal --- */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <span className="text-2xl">💬</span> Góp ý ứng dụng
              </h3>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="p-1 hover:bg-slate-50 rounded-full transition-colors text-slate-300 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Tên người góp ý</label>
                <input required type="text" value={feedbackName} onChange={e => setFeedbackName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nhập tên của bạn" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Số điện thoại</label>
                <input type="tel" value={feedbackPhone} onChange={e => setFeedbackPhone(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Số điện thoại liên hệ" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Nội dung góp ý</label>
                <textarea required value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} rows={4} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Hãy cho chúng tôi biết cảm nghĩ hoặc yêu cầu tính năng mới..." />
              </div>
              
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs tracking-widest hover:bg-indigo-700 active:scale-95 transition-all mt-4">
                Gửi góp ý
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- AI Analysis Modal (Deep Analysis) --- */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl h-[85vh] flex flex-col p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <span className="text-2xl">📑</span> Báo cáo Sức khỏe Tài chính
              </h3>
              <button onClick={() => setIsAnalysisModalOpen(false)} className="p-1 hover:bg-slate-50 rounded-full transition-colors text-slate-300 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 text-center py-12">
                   <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-xl">🤖</div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Đang phân tích dữ liệu...</p>
                      <p className="text-xs text-slate-400 italic">"Chuyên gia AI đang xem lại lịch sử chi tiêu của bạn để đưa ra lời khuyên tốt nhất."</p>
                   </div>
                </div>
              ) : (
                <div className="prose prose-slate prose-sm max-w-none">
                  <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 mb-6">
                     <p className="text-[10px] font-black text-indigo-500 uppercase mb-2 tracking-[0.2em]">Lời chào từ chuyên gia</p>
                     <p className="text-slate-700 leading-relaxed font-medium">Chào {currentUser?.displayName || 'bạn'}, tôi đã hoàn tất việc kiểm tra các hũ tài chính của bạn. Dưới đây là lộ trình tối ưu để bạn sớm đạt được tự do tài chính.</p>
                  </div>
                  <div className="whitespace-pre-wrap text-slate-600 text-xs leading-relaxed font-medium space-y-4">
                    {deepAnalysisResult}
                  </div>
                </div>
              )}
            </div>
            
            {!isAnalyzing && (
              <div className="pt-6 border-t border-slate-100 flex justify-center">
                <button onClick={() => setIsAnalysisModalOpen(false)} className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-lg shadow-indigo-100 active:scale-95 transition-all">Tôi đã hiểu</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Auth Modal --- */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 relative">
            <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">{authMode === 'login' ? '🔑 Đăng nhập' : '📝 Đăng ký'}</h2>
            <form onSubmit={handleAuth} className="space-y-4 mt-6">
              {authMode === 'register' && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Tên hiển thị</label>
                  <input type="text" value={authName} onChange={e => setAuthName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nguyễn Văn A" />
                </div>
              )}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Email</label>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="name@email.com" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Mật khẩu</label>
                <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" />
              </div>
              {authError && <p className="text-[10px] text-red-500 font-bold text-center bg-red-50 p-2 rounded-lg">{authError}</p>}
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs tracking-widest hover:bg-indigo-700 active:scale-95 transition-all">
                {authMode === 'login' ? 'Vào ứng dụng' : 'Tạo tài khoản'}
              </button>
            </form>
            <div className="relative my-8"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300"><span className="bg-white px-2">Hoặc</span></div></div>
            <button onClick={loginWithGoogle} className="w-full py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-xs font-black text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">Tiếp tục với Gmail</button>
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }} className="w-full mt-6 text-[10px] font-black uppercase text-indigo-600 hover:underline">
              {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
            <button onClick={() => { setIsAuthModalOpen(false); resetAuthFields(); }} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* --- Loan Modal --- */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <span className="text-2xl">{editingLoanId ? '✏️' : '🏦'}</span>
              {editingLoanId ? 'Chỉnh sửa khoản vay nợ' : 'Thêm khoản vay nợ mới'}
            </h2>
            <form onSubmit={handleSaveLoan} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Loại hình</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 h-[52px]">
                  <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${loanForm.type === LoanType.BORROW ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>Tôi Vay (Thu vào)</button>
                  <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${loanForm.type === LoanType.LEND ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Cho Vay (Chi ra)</button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">{loanForm.type === LoanType.BORROW ? 'Chủ nợ / Ngân hàng' : 'Người vay'}</label>
                <input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ví dụ: Techcombank, Anh Tú..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Ngày (DD/MM/YY)</label>
                  <input required type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Phân loại</label>
                  <select value={loanForm.category} onChange={e => setLoanForm({...loanForm, category: e.target.value as LoanCategory})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none">
                    <option value={LoanCategory.BANK}>🏛️ Ngân hàng</option>
                    <option value={LoanCategory.PERSONAL}>👤 Cá nhân</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Số tiền gốc (đ)</label>
                  <input required type="number" value={loanForm.principal} onChange={e => setLoanForm({...loanForm, principal: Number(e.target.value)})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">{loanForm.type === LoanType.BORROW ? 'Đã trả' : 'Đã thu hồi'} (đ)</label>
                  <input type="number" value={loanForm.paidAmount} onChange={e => setLoanForm({...loanForm, paidAmount: Number(e.target.value)})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Độ ưu tiên</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 h-[52px]">
                  <button type="button" onClick={() => setLoanForm({...loanForm, isUrgent: false})} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${!loanForm.isUrgent ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400'}`}>Bình thường</button>
                  <button type="button" onClick={() => setLoanForm({...loanForm, isUrgent: true})} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${loanForm.isUrgent ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400'}`}>Gấp 🔥</button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsLoanModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 rounded-2xl">Hủy</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs tracking-widest hover:bg-indigo-700 active:scale-95 transition-all">Lưu khoản vay nợ</button>
              </div>
            </form>
            <button onClick={() => setIsLoanModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600">✕</button>
          </div>
        </div>
      )}

      {/* --- Repay Modal --- */}
      {isRepayModalOpen && repayLoanTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
              <span className="text-xl">💳</span> {repayLoanTarget.type === LoanType.BORROW ? 'Thanh toán cho' : 'Thu hồi từ'} {repayLoanTarget.lenderName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Số tiền (đ)</label>
                <input type="number" value={repayForm.amount} onChange={e => setRepayForm({...repayForm, amount: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">{repayLoanTarget.type === LoanType.BORROW ? 'Lấy từ hũ' : 'Thu vào hũ'}</label>
                <select value={repayForm.jarType} onChange={e => setRepayForm({...repayForm, jarType: e.target.value as JarType})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none">
                  {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {JAR_CONFIG[type].name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsRepayModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400">Hủy</button>
                <button onClick={handleRepayment} className="flex-1 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all">Xác nhận</button>
              </div>
            </div>
            <button onClick={() => setIsRepayModalOpen(false)} className="absolute top-6 right-6 text-slate-300">✕</button>
          </div>
        </div>
      )}

      {/* AI Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-30 shadow-2xl">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleProcessInput} className="flex items-center gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Nhập: 'Lương 20tr' hoặc 'Cơm trưa 50k'..." className="flex-1 bg-slate-100 border-none rounded-full px-6 py-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 shadow-inner" />
            <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white rounded-full p-4 shadow-lg min-w-[56px] flex items-center justify-center transition-all active:scale-95">
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
