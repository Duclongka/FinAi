
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const EXCHANGE_RATES = {
  VND: 1,
  USD: 1 / 25400,
  JPY: 1 / 168,
};

const formatAmountUnits = (amount: number, currency: string): string => {
  if (!amount || amount <= 0) return '';
  if (currency === 'VND') {
    const ty = Math.floor(amount / 1000000000);
    const trieu = Math.floor((amount % 1000000000) / 1000000);
    const ngan = Math.floor((amount % 1000000) / 1000);
    const dong = Math.floor(amount % 1000);
    let res = '';
    if (ty > 0) res += `${ty}tỷ `;
    if (trieu > 0) res += `${trieu}tr `;
    if (ngan > 0) res += `${ngan}k `;
    if (dong > 0) res += `${dong}đ`;
    return res.trim();
  } else if (currency === 'JPY') {
    const man = Math.floor(amount / 10000);
    const sen = Math.floor((amount % 10000) / 1000);
    const yen = Math.floor(amount % 1000);
    let res = '';
    if (man > 0) res += `${man}m `;
    if (sen > 0) res += `${sen}s `;
    if (yen > 0) res += `${yen}y`;
    return res.trim();
  }
  return '';
};

const formatDots = (val: string) => {
  if (!val) return "";
  const cleaned = val.toString().replace(/[^0-9]/g, "");
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const TRANSLATIONS = {
  vi: {
    appTitle: "FINAI",
    stats_jars: "Tiền hũ",
    stats_debt: "Nợ phải trả",
    stats_lent: "Đang cho vay",
    stats_net: "Tài sản ròng",
    advice_title: "Lời khuyên từ chuyên gia",
    chart_title: "BIỂU ĐỒ THU CHI",
    chart_week: "Tuần",
    chart_month: "Tháng",
    chart_year: "Năm",
    manual_title: "GHI CHÉP THỦ CÔNG",
    manual_edit: "ĐANG SỬA GIAO DỊCH",
    manual_cancel: "HỦY",
    manual_type: "Loại giao dịch",
    manual_expense: "CHI TIÊU",
    manual_income: "THU NHẬP",
    manual_amount: "Số tiền",
    manual_desc: "Nội dung",
    manual_jar_img: "Phân bổ & Hình ảnh",
    manual_allocation_only: "Phân bổ",
    manual_date_label: "Ngày tháng",
    manual_auto: "✨ Tự động phân bổ 6 hũ",
    manual_save: "LƯU GIAO DỊCH",
    manual_update: "LƯU THAY ĐỔI",
    history_title: "LỊCH SỬ GIAO DỊCH",
    history_filter: "BỘ LỌC",
    history_type: "Loại",
    history_jar: "Hũ",
    history_date: "Ngày",
    history_all: "TẤT CẢ",
    history_inc_only: "Chỉ Thu",
    history_exp_only: "Chỉ Chi",
    history_more: "Xem thêm ↓",
    history_empty: "Danh sách trống",
    loan_title: "QUẢN LÝ VAY NỢ",
    loan_new: "GHI VAY NỢ MỚI",
    loan_edit: "SỬA KHOẢN VAY",
    loan_pay: "THANH TOÁN",
    loan_recover: "THU HỒI",
    loan_i_owe: "TÔI NỢ",
    loan_owes_me: "NỢ TÔI",
    loan_rem: "Còn",
    loan_paid: "Đã trả",
    loan_partner: "ĐỐI TÁC",
    loan_principal: "TIỀN GỐC (VND)",
    loan_paid_label: "ĐÃ TRẢ (VND)",
    loan_jar_label: "HŨ LIÊN QUAN",
    settings_title: "CÀI ĐẶT ỨNG DỤNG",
    settings_data: "DỮ LIỆU",
    settings_data_export: "XUẤT DỮ LIỆU CSV",
    settings_data_import: "NHẬP DỮ LIỆU (AI)",
    settings_data_reset: "XÓA TẤT CẢ DỮ LIỆU",
    settings_info: "TIN",
    settings_connect: "HỖ TRỢ",
    settings_policy: "PHÁP LÝ",
    settings_guide: "HDSD",
    settings_app: "CÀI ĐẶT",
    currency: "TIỀN TỆ",
    language: "NGÔN NGỮ",
    lang_vi: "Tiếng Việt",
    lang_en: "Tiếng Anh",
    lang_ja: "Tiếng Nhật",
    user_label: "Cài đặt ứng dụng",
    ai_placeholder: "Nhập giao dịch bằng AI (vd: Sáng ăn phở 50k hũ thiết yếu)...",
    jars: {
      NEC: { name: "Thiết yếu", desc: "Chi tiêu cần thiết hàng tháng (thuê nhà, ăn uống...)" },
      LTS: { name: "Tiết kiệm dài hạn", desc: "Dành cho mục tiêu lớn (mua nhà, xe, du lịch...)" },
      EDU: { name: "Giáo dục", desc: "Đầu tư vào tri thức và kỹ năng bản thân." },
      PLAY: { name: "Hưởng thụ", desc: "Giải trí, mua sắm, tận hưởng cuộc sống." },
      FFA: { name: "Đầu tư tài chính", desc: "Tạo thu nhập thụ động, tự do tài chính." },
      GIVE: { name: "Cho đi", desc: "Ủng hộ từ thiện, giúp đỡ người thân." }
    }
  }
};

const App: React.FC = () => {
  const APP_VERSION = "v4.5.6";
  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const defaultRatios: Record<JarType, number> = {
    [JarType.NEC]: 0.55, [JarType.LTS]: 0.10, [JarType.EDU]: 0.10,
    [JarType.PLAY]: 0.10, [JarType.FFA]: 0.10, [JarType.GIVE]: 0.05,
  };

  const defaultSettings: AppSettings = {
    pin: '', pinEnabled: false, faceIdEnabled: false, currency: 'VND',
    language: 'vi', notificationsEnabled: true, notificationTime: '18:00',
    jarRatios: defaultRatios
  };

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

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info' | 'danger'} | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'export' | 'info' | 'connect' | 'policy' | 'guide' | 'app'>('app');
  
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [historyJarFilter, setHistoryJarFilter] = useState<JarType | 'all'>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>(''); 

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualJar, setManualJar] = useState<JarType | 'AUTO'>(JarType.NEC);
  const [manualDate, setManualDate] = useState(getTodayString());
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanPrincipalStr, setLoanPrincipalStr] = useState('');
  const [loanPaidAmountStr, setLoanPaidAmountStr] = useState('');
  const [loanForm, setLoanForm] = useState<Omit<Partial<Loan>, 'loanJar'> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO'
  });

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvice, setAiAdvice] = useState<string>('Chào mừng bạn quay lại! Hãy tiếp tục duy trì kỷ luật chi tiêu nhé.');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);

  const aiInputRef = useRef<HTMLInputElement>(null);
  const manualEntryRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.vi;

  useEffect(() => localStorage.setItem('jars_balances', JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem('jars_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('jars_loans', JSON.stringify(loans)), [loans]);
  useEffect(() => localStorage.setItem('jars_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('jars_user', JSON.stringify(currentUser));
      setIsAuthModalOpen(false);
    } else {
      setIsAuthModalOpen(true);
    }
  }, [currentUser]);

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const debt = loans.filter(l => l.type === LoanType.BORROW).reduce((a, l) => a + (l.principal - l.paidAmount), 0);
    const lent = loans.filter(l => l.type === LoanType.LEND).reduce((a, l) => a + (l.principal - l.paidAmount), 0);
    const net = Object.values(balances).reduce((a, b) => a + b, 0) + lent - debt;
    return { debt, lent, net };
  }, [balances, loans]);

  // Fetch AI Advice when financial state changes
  useEffect(() => {
    if (!currentUser) return;
    const fetchAdvice = async () => {
      setIsAdviceLoading(true);
      const advice = await getFinancialAdvice(balances, stats, currentUser);
      setAiAdvice(advice);
      setIsAdviceLoading(false);
    };
    fetchAdvice();
  }, [balances, stats, currentUser]);

  const convertValue = (valInVnd: number) => valInVnd * EXCHANGE_RATES[settings.currency];

  const parseFormattedNumber = (str: string) => {
    const cleaned = str.toString().replace(/[^0-9]/g, "");
    const inputVal = parseFloat(cleaned) || 0;
    return inputVal / EXCHANGE_RATES[settings.currency];
  };

  const showToast = (msg: string, type: 'success' | 'info' | 'danger' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatCurrency = (valInVnd: number) => {
    const val = convertValue(valInVnd);
    const symbols = { 'VND': 'đ', 'JPY': '¥', 'USD': '$' };
    const decimals = settings.currency === 'USD' ? 2 : 0;
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return settings.currency === 'USD' ? `${symbols.USD}${formatted}` : `${formatted}${symbols[settings.currency]}`;
  };

  const updateBalances = (prevTrans: Transaction | null, nextTrans: Transaction | null) => {
    setBalances(prevBalances => {
      const nb = { ...prevBalances };
      const ratios = settings.jarRatios;
      if (prevTrans) {
        const factor = prevTrans.type === 'income' ? -1 : 1;
        if (prevTrans.jarType) nb[prevTrans.jarType] += prevTrans.amount * factor;
        else Object.values(JarType).forEach(type => { nb[type as JarType] += prevTrans.amount * ratios[type as JarType] * factor; });
      }
      if (nextTrans) {
        const factor = nextTrans.type === 'income' ? 1 : -1;
        if (nextTrans.jarType) nb[nextTrans.jarType] += nextTrans.amount * factor;
        else Object.values(JarType).forEach(type => { nb[type as JarType] += nextTrans.amount * ratios[type as JarType] * factor; });
      }
      return nb;
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(manualAmount);
    if (amountInVnd <= 0 || !manualDesc.trim()) return;
    const newTrans: Transaction = {
      id: editingTransactionId || Date.now().toString(), type: manualType,
      amount: amountInVnd, description: manualDesc, 
      jarType: manualJar === 'AUTO' ? undefined : manualJar,
      timestamp: new Date(manualDate).getTime(),
    };
    if (editingTransactionId) {
      const old = transactions.find(item => item.id === editingTransactionId) || null;
      setTransactions(prev => prev.map(item => item.id === editingTransactionId ? newTrans : item));
      updateBalances(old, newTrans);
      setEditingTransactionId(null);
    } else {
      setTransactions(prev => [newTrans, ...prev]);
      updateBalances(null, newTrans);
    }
    setManualAmount(''); 
    setManualDesc(''); 
    setManualJar(manualType === 'expense' ? JarType.NEC : 'AUTO');
    setManualDate(getTodayString());
    setSelectedTxId(null); 
    showToast("Đã lưu!");
  };

  const handleProcessInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const result = await analyzeTransactionText(input, transactions);
      if (result && result.action === 'create' && (result.amount || 0) > 0) {
        const isExpense = result.isExpense !== false;
        const finalAmountVnd = result.amount! / EXCHANGE_RATES[settings.currency];
        const newTrans: Transaction = {
          id: Date.now().toString(), type: isExpense ? 'expense' : 'income',
          amount: finalAmountVnd, description: result.description || input,
          jarType: isExpense ? (result.jarType || JarType.NEC) : undefined,
          timestamp: Date.now(), rawText: input
        };
        setTransactions(prev => [newTrans, ...prev]);
        updateBalances(null, newTrans);
        showToast("Đã thêm thành công!");
      } else showToast("Không nhận diện được giao dịch.", "info");
    } catch (e) { showToast("AI Error.", "danger"); }
    finally { setIsLoading(false); setInput(''); }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(transferAmount);
    if (amountInVnd <= 0 || amountInVnd > balances[transferFrom]) return showToast("Số dư không đủ.", "danger");
    setBalances(prev => {
      const nb = { ...prev };
      nb[transferFrom] -= amountInVnd;
      nb[transferTo] += amountInVnd;
      return nb;
    });
    const tx1: Transaction = { id: Date.now().toString(), type: 'expense', amount: amountInVnd, description: `Chuyển: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferFrom, timestamp: Date.now() };
    const tx2: Transaction = { id: (Date.now()+1).toString(), type: 'income', amount: amountInVnd, description: `Nhận: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferTo, timestamp: Date.now() };
    setTransactions(p => [tx1, tx2, ...p]);
    setIsTransferModalOpen(false);
    setTransferAmount('');
    showToast("Đã điều chuyển!");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanPrincipalStr) return;
    const principalVnd = parseFormattedNumber(loanPrincipalStr);
    const paidAmountVnd = parseFormattedNumber(loanPaidAmountStr || '0');
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : (loanForm.loanJar as JarType);
    
    // Create a synthetic transaction to update balances based on principal
    // Borrow = income (money comes in), Lend = expense (money goes out)
    const syntheticTx: Transaction = {
        id: `loan_${editingLoanId || Date.now()}`,
        type: loanForm.type === LoanType.BORROW ? 'income' : 'expense',
        amount: principalVnd,
        description: `${loanForm.type === LoanType.BORROW ? 'Vay từ' : 'Cho vay đến'}: ${loanForm.lenderName}`,
        jarType: finalLoanJar,
        timestamp: Date.now(),
        loanId: editingLoanId || Date.now().toString()
    };

    if (editingLoanId) {
       const oldLoan = loans.find(l => l.id === editingLoanId);
       if (oldLoan) {
          // Reverse previous impact
          const oldSyntheticTx: Transaction = {
             id: `loan_${oldLoan.id}`,
             type: oldLoan.type === LoanType.BORROW ? 'income' : 'expense',
             amount: oldLoan.principal,
             description: `Reverse: ${oldLoan.lenderName}`,
             jarType: oldLoan.loanJar,
             timestamp: Date.now()
          };
          updateBalances(oldSyntheticTx, syntheticTx);
       }
       setLoans(p => p.map(l => l.id === editingLoanId ? { ...l, ...loanForm, principal: principalVnd, paidAmount: paidAmountVnd, loanJar: finalLoanJar } as Loan : l));
       setEditingLoanId(null);
       showToast("Cập nhật khoản vay và số dư thành công!");
    } else {
       const loanId = Date.now().toString();
       const newLoan: Loan = { ...loanForm as Loan, id: loanId, principal: principalVnd, paidAmount: paidAmountVnd, loanJar: finalLoanJar };
       setLoans(p => [newLoan, ...p]);
       updateBalances(null, syntheticTx);
       showToast("Ghi nợ và phân bổ hũ thành công!");
    }
    setIsLoanModalOpen(false);
    setLoanPrincipalStr('');
    setLoanPaidAmountStr('');
    setLoanForm({ type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO' });
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      updateBalances(tx, null);
      setTransactions(p => p.filter(t => t.id !== id));
      showToast("Đã xóa giao dịch.");
      setSelectedTxId(null);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setManualType(tx.type);
    setManualAmount(formatDots((tx.amount * EXCHANGE_RATES[settings.currency]).toString()));
    setManualDesc(tx.description);
    setManualJar(tx.jarType || 'AUTO');
    setManualDate(new Date(tx.timestamp).toISOString().split('T')[0]);
    setSelectedTxId(null);
    manualEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleEditLoan = (loan: Loan) => {
     setEditingLoanId(loan.id);
     setLoanForm({ ...loan, loanJar: loan.loanJar || 'AUTO' });
     setLoanPrincipalStr(formatDots((loan.principal * EXCHANGE_RATES[settings.currency]).toString()));
     setLoanPaidAmountStr(formatDots((loan.paidAmount * EXCHANGE_RATES[settings.currency]).toString()));
     setIsLoanModalOpen(true);
  };

  const handleDeleteLoan = (id: string) => {
    const loan = loans.find(l => l.id === id);
    if (loan) {
        // Reverse balance impact
        const reverseTx: Transaction = {
            id: `del_loan_${loan.id}`,
            type: loan.type === LoanType.BORROW ? 'income' : 'expense',
            amount: loan.principal,
            description: `Delete loan reverse impact`,
            jarType: loan.loanJar,
            timestamp: Date.now()
        };
        updateBalances(reverseTx, null);
    }
    setLoans(p => p.filter(l => l.id !== id));
    showToast("Đã xóa khoản nợ và hoàn tác số dư.");
  };

  const handlePayLoan = (loan: Loan) => {
     setLoanForm({ ...loan, loanJar: loan.loanJar || 'AUTO' });
     setLoanPrincipalStr(formatDots((loan.principal * EXCHANGE_RATES[settings.currency]).toString()));
     setLoanPaidAmountStr(formatDots((loan.paidAmount * EXCHANGE_RATES[settings.currency]).toString()));
     setEditingLoanId(loan.id);
     setIsLoanModalOpen(true);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return showToast("Không có dữ liệu.");
    const header = "ID,Type,Amount (VND),Description,Jar,Date\n";
    const rows = transactions.map(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString();
      const jar = tx.jarType || "AUTO";
      return `${tx.id},${tx.type},${tx.amount},"${tx.description}",${jar},${date}`;
    }).join("\n");
    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `finai_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã xuất CSV!");
  };

  const handleResetData = () => {
    if (window.confirm("XÓA TOÀN BỘ DỮ LIỆU SẼ KHÔI PHỤC. TIẾP TỤC?")) {
      setTransactions([]);
      setBalances({ [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 });
      setLoans([]);
      localStorage.clear();
      showToast("Đã xóa hết dữ liệu.");
    }
  };

  const formatYAxis = (value: any): string => {
    const val = Number(value);
    if (settings.currency !== 'VND') return val.toString();
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'tr';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toString();
  };

  const chartData = useMemo(() => {
    const data: { name: string; Thu: number; Chi: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayT = transactions.filter(tx => new Date(tx.timestamp).toDateString() === d.toDateString());
      data.push({
        name: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        Thu: convertValue(dayT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
        Chi: convertValue(dayT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
      });
    }
    return data;
  }, [transactions, settings.currency]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.loanId) return false;
      const matchType = historyFilter === 'all' || tx.type === historyFilter;
      const matchJar = historyJarFilter === 'all' || tx.jarType === historyJarFilter;
      const matchDate = !historyDateFilter || new Date(tx.timestamp).toISOString().split('T')[0] === historyDateFilter;
      return matchType && matchJar && matchDate;
    }).slice(0, 50);
  }, [transactions, historyFilter, historyJarFilter, historyDateFilter]);

  const [onboardingForm, setOnboardingForm] = useState({ name: '', gender: 'male' as 'male' | 'female' });

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pt-32 pb-32 font-sans flex flex-col items-center">
      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'success' ? 'bg-indigo-600' : 'bg-slate-800'} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-2xl animate-in slide-in-from-top-4`}>
          {toast.msg}
        </div>
      )}

      {/* --- ONBOARDING MODAL --- */}
      {isAuthModalOpen && !currentUser && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-4xl shadow-xl shadow-indigo-200">✨</div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Chào mừng đến với FINAI</h1>
                <p className="text-xs font-medium text-slate-400">Hãy cho chúng tôi biết thông tin của bạn để bắt đầu hành trình tự do tài chính.</p>
              </div>
              
              <div className="w-full space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Họ và tên của bạn</label>
                  <input 
                    type="text" 
                    value={onboardingForm.name} 
                    onChange={e => setOnboardingForm({...onboardingForm, name: e.target.value})}
                    placeholder="Nhập tên..." 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Giới tính</label>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setOnboardingForm({...onboardingForm, gender: 'male'})}
                      className={`flex-1 py-4 rounded-3xl text-sm font-black transition-all ${onboardingForm.gender === 'male' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}
                    >
                      NAM
                    </button>
                    <button 
                      onClick={() => setOnboardingForm({...onboardingForm, gender: 'female'})}
                      className={`flex-1 py-4 rounded-3xl text-sm font-black transition-all ${onboardingForm.gender === 'female' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}
                    >
                      NỮ
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if (onboardingForm.name.trim()) {
                    setCurrentUser({
                      id: Date.now().toString(),
                      displayName: onboardingForm.name,
                      gender: onboardingForm.gender,
                      email: '',
                      provider: 'local'
                    });
                  }
                }}
                disabled={!onboardingForm.name.trim()}
                className="w-full py-5 bg-slate-900 text-white rounded-3xl text-sm font-black uppercase tracking-widest hover:bg-black active:scale-95 transition-all disabled:opacity-50"
              >
                BẮT ĐẦU NGAY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- AI INPUT BAR --- */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-indigo-100 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <form onSubmit={handleProcessInput} className="relative w-full">
            <input ref={aiInputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.ai_placeholder} className="w-full bg-slate-100 border-2 border-slate-200 rounded-full px-5 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-400" />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95">
              {isLoading ? <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨"}
            </button>
          </form>
          
          <div className="w-full mt-2 flex justify-center items-center gap-4 bg-slate-50/50 py-1.5 px-4 rounded-full border border-slate-100">
             <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em] flex items-center gap-1.5">
               <span className="opacity-40">👋</span> HI, <span className="text-slate-900 underline decoration-indigo-200 decoration-2 underline-offset-2">{currentUser?.displayName || 'BẠN'}</span>
             </div>
             <div className="w-[1px] h-3 bg-slate-200"></div>
             <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <span className="opacity-50">📅</span> {currentTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
             </div>
             <div className="w-[1px] h-3 bg-slate-200"></div>
             <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <span className="opacity-50">⏰</span> {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
             </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto px-4 space-y-8">
        {/* STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t.stats_jars, val: Object.values(balances).reduce((a, b) => a + b, 0), icon: '💰', colorClass: 'text-slate-900' }, 
            { label: t.stats_debt, val: stats.debt, icon: '📉', colorClass: 'text-blue-600' }, 
            { label: t.stats_lent, val: stats.lent, icon: '🤝', colorClass: 'text-red-600' }, 
            { label: t.stats_net, val: stats.net, icon: '💎', dark: true, colorClass: 'text-white' }
          ].map((s, i) => (
            <div key={i} className={`${s.dark ? 'bg-indigo-600 text-white' : 'bg-white'} p-4 rounded-2xl border-2 border-slate-100 shadow-md`}>
              <p className="text-[8px] font-black uppercase opacity-60 mb-1">{s.label}</p>
              <h3 className={`text-base font-black truncate ${s.colorClass}`}>{formatCurrency(s.val)}</h3>
            </div>
          ))}
        </section>

        {/* AI ADVICE SECTION */}
        <section className="bg-white p-5 rounded-[2.5rem] border-2 border-indigo-50 shadow-xl shadow-indigo-100/50 flex items-center gap-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-indigo-200 z-10">
            {isAdviceLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "🦉"}
          </div>
          <div className="space-y-1 z-10 flex-1">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{t.advice_title}</h4>
            <p className="text-[12px] font-bold text-slate-700 italic leading-relaxed">
              "{aiAdvice}"
            </p>
          </div>
        </section>

        {/* 6 JARS */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.values(JarType).map(type => (
            <JarVisual 
              key={type} 
              jar={JAR_CONFIG[type]} 
              balance={balances[type]} 
              currencySymbol={settings.currency === 'VND' ? 'đ' : '$'}
              convertValue={convertValue}
              onTransferClick={() => { setTransferFrom(type); setIsTransferModalOpen(true); }} 
            />
          ))}
        </section>

        {/* MANUAL ENTRY */}
        <section ref={manualEntryRef} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-xl scroll-mt-24">
          <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest mb-4">📝 {t.manual_title}</h3>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
             <div className="flex bg-slate-100 p-1 rounded-xl h-10">
                <button type="button" onClick={() => { setManualType('expense'); setManualJar(JarType.NEC); }} className={`flex-1 text-[9px] font-black rounded-lg ${manualType === 'expense' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>{t.manual_expense}</button>
                <button type="button" onClick={() => { setManualType('income'); setManualJar('AUTO'); }} className={`flex-1 text-[9px] font-black rounded-lg ${manualType === 'income' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>{t.manual_income}</button>
             </div>
             <div className="relative h-10">
                <input 
                  required 
                  type="text" 
                  value={manualAmount} 
                  onChange={e => setManualAmount(formatDots(e.target.value))} 
                  placeholder={`Số tiền (${settings.currency})`} 
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none h-full pr-24" 
                />
                <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 pointer-events-none">
                  {formatAmountUnits(parseFormattedNumber(manualAmount) * EXCHANGE_RATES[settings.currency], settings.currency)}
                </p>
             </div>
             <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Nội dung..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none h-10" />
             <select value={manualJar} onChange={e => setManualJar(e.target.value as any)} className="bg-slate-50 border-2 border-slate-200 rounded-xl px-2 text-[11px] font-bold outline-none h-10">
                <option value="AUTO">{t.manual_auto}</option>
                {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].name}</option>)}
             </select>
             <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-xs font-bold h-10" />
             <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-xl h-10 hover:bg-indigo-700 shadow-lg">{editingTransactionId ? t.manual_update : t.manual_save}</button>
                {editingTransactionId && (
                   <button type="button" onClick={() => { setEditingTransactionId(null); setManualAmount(''); setManualDesc(''); }} className="px-4 bg-slate-200 text-slate-500 text-[11px] font-black uppercase rounded-xl h-10">{t.manual_cancel}</button>
                )}
             </div>
          </form>
        </section>

        {/* LOAN MGMT */}
        <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl relative min-h-[160px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📉</span> {t.loan_title}</h3>
            <button onClick={() => { setEditingLoanId(null); setIsLoanModalOpen(true); }} className="px-3 py-1.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-full shadow-md hover:bg-indigo-700 active:scale-95 transition-all">
              <span>＋</span> {t.loan_new}
            </button>
          </div>
          {loans.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50 py-10">
               <p className="text-slate-400 italic text-[10px] font-bold">{t.history_empty}</p>
            </div>
          ) : (
            <div className="space-y-4">
               {loans.map(loan => {
                 const isCompleted = loan.paidAmount >= loan.principal;
                 const progress = Math.min(100, (loan.paidAmount / loan.principal) * 100);
                 const labelPaid = settings.language === 'vi' ? "Đã trả" : "Paid";
                 const labelRem = settings.language === 'vi' ? "Còn lại" : "Rem";
                 return (
                   <div 
                     key={loan.id} 
                     className="bg-slate-50 rounded-2xl border border-slate-100 p-3 group relative transition-all hover:border-indigo-400 hover:bg-white select-none overflow-hidden pb-8"
                   >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${loan.type === LoanType.BORROW ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {loan.type === LoanType.BORROW ? '💸' : '🤝'}
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-slate-800 uppercase">{loan.lenderName}</p>
                             <p className="text-[8px] font-bold text-slate-400">{loan.startDate}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {!isCompleted && (
                              <button 
                                onClick={() => handlePayLoan(loan)}
                                className={`px-2 py-1 text-[7px] font-black uppercase rounded-lg shadow-sm border ${loan.type === LoanType.BORROW ? 'bg-rose-600 text-white border-rose-700' : 'bg-emerald-600 text-white border-emerald-700'}`}
                              >
                                 {loan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}
                              </button>
                           )}
                           <div className="text-right">
                              <p className={`text-[10px] font-black ${isCompleted ? 'text-slate-400 line-through' : (loan.type === LoanType.BORROW ? 'text-rose-500' : 'text-emerald-600')}`}>
                                 {formatCurrency(loan.principal - loan.paidAmount)}
                              </p>
                           </div>
                        </div>
                      </div>

                      {/* Progress line */}
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                         <div 
                           className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-indigo-500' : (loan.type === LoanType.BORROW ? 'bg-rose-400' : 'bg-emerald-400')}`} 
                           style={{ width: `${progress}%` }} 
                         />
                      </div>
                      <div className="flex justify-between mt-1 px-1">
                         <span className="text-[7px] font-bold text-slate-400 uppercase">{labelPaid}: {progress.toFixed(0)}%</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase">{isCompleted ? 'Completed' : `${labelRem}: ${formatCurrency(loan.principal - loan.paidAmount)}`}</span>
                      </div>

                      {/* Smaller Action Buttons at bottom-center */}
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all z-20">
                         {!isCompleted && (
                            <button onClick={() => handleEditLoan(loan)} className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white shadow-sm border border-indigo-100 text-[10px]">✏️</button>
                         )}
                         <button 
                            onDoubleClick={() => handleDeleteLoan(loan.id)} 
                            className="w-6 h-6 bg-white text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white shadow-sm border border-rose-100 text-[10px]"
                         >🗑️</button>
                      </div>
                   </div>
                 );
               })}
            </div>
          )}
        </section>

        {/* CHART */}
        <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl h-[300px]">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">📊 {t.chart_title}</h3>
          <div className="h-full pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 9, fontWeight: 700 }} />
                <Tooltip />
                <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* TRANSACTION HISTORY */}
        <section className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-200 shadow-xl">
           <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📜</span>
              <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{t.history_title}</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="space-y-0.5">
                 <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_type}</label>
                 <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none h-8">
                    <option value="all">{t.history_all}</option>
                    <option value="income">{t.history_inc_only}</option>
                    <option value="expense">{t.history_exp_only}</option>
                 </select>
              </div>
              <div className="space-y-0.5">
                 <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_jar}</label>
                 <select value={historyJarFilter} onChange={e => setHistoryJarFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none h-8">
                    <option value="all">{t.history_all}</option>
                    {Object.values(JarType).map(jt => <option key={jt} value={jt}>{JAR_CONFIG[jt].name}</option>)}
                 </select>
              </div>
              <div className="space-y-0.5">
                 <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_date}</label>
                 <input type="date" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none h-8" />
              </div>
           </div>

           <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
              {filteredTransactions.length === 0 ? (
                 <p className="text-center py-6 text-[9px] font-bold text-slate-400 italic">Danh sách trống</p>
              ) : (
                filteredTransactions.map(tx => (
                  <div 
                    key={tx.id} 
                    className={`p-3 bg-slate-50/50 rounded-xl border transition-all cursor-default flex items-center justify-between group relative overflow-hidden select-none border-slate-100 hover:border-indigo-200 hover:bg-white`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {tx.type === 'income' ? '↑' : '↓'}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-800 line-clamp-1 leading-tight">{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[7px] font-black text-slate-400 uppercase">{new Date(tx.timestamp).toLocaleDateString()}</span>
                          {tx.jarType && <span className="text-[6px] font-black bg-slate-100 px-1 py-0.5 rounded text-slate-500 uppercase">{JAR_CONFIG[tx.jarType].name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <p className={`text-[10px] font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                         {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                       </p>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all ml-1">
                          <button onClick={() => handleEditTransaction(tx)} className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm text-[9px]">✏️</button>
                          <button onDoubleClick={() => handleDeleteTransaction(tx.id)} className="w-6 h-6 bg-red-50 text-red-600 rounded-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm text-[9px]" title="Double click to delete">🗑️</button>
                       </div>
                    </div>
                  </div>
                ))
              )}
           </div>
        </section>
      </main>

      {/* --- FOOTER MENU --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-indigo-100/50 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-2">
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-black text-slate-900 uppercase">FINAI</span>
            <span className="text-[7px] font-black text-indigo-600 uppercase tracking-widest">{APP_VERSION}</span>
          </div>
          
          <button 
            onClick={() => aiInputRef.current?.focus()} 
            className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(79,70,229,0.5)] hover:scale-110 active:scale-95 transition-all -translate-y-4 ring-4 ring-white"
          >
            <span className="text-3xl font-light">＋</span>
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-500 rounded-xl border border-slate-200">
            <div className="w-4 h-0.5 bg-slate-400 rounded-full"></div>
            <div className="w-4 h-0.5 bg-slate-400 rounded-full"></div>
            <div className="w-4 h-0.5 bg-slate-400 rounded-full"></div>
          </button>
        </div>
      </div>

      {/* --- SIDEBAR DRAWER --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative ml-auto h-full w-full max-sm:max-w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t.settings_title}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {settingsTab === 'app' && (
                <div className="space-y-10">
                   <div className="space-y-4">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.currency}</label>
                      <div className="bg-slate-50 p-1 rounded-2xl border-2 border-slate-200 flex gap-1">
                        {['VND', 'JPY', 'USD'].map(curr => (
                          <button key={curr} onClick={() => setSettings({...settings, currency: curr as any})} className={`flex-1 py-2.5 text-[9px] font-black rounded-xl transition-all ${settings.currency === curr ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{curr}</button>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.language}</label>
                      <div className="bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-200 flex flex-col gap-1">
                        {['Tiếng Việt', 'Tiếng Anh', 'Tiếng Nhật'].map((lang, idx) => {
                          const code = ['vi', 'en', 'ja'][idx] as 'vi' | 'en' | 'ja';
                          return (
                            <button key={lang} onClick={() => setSettings({...settings, language: code})} className={`w-full py-3 text-[9px] font-bold rounded-xl transition-all text-center ${settings.language === code ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{lang}</button>
                          );
                        })}
                      </div>
                   </div>
                </div>
              )}

              {settingsTab === 'policy' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-[12px] font-black text-red-600 uppercase text-center mb-6">CHÍNH SÁCH BẢO MẬT & MIỄN TRỪ TRÁCH NHIỆM</h3>
                  <div className="space-y-6 text-[10px] leading-relaxed">
                    <p><strong>1. Quyền riêng tư tuyệt đối:</strong> Ứng dụng FINAI cam kết không lưu trữ bất kỳ dữ liệu tài chính nào của người dùng trên máy chủ (server). Mọi dữ liệu đều được lưu trữ trực tiếp trên thiết bị cá nhân (LocalStorage/Browser Storage) của chính bạn.</p>
                    <p><strong>2. An toàn mạng:</strong> Chúng tôi tuân thủ nghiêm ngặt Luật An toàn thông tin mạng và Luật An ninh mạng Việt Nam. Vì dữ liệu không được tải lên mạng, nguy cơ rò rỉ dữ liệu cá nhân từ hệ thống là bằng 0.</p>
                    <p><strong>3. Trách nhiệm người dùng:</strong> Do đặc thù lưu trữ tại chỗ, người dùng có trách nhiệm tự bảo mật thiết bị truy cập và sao lưu dữ liệu (qua tính năng Export CSV).</p>
                    <p><strong>4. Miễn trừ trách nhiệm:</strong> FINAI không chịu trách nhiệm cho bất kỳ mất mát dữ liệu nào do lỗi thiết bị, xóa bộ nhớ trình duyệt, hoặc hành xâm nhập trái phép vào thiết bị của người dùng.</p>
                    <p className="text-red-500 font-bold italic pt-4 border-t border-slate-100">* DỰA TRÊN LUẬT AN NINH MẠNG VIỆT NAM 2018 VÀ NGHỊ ĐỊNH 13/2023/NĐ-CP VỀ BẢO VỆ DỮ LIỆU CÁ NHÂN.</p>
                  </div>
                </div>
              )}

              {settingsTab === 'guide' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                  <h3 className="text-[12px] font-black text-indigo-600 uppercase text-center">HƯỚNG DẪN SỬ DỤNG</h3>
                  <div className="space-y-4">
                    {[
                      { num: "1", text: "Sử dụng AI: Nhập nhanh giao dịch tại thanh tìm kiếm trên cùng. (Ví dụ: \"Sáng ăn phở 50k hũ thiết yếu\")" },
                      { num: "2", text: "Quy tắc 6 Hũ: Hệ thống tự động chia thu nhập của bạn theo tỉ lệ (55%, 10%, 10%, 10%, 10%, 5%)." },
                      { num: "3", text: "Vay nợ: Quản lý các khoản nợ phải trả và nợ thu hồi một cách minh bạch." },
                      { num: "4", text: "Dữ liệu: Mọi thông tin lưu trên máy bạn. Hãy xuất CSV định kỳ để sao lưu!" }
                    ].map(item => (
                      <div key={item.num} className="flex gap-4 items-start bg-slate-50 p-4 rounded-2xl">
                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0">{item.num}</span>
                        <p className="text-[10px] font-bold text-slate-600 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-[2rem] p-6 text-center space-y-4 mt-8">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">VIDEO TÀI LIỆU THAM KHẢO</p>
                    <p className="text-[9px] font-bold text-slate-500">Tìm hiểu chi tiết hơn về quy tắc 6 chiếc lọ để quản lý tài chính cá nhân thông minh qua video sau:</p>
                    <button 
                      onClick={() => window.open('https://fb.watch/EFXzA_Mhre/', '_blank')}
                      className="w-full py-3 bg-white border border-emerald-200 rounded-xl text-[9px] font-black text-emerald-600 shadow-sm flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-emerald-50 transition-colors"
                    >
                      🎬 XEM VIDEO QUY TẮC 6 LỌ
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'info' && (
                <div className="flex flex-col items-center py-6 space-y-4">
                   <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-indigo-200">✨</div>
                   <div className="text-center space-y-1">
                      <h2 className="text-lg font-black text-slate-800 tracking-tighter">FINAI</h2>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Smart financial AI<br/>6 Jars Method</p>
                   </div>
                   <div className="w-full border-t border-slate-100 my-2"></div>
                   <div className="text-center">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">THIẾT KẾ BỞI LOONG LEE</p>
                      <p className="text-[8px] font-bold text-slate-400 italic">Version {APP_VERSION}</p>
                   </div>
                </div>
              )}

              {settingsTab === 'connect' && (
                <div className="space-y-6">
                   <div className="flex flex-col items-center gap-3 mb-4">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-2xl shadow-sm">📬</div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.settings_connect}</p>
                   </div>
                   <div className="grid grid-cols-1 gap-2">
                      <a href="https://www.facebook.com/duclongka" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100 group transition-all hover:bg-blue-100/50">
                         <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-base shadow-sm group-hover:scale-110 transition-transform font-black">f</div>
                         <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">KẾT NỐI FACEBOOK</span>
                      </a>
                      <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                         <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-base shadow-sm font-black">💬</div>
                         <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">ZALO HỖ TRỢ</span>
                            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">0964.855.899</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                         <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-base shadow-sm font-black">✉️</div>
                         <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">EMAIL HỖ TRỢ</span>
                            <span className="text-[9px] font-black text-indigo-800 tracking-wider">longld@itsupro.org</span>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {settingsTab === 'export' && (
                <div className="space-y-6 pt-5">
                   <button onClick={exportToCSV} className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-[2rem] shadow-lg flex items-center justify-center gap-2"><span>📤</span> {t.settings_data_export}</button>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-[2rem] shadow-lg flex items-center justify-center gap-2"><span>📥</span> {t.settings_data_import}</button>
                   <input type="file" hidden ref={fileInputRef} />
                   <button onClick={handleResetData} className="w-full py-4 bg-red-600 text-white text-[10px] font-black uppercase rounded-[2rem] shadow-lg flex items-center justify-center gap-2"><span>⚠️</span> {t.settings_data_reset}</button>
                </div>
              )}
            </div>

            <div className="p-3 border-t grid grid-cols-6 items-center justify-around bg-slate-50">
              {[ { id: 'app', icon: '⚙️', label: 'CÀI ĐẶT' }, { id: 'export', icon: '📁', label: 'DỮ LIỆU' }, { id: 'info', icon: 'ℹ️', label: 'TIN' }, { id: 'connect', icon: '💬', label: t.settings_connect }, { id: 'policy', icon: '🛡️', label: 'PHÁP LÝ' }, { id: 'guide', icon: '📖', label: 'HDSD' } ].map(tab => (
                <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-1 py-1 rounded-xl transition-all ${settingsTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>
                  {tab.id === 'policy' ? (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${settingsTab === 'policy' ? 'bg-blue-100 text-blue-600' : 'text-slate-400'}`}>
                      <span className="text-lg">🛡️</span>
                    </div>
                  ) : (
                    <span className="text-base">{tab.icon}</span>
                  )}
                  <span className="text-[6px] font-black uppercase text-center leading-none">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- LOAN MODAL --- */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-xl p-6 shadow-2xl relative">
            <h2 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase mb-6 tracking-widest">
              <span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md text-sm">🏦</span>
              {editingLoanId ? t.loan_edit : t.loan_new}
            </h2>
            <form onSubmit={handleSaveLoan} className="space-y-5">
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${loanForm.type === LoanType.BORROW ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}>💸 {t.loan_i_owe}</button>
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${loanForm.type === LoanType.LEND ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>🤝 {t.loan_owes_me}</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_partner}</label>
                  <input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="Tên..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_jar_label}</label>
                  <select value={loanForm.loanJar} onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none">
                    <option value="AUTO">{t.manual_auto}</option>
                    {Object.values(JarType).map(jt => <option key={jt} value={jt}>{JAR_CONFIG[jt].name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">NGÀY</label>
                <input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_principal}</label>
                  <div className="relative">
                     <input required type="text" value={loanPrincipalStr} onChange={e => setLoanPrincipalStr(formatDots(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="0" />
                     <p className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(loanPrincipalStr) * EXCHANGE_RATES[settings.currency], settings.currency)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_paid_label}</label>
                  <div className="relative">
                     <input type="text" value={loanPaidAmountStr} onChange={e => setLoanPaidAmountStr(formatDots(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="0" />
                     <p className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(loanPaidAmountStr) * EXCHANGE_RATES[settings.currency], settings.currency)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsLoanModalOpen(false); setEditingLoanId(null); }} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-xl tracking-widest hover:bg-slate-200 transition-colors">HỦY</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase text-[9px] rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all tracking-widest">LƯU</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TRANSFER MODAL --- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:w-[95%] p-6 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-[12px] font-black text-slate-800 uppercase text-center mb-6 tracking-widest">CHUYỂN TIỀN GIỮA CÁC HŨ</h2>
            <form onSubmit={handleTransferSubmit} className="space-y-5">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                 <div className="flex-1 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Từ hũ</p>
                    <div className="text-xl">{JAR_CONFIG[transferFrom].icon}</div>
                    <p className="text-[8px] font-black text-slate-800 uppercase">{JAR_CONFIG[transferFrom].name}</p>
                 </div>
                 <div className="text-indigo-400 text-xl font-bold animate-pulse">➔</div>
                 <div className="flex-1 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Đến hũ</p>
                    <select value={transferTo} onChange={e => setTransferTo(e.target.value as JarType)} className="w-full bg-white border border-slate-200 rounded-lg py-1 text-[9px] font-black outline-none text-center">
                       {Object.values(JarType).filter(t => t !== transferFrom).map(t => <option key={t} value={t}>{JAR_CONFIG[t].name}</option>)}
                    </select>
                 </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">SỐ TIỀN CHUYỂN</label>
                 <div className="relative">
                    <input required type="text" value={transferAmount} onChange={e => setTransferAmount(formatDots(e.target.value))} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[12px] font-black outline-none text-center focus:border-indigo-400" placeholder="0" />
                    <p className="absolute bottom-1 right-3 text-[7px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(transferAmount) * EXCHANGE_RATES[settings.currency], settings.currency)}</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-xl">HỦY</button>
                 <button type="submit" className="flex-2 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-700">XÁC NHẬN</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
