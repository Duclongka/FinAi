
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const EXCHANGE_RATES = {
  VND: 1,
  USD: 1 / 25400,
  JPY: 1 / 168,
};

const formatAmountUnits = (amount: number, currency: string): string => {
  if (!amount || amount <= 0) return '0' + (currency === 'VND' ? ' đồng' : currency === 'JPY' ? ' yên' : '');
  
  const formatWithCommas = (num: number) => num.toLocaleString('en-US');

  if (currency === 'VND') {
    const ty = Math.floor(amount / 1000000000);
    const trieu = Math.floor((amount % 1000000000) / 1000000);
    const ngan = Math.floor((amount % 1000000) / 1000);
    const dong = Math.floor(amount % 1000);
    let res = '';
    if (ty > 0) res += `${formatWithCommas(ty)} tỷ `;
    if (trieu > 0) res += `${formatWithCommas(trieu)} triệu `;
    if (ngan > 0) res += `${formatWithCommas(ngan)} ngàn `;
    if (dong > 0 || res === '') res += `${formatWithCommas(dong)} đồng`;
    return res.trim();
  } else if (currency === 'JPY') {
    const man = Math.floor(amount / 10000);
    const sen = Math.floor((amount % 10000) / 1000);
    const yen = Math.floor(amount % 1000);
    let res = '';
    if (man > 0) res += `${formatWithCommas(man)} man `;
    if (sen > 0) res += `${formatWithCommas(sen)} sên `;
    if (yen > 0 || res === '') res += `${formatWithCommas(yen)} yên`;
    return res.trim();
  } else if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '';
};

const formatDots = (val: string) => {
  if (!val) return "";
  const cleaned = val.toString().replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const TRANSLATIONS: Record<string, any> = {
  vi: {
    appTitle: "FINAI",
    stats_jars: "Tiền hũ",
    stats_debt: "Nợ phải trả",
    stats_lent: "Đang cho vay",
    stats_net: "Tài sản ròng",
    advice_title: "Lời khuyên từ chuyên gia",
    chart_title: "BIỂU ĐỒ THU CHI",
    pie_title: "PHÂN BỔ SỐ DƯ HŨ",
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
    loan_principal: "TIỀN GỐC",
    loan_paid_label: "ĐÃ TRẢ",
    loan_jar_label: "HŨ LIÊN QUAN",
    loan_date_label: "NGÀY THỰC HIỆN",
    loan_img_label: "ẢNH CHỨNG TỪ",
    loan_add_img: "THÊM ẢNH",
    settings_title: "CÀI ĐẶT ỨNG DỤNG",
    settings_data: "DỮ LIỆU",
    settings_data_export: "XUẤT DỮ LIỆU CSV",
    settings_data_import: "NHẬP DỮ LIỆU (AI)",
    settings_data_reset: "XÓA TẤT CẢ DỮ LIỆU",
    settings_info: "TIN",
    settings_connect: "GÓP Ý",
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
    onboarding_welcome: "Chào mừng đến với FINAI",
    onboarding_desc: "Hãy cho chúng tôi biết thông tin của bạn để bắt đầu hành trình tự do tài chính.",
    onboarding_name: "Họ và tên của bạn",
    onboarding_gender: "Giới tính",
    onboarding_male: "NAM",
    onboarding_female: "NỮ",
    onboarding_start: "BẮT ĐẦU NGAY",
    transfer_title: "CHUYỂN TIỀN GIỮA CÁC HŨ",
    transfer_from: "Từ hũ",
    transfer_to: "Đến hũ",
    transfer_amount: "SỐ TIỀN MUỐN CHUYỂN",
    transfer_cancel: "HỦY BỎ",
    transfer_confirm: "XÁC NHẬN CHUYỂN",
    save_loan: "LƯU KHOẢN VAY",
    view_photo: "XEM ẢNH",
    support_email: "EMAIL GÓP Ý",
    guide_video_btn: "TÌM HIỂU QUY TẮC 6 LỌ"
  },
  en: {
    appTitle: "FINAI",
    stats_jars: "Jar Balance",
    stats_debt: "Debts to Pay",
    stats_lent: "Money Lent",
    stats_net: "Net Assets",
    advice_title: "AI Financial Advice",
    chart_title: "INCOME & EXPENSE CHART",
    pie_title: "JAR ALLOCATION",
    chart_week: "Week",
    chart_month: "Month",
    chart_year: "Year",
    manual_title: "MANUAL ENTRY",
    manual_edit: "EDITING TRANSACTION",
    manual_cancel: "CANCEL",
    manual_type: "Transaction Type",
    manual_expense: "EXPENSE",
    manual_income: "INCOME",
    manual_amount: "Amount",
    manual_desc: "Description",
    manual_jar_img: "Allocation & Images",
    manual_allocation_only: "Allocation",
    manual_date_label: "Date",
    manual_auto: "✨ Auto-split 6 Jars",
    manual_save: "SAVE TRANSACTION",
    manual_update: "SAVE CHANGES",
    history_title: "TRANSACTION HISTORY",
    history_filter: "FILTER",
    history_type: "Type",
    history_jar: "Jar",
    history_date: "Date",
    history_all: "ALL",
    history_inc_only: "Income",
    history_exp_only: "Expense",
    history_more: "Load more ↓",
    history_empty: "No transactions",
    loan_title: "LOAN MANAGEMENT",
    loan_new: "ADD NEW LOAN",
    loan_edit: "EDIT LOAN",
    loan_pay: "PAY",
    loan_recover: "RECOVER",
    loan_i_owe: "I OWE",
    loan_owes_me: "OWES ME",
    loan_rem: "Rem",
    loan_paid: "Paid",
    loan_partner: "PARTNER",
    loan_principal: "PRINCIPAL",
    loan_paid_label: "PAID AMOUNT",
    loan_jar_label: "RELATED JAR",
    loan_date_label: "EXECUTION DATE",
    loan_img_label: "PHOTO",
    loan_add_img: "ADD PHOTO",
    settings_title: "APP SETTINGS",
    settings_data: "DATA",
    settings_data_export: "EXPORT CSV",
    settings_data_import: "IMPORT DATA (AI)",
    settings_data_reset: "RESET ALL DATA",
    settings_info: "INFO",
    settings_connect: "SUPPORT",
    settings_policy: "LEGAL",
    settings_guide: "GUIDE",
    settings_app: "CONFIG",
    currency: "CURRENCY",
    language: "LANGUAGE",
    lang_vi: "Vietnamese",
    lang_en: "English",
    lang_ja: "Japanese",
    user_label: "Settings",
    ai_placeholder: "Enter transaction (e.g., Dinner 20$ NEC jar)...",
    onboarding_welcome: "Welcome to FINAI",
    onboarding_desc: "Please provide your info to start your financial freedom journey.",
    onboarding_name: "Your full name",
    onboarding_gender: "Gender",
    onboarding_male: "MALE",
    onboarding_female: "FEMALE",
    onboarding_start: "START NOW",
    transfer_title: "TRANSFER BETWEEN JARS",
    transfer_from: "From Jar",
    transfer_to: "To Jar",
    transfer_amount: "TRANSFER AMOUNT",
    transfer_cancel: "CANCEL",
    transfer_confirm: "CONFIRM TRANSFER",
    save_loan: "SAVE LOAN",
    view_photo: "VIEW PHOTO",
    support_email: "FEEDBACK EMAIL",
    guide_video_btn: "LEARN 6-JARS RULE"
  },
  ja: {
    appTitle: "FINAI",
    stats_jars: "残高",
    stats_debt: "借金",
    stats_lent: "貸付金",
    stats_net: "純資産",
    advice_title: "AIアドバイス",
    chart_title: "収支チャート",
    pie_title: "資産配分",
    chart_week: "週",
    chart_month: "月",
    chart_year: "年",
    manual_title: "手動入力",
    manual_edit: "取引を編集",
    manual_cancel: "キャンセル",
    manual_type: "取引タイプ",
    manual_expense: "支出",
    manual_income: "収入",
    manual_amount: "金額",
    manual_desc: "内容",
    manual_jar_img: "配分と画像",
    manual_allocation_only: "配分",
    manual_date_label: "日付",
    manual_auto: "✨ 6つの瓶に自動分配",
    manual_save: "保存",
    manual_update: "変更を保存",
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
    loan_new: "新規ローン登録",
    loan_edit: "ローン編集",
    loan_pay: "支払う",
    loan_recover: "回収する",
    loan_i_owe: "私の借金",
    loan_owes_me: "貸している金",
    loan_rem: "残高",
    loan_paid: "支払済",
    loan_partner: "相手",
    loan_principal: "元金",
    loan_paid_label: "返済額",
    loan_jar_label: "関連する瓶",
    loan_date_label: "実行日",
    loan_img_label: "証拠写真",
    loan_add_img: "写真追加",
    settings_title: "設定",
    settings_data: "データ",
    settings_data_export: "CSVエクスポート",
    settings_data_import: "AIインポート",
    settings_data_reset: "データ初期化",
    settings_info: "情報",
    settings_connect: "サポート",
    settings_policy: "ポリシー",
    settings_guide: "ガイド",
    settings_app: "アプリ設定",
    currency: "通貨",
    language: "言語",
    lang_vi: "ベトナム語",
    lang_en: "英語",
    lang_ja: "日本語",
    user_label: "設定",
    ai_placeholder: "AI入力（例：昼食 1000円 生活費）...",
    onboarding_welcome: "FINAIへようこそ",
    onboarding_desc: "自由な未来のために, あなたの情報を教えてください。",
    onboarding_name: "お名前",
    onboarding_gender: "性別",
    onboarding_male: "男性",
    onboarding_female: "女性",
    onboarding_start: "はじめる",
    transfer_title: "瓶の間の資金移動",
    transfer_from: "元",
    transfer_to: "先",
    transfer_amount: "移動金額",
    transfer_cancel: "キャンセル",
    transfer_confirm: "移動を確定",
    save_loan: "ローンを保存",
    view_photo: "写真を見る",
    support_email: "フィードバックメール",
    guide_video_btn: "6つの瓶のルールを学ぶ"
  }
};

type AppTab = 'home' | 'entry' | 'history' | 'overview' | 'loans';

const App: React.FC = () => {
  const APP_VERSION = "v4.6.3";
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

  const [activeTab, setActiveTab] = useState<AppTab>('home');
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
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loanPrincipalStr, setLoanPrincipalStr] = useState('');
  const [loanPaidAmountStr, setLoanPaidAmountStr] = useState('');
  const [loanForm, setLoanForm] = useState<Omit<Partial<Loan>, 'loanJar'> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: ''
  });

  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [chartRange, setChartRange] = useState<'week' | 'month' | 'year'>('week');

  const aiInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loanPhotoInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!currentUser) return;
    const fetchAdvice = async () => {
      setIsAdviceLoading(true);
      const advice = await getFinancialAdvice(balances, stats, currentUser);
      setAiAdvice(advice);
      setIsAdviceLoading(false);
    };
    fetchAdvice();
  }, [balances, stats, currentUser, settings.language]);

  const convertValue = (valInVnd: number) => valInVnd * EXCHANGE_RATES[settings.currency];

  const parseFormattedNumber = (str: string) => {
    const cleaned = str.toString().replace(/,/g, "");
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
    const formatted = val.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
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
    setActiveTab('history');
    showToast("Success!");
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
        showToast("Added via AI!");
      } else showToast("Failed to recognize transaction.", "info");
    } catch (e) { showToast("AI Error.", "danger"); }
    finally { setIsLoading(false); setInput(''); }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(transferAmount);
    if (amountInVnd <= 0 || amountInVnd > balances[transferFrom]) return showToast("Insufficient balance.", "danger");
    setBalances(prev => {
      const nb = { ...prev };
      nb[transferFrom] -= amountInVnd;
      nb[transferTo] += amountInVnd;
      return nb;
    });
    const tx1: Transaction = { id: Date.now().toString(), type: 'expense', amount: amountInVnd, description: `Transfer: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferFrom, timestamp: Date.now() };
    const tx2: Transaction = { id: (Date.now()+1).toString(), type: 'income', amount: amountInVnd, description: `Received: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferTo, timestamp: Date.now() };
    setTransactions(p => [tx1, tx2, ...p]);
    setIsTransferModalOpen(false);
    setTransferAmount('');
    showToast("Transferred!");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanPrincipalStr) return;
    const principalVnd = parseFormattedNumber(loanPrincipalStr);
    const paidAmountVnd = parseFormattedNumber(loanPaidAmountStr || '0');
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : (loanForm.loanJar as JarType);
    const loanId = editingLoanId || Date.now().toString();
    
    if (editingLoanId) {
        const oldLoan = loans.find(l => l.id === editingLoanId);
        if (oldLoan && paidAmountVnd !== oldLoan.paidAmount) {
            const payDelta = Math.abs(paidAmountVnd - oldLoan.paidAmount);
            const isIncreasing = paidAmountVnd > oldLoan.paidAmount;
            
            let txType: 'income' | 'expense';
            if (oldLoan.type === LoanType.BORROW) {
                txType = isIncreasing ? 'expense' : 'income';
            } else {
                txType = isIncreasing ? 'income' : 'expense';
            }

            const payTx: Transaction = {
                id: `pay_${Date.now()}`,
                type: txType,
                amount: payDelta,
                description: `${isIncreasing ? 'Pay/Recover' : 'Correct'} loan: ${oldLoan.lenderName}`,
                jarType: finalLoanJar,
                timestamp: Date.now(),
                loanId: loanId
            };
            setTransactions(p => [payTx, ...p]);
            updateBalances(null, payTx);
        }
    }

    const syntheticTx: Transaction = {
        id: `loan_${loanId}`,
        type: loanForm.type === LoanType.BORROW ? 'income' : 'expense',
        amount: principalVnd,
        description: `${loanForm.type === LoanType.BORROW ? 'Borrowed from' : 'Lent to'}: ${loanForm.lenderName}`,
        jarType: finalLoanJar,
        timestamp: Date.now(),
        loanId: loanId
    };
    
    if (editingLoanId) {
       const oldLoan = loans.find(l => l.id === editingLoanId);
       if (oldLoan) {
          const oldSyntheticTx: Transaction = { id: `loan_${oldLoan.id}`, type: oldLoan.type === LoanType.BORROW ? 'income' : 'expense', amount: oldLoan.principal, description: `Reverse impact`, jarType: oldLoan.loanJar, timestamp: Date.now(), loanId: oldLoan.id };
          updateBalances(oldSyntheticTx, syntheticTx);
       }
       setLoans(p => p.map(l => l.id === editingLoanId ? { ...l, ...loanForm, principal: principalVnd, paidAmount: paidAmountVnd, loanJar: finalLoanJar } as Loan : l));
       setEditingLoanId(null);
       showToast("Loan updated!");
    } else {
       const newLoan: Loan = { ...loanForm as Loan, id: loanId, principal: principalVnd, paidAmount: paidAmountVnd, loanJar: finalLoanJar };
       setLoans(p => [newLoan, ...p]);
       updateBalances(null, syntheticTx);
       showToast("Loan saved!");
    }
    setIsLoanModalOpen(false);
    setLoanPrincipalStr('');
    setLoanPaidAmountStr('');
    setLoanForm({ type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '' });
  };

  const handleLoanPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return showToast("Image too large (>2MB)", "danger");
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoanForm(prev => ({ ...prev, imageUrl: reader.result as string }));
        showToast("Photo added!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      updateBalances(tx, null);
      setTransactions(p => p.filter(t => t.id !== id));
      showToast("Transaction deleted.");
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setManualType(tx.type);
    setManualAmount(formatDots((tx.amount * EXCHANGE_RATES[settings.currency]).toString()));
    setManualDesc(tx.description);
    setManualJar(tx.jarType || 'AUTO');
    setManualDate(new Date(tx.timestamp).toISOString().split('T')[0]);
    setActiveTab('entry');
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
        const netImpactOnJars = loan.principal - loan.paidAmount;
        if (netImpactOnJars > 0) {
            const reversalTx: Transaction = {
                id: `loan_revert_${Date.now()}`,
                type: loan.type === LoanType.BORROW ? 'expense' : 'income',
                amount: netImpactOnJars,
                description: `Revert deletion of loan with ${loan.lenderName}`,
                jarType: loan.loanJar,
                timestamp: Date.now()
            };
            updateBalances(null, reversalTx);
        }
        setLoans(p => p.filter(l => l.id !== id));
        setTransactions(p => p.filter(t => t.loanId !== id && t.id !== `loan_${id}`));
        showToast("Loan and data restored.");
    }
  };

  const handlePayLoan = (loan: Loan) => {
     setLoanForm({ ...loan, loanJar: loan.loanJar || 'AUTO' });
     setLoanPrincipalStr(formatDots((loan.principal * EXCHANGE_RATES[settings.currency]).toString()));
     setLoanPaidAmountStr(formatDots((loan.paidAmount * EXCHANGE_RATES[settings.currency]).toString()));
     setEditingLoanId(loan.id);
     setIsLoanModalOpen(true);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return showToast("No data to export.");
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
    showToast("Exported CSV!");
  };

  const handleResetData = () => {
    if (window.confirm("ARE YOU SURE YOU WANT TO RESET ALL DATA? THIS CANNOT BE UNDONE.")) {
      setTransactions([]);
      setBalances({ [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 });
      setLoans([]);
      localStorage.clear();
      showToast("Data reset.");
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
    const count = chartRange === 'week' ? 7 : chartRange === 'month' ? 30 : 12;
    
    if (chartRange === 'year') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { month: '2-digit', year: 'numeric' });
            const monthT = transactions.filter(tx => {
                const txD = new Date(tx.timestamp);
                return txD.getMonth() === d.getMonth() && txD.getFullYear() === d.getFullYear();
            });
            data.push({
                name: label,
                Thu: convertValue(monthT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
                Chi: convertValue(monthT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
            });
        }
    } else {
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dayT = transactions.filter(tx => new Date(tx.timestamp).toDateString() === d.toDateString());
            data.push({
                name: d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' }),
                Thu: convertValue(dayT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
                Chi: convertValue(dayT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
            });
        }
    }
    return data;
  }, [transactions, settings.currency, settings.language, chartRange]);

  const pieData = useMemo(() => {
    return Object.entries(balances).map(([type, amount]) => ({
      name: `${JAR_CONFIG[type as JarType].name} (${formatAmountUnits(amount, settings.currency)})`,
      value: Math.max(0, amount),
      color: JAR_CONFIG[type as JarType].color
    })).filter(d => d.value > 0);
  }, [balances, settings.currency]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const isLoanRelated = tx.loanId || tx.id.startsWith('loan_') || tx.id.startsWith('pay_');
      if (isLoanRelated) return false;
      const matchType = historyFilter === 'all' || tx.type === historyFilter;
      const matchJar = historyJarFilter === 'all' || tx.jarType === historyJarFilter;
      const matchDate = !historyDateFilter || new Date(tx.timestamp).toISOString().split('T')[0] === historyDateFilter;
      return matchType && matchJar && matchDate;
    }).slice(0, 50);
  }, [transactions, historyFilter, historyJarFilter, historyDateFilter]);

  const [onboardingForm, setOnboardingForm] = useState({ name: '', gender: 'male' as 'male' | 'female' });

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pt-36 pb-32 font-sans flex flex-col items-center">
      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'success' ? 'bg-indigo-600' : 'bg-slate-800'} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-2xl animate-in slide-in-from-top-4`}>
          {toast.msg}
        </div>
      )}

      {isAuthModalOpen && !currentUser && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/90 backdrop-blur-2xl p-4">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[3rem] w-full max-md:max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-200">✨</div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.onboarding_welcome}</h1>
                <p className="text-[11px] font-semibold text-slate-500">{t.onboarding_desc}</p>
              </div>
              <div className="w-full space-y-5">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-4">{t.onboarding_name}</label>
                  <input type="text" value={onboardingForm.name} onChange={e => setOnboardingForm({...onboardingForm, name: e.target.value})} placeholder="Nguyễn Văn A" className="w-full bg-white/50 border-2 border-slate-100 rounded-[2rem] px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-sm" />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-4">{t.onboarding_gender}</label>
                  <div className="flex gap-4">
                    <button onClick={() => setOnboardingForm({...onboardingForm, gender: 'male'})} className={`flex-1 py-4 rounded-[2rem] text-xs font-black transition-all border-2 ${onboardingForm.gender === 'male' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}>{t.onboarding_male}</button>
                    <button onClick={() => setOnboardingForm({...onboardingForm, gender: 'female'})} className={`flex-1 py-4 rounded-[2rem] text-xs font-black transition-all border-2 ${onboardingForm.gender === 'female' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}>{t.onboarding_female}</button>
                  </div>
                </div>
              </div>
              <button onClick={() => onboardingForm.name.trim() && setCurrentUser({ id: Date.now().toString(), displayName: onboardingForm.name, gender: onboardingForm.gender, email: '', provider: 'local' })} disabled={!onboardingForm.name.trim()} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-black active:scale-95 transition-all disabled:opacity-50 shadow-2xl">
                {t.onboarding_start}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with AI Input */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-indigo-100 p-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col">
              <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em] flex items-center gap-1.5">
                <span className="opacity-40">👋</span> HI, <span className="text-slate-900 underline decoration-indigo-200 decoration-2 underline-offset-2">{currentUser?.displayName || 'YOU'}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="opacity-50">📅</span> {currentTime.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="w-[1px] h-2 bg-slate-200"></div>
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="opacity-50">⏰</span> {currentTime.toLocaleTimeString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[12px] font-black text-slate-900 uppercase leading-none tracking-tighter">FINAI</span>
              <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">{APP_VERSION}</span>
            </div>
          </div>
          <form onSubmit={handleProcessInput} className="relative w-full">
            <input ref={aiInputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.ai_placeholder} className="w-full bg-slate-100 border-2 border-slate-200 rounded-full px-5 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-400 transition-all" />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95">
              {isLoading ? <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨"}
            </button>
          </form>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto px-4 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {activeTab === 'home' && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
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

            <section className="bg-white p-5 rounded-[2.5rem] border-2 border-indigo-50 shadow-xl shadow-indigo-100/50 flex items-center gap-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-indigo-200 z-10">
                {isAdviceLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "🦉"}
              </div>
              <div className="space-y-1 z-10 flex-1">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{t.advice_title}</h4>
                <p className="text-[12px] font-bold text-slate-700 italic leading-relaxed">"{aiAdvice}"</p>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.values(JarType).map(type => (
                <JarVisual key={type} jar={JAR_CONFIG[type]} balance={balances[type]} currency={settings.currency} convertValue={convertValue} onTransferClick={() => { setTransferFrom(type); setIsTransferModalOpen(true); }} />
              ))}
            </section>
          </>
        )}

        {activeTab === 'entry' && (
          <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">📝 {t.manual_title}</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
               <div className="flex bg-slate-100 p-1 rounded-2xl h-12 border-2 border-slate-200">
                  <button type="button" onClick={() => { setManualType('expense'); setManualJar(JarType.NEC); }} className={`flex-1 text-[10px] font-black rounded-xl transition-all ${manualType === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>{t.manual_expense}</button>
                  <button type="button" onClick={() => { setManualType('income'); setManualJar('AUTO'); }} className={`flex-1 text-[10px] font-black rounded-xl transition-all ${manualType === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>{t.manual_income}</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="relative h-12">
                    <input required type="text" value={manualAmount} onChange={e => setManualAmount(formatDots(e.target.value))} placeholder={`${t.manual_amount} (${settings.currency})`} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none h-full pr-24" />
                    <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 pointer-events-none">{formatAmountUnits(parseFormattedNumber(manualAmount) * EXCHANGE_RATES[settings.currency], settings.currency)}</p>
                 </div>
                 <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder={t.manual_desc} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none h-12" />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <select value={manualJar} onChange={e => setManualJar(e.target.value as any)} className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-[11px] font-bold outline-none h-12">
                    <option value="AUTO">{t.manual_auto}</option>
                    {Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].name}</option>)}
                 </select>
                 <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-xs font-bold h-12" />
               </div>
               <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-xl h-12 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">{editingTransactionId ? t.manual_update : t.manual_save}</button>
                  {editingTransactionId && (
                     <button type="button" onClick={() => { setEditingTransactionId(null); setManualAmount(''); setManualDesc(''); }} className="px-6 bg-slate-200 text-slate-500 text-[11px] font-black uppercase rounded-xl h-12">{t.manual_cancel}</button>
                  )}
               </div>
            </form>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📜</span>
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{t.history_title}</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 pb-4 border-b border-slate-100">
                <div className="space-y-0.5">
                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_type}</label>
                   <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1 text-[9px] font-bold outline-none h-8">
                      <option value="all">{t.history_all}</option>
                      <option value="income">{t.history_inc_only}</option>
                      <option value="expense">{t.history_exp_only}</option>
                   </select>
                </div>
                <div className="space-y-0.5">
                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_jar}</label>
                   <select value={historyJarFilter} onChange={e => setHistoryJarFilter(e.target.value as any)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1 text-[9px] font-bold outline-none h-8">
                      <option value="all">{t.history_all}</option>
                      {Object.values(JarType).map(jt => <option key={jt} value={jt}>{JAR_CONFIG[jt].name}</option>)}
                   </select>
                </div>
                <div className="space-y-0.5">
                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_date}</label>
                   <input type="date" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1 text-[9px] font-bold outline-none h-8" />
                </div>
             </div>
             <div className="space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
                {filteredTransactions.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 italic">{t.history_empty}</p>
                   </div>
                ) : (
                  filteredTransactions.map(tx => (
                    <div key={tx.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all cursor-default flex items-center justify-between group relative overflow-hidden select-none hover:border-indigo-200 hover:bg-white">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{tx.type === 'income' ? '↑' : '↓'}</div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 line-clamp-1 leading-tight">{tx.description}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[7px] font-black text-slate-400 uppercase">{new Date(tx.timestamp).toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US')}</span>
                            {tx.jarType && <span className="text-[6px] font-black bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-500 uppercase">{JAR_CONFIG[tx.jarType].name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <p className={`text-[11px] font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</p>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all ml-1">
                            <button onClick={() => handleEditTransaction(tx)} className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm text-[10px]">✏️</button>
                            <button onDoubleClick={() => handleDeleteTransaction(tx.id)} className="w-7 h-7 bg-red-50 text-red-600 rounded-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm text-[10px]">🗑️</button>
                         </div>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </section>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl min-h-[350px]">
              <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">📊 {t.chart_title}</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button onClick={() => setChartRange('week')} className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${chartRange === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t.chart_week}</button>
                    <button onClick={() => setChartRange('month')} className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${chartRange === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t.chart_month}</button>
                    <button onClick={() => setChartRange('year')} className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${chartRange === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t.chart_year}</button>
                </div>
              </div>
              <div className="h-[250px] pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                    <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl min-h-[400px]">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">⭕ {t.pie_title}</h3>
              <div className="h-[300px] flex flex-col items-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" labelLine={false}>
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[10px] font-bold text-slate-300 italic">{t.history_empty}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'loans' && (
          <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl min-h-[160px] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-3">
              <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📉</span> {t.loan_title}</h3>
              <button onClick={() => { setEditingLoanId(null); setIsLoanModalOpen(true); }} className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"><span>＋</span> {t.loan_new}</button>
            </div>
            {loans.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 py-20">
                 <p className="text-slate-400 italic text-[10px] font-bold">{t.history_empty}</p>
              </div>
            ) : (
              <div className="space-y-4">
                 {loans.map(loan => {
                   const isCompleted = loan.paidAmount >= loan.principal;
                   const progress = Math.min(100, (loan.paidAmount / loan.principal) * 100);
                   return (
                     <div key={loan.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 group relative transition-all hover:border-indigo-400 hover:bg-white select-none overflow-hidden pb-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm ${loan.type === LoanType.BORROW ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{loan.type === LoanType.BORROW ? '💸' : '🤝'}</div>
                             <div>
                               <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{loan.lenderName}</p>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <p className="text-[8px] font-bold text-slate-400">{loan.startDate}</p>
                                 {loan.imageUrl && (
                                   <button onClick={() => setViewingImageUrl(loan.imageUrl!)} className="w-4 h-4 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[7px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm">📷</button>
                                 )}
                               </div>
                             </div>
                          </div>
                          <div className="flex flex-col items-end">
                             {!isCompleted && (
                                <button onClick={() => handlePayLoan(loan)} className={`px-2 py-1 text-[7px] font-black uppercase rounded-lg shadow-sm mb-1 ${loan.type === LoanType.BORROW ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{loan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</button>
                             )}
                             <p className={`text-[11px] font-black ${isCompleted ? 'text-slate-400 line-through' : (loan.type === LoanType.BORROW ? 'text-rose-500' : 'text-emerald-600')}`}>{formatCurrency(loan.principal - loan.paidAmount)}</p>
                             <p className="text-[8px] font-bold text-slate-400 mt-0.5">{t.loan_paid}: {formatCurrency(loan.paidAmount)}</p>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2"><div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-indigo-500' : (loan.type === LoanType.BORROW ? 'bg-rose-400' : 'bg-emerald-400')}`} style={{ width: `${progress}%` }} /></div>
                        <div className="flex justify-between mt-2 px-1"><span className="text-[8px] font-bold text-slate-400 uppercase">{t.manual_allocation_only}: {progress.toFixed(0)}%</span><span className="text-[8px] font-bold text-slate-400 uppercase">{isCompleted ? 'Done' : `${t.loan_rem}: ${formatCurrency(loan.principal - loan.paidAmount)}`}</span></div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all z-20">
                           {!isCompleted && <button onClick={() => handleEditLoan(loan)} className="w-7 h-7 bg-white text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white shadow-md border border-indigo-100 text-[10px]">✏️</button>}
                           <button onDoubleClick={() => handleDeleteLoan(loan.id)} className="w-7 h-7 bg-white text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white shadow-md border border-rose-100 text-[10px]">🗑️</button>
                        </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-indigo-100/50 p-2 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-1 md:px-4">
          <div className="flex items-center gap-1 md:gap-4 flex-1 justify-start">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'home' ? 'bg-indigo-50 text-indigo-600 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl">🏠</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">Home</span>
            </button>
            <button onClick={() => setActiveTab('entry')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'entry' ? 'bg-indigo-50 text-indigo-600 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl">📝</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">Entry</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-600 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl">📜</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">History</span>
            </button>
          </div>

          <button onClick={() => setActiveTab('entry')} className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-indigo-200 hover:scale-110 active:scale-95 transition-all -translate-y-5 ring-4 ring-white flex-shrink-0 mx-2">
            <span className="text-3xl font-light">＋</span>
          </button>

          <div className="flex items-center gap-1 md:gap-4 flex-1 justify-end">
            <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-600 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl">📊</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">Overview</span>
            </button>
            <button onClick={() => setActiveTab('loans')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'loans' ? 'bg-indigo-50 text-indigo-600 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-xl">🏦</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">Loans</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="flex flex-col items-center gap-1 p-2 rounded-2xl text-slate-400 hover:bg-slate-50 transition-all">
              <span className="text-xl">⚙️</span>
              <span className="text-[7px] font-black uppercase tracking-tighter">Menu</span>
            </button>
          </div>
        </div>
      </div>

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
                        {['VND', 'JPY', 'USD'].map(curr => <button key={curr} onClick={() => setSettings({...settings, currency: curr as any})} className={`flex-1 py-2.5 text-[9px] font-black rounded-xl transition-all ${settings.currency === curr ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{curr}</button>)}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.language}</label>
                      <div className="bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-200 flex flex-col gap-1">
                        {['Tiếng Việt', 'Tiếng Anh', 'Tiếng Nhật'].map((lang, idx) => {
                          const code = ['vi', 'en', 'ja'][idx] as 'vi' | 'en' | 'ja';
                          const display = code === 'vi' ? t.lang_vi : code === 'en' ? t.lang_en : t.lang_ja;
                          return <button key={lang} onClick={() => setSettings({...settings, language: code})} className={`w-full py-3 text-[9px] font-bold rounded-xl transition-all text-center ${settings.language === code ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{display}</button>;
                        })}
                      </div>
                   </div>
                </div>
              )}
              {settingsTab === 'policy' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 text-[11px] leading-relaxed">
                  <h3 className="text-[14px] font-black text-red-600 uppercase text-center mb-6">CHÍNH SÁCH BẢO MẬT & MIỄN TRỪ TRÁCH NHIỆM</h3>
                  <div className="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-4">
                    <p><strong>1. Quyền riêng tư tuyệt đối:</strong> Ứng dụng FINAI cam kết không lưu trữ bất kỳ dữ liệu tài chính nào của người dùng trên máy chủ (server). Mọi dữ liệu đều được lưu trữ trực tiếp trên thiết bị cá nhân (LocalStorage/Browser Storage) của chính bạn.</p>
                    <p><strong>2. An toàn mạng:</strong> Chúng tôi tuân thủ nghiêm ngặt Luật An toàn thông tin mạng và Luật An ninh mạng Việt Nam. Vì dữ liệu không được tải lên mạng, nguy cơ rò rỉ dữ liệu cá nhân từ hệ thống là bằng 0.</p>
                    <p><strong>3. Trách nhiệm người dùng:</strong> Do đặc thù lưu trữ tại chỗ, người dùng có trách nhiệm tự bảo mật thiết bị truy cập và sao lưu dữ liệu (qua tính năng Export CSV).</p>
                    <p><strong>4. Miễn trừ trách nhiệm:</strong> FINAI không chịu trách nhiệm cho bất kỳ mất mát dữ liệu nào do lỗi thiết bị, xóa bộ nhớ trình duyệt, hoặc hành vi xâm nhập trái phép vào thiết bị của người dùng.</p>
                    <div className="h-[1px] bg-red-200 my-4"></div>
                    <p className="text-red-500 font-black italic text-center text-[10px]">
                      * DỰA TRÊN LUẬT AN NINH MẠNG VIỆT NAM 2018 VÀ NGHỊ ĐỊNH 13/2023/NĐ-CP VỀ BẢO VỆ DỮ LIỆU CÁ NHÂN.
                    </p>
                  </div>
                </div>
              )}
              {settingsTab === 'guide' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                  <h3 className="text-[14px] font-black text-indigo-600 uppercase text-center">HƯỚNG DẪN SỬ DỤNG</h3>
                  <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] space-y-6">
                    <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">1</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Sử dụng AI: Nhập nhanh giao dịch tại thanh tìm kiếm trên cùng. (Ví dụ: "Sáng ăn phở 50k hũ thiết yếu")</p>
                    </div>
                    <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">2</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Quy tắc 6 Hũ: Hệ thống tự động chia thu nhập của bạn theo tỉ lệ (55%, 10%, 10%, 10%, 10%, 5%).</p>
                    </div>
                    <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">3</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Vay nợ: Quản lý các khoản nợ phải trả và nợ thu hồi một cách minh bạch.</p>
                    </div>
                    <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">4</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Dữ liệu: Mọi thông tin lưu trên máy bạn. Hãy xuất CSV định kỳ để sao lưu!</p>
                    </div>
                    <a href="https://fb.watch/EFXzA_Mhre/" target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-2xl text-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all mt-4 tracking-widest">
                       {t.guide_video_btn}
                    </a>
                  </div>
                </div>
              )}
              {settingsTab === 'info' && (
                <div className="flex flex-col items-center py-10 space-y-4">
                   <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center text-3xl shadow-xl">✨</div>
                   <div className="text-center">
                      <h2 className="text-xl font-black text-slate-800 tracking-tighter">FINAI</h2>
                      <p className="text-[10px] font-bold text-slate-500 mt-1">Dựa trên nguyên tắc quản lý tài chính 6 lọ của T. Harv Eker</p>
                      <p className="text-[9px] font-black text-indigo-600 uppercase mt-4 tracking-widest">THIẾT KẾ BỞI LOONG LEE</p>
                      <p className="text-[8px] font-bold text-slate-400 italic mt-1">Version {APP_VERSION}</p>
                   </div>
                </div>
              )}
              {settingsTab === 'connect' && (
                <div className="space-y-4">
                   <a href="https://www.facebook.com/duclongka" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 group transition-all hover:bg-blue-100/50"><div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg font-black">f</div><span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">FACEBOOK</span></a>
                   <div className="flex items-center gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100"><div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-lg">💬</div><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase">ZALO</span><span className="text-[10px] font-black text-emerald-800 uppercase">0964.855.899</span></div></div>
                   <a href="mailto:longld@itsupro.org" className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 group transition-all hover:bg-indigo-100/50"><div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-lg">✉️</div><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase">{t.support_email}</span><span className="text-[10px] font-black text-indigo-800 uppercase truncate">longld@itsupro.org</span></div></a>
                </div>
              )}
              {settingsTab === 'export' && (
                <div className="space-y-6 pt-5">
                   <button onClick={exportToCSV} className="w-full py-5 bg-emerald-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2"><span>📤</span> {t.settings_data_export}</button>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2"><span>📥</span> {t.settings_data_import}</button>
                   <input type="file" hidden ref={fileInputRef} />
                   <button onClick={handleResetData} className="w-full py-5 bg-red-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2"><span>⚠️</span> {t.settings_data_reset}</button>
                </div>
              )}
            </div>
            <div className="p-3 border-t grid grid-cols-6 items-center justify-around bg-slate-50">
              {[ { id: 'app', icon: '⚙️', label: t.settings_app }, { id: 'export', icon: '📁', label: t.settings_data }, { id: 'info', icon: 'ℹ️', label: t.settings_info }, { id: 'connect', icon: '💬', label: t.settings_connect }, { id: 'policy', icon: '🛡️', label: t.settings_policy }, { id: 'guide', icon: '📖', label: t.settings_guide } ].map(tab => (
                <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-1 py-1 rounded-xl transition-all ${settingsTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>
                  <span className="text-base">{tab.icon}</span>
                  <span className="text-[6px] font-black uppercase text-center leading-none">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 shadow-2xl relative animate-in zoom-in-95">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-8 tracking-widest border-b pb-4"><span className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">🏦</span> {editingLoanId ? t.loan_edit : t.loan_new}</h2>
            <form onSubmit={handleSaveLoan} className="space-y-6">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 border-2 border-slate-200">
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loanForm.type === LoanType.BORROW ? 'bg-white shadow-md text-rose-600' : 'text-slate-400'}`}>💸 {t.loan_i_owe}</button>
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${loanForm.type === LoanType.LEND ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>🤝 {t.loan_owes_me}</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_partner}</label><input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none" placeholder="..." /></div>
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_jar_label}</label><select value={loanForm.loanJar} onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as any})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(jt => <option key={jt} value={jt}>{JAR_CONFIG[jt].name}</option>)}</select></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_date_label}</label>
                  <input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_img_label}</label>
                  <div className="relative">
                    <input type="file" hidden ref={loanPhotoInputRef} accept="image/*" onChange={handleLoanPhotoChange} />
                    <button type="button" onClick={() => loanPhotoInputRef.current?.click()} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-black uppercase text-indigo-600 flex items-center justify-center gap-2 hover:bg-white transition-all">
                      {loanForm.imageUrl ? '✅' : '📷'} {t.loan_add_img}
                    </button>
                    {loanForm.imageUrl && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-100 rounded-full border-2 border-white overflow-hidden shadow-sm flex items-center justify-center pointer-events-none">
                        <img src={loanForm.imageUrl} className="w-full h-full object-cover" alt="Proof thumbnail" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_principal}</label><div className="relative"><input required type="text" value={loanPrincipalStr} onChange={e => setLoanPrincipalStr(formatDots(e.target.value))} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none" placeholder="0" /><p className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(loanPrincipalStr) * EXCHANGE_RATES[settings.currency], settings.currency)}</p></div></div>
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_paid_label}</label><div className="relative"><input type="text" value={loanPaidAmountStr} onChange={e => setLoanPaidAmountStr(formatDots(e.target.value))} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold outline-none" placeholder="0" /><p className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(loanPaidAmountStr) * EXCHANGE_RATES[settings.currency], settings.currency)}</p></div></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setIsLoanModalOpen(false); setEditingLoanId(null); }} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl tracking-widest transition-colors">{t.manual_cancel}</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all tracking-widest">{t.save_loan}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingImageUrl && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setViewingImageUrl(null)}>
          <button onClick={() => setViewingImageUrl(null)} className="absolute top-8 right-8 text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-all z-10">✕</button>
          <img src={viewingImageUrl} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" alt="Receipt Preview" />
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-sm:w-[95%] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-[14px] font-black text-slate-800 uppercase text-center mb-8 tracking-widest">{t.transfer_title}</h2>
            <form onSubmit={handleTransferSubmit} className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-100">
                 <div className="flex-1 text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-2">{t.transfer_from}</p><div className="text-3xl mb-1">{JAR_CONFIG[transferFrom].icon}</div><p className="text-[10px] font-black text-slate-800 uppercase">{JAR_CONFIG[transferFrom].name}</p></div>
                 <div className="text-indigo-400 text-2xl font-bold animate-pulse">➔</div>
                 <div className="flex-1 text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-2">{t.transfer_to}</p><select value={transferTo} onChange={e => setTransferTo(e.target.value as JarType)} className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 text-[10px] font-black outline-none text-center shadow-sm">{Object.values(JarType).filter(t => t !== transferFrom).map(t => <option key={t} value={t}>{JAR_CONFIG[t].name}</option>)}</select></div>
              </div>
              <div className="space-y-2"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">{t.transfer_amount}</label><div className="relative"><input required type="text" value={transferAmount} onChange={e => setTransferAmount(formatDots(e.target.value))} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[16px] font-black outline-none text-center focus:border-indigo-400" placeholder="0" /><p className="absolute bottom-2 right-4 text-[8px] font-bold text-slate-400">{formatAmountUnits(parseFormattedNumber(transferAmount) * EXCHANGE_RATES[settings.currency], settings.currency)}</p></div></div>
              <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 text-[11px] font-black uppercase rounded-2xl">{t.transfer_cancel}</button>
                 <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl hover:bg-indigo-700">{t.transfer_confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
