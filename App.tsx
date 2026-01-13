
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";

// --- Tỷ giá hối đoái cố định (Cơ sở: VND) ---
const EXCHANGE_RATES = {
  VND: 1,
  USD: 1 / 25400, // 1 USD ~ 25.400 VND
  JPY: 1 / 168,   // 1 JPY ~ 168 VND
};

// --- Hệ thống dịch thuật ---
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
    history_filter: "Bộ lọc",
    history_type: "Loại",
    history_jar: "Hũ",
    history_date: "Ngày",
    history_all: "Tất cả",
    history_inc_only: "Chỉ Thu",
    history_exp_only: "Chỉ Chi",
    history_more: "Xem thêm ↓",
    history_empty: "Danh sách trống",
    loan_title: "QUẢN LÝ VAY NỢ",
    loan_new: "GHI VAY NỢ MỚI",
    loan_pay: "THANH TOÁN",
    loan_recover: "THU HỒI",
    loan_i_owe: "Tôi nợ",
    loan_owes_me: "Nợ tôi",
    loan_rem: "Còn",
    loan_paid: "Đã trả",
    loan_partner: "Đối tác",
    loan_principal: "Tiền gốc",
    loan_jar_label: "Hũ liên quan",
    settings_title: "CÀI ĐẶT ỨNG DỤNG",
    settings_data: "Dữ liệu",
    settings_data_export: "XUẤT DỮ LIỆU CSV",
    settings_data_import: "NHẬP DỮ LIỆU (AI)",
    settings_data_reset: "XÓA TẤT CẢ DỮ LIỆU",
    settings_info: "Tin",
    settings_connect: "Góp ý",
    settings_policy: "Pháp lý",
    settings_guide: "HDSD",
    settings_app: "Cài đặt",
    currency: "Tiền tệ",
    language: "Ngôn ngữ",
    lang_vi: "Tiếng Việt",
    lang_en: "Tiếng Anh",
    lang_ja: "Tiếng Nhật",
    user_label: "Nhập tên bạn",
    ai_placeholder: "Nhập giao dịch bằng AI (vd: Sáng ăn 50k hũ thiết yếu)...",
    jars: {
      NEC: { name: "Thiết yếu", desc: "Chi tiêu cần thiết hàng tháng (thuê nhà, ăn uống...)" },
      LTS: { name: "Tiết kiệm dài hạn", desc: "Dành cho mục tiêu lớn (mua nhà, xe, du lịch...)" },
      EDU: { name: "Giáo dục", desc: "Đầu tư vào tri thức và kỹ năng bản thân." },
      PLAY: { name: "Hưởng thụ", desc: "Giải trí, mua sắm, tận hưởng cuộc sống." },
      FFA: { name: "Đầu tư tài chính", desc: "Tạo thu nhập thụ động, tự do tài chính." },
      GIVE: { name: "Cho đi", desc: "Ủng hộ từ thiện, giúp đỡ người thân." }
    }
  },
  en: {
    appTitle: "FINAI",
    stats_jars: "Jar Money",
    stats_debt: "Total Debt",
    stats_lent: "Total Lent",
    stats_net: "Net Assets",
    advice_title: "Expert Advice",
    chart_title: "INCOME & EXPENSE",
    chart_week: "Week",
    chart_month: "Month",
    chart_year: "Year",
    manual_title: "MANUAL ENTRY",
    manual_edit: "EDITING TRANSACTION",
    manual_cancel: "CANCEL",
    manual_type: "Type",
    manual_expense: "EXPENSE",
    manual_income: "INCOME",
    manual_amount: "Amount",
    manual_desc: "Description",
    manual_jar_img: "Jar & Image",
    manual_allocation_only: "Allocation",
    manual_date_label: "Date",
    manual_auto: "✨ Auto-allocate 6 Jars",
    manual_save: "SAVE",
    manual_update: "UPDATE",
    history_title: "TRANSACTION HISTORY",
    history_filter: "Filter",
    history_type: "Type",
    history_jar: "Jar",
    history_date: "Date",
    history_all: "All",
    history_inc_only: "Income Only",
    history_exp_only: "Expense Only",
    history_more: "View more ↓",
    history_empty: "No transactions",
    loan_title: "LOAN MGMT",
    loan_new: "NEW LOAN",
    loan_pay: "PAY",
    loan_recover: "RECOVER",
    loan_i_owe: "I owe",
    loan_owes_me: "Owes me",
    loan_rem: "Rem",
    loan_paid: "Paid",
    loan_partner: "Partner",
    loan_principal: "Principal",
    loan_jar_label: "Related Jar",
    settings_title: "APP SETTINGS",
    settings_data: "Data",
    settings_data_export: "EXPORT CSV",
    settings_data_import: "IMPORT (AI)",
    settings_data_reset: "RESET ALL DATA",
    settings_info: "Info",
    settings_connect: "Feedback",
    settings_policy: "Legal",
    settings_guide: "Guide",
    settings_app: "Settings",
    currency: "Currency",
    language: "Language",
    lang_vi: "Vietnamese",
    lang_en: "English",
    lang_ja: "Japanese",
    user_label: "Enter your name",
    ai_placeholder: "Enter transaction via AI (e.g., 50k for lunch)...",
    jars: {
      NEC: { name: "Necessities", desc: "Monthly essentials (rent, food...)" },
      LTS: { name: "Long-term Savings", desc: "Large future goals (house, car...)" },
      EDU: { name: "Education", desc: "Investment in knowledge and skills." },
      PLAY: { name: "Play", desc: "Fun, shopping, entertainment." },
      FFA: { name: "Financial Freedom", desc: "Passive income, investments." },
      GIVE: { name: "Give", desc: "Charity and helping others." }
    }
  },
  ja: {
    appTitle: "FINAI",
    stats_jars: "残高合計",
    stats_debt: "借金合計",
    stats_lent: "貸付合計",
    stats_net: "純資産",
    advice_title: "専門家のアドバイス",
    chart_title: "収支統計",
    chart_week: "週",
    chart_month: "月",
    chart_year: "年",
    manual_title: "手動入力",
    manual_edit: "編集中",
    manual_cancel: "キャンセル",
    manual_type: "取引タイプ",
    manual_expense: "支出",
    manual_income: "収入",
    manual_amount: "金額",
    manual_desc: "内容",
    manual_jar_img: "配分と画像",
    manual_allocation_only: "配分",
    manual_date_label: "日付",
    manual_auto: "✨ 6つの瓶に自動配分",
    manual_save: "保存",
    manual_update: "更新",
    history_title: "取引履歴",
    history_filter: "フィルター",
    history_type: "タイプ",
    history_jar: "瓶",
    history_date: "日付",
    history_all: "すべて",
    history_inc_only: "収入のみ",
    history_exp_only: "支出のみ",
    history_more: "もっと見る ↓",
    history_empty: "履歴なし",
    loan_title: "ローン管理",
    loan_new: "新規ローン入力",
    loan_pay: "返済",
    loan_recover: "回収",
    loan_i_owe: "借金",
    loan_owes_me: "貸付",
    loan_rem: "残り",
    loan_paid: "返済済",
    loan_partner: "パートナー",
    loan_principal: "元金",
    loan_jar_label: "関連する瓶",
    settings_title: "アプリ設定",
    settings_data: "データ",
    settings_data_export: "CSVエクスポート",
    settings_data_import: "AIインポート",
    settings_data_reset: "全データ削除",
    settings_info: "情報",
    settings_connect: "フィードバック",
    settings_policy: "規約",
    settings_guide: "ガイド",
    settings_app: "設定",
    currency: "通貨",
    language: "言語",
    lang_vi: "ベトナム語",
    lang_en: "英語",
    lang_ja: "日本語",
    user_label: "お名前を入力",
    ai_placeholder: "AIで入力 (例: 昼食 1000円)...",
    jars: {
      NEC: { name: "必要経費", desc: "毎月の基本的な生活費。" },
      LTS: { name: "長期貯蓄", desc: "将来の大きな目標（家、車など）のため。" },
      EDU: { name: "教育基金", desc: "知識やスキルの習得への投資。" },
      PLAY: { name: "娯楽基金", desc: "遊び、買い物、趣味などの楽しみ。" },
      FFA: { name: "財務自由", desc: "不労所得を得るための投資基金。" },
      GIVE: { name: "奉仕基金", desc: "寄付や他者への援助のため。" }
    }
  }
};

const App: React.FC = () => {
  // --- Constants ---
  const APP_VERSION = "4.5.4";
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
  const [settingsTab, setSettingsTab] = useState<'export' | 'info' | 'connect' | 'policy' | 'guide' | 'app'>('info');
  
  const [isPayLoanModalOpen, setIsPayLoanModalOpen] = useState(false);
  const [activeLoanForPay, setActiveLoanForPay] = useState<Loan | null>(null);
  const [payLoanAmount, setPayLoanAmount] = useState('');
  const [payLoanJar, setPayLoanJar] = useState<JarType | 'AUTO'>('AUTO');

  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [historyJarFilter, setHistoryJarFilter] = useState<JarType | 'all'>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>(''); 
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);
  const [chartTab, setChartTab] = useState<'week' | 'month' | 'year'>('week');

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
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loanDeleteConfirmId, setLoanDeleteConfirmId] = useState<string | null>(null);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanPrincipalStr, setLoanPrincipalStr] = useState('');
  const [loanPaidAmountStr, setLoanPaidAmountStr] = useState('');
  const [loanForm, setLoanForm] = useState<Omit<Partial<Loan>, 'loanJar'> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO'
  });

  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const manualFormRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.vi;

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
  const convertValue = (valInVnd: number) => {
    return valInVnd * EXCHANGE_RATES[settings.currency];
  };

  const formatNumberForDisplay = (num: number | string) => {
    if (num === "" || num === undefined || num === null) return "";
    const cleanedString = typeof num === 'string' ? num.replace(/[^0-9.-]+/g, "") : num.toString();
    const n = parseFloat(cleanedString);
    if (isNaN(n)) return "";
    
    const isJpy = settings.currency === 'JPY';
    const decimals = isJpy ? 0 : (settings.currency === 'USD' ? 2 : 0);
    
    return n.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals,
      useGrouping: true
    });
  };

  const parseFormattedNumber = (str: string) => {
    const cleaned = str.toString().replace(/[^0-9.]/g, "");
    const inputVal = parseFloat(cleaned) || 0;
    return inputVal / EXCHANGE_RATES[settings.currency];
  };

  const getJpyBreakdown = (valStr: string) => {
    const n = parseInt(valStr.replace(/\D/g, '')) || 0;
    if (n === 0) return "";
    const man = Math.floor(n / 10000);
    const sen = Math.floor((n % 10000) / 1000);
    const yen = n % 1000;
    let res = [];
    if (man > 0) res.push(`${man}vạn (man)`);
    if (sen > 0) res.push(`${sen}nghìn (sen)`);
    if (yen > 0) res.push(`${yen}yên`);
    return res.length > 0 ? `→ ${res.join(" ")}` : "";
  };

  const showToast = (msg: string, type: 'success' | 'info' | 'danger' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatCurrency = (valInVnd: number) => {
    const val = convertValue(valInVnd);
    const symbols = { 'VND': 'đ', 'JPY': '¥', 'USD': '$' };
    const decimals = settings.currency === 'USD' ? 2 : (settings.currency === 'JPY' ? 0 : 0);
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return settings.currency === 'USD' ? `${symbols.USD}${formatted}` : `${formatted}${symbols[settings.currency]}`;
  };

  const formatYAxis = (valInVnd: number) => {
    const val = convertValue(valInVnd);
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toFixed(0);
  };

  const updateBalances = (prevTrans: Transaction | null, nextTrans: Transaction) => {
    setBalances(prevBalances => {
      const nb = { ...prevBalances };
      const ratios = settings.jarRatios;

      if (prevTrans) {
        if (prevTrans.type === 'income') {
          if (prevTrans.jarType) nb[prevTrans.jarType] -= prevTrans.amount;
          else Object.values(JarType).forEach(type => { nb[type as JarType] -= prevTrans.amount * ratios[type as JarType]; });
        } else {
          if (prevTrans.jarType) nb[prevTrans.jarType] += prevTrans.amount;
          else Object.values(JarType).forEach(type => { nb[type as JarType] += prevTrans.amount * ratios[type as JarType]; });
        }
      }

      if (nextTrans.type === 'income') {
        if (nextTrans.jarType) nb[nextTrans.jarType] += nextTrans.amount;
        else Object.values(JarType).forEach(type => { nb[type as JarType] += nextTrans.amount * ratios[type as JarType]; });
      } else {
        if (nextTrans.jarType) nb[nextTrans.jarType] -= nextTrans.amount;
        else Object.values(JarType).forEach(type => { nb[type as JarType] -= nextTrans.amount * ratios[type as JarType]; });
      }

      Object.keys(nb).forEach(k => { nb[k as JarType] = Math.round(nb[k as JarType] * 1000) / 1000; });
      return nb;
    });
  };

  // --- Handlers ---
  const handleProcessInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        showToast(`${settings.language === 'vi' ? 'Đã thêm' : 'Added'}: ${newTrans.description}`);
        setAdvice(await getFinancialAdvice(balances, `Added: ${newTrans.description}`));
      } else showToast("AI Error.", "info");
    } catch (e) { showToast("AI Error.", "danger"); }
    finally { setIsLoading(false); setInput(''); }
  };

  const deleteTransaction = (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      showToast(settings.language === 'vi' ? "Bấm thêm 1 lần nữa để xóa" : "Click again to delete", "info");
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }

    setTransactions(prevTransactions => {
      const t_obj = prevTransactions.find(item => item.id === id);
      if (!t_obj) return prevTransactions;
      
      setBalances(prevBalances => {
        const nb = { ...prevBalances };
        const amt = t_obj.amount;
        if (t_obj.type === 'income') {
          if (t_obj.jarType) nb[t_obj.jarType] -= amt;
          else Object.values(JarType).forEach(type => { nb[type as JarType] -= amt * settings.jarRatios[type as JarType]; });
        } else {
          if (t_obj.jarType) nb[t_obj.jarType] += amt;
          else Object.values(JarType).forEach(type => { nb[type as JarType] += amt * settings.jarRatios[type as JarType]; });
        }
        Object.keys(nb).forEach(k => { nb[k as JarType] = Math.round(nb[k as JarType] * 1000) / 1000; });
        return nb;
      });
      
      showToast(settings.language === 'vi' ? "Đã xóa" : "Deleted", "info");
      setDeleteConfirmId(null);
      return prevTransactions.filter(item => item.id !== id);
    });
  };

  const deleteLoan = (id: string) => {
    if (loanDeleteConfirmId !== id) {
      setLoanDeleteConfirmId(id);
      showToast(settings.language === 'vi' ? "Bấm thêm 1 lần nữa để xóa khoản nợ này" : "Click again to delete this loan", "info");
      setTimeout(() => setLoanDeleteConfirmId(null), 3000);
      return;
    }

    const loanToDelete = loans.find(l => l.id === id);
    if (!loanToDelete) return;

    setBalances(prevBalances => {
      const nb = { ...prevBalances };
      const { type, principal, paidAmount, loanJar } = loanToDelete;
      const netImpact = principal - paidAmount;

      if (type === LoanType.BORROW) {
        if (loanJar) {
          nb[loanJar] -= netImpact;
        } else {
          Object.values(JarType).forEach(jt => { nb[jt as JarType] -= netImpact * settings.jarRatios[jt as JarType]; });
        }
      } else {
        if (loanJar) {
          nb[loanJar] += netImpact;
        } else {
          Object.values(JarType).forEach(jt => { nb[jt as JarType] += netImpact * settings.jarRatios[jt as JarType]; });
        }
      }
      Object.keys(nb).forEach(k => { nb[k as JarType] = Math.round(nb[k as JarType] * 1000) / 1000; });
      return nb;
    });

    setTransactions(prev => prev.filter(t => t.loanId !== id));
    setLoans(prev => prev.filter(l => l.id !== id));
    showToast(settings.language === 'vi' ? "Đã xóa & hoàn số dư." : "Deleted & balance reverted.", "info");
    setLoanDeleteConfirmId(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(manualAmount);
    if (amountInVnd <= 0 || !manualDesc.trim()) return;
    const newTrans: Transaction = {
      id: editingTransactionId || Date.now().toString(), type: manualType,
      amount: amountInVnd, description: manualDesc, jarType: manualType === 'expense' ? manualJar : undefined,
      timestamp: new Date(manualDate).getTime(),
      imageUrl: manualImage || undefined
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
    setManualAmount(''); setManualDesc(''); setManualImage(null); showToast(settings.language === 'vi' ? "Đã lưu!" : "Saved!");
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setManualAmount(formatNumberForDisplay(convertValue(tx.amount)));
    setManualDesc(tx.description);
    setManualType(tx.type);
    if (tx.jarType) setManualJar(tx.jarType);
    setManualDate(new Date(tx.timestamp).toISOString().split('T')[0]);
    setManualImage(tx.imageUrl || null);
    manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9.]/g, "");
    setManualAmount(rawVal);
  };

  const handlePayLoanAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9.]/g, "");
    setPayLoanAmount(rawVal);
  };

  const handleLoanPrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9.]/g, "");
    setLoanPrincipalStr(rawVal);
  };
  const handleLoanPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9.]/g, "");
    setLoanPaidAmountStr(rawVal);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(transferAmount);
    if (amountInVnd <= 0 || amountInVnd > balances[transferFrom]) return showToast("Invalid Amount.", "danger");
    setBalances(prev => {
      const nb = { ...prev };
      nb[transferFrom] -= amountInVnd;
      nb[transferTo] += amountInVnd;
      return nb;
    });
    const tx1: Transaction = { id: Date.now().toString(), type: 'expense', amount: amountInVnd, description: `Transfer: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferFrom, timestamp: Date.now() };
    const tx2: Transaction = { id: (Date.now()+1).toString(), type: 'income', amount: amountInVnd, description: `Receive: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferTo, timestamp: Date.now() };
    setTransactions(p => [tx1, tx2, ...p]);
    setIsTransferModalOpen(false);
    showToast("Success!");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanPrincipalStr) return;
    
    const principalVnd = parseFormattedNumber(loanPrincipalStr);
    const paidAmountVnd = parseFormattedNumber(loanPaidAmountStr || '0');
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : (loanForm.loanJar as JarType);

    if (editingLoanId) {
      const oldLoan = loans.find(l => l.id === editingLoanId);
      if (oldLoan) {
        const oldTx = transactions.find(t => t.loanId === editingLoanId && !t.description.includes('Thanh toán') && !t.description.includes('Thu hồi'));
        const newTx: Transaction = {
          id: oldTx?.id || Date.now().toString(),
          type: loanForm.type === LoanType.BORROW ? 'income' : 'expense',
          amount: principalVnd,
          description: `${loanForm.type === LoanType.BORROW ? 'Vay từ' : 'Cho vay'} ${loanForm.lenderName}`,
          timestamp: oldTx?.timestamp || Date.now(),
          jarType: finalLoanJar,
          loanId: editingLoanId
        };
        updateBalances(oldTx || null, newTx);
        if (oldTx) {
          setTransactions(prev => prev.map(t => t.id === oldTx.id ? newTx : t));
        } else {
          setTransactions(prev => [newTx, ...prev]);
        }
        setLoans(prev => prev.map(l => l.id === editingLoanId ? {
          ...(loanForm as Loan),
          id: editingLoanId,
          principal: principalVnd,
          paidAmount: paidAmountVnd,
          loanJar: finalLoanJar
        } : l));
        showToast("Updated!");
      }
      setEditingLoanId(null);
    } else {
      const loanId = Date.now().toString();
      const newLoan: Loan = { 
        ...(loanForm as Loan), 
        id: loanId, 
        principal: principalVnd, 
        paidAmount: paidAmountVnd,
        loanJar: finalLoanJar
      };
      const tx: Transaction = { 
        id: Date.now().toString(), 
        type: newLoan.type === LoanType.BORROW ? 'income' : 'expense', 
        amount: principalVnd, 
        description: `${newLoan.type === LoanType.BORROW ? 'Vay từ' : 'Cho vay'} ${newLoan.lenderName}`, 
        timestamp: Date.now(), 
        jarType: finalLoanJar,
        loanId: loanId 
      };
      setTransactions(p => [tx, ...p]);
      updateBalances(null, tx);
      setLoans(p => [newLoan, ...p]);
      showToast("Success!");
    }
    setIsLoanModalOpen(false);
    setLoanPrincipalStr('');
    setLoanPaidAmountStr('');
  };

  const handleConfirmPayLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoanForPay) return;
    const amountVnd = parseFormattedNumber(payLoanAmount);
    if (amountVnd <= 0) return showToast("Invalid amount.", "danger");
    const loan = activeLoanForPay;
    const isRecovery = loan.type === LoanType.LEND;
    const actualPayVnd = Math.min(amountVnd, loan.principal - loan.paidAmount);
    
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, paidAmount: l.paidAmount + actualPayVnd } : l));
    
    const tx: Transaction = { 
      id: Date.now().toString(), 
      type: isRecovery ? 'income' : 'expense', 
      amount: actualPayVnd, 
      description: `${isRecovery ? 'Thu hồi' : 'Thanh toán'} nợ: ${loan.lenderName}`, 
      timestamp: Date.now(), 
      jarType: payLoanJar === 'AUTO' ? undefined : payLoanJar,
      loanId: loan.id
    };
    
    setTransactions(p => [tx, ...p]);
    updateBalances(null, tx);
    setIsPayLoanModalOpen(false);
    setPayLoanAmount(''); 
    showToast("Success!");
  };

  const handleEditBalance = (type: JarType | 'TOTAL' | 'DEBT' | 'LENT' | 'NET') => {
    let currentVal = 0;
    let label = "";
    const jarTypesList = Object.values(JarType) as string[];
    const isJar = jarTypesList.includes(type.toString());
    if (isJar) {
      currentVal = convertValue(balances[type as JarType]);
      label = t.jars[type as JarType].name;
    } else {
      switch(type) {
        case 'TOTAL': currentVal = convertValue(totalInJars); label = t.stats_jars; break;
        case 'DEBT': currentVal = convertValue(totalBorrowed); label = t.stats_debt; break;
        case 'LENT': currentVal = convertValue(totalLent); label = t.stats_lent; break;
        case 'NET': currentVal = convertValue(netAssets); label = t.stats_net; break;
      }
    }
    const newValStr = window.prompt(`${settings.language === 'vi' ? 'Nhập số dư mới cho' : 'Enter new balance for'} ${label} (${settings.currency}):`, currentVal.toFixed(settings.currency === 'USD' ? 2 : 0));
    if (newValStr !== null) {
      const newVal = parseFloat(newValStr.replace(/[^0-9.]/g, "")) || 0;
      const newValVnd = newVal / EXCHANGE_RATES[settings.currency];
      if (isJar) {
        setBalances(prev => ({ ...prev, [type as JarType]: newValVnd }));
        showToast("Success!");
      } else if (type === 'TOTAL') {
        const nb = { ...balances };
        Object.values(JarType).forEach(jt => { nb[jt as JarType] = newValVnd * settings.jarRatios[jt as JarType]; });
        setBalances(nb);
        showToast("Success!");
      } else if (type === 'DEBT' || type === 'LENT' || type === 'NET') {
        showToast(settings.language === 'vi' ? "Số dư này được tính tự động, vui lòng sửa chi tiết trong danh sách vay nợ hoặc hũ." : "This balance is auto-calculated. Please edit loan details or jar balances.", "info");
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setManualImage(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenPayLoanModal = (loan: Loan) => {
    setActiveLoanForPay(loan);
    setPayLoanAmount('');
    setPayLoanJar('AUTO');
    setIsPayLoanModalOpen(true);
  };

  const handleOpenNewLoanModal = () => {
    setEditingLoanId(null);
    setLoanForm({
      type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO'
    });
    setLoanPrincipalStr('');
    setLoanPaidAmountStr('');
    setIsLoanModalOpen(true);
  };

  const handleEditLoanClick = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setLoanForm({
      type: loan.type,
      lenderName: loan.lenderName,
      category: loan.category,
      startDate: loan.startDate,
      isUrgent: loan.isUrgent,
      loanJar: loan.loanJar || 'AUTO'
    });
    setLoanPrincipalStr(formatNumberForDisplay(convertValue(loan.principal)));
    setLoanPaidAmountStr(formatNumberForDisplay(convertValue(loan.paidAmount)));
    setIsLoanModalOpen(true);
  };

  const scrollToAi = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    aiInputRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    showToast(settings.language === 'vi' ? "Đang đọc..." : "Reading...", "info");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze this CSV/Sheet content: ${content.substring(0, 5000)}. Return JSON array of: { "type": "income" | "expense", "amount": number, "description": string, "jarType": JarType | undefined, "timestamp": number }`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["income", "expense"] },
                  amount: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  jarType: { type: Type.STRING, enum: Object.values(JarType) },
                  timestamp: { type: Type.INTEGER }
                },
                required: ["type", "amount", "description"]
              }
            }
          }
        });
        const list = JSON.parse(response.text || "[]") as Transaction[];
        if (list.length > 0) {
          const final = list.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }));
          setTransactions(prev => [...final, ...prev]);
          setBalances(prevBalances => {
            const nb = { ...prevBalances };
            final.forEach(item => {
              if (item.type === 'income') {
                if (item.jarType) nb[item.jarType] += item.amount;
                else Object.values(JarType).forEach(type => { nb[type as JarType] += item.amount * settings.jarRatios[type as JarType]; });
              } else {
                if (item.jarType) nb[item.jarType] -= item.amount;
                else Object.values(JarType).forEach(type => { nb[type as JarType] -= item.amount * settings.jarRatios[type as JarType]; });
              }
            });
            Object.keys(nb).forEach(k => { nb[k as JarType] = Math.round(nb[k as JarType] * 1000) / 1000; });
            return nb;
          });
          showToast(`Imported ${final.length} transactions!`);
        }
      } catch (err) { showToast("AI analysis error.", "danger"); }
      finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm(settings.language === 'vi' ? "BẠN CÓ CHẮC MUỐN XÓA TOÀN BỘ DỮ LIỆU?" : "ARE YOU SURE YOU WANT TO CLEAR ALL DATA?")) {
      setTransactions([]);
      setBalances({ [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 });
      setLoans([]);
      setSettings({...defaultSettings});
      localStorage.clear();
      showToast("Cleared.", "danger");
      setIsSettingsOpen(false);
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return showToast("No Data.", "info");
    const headers = ["ID", "Type", "Amount", "Description", "Jar", "Time"];
    const rows = transactions.map(item => [item.id, item.type === 'income' ? 'Income' : 'Expense', item.amount, item.description.replace(/,/g, " "), item.jarType ? JAR_CONFIG[item.jarType as JarType].name : 'Auto', new Date(item.timestamp).toLocaleString()]);
    const csvContent = ["\ufeff" + headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finai_export_${Date.now()}.csv`;
    link.click();
    showToast("Exported!");
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = historyFilter === 'all' || tx.type === historyFilter;
      const matchesJar = historyJarFilter === 'all' || tx.jarType === historyJarFilter;
      const matchesDate = !historyDateFilter || new Date(tx.timestamp).toISOString().split('T')[0] === historyDateFilter;
      return matchesType && matchesJar && matchesDate;
    });
  }, [transactions, historyFilter, historyJarFilter, historyDateFilter]);

  const displayedHistory = useMemo(() => {
    return filteredTransactions.slice(0, visibleHistoryCount);
  }, [filteredTransactions, visibleHistoryCount]);

  const totalInJars = (Object.values(balances) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalBorrowed = loans.filter(l => l.type === LoanType.BORROW).reduce((a: number, l) => a + (l.principal - l.paidAmount), 0);
  const totalLent = loans.filter(l => l.type === LoanType.LEND).reduce((a: number, l) => a + (l.principal - l.paidAmount), 0);
  const netAssets = totalInJars - totalBorrowed + totalLent;

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
        dayT = transactions.filter(tx => { const td = new Date(tx.timestamp); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); });
      } else {
        d.setDate(d.getDate() - i);
        label = d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' });
        dayT = transactions.filter(tx => new Date(tx.timestamp).toDateString() === d.toDateString());
      }
      const thu = dayT.filter(tx => tx.type === 'income').reduce((s: number, tx: Transaction) => s + tx.amount, 0);
      const chi = dayT.filter(tx => tx.type === 'expense').reduce((s: number, tx: Transaction) => s + tx.amount, 0);
      data.push({ name: label, Thu: convertValue(thu), Chi: convertValue(chi) });
    }
    return data;
  }, [transactions, chartTab, settings.currency, settings.language]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pt-24 pb-32 font-sans flex flex-col items-center overflow-x-hidden">
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'success' ? 'bg-indigo-600' : toast.type === 'danger' ? 'bg-red-600' : 'bg-slate-800'} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xl animate-in slide-in-from-top-4 duration-300`}>
          {toast.msg}
        </div>
      )}

      {/* --- AI INPUT BAR (TĂNG ĐỘ RỘNG & ĐỔ BÓNG) --- */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-indigo-100 p-4 shadow-[0_4px_30px_rgba(79,70,229,0.08)]">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <form onSubmit={handleProcessInput} className="relative flex-1">
            <input ref={aiInputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.ai_placeholder} className="w-full bg-slate-100 border-2 border-slate-200 rounded-full px-5 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-400 shadow-inner" />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 shadow-lg transition-transform active:scale-95">
              {isLoading ? <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨"}
            </button>
          </form>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto px-4 space-y-8 mt-4">
        {/* STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t.stats_jars, val: totalInJars, icon: '💰', type: 'TOTAL', colorClass: 'text-slate-900' }, 
            { label: t.stats_debt, val: totalBorrowed, icon: '📉', type: 'DEBT', colorClass: 'text-blue-600' }, 
            { label: t.stats_lent, val: totalLent, icon: '🤝', type: 'LENT', colorClass: 'text-red-600' }, 
            { label: t.stats_net, val: netAssets, icon: '💎', dark: true, type: 'NET', colorClass: 'text-white' }
          ].map((s, i) => (
            <div key={i} className={`${s.dark ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200' : 'bg-white border-slate-200 shadow-slate-200'} p-4 rounded-2xl border-2 shadow-lg transition-all hover:-translate-y-1 relative group`}>
              <div className="flex justify-between items-start mb-1">
                <p className={`${s.dark ? 'text-indigo-100' : 'text-slate-400'} text-[8px] font-black uppercase tracking-wider`}>{s.label}</p>
                <span className="text-sm opacity-50">{s.icon}</span>
              </div>
              <h3 className={`text-base font-black truncate ${s.colorClass}`}>{formatCurrency(s.val)}</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); handleEditBalance(s.type as any); }}
                className={`absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer ${s.dark ? 'bg-indigo-50 text-indigo-100' : 'bg-slate-50 text-slate-300 hover:text-indigo-500'}`}
              >
                <span className="text-[11px]">✏️</span>
              </button>
            </div>
          ))}
        </section>

        {/* AI ADVICE */}
        <section className="bg-white rounded-[1.5rem] p-5 border-2 border-indigo-100 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl border border-indigo-100 shrink-0">💡</div>
          <div className="flex-1"><p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">{t.advice_title}</p><p className="text-xs font-bold text-slate-700 italic">"{advice}"</p></div>
        </section>

        {/* JARS VISUAL */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.values(JarType).map(type => (
            <JarVisual 
              key={type} 
              jar={{...JAR_CONFIG[type as JarType], name: t.jars[type as JarType].name, description: t.jars[type as JarType].desc}} 
              balance={balances[type as JarType]} 
              currencySymbol={settings.currency === 'VND' ? 'đ' : settings.currency === 'JPY' ? '¥' : '$'}
              convertValue={convertValue}
              onTransferClick={() => { setTransferFrom(type as JarType); setIsTransferModalOpen(true); }} 
              onEditBalance={(jt) => handleEditBalance(jt)}
            />
          ))}
        </section>

        {/* CHART SECTION */}
        <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl h-[460px] flex flex-col w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📊</span> {t.chart_title}</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">{['week', 'month', 'year'].map(period => <button key={period} onClick={() => setChartTab(period as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${chartTab === period ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{period === 'week' ? t.chart_week : period === 'month' ? t.chart_month : t.chart_year}</button>)}</div>
          </div>
          <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: -25, bottom: 0, right: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={formatYAxis} /><Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', fontSize: '9px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} /><Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>

        {/* MANUAL FORM */}
        <section ref={manualFormRef} className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-xl transition-all ${editingTransactionId ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200'}`}>
          <div className="flex justify-between items-center mb-6"><h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📝</span> {editingTransactionId ? t.manual_edit : t.manual_title}</h3>{editingTransactionId && <button onClick={() => setEditingTransactionId(null)} className="text-[9px] font-black text-red-500 uppercase">{t.manual_cancel}</button>}</div>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.manual_type}</label>
              <div className="flex bg-slate-100 p-1 rounded-xl h-12">
                <button type="button" onClick={() => setManualType('expense')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${manualType === 'expense' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>{t.manual_expense}</button>
                <button type="button" onClick={() => setManualType('income')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${manualType === 'income' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>{t.manual_income}</button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.manual_amount} ({settings.currency})</label>
              <input required type="text" value={formatNumberForDisplay(manualAmount)} onChange={handleAmountChange} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[12px] font-bold outline-none h-12 shadow-inner focus:border-indigo-300 transition-colors" />
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.manual_desc}</label>
              <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[12px] font-bold outline-none h-12 shadow-inner focus:border-indigo-300 transition-colors" />
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{manualType === 'income' ? t.manual_allocation_only : t.manual_jar_img}</label>
              {manualType === 'income' ? (
                <div className="w-full bg-indigo-50 border-2 border-indigo-100 text-indigo-600 rounded-xl p-3 text-[10px] font-black flex items-center justify-center h-12 uppercase italic">{t.manual_auto}</div>
              ) : (
                <div className="flex gap-2 h-12">
                  <select value={manualJar} onChange={e => setManualJar(e.target.value as JarType)} className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 text-[11px] font-bold outline-none shadow-inner focus:border-indigo-300 transition-colors">
                    {Object.values(JarType).map(type => <option key={type} value={type}>{t.jars[type as JarType].name}</option>)}
                  </select>
                  <label className="w-12 bg-slate-100 border-2 border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors shadow-sm">
                    <span className="text-xl">📷</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              )}
              {manualImage && (
                <div className="relative w-full h-12 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 mt-1">
                  <img src={manualImage} alt="preview" className="w-full h-full object-cover" />
                  <button onClick={() => setManualImage(null)} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg text-[10px] font-black">✕</button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.manual_date_label}</label>
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-[12px] font-bold outline-none h-12 shadow-inner focus:border-indigo-300 transition-colors" />
            </div>
            <div className="space-y-3 flex flex-col justify-end">
              <button type="submit" className="w-full h-12 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                <span>💾</span> {editingTransactionId ? t.manual_update : t.manual_save}
              </button>
            </div>
          </form>
        </section>

        {/* HISTORY SECTION */}
        <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl flex flex-col h-fit w-full">
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📜</span> {t.history_title}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.history_filter}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">{t.history_type}</label>
                  <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none">
                    <option value="all">{t.history_all}</option>
                    <option value="income">{t.history_inc_only}</option>
                    <option value="expense">{t.history_exp_only}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">{t.history_jar}</label>
                  <select value={historyJarFilter} onChange={e => setHistoryJarFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none">
                    <option value="all">{t.history_all}</option>
                    {Object.values(JarType).map(type => <option key={type} value={type}>{t.jars[type as JarType].name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase">{t.history_date}</label>
                  <input type="date" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase outline-none"/>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? <div className="py-20 text-center text-slate-300 italic text-[11px] font-bold">{t.history_empty}</div> : displayedHistory.map(item => {
              const linkedLoan = item.loanId ? loans.find(l => l.id === item.loanId) : null;
              const isLinkedToPaidOffLoan = linkedLoan ? (Math.max(0, linkedLoan.principal - linkedLoan.paidAmount) < 0.01) : false;

              return (
                <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-inner relative overflow-hidden">
                      {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="tx" /> : (item.type === 'income' ? '💰' : JAR_CONFIG[item.jarType as JarType]?.icon || '🏦')}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 leading-tight">{item.description}</p>
                      <p className="text-[8px] text-slate-400 font-black uppercase">{new Date(item.timestamp).toLocaleDateString()} • {item.jarType ? t.jars[item.jarType].name : 'Auto'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-[11px] font-black ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isLinkedToPaidOffLoan && (
                        <button onClick={() => handleEditClick(item)} className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 rounded-lg border border-indigo-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">✏️</button>
                      )}
                      <button onClick={() => deleteTransaction(item.id)} className={`w-8 h-8 flex items-center justify-center rounded-lg border shadow-sm transition-all ${deleteConfirmId === item.id ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-red-50 text-red-500 border-red-100 opacity-0 group-hover:opacity-100'}`}>{deleteConfirmId === item.id ? '?' : '🗑️'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredTransactions.length > visibleHistoryCount && <button onClick={() => setVisibleHistoryCount(prev => prev + 5)} className="mt-6 w-full py-3 bg-slate-50 text-slate-500 text-[10px] font-black uppercase rounded-xl border-2 border-dashed border-slate-200 hover:bg-slate-100 transition-all">{t.history_more}</button>}
        </section>

        {/* LOANS SECTION */}
        <section className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-200 shadow-xl space-y-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <span>📉</span> {t.loan_title}
            </h3>
            <button onClick={handleOpenNewLoanModal} className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5">
              <span>＋</span> {t.loan_new}
            </button>
          </div>

          {loans.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50">
              <span className="text-4xl block mb-3 opacity-30">📂</span>
              <p className="text-slate-400 italic text-[11px] font-bold">{t.history_empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loans.map(loan => {
                const remaining = Math.max(0, loan.principal - loan.paidAmount);
                const isPaidOff = remaining < 0.01;
                
                const completionDate = isPaidOff 
                  ? transactions
                      .filter(t => t.loanId === loan.id)
                      .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp 
                  : null;

                return (
                  <div key={loan.id} className={`group p-5 rounded-[1.5rem] border-2 transition-all shadow-sm hover:shadow-md relative overflow-hidden bg-white ${loan.type === LoanType.BORROW ? 'border-red-50 hover:border-red-100' : 'border-emerald-50 hover:border-emerald-100'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${loan.type === LoanType.BORROW ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${loan.type === LoanType.BORROW ? (isPaidOff ? 'bg-slate-50 text-slate-400' : 'bg-red-50 text-red-500') : (isPaidOff ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-500')}`}>
                          {isPaidOff ? '✅' : (loan.type === LoanType.BORROW ? '💸' : '🤝')}
                        </div>
                        <div>
                          <h4 className={`text-[12px] font-black leading-tight ${isPaidOff ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {loan.lenderName}
                          </h4>
                          {!isPaidOff && (
                            <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase mt-1 inline-block ${loan.type === LoanType.BORROW ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {loan.type === LoanType.BORROW ? t.loan_i_owe : t.loan_owes_me}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 mb-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          {!isPaidOff && (
                            <>
                              <button onClick={() => handleEditLoanClick(loan)} className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-slate-100 shadow-sm transition-all">✏️</button>
                              <button onClick={() => handleOpenPayLoanModal(loan)} className={`h-7 px-2.5 flex items-center justify-center text-[8px] font-black uppercase rounded-lg border shadow-sm transition-all ${loan.type === LoanType.BORROW ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-white' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-white'}`}>💰 {loan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</button>
                            </>
                          )}
                          
                          {isPaidOff && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteLoan(loan.id); }} 
                              className={`w-7 h-7 flex items-center justify-center rounded-lg border shadow-sm transition-all ${loanDeleteConfirmId === loan.id ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-red-50 text-red-400 border-red-100 hover:bg-white'}`}
                            >
                              {loanDeleteConfirmId === loan.id ? '?' : '🗑️'}
                            </button>
                          )}
                        </div>
                        {isPaidOff ? (
                          <div className="text-right">
                             <p className="text-[10px] font-black text-emerald-600">{formatCurrency(loan.paidAmount)}</p>
                             <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Đã trả hết</p>
                          </div>
                        ) : (
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-800">{formatCurrency(remaining)}</p>
                             <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">{t.loan_rem}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isPaidOff ? (
                      <div className="space-y-1.5">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full transition-all duration-1000 rounded-full ${loan.type === LoanType.BORROW ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((loan.paidAmount/loan.principal)*100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                          <span>{t.loan_paid}: {formatCurrency(loan.paidAmount)}</span>
                          <span>Ngày vay: {new Date(loan.startDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                        <span>Ngày hoàn thành:</span>
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {completionDate ? new Date(completionDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* --- GLOSSY CENTER FAB (ĐIỀU CHỈNH VỊ TRÍ) --- */}
      <button onClick={scrollToAi} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] w-16 h-16 bg-gradient-to-tr from-indigo-700 to-indigo-400 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all border-4 border-white"><span className="text-4xl">＋</span></button>

      {/* --- UTILITY BAR (FOOTER - TĂNG ĐỘ RỘNG & ĐỔ BÓNG MỜ) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-indigo-100/50 p-5 shadow-[0_-10px_40px_rgba(79,70,229,0.08)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4">
          <div className="flex flex-col leading-none"><span className="text-xs font-black text-slate-900 uppercase">FINAI</span><span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">by Loong Lee</span></div>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-full border border-slate-200 shadow-inner transition-all hover:bg-slate-100"><img src={currentUser?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} className="w-5 h-5 rounded-full" /><span className="text-[8px] font-black uppercase max-w-[80px] truncate text-indigo-600">{currentUser?.displayName || t.user_label}</span></button>
            <button onClick={() => setIsSettingsOpen(true)} className="w-11 h-11 flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-500 rounded-2xl border border-slate-200 shadow-sm transition-all hover:bg-indigo-50"><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div></button>
          </div>
        </div>
      </div>

      {/* --- SETTINGS SIDE DRAWER --- */}
      <div className={`fixed inset-0 z-[200] transition-opacity duration-300 ${isSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 transform flex flex-col ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b-2 border-slate-100 flex items-center justify-between bg-slate-50"><h2 className="text-sm font-black text-slate-800 uppercase">{t.settings_title}</h2><button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 text-xl hover:text-slate-600 transition-colors">✕</button></div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {settingsTab === 'app' && (
              <div className="space-y-8 py-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 text-center">{t.settings_app}</h4>
                <div className="space-y-6">
                  <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.currency}</label><div className="flex bg-slate-50 p-1.5 rounded-2xl border gap-1">{['VND', 'JPY', 'USD'].map(curr => (<button key={curr} onClick={() => setSettings({...settings, currency: curr as any})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${settings.currency === curr ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-400'}`}>{curr}</button>))}</div></div>
                  <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.language}</label><div className="flex flex-col bg-slate-50 p-2 rounded-2xl border gap-1"><button onClick={() => setSettings({...settings, language: 'vi'})} className={`w-full py-3 text-[10px] font-black rounded-xl transition-all ${settings.language === 'vi' ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-400'}`}>{t.lang_vi}</button><button onClick={() => setSettings({...settings, language: 'en'})} className={`w-full py-3 text-[10px] font-black rounded-xl transition-all ${settings.language === 'en' ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-400'}`}>{t.lang_en}</button><button onClick={() => setSettings({...settings, language: 'ja'})} className={`w-full py-3 text-[10px] font-black rounded-xl transition-all ${settings.language === 'ja' ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-400'}`}>{t.lang_ja}</button></div></div>
                </div>
              </div>
            )}
            {settingsTab === 'connect' && (
              <div className="space-y-8 py-6 text-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{t.settings_connect}</h4>
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-inner border border-emerald-100 mb-6">📬</div>
                <div className="space-y-3">
                   <a href="https://www.facebook.com/duclongka" target="_blank" className="flex items-center gap-4 p-5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 group transition-all hover:bg-blue-100"><div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-lg">📘</div><div><p className="text-[11px] font-black uppercase tracking-tight">Facebook</p></div></a>
                   <div className="flex items-center gap-4 p-5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 group"><div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-lg">💬</div><div><p className="text-[11px] font-black uppercase tracking-tight">Zalo / SĐT: 0964855899</p></div></div>
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2"><p className="text-[11px] font-bold text-slate-600">Liên hệ qua email</p><a href="mailto:longld@itsupro.org" className="text-sm font-black text-indigo-600 hover:underline block">longld@itsupro.org</a></div>
                </div>
              </div>
            )}
            {settingsTab === 'export' && (
              <div className="space-y-8 py-6 text-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{t.settings_data}</h4>
                <div className="space-y-4">
                  <button onClick={exportToCSV} className="w-full py-4 bg-emerald-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"><span>📥</span> {t.settings_data_export}</button>
                  <label className="block w-full py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl cursor-pointer hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"><span>📤</span> {t.settings_data_import}<input type="file" accept=".csv, .txt, .xlsx" onChange={handleFileUpload} className="hidden" ref={fileInputRef} /></label>
                  <button onClick={handleResetData} className="w-full py-4 bg-red-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"><span>⚠️</span> {t.settings_data_reset}</button>
                </div>
              </div>
            )}
            {settingsTab === 'info' && (
               <div className="space-y-8 py-6 text-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{t.settings_info}</h4>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                   <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-4">✨</div>
                   <h4 className="text-2xl font-black text-slate-800 tracking-tighter uppercase mb-2">FINAI</h4>
                   <p className="text-[12px] font-bold text-slate-700 leading-relaxed">Smart financial management using AI based on T. Harv Eker's 6 Jars rule.</p>
                   <div className="mt-8 pt-8 border-t border-slate-200"><p className="text-[11px] font-bold text-indigo-600 uppercase font-black">{settings.language === 'vi' ? 'Thiết kế bởi Loong Lee' : 'Designed by Loong Lee'}</p><p className="text-[10px] font-bold text-slate-400 italic mt-1">Version v{APP_VERSION}</p></div>
                </div>
              </div>
            )}
            {settingsTab === 'policy' && (
              <div className="space-y-6 py-4 text-left">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">{t.settings_policy}</h4>
                <div className="space-y-4">
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-100 space-y-4">
                    <p className="text-[11px] font-black text-red-600 uppercase">CHÍNH SÁCH BẢO MẬT & MIỄN TRỪ TRÁCH NHIỆM</p>
                    <p className="text-[10px] font-bold text-slate-700 leading-relaxed">1. <strong>Quyền riêng tư tuyệt đối:</strong> Ứng dụng FINAI cam kết không lưu trữ bất kỳ dữ liệu tài chính nào của người dùng trên máy chủ (server). Mọi dữ liệu đều được lưu trữ trực tiếp trên thiết bị cá nhân (LocalStorage/Browser Storage) của chính bạn.</p>
                    <p className="text-[10px] font-bold text-slate-700 leading-relaxed">2. <strong>An toàn mạng:</strong> Chúng tôi tuân thủ nghiêm ngặt Luật An toàn thông tin mạng và Luật An ninh mạng Việt Nam. Vì dữ liệu không được tải lên mạng, nguy cơ rò rỉ dữ liệu cá nhân từ hệ thống là bằng 0.</p>
                    <p className="text-[10px] font-bold text-slate-700 leading-relaxed">3. <strong>Trách nhiệm người dùng:</strong> Do đặc thù lưu trữ tại chỗ, người dùng có trách nhiệm tự bảo mật thiết bị truy cập và sao lưu dữ liệu (qua tính năng Export CSV).</p>
                    <p className="text-[10px] font-bold text-slate-700 leading-relaxed">4. <strong>Miễn trừ trách nhiệm:</strong> FINAI không chịu trách nhiệm cho bất kỳ mất mát dữ liệu nào do lỗi thiết bị, xóa bộ nhớ trình duyệt, hoặc hành vi xâm nhập trái phép vào thiết bị của người dùng.</p>
                    <div className="pt-2 border-t border-red-200"><p className="text-[9px] font-black text-red-500 uppercase italic">* Dựa trên Luật An ninh mạng Việt Nam 2018 và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</p></div>
                  </div>
                </div>
              </div>
            )}
            {settingsTab === 'guide' && (
              <div className="space-y-8 py-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 text-center">HƯỚNG DẪN SỬ DỤNG</h4>
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="flex items-start gap-3"><span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">1</span><p className="text-[11px] font-bold text-slate-700">Sử dụng AI: Nhập nhanh giao dịch tại thanh tìm kiếm trên cùng. (Ví dụ: "Sáng ăn phở 50k hũ thiết yếu")</p></div>
                  <div className="flex items-start gap-3"><span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">2</span><p className="text-[11px] font-bold text-slate-700">Quy tắc 6 Hũ: Hệ thống tự động chia thu nhập của bạn theo tỉ lệ (55%, 10%, 10%, 10%, 10%, 5%).</p></div>
                  <div className="flex items-start gap-3"><span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">3</span><p className="text-[11px] font-bold text-slate-700">Vay nợ: Quản lý các khoản nợ phải trả và nợ thu hồi một cách minh bạch.</p></div>
                  <div className="flex items-start gap-3"><span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">4</span><p className="text-[11px] font-bold text-slate-700">Dữ liệu: Mọi thông tin lưu trên máy bạn. Hãy xuất CSV định kỳ để sao lưu!</p></div>
                </div>
                {/* MỤC MỚI THÊM: TÌM HIỂU QUY TẮC 6 CHIẾC LỌ QUA VIDEO */}
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Video Tài Liệu Tham Khảo</p>
                  <p className="text-[11px] font-bold text-slate-700">Tìm hiểu chi tiết hơn về quy tắc 6 chiếc lọ để quản lý tài chính cá nhân thông minh qua video sau:</p>
                  <a href="https://fb.watch/EB-ewk_ZJ5/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-3 bg-white border border-emerald-200 rounded-xl text-[10px] font-black text-emerald-600 shadow-sm hover:shadow-md transition-all active:scale-95 uppercase">
                    <span>🎬</span> Xem Video Quy Tắc 6 Lọ
                  </a>
                </div>
                <div className="text-center"><a href="https://itsuprogroup-my.sharepoint.com/:w:/g/personal/longld_itsupro_org/IQBdYXaYoB6oTItr2tb0ZwwZAd3RZWco8SxetSlAJWDF_kk?e=ZphnBf" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl transition-all hover:bg-indigo-700">TÀI LIỆU CHI TIẾT</a></div>
              </div>
            )}
          </div>
          <div className="p-4 border-t-2 border-slate-100 grid grid-cols-6 items-center justify-around bg-slate-50">
            {[ { id: 'app', icon: '⚙️', label: t.settings_app }, { id: 'export', icon: '📁', label: t.settings_data }, { id: 'info', icon: 'ℹ️', label: t.settings_info }, { id: 'connect', icon: '💬', label: t.settings_connect }, { id: 'policy', icon: '🛡️', label: t.settings_policy }, { id: 'guide', icon: '📖', label: t.settings_guide } ].map(tab => (
              <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all ${settingsTab === tab.id ? 'bg-white shadow-lg text-indigo-600 scale-105' : 'text-slate-400 hover:text-indigo-400'}`}><span className="text-lg">{tab.icon}</span><span className="text-[7px] font-black uppercase text-center">{tab.label}</span></button>
            ))}
          </div>
        </div>
      </div>

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-4 md:p-8 shadow-2xl relative overflow-hidden border-2 border-indigo-50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 opacity-50"></div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-3 uppercase mb-4 md:mb-8 relative z-10"><span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg text-sm">🏦</span>{editingLoanId ? 'Sửa thông tin vay nợ' : t.loan_new}</h2>
            <form onSubmit={handleSaveLoan} className="space-y-4 md:space-y-6 relative z-10">
               <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Hình thức giao dịch</label><div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200 shadow-inner"><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${loanForm.type === LoanType.BORROW ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}><span>💸</span> {t.loan_i_owe}</button><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${loanForm.type === LoanType.LEND ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><span>🤝</span> {t.loan_owes_me}</button></div></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"><div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_partner}</label><input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[11px] font-bold outline-none shadow-sm focus:border-indigo-400 transition-all" placeholder="Tên cá nhân / Tổ chức..." /></div><div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_jar_label}</label><select value={loanForm.loanJar} onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as JarType | 'AUTO'})} className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[10px] font-bold outline-none shadow-sm focus:border-indigo-400 transition-all cursor-pointer"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(jt => (<option key={jt} value={jt}>{t.jars[jt].name}</option>))}</select></div></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                 <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_date_label}</label>
                   <input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[10px] font-bold outline-none shadow-sm focus:border-indigo-400 transition-all" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_principal} ({settings.currency})</label>
                   <div className="relative">
                     <input required type="text" value={formatNumberForDisplay(loanPrincipalStr)} onChange={handleLoanPrincipalChange} placeholder="0" className="w-full p-2.5 pl-8 bg-slate-50 border-2 border-slate-200 rounded-xl text-[12px] font-black outline-none shadow-sm focus:border-indigo-400 transition-all text-indigo-700" />
                     <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">💰</span>
                   </div>
                   {settings.currency === 'JPY' && (<p className="text-[7px] font-black text-indigo-500 mt-0.5 uppercase italic tracking-tight leading-none">{getJpyBreakdown(loanPrincipalStr)}</p>)}
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_paid} ({settings.currency})</label>
                   <div className="relative">
                     <input type="text" value={formatNumberForDisplay(loanPaidAmountStr)} onChange={handleLoanPaidChange} placeholder="0" className="w-full p-2.5 pl-8 bg-slate-50 border-2 border-slate-200 rounded-xl text-[12px] font-black outline-none shadow-sm focus:border-indigo-400 transition-all text-emerald-600" />
                     <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">✅</span>
                   </div>
                   {settings.currency === 'JPY' && (<p className="text-[7px] font-black text-emerald-500 mt-0.5 uppercase italic tracking-tight leading-none">{getJpyBreakdown(loanPaidAmountStr)}</p>)}
                 </div>
               </div>
               <div className="flex items-center justify-between gap-3 md:gap-4 pt-2"><button type="button" onClick={() => setIsLoanModalOpen(false)} className="px-4 py-2 text-slate-400 font-black uppercase text-[8px] hover:text-red-500 transition-colors tracking-widest">HỦY</button><button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-black uppercase text-[9px] rounded-lg shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all tracking-widest border border-indigo-400/20">LƯU</button></div>
            </form>
            <button onClick={() => setIsLoanModalOpen(false)} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all text-xs">✕</button>
          </div>
        </div>
      )}

      {isPayLoanModalOpen && activeLoanForPay && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative"><h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter mb-6">💳 {activeLoanForPay.lenderName.toUpperCase()}</h2><form onSubmit={handleConfirmPayLoan} className="space-y-6"><div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Số tiền giao dịch ({settings.currency})</label><input required type="text" value={formatNumberForDisplay(payLoanAmount)} onChange={handlePayLoanAmountChange} placeholder="Nhập số tiền..." className="w-full p-3.5 bg-slate-50 border rounded-xl text-[13px] font-bold outline-none shadow-inner focus:border-indigo-300" />{settings.currency === 'JPY' && (<p className="text-[9px] font-black text-indigo-500 mt-1 uppercase italic">{getJpyBreakdown(payLoanAmount)}</p>)}</div><div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Thực hiện qua hũ</label><select value={payLoanJar} onChange={e => setPayLoanJar(e.target.value as JarType | 'AUTO')} className="w-full p-3.5 bg-slate-50 border rounded-xl text-[11px] font-bold outline-none h-12 shadow-inner focus:border-indigo-300"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(jt => (<option key={jt} value={jt}>{t.jars[jt].name}</option>))}</select></div><div className="flex items-center justify-between gap-4 pt-4"><button type="button" onClick={() => setIsPayLoanModalOpen(false)} className="flex-1 py-3.5 text-slate-400 font-black uppercase text-[10px] hover:text-red-500 transition-colors">Hủy</button><button type="submit" className="flex-[2] py-3.5 bg-indigo-600 text-white font-black uppercase text-[11px] rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95">Xác nhận</button></div></form></div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-[320px] p-10 shadow-2xl relative border-4 border-indigo-50"><div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-indigo-200 shadow-xl animate-bounce">✨</div><h2 className="text-lg font-black text-slate-800 mb-2 text-center uppercase tracking-tight">{t.user_label}</h2><p className="text-[10px] text-slate-400 text-center mb-6 font-bold">Hãy để chúng tôi đồng hành cùng tài chính của bạn</p><form onSubmit={(e) => { e.preventDefault(); const nameInput = (e.currentTarget.elements[0] as HTMLInputElement).value; setCurrentUser({ id: '1', email: 'user@finai.app', displayName: nameInput || 'User', provider: 'local', avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nameInput}` }); setIsAuthModalOpen(false); }} className="space-y-5"><input required type="text" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[12px] font-bold outline-none focus:border-indigo-400 shadow-inner" placeholder="..." /><button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-indigo-300 shadow-lg uppercase text-[11px] hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all">BẮT ĐẦU NGAY</button></form></div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm p-8 shadow-2xl relative"><h2 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2"><span>⇄</span> Điều chuyển hũ</h2><form onSubmit={handleTransferSubmit} className="space-y-4"><div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Đến hũ mục tiêu</label><select value={transferTo} onChange={e => setTransferTo(e.target.value as JarType)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-bold outline-none focus:border-indigo-400 shadow-inner">{Object.values(JarType).filter(jt => jt !== transferFrom).map(jt => <option key={jt} value={jt}>{t.jars[jt].name}</option>)}</select></div><div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Số tiền</label><input required type="text" value={formatNumberForDisplay(transferAmount)} onChange={e => setTransferAmount(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-bold outline-none focus:border-indigo-400 shadow-inner" placeholder="0" /></div><button type="submit" className="w-full py-4 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg active:scale-95 transition-all mt-4 hover:bg-emerald-700">Xác nhận chuyển</button></form><button onClick={() => setIsTransferModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors">✕</button></div>
        </div>
      )}
    </div>
  );
};

export default App;
