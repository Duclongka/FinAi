
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings, RecurringTemplate, EventGroup, SubscriptionType } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice } from './services/geminiService';
import JarVisual from './components/JarVisual';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type AppTab = 'home' | 'history' | 'overview' | 'loans';

const SUBSCRIPTION_DURATIONS: Record<SubscriptionType, number> = {
  '1d': 1, '3d': 3, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095
};

const EXCHANGE_RATES = {
  VND: 1,
  USD: 1 / 25400,
  JPY: 1 / 168,
};

const formatDots = (val: string) => {
  if (!val) return "";
  const cleaned = val.toString().replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const evaluateMath = (expr: string): string => {
  try {
    const sanitized = expr.replace(/[^0-9+\-*/.%()]/g, '');
    const withPercent = sanitized.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
    const result = new Function(`return ${withPercent}`)();
    return isFinite(result) ? result.toString() : "";
  } catch {
    return "";
  }
};

const TRANSLATIONS: Record<string, any> = {
  vi: {
    appTitle: "FinAi",
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
    manual_title: "Thêm giao dịch mới",
    manual_edit: "ĐANG SỬA GIAO DỊCH",
    manual_cancel: "HỦY",
    manual_type: "Loại giao dịch",
    manual_expense: "CHI TIÊU",
    manual_income: "THU NHẬP",
    manual_amount: "Số tiền",
    manual_desc: "Nội dung",
    manual_note: "Ghi chú",
    manual_jar_img: "Phân bổ",
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
    history_from: "Từ ngày",
    history_to: "Đến ngày",
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
    loan_partner: "Đối tác",
    loan_principal: "Tiền gốc",
    loan_paid_label: "Đã trả/thu",
    loan_jar_label: "Hũ liên quan",
    loan_date_label: "Ngày thực hiện",
    loan_img_label: "Ảnh chứng từ",
    loan_add_img: "THÊM ẢNH",
    settings_title: "CÀI ĐẶT ỨNG DỤNG",
    settings_data: "DỮ LIỆU",
    settings_data_export: "XUẤT DỮ LIỆU CSV",
    settings_data_import: "NHẬP DỮ LIỆU (AI)",
    settings_data_reset: "XÓA TẤT CẢ DỮ LIỆU",
    settings_info: "THÔNG TIN",
    settings_connect: "GÓP Ý",
    settings_policy: "PHÁP LÝ",
    settings_guide: "HDSD",
    settings_app: "CÀI ĐẶT",
    settings_notification: "HẸN GIỜ THÔNG BÁO",
    settings_notification_desc: "Nhắc nhở ghi chép chi tiêu hằng ngày",
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
    guide_video_btn: "TÌM HIỂU QUY TẮC 6 LỌ",
    nav_home: "TRANG CHỦ",
    nav_entry: "NHẬP LIỆU",
    nav_history: "LỊCH SỬ",
    nav_overview: "TỔNG QUAN",
    nav_loans: "GD KHÁC",
    nav_menu: "MENU",
    jar_nec_name: "Thiết yếu",
    jar_nec_desc: "Dành cho các khoản chi tiêu cần thiết hàng tháng như tiền thuê nhà, hóa đơn điện nước, thực phẩm, và các chi phí sinh hoạt khác.",
    jar_lts_name: "Tiết kiệm",
    jar_lts_desc: "Dùng để tiết kiệm cho các mục tiêu lớn trong tương lai như mua nhà, mua xe hoặc du lịch.",
    jar_edu_name: "Giáo dục",
    jar_edu_desc: "Dành cho việc đầu tư vào tri thức và kỹ năng, giúp nâng cao giá trị bản thân và phát triển sự nghiệp.",
    jar_play_name: "Hưởng thụ",
    jar_play_desc: "Dùng cho các khoản chi tiêu giải trí như đi du lịch, xem phim, mua sắm, giúp bạn tận hưởng cuộc sống.",
    jar_ffa_name: "Đầu tư",
    jar_ffa_desc: "Dành cho các khoản đầu tư nhằm tăng thu nhập, giúp bạn đạt được tự do tài chính trong tương lai.",
    jar_give_name: "Cho đi",
    jar_give_desc: "Dùng để ủng hộ các tổ chức từ thiện hoặc giúp đỡ người thân, bạn bè, tạo giá trị cộng đồng.",
    recurring_title: "GIAO DỊCH ĐỊNH KỲ",
    recurring_add: "THÊM ĐỊNH KỲ",
    event_title: "GD THEO SỰ KIỆN",
    event_add: "+Tạo SK mới",
    event_save_history: "Lưu lịch sử chung",
    event_delete: "Xóa sự kiện",
    event_entry_title: "Nhập liệu sự kiện",
    history_detail_title: "CHI TIÊU CHI TIẾT",
    confirm_delete_title: "XÁC NHẬN XÓA",
    confirm_delete_msg: "Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch này?",
    loan_detail_title: "THÔNG TIN GIAO DỊCH VAY NỢ"
  }
};

const App: React.FC = () => {
  const APP_VERSION = "v5.6.5";
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

  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>(() => {
    const saved = localStorage.getItem('jars_recurring');
    return saved ? JSON.parse(saved) : [];
  });

  const [events, setEvents] = useState<EventGroup[]>(() => {
    const saved = localStorage.getItem('jars_events');
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
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'export' | 'info' | 'policy' | 'guide' | 'app'>('app');
  
  const [isHistoryFilterModalOpen, setIsHistoryFilterModalOpen] = useState(false);
  const [isHistoryDetailModalOpen, setIsHistoryDetailModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [historyJarFilter, setHistoryJarFilter] = useState<JarType | 'all'>('all');
  const [historyFromDateFilter, setHistoryFromDateFilter] = useState<string>(''); 
  const [historyToDateFilter, setHistoryToDateFilter] = useState<string>(''); 
  const [visibleTxCount, setVisibleTxCount] = useState(15);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualJar, setManualJar] = useState<JarType | 'AUTO'>(JarType.NEC);
  const [manualDate, setManualDate] = useState(getTodayString());
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcTarget, setCalcTarget] = useState<'manual' | 'loan' | 'payment' | 'recurring' | 'event' | 'transfer'>('manual');

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isLoanDetailModalOpen, setIsLoanDetailModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isLoanPaymentModalOpen, setIsLoanPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amountStr: '', date: getTodayString(), jar: JarType.NEC as JarType | 'AUTO', note: '', imageUrl: '' });
  const [paymentLoanId, setPaymentLoanId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loanPrincipalStr, setLoanPrincipalStr] = useState('');
  const [loanForm, setLoanForm] = useState<Omit<Partial<Loan>, 'loanJar'> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '', purpose: ''
  });

  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState<Partial<RecurringTemplate>>({ amount: 0, description: '', jarType: 'AUTO', type: 'expense', subscriptionType: '1m', isActive: true, startDate: getTodayString() });
  const [recurringAmountStr, setRecurringAmountStr] = useState('');

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isEventEntryModalOpen, setIsEventEntryModalOpen] = useState(false);
  const [eventManualAmount, setEventManualAmount] = useState('');
  const [eventManualDesc, setEventManualDesc] = useState('');
  const [eventManualType, setEventManualType] = useState<'income' | 'expense'>('expense');
  const [eventFilters, setEventFilters] = useState<Record<string, 'all' | 'income' | 'expense'>>({});

  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const [deleteClickData, setDeleteClickData] = useState({ id: '', count: 0 });
  const deleteResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [chartRange, setChartRange] = useState<'week' | 'month' | 'year'>('week');

  const aiInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loanPhotoInputRef = useRef<HTMLInputElement>(null);
  const paymentPhotoInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.vi;

  useEffect(() => localStorage.setItem('jars_balances', JSON.stringify(balances)), [balances]);
  useEffect(() => localStorage.setItem('jars_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('jars_loans', JSON.stringify(loans)), [loans]);
  useEffect(() => localStorage.setItem('jars_recurring', JSON.stringify(recurringTemplates)), [recurringTemplates]);
  useEffect(() => localStorage.setItem('jars_events', JSON.stringify(events)), [events]);
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

  useEffect(() => {
    const checkRecurring = () => {
      const today = getTodayString();
      const updatedTemplates = [...recurringTemplates];
      let hasChanges = false;
      const newTransactions: Transaction[] = [];

      updatedTemplates.forEach(tpl => {
        if (!tpl.isActive) return;
        
        const todayDate = new Date(today);
        const startDate = new Date(tpl.startDate);
        const endDate = new Date(tpl.endDate);

        if (todayDate < startDate || todayDate > endDate) return;

        let shouldRun = false;
        if (!tpl.lastRunDate) {
          shouldRun = true;
        } else {
          const lastDate = new Date(tpl.lastRunDate);
          const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          const interval = SUBSCRIPTION_DURATIONS[tpl.subscriptionType] || 30;
          if (diffDays >= interval) shouldRun = true;
        }

        if (shouldRun) {
          const tx: Transaction = {
            id: `rec_${tpl.id}_${Date.now()}`,
            type: tpl.type,
            amount: tpl.amount,
            description: `[Định kỳ] ${tpl.description}`,
            jarType: tpl.jarType === 'AUTO' ? undefined : tpl.jarType as JarType,
            timestamp: Date.now()
          };
          newTransactions.push(tx);
          tpl.lastRunDate = today;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setTransactions(prev => [...newTransactions, ...prev]);
        newTransactions.forEach(tx => updateBalances(null, tx));
        setRecurringTemplates(updatedTemplates);
        showToast("Đã xử lý giao dịch định kỳ!");
      }
    };
    if (recurringTemplates.length > 0) checkRecurring();
  }, [recurringTemplates.length]);

  const stats = useMemo(() => {
    const debt = loans.filter(l => l.type === LoanType.BORROW).reduce((a, l) => a + (l.principal - l.paidAmount), 0);
    const lent = loans.filter(l => l.type === LoanType.LEND).reduce((a, l) => a + (l.principal - l.paidAmount), 0);
    const net = (Object.values(balances) as number[]).reduce((a: number, b: number) => a + b, 0) + lent - debt;
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
    return symbols[settings.currency] ? (settings.currency === 'USD' ? `${symbols.USD}${formatted}` : `${formatted}${symbols[settings.currency]}`) : `${formatted}đ`;
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
      note: manualNote,
      jarType: manualJar === 'AUTO' ? undefined : manualJar as JarType,
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
    setManualNote('');
    setManualJar(manualType === 'expense' ? JarType.NEC : 'AUTO');
    setManualDate(getTodayString());
    setIsEntryModalOpen(false);
    setActiveTab('history');
    showToast("Thành công!");
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
        setActiveTab('history');
        showToast("Đã thêm qua AI!");
      } else showToast("Không nhận diện được giao dịch.", "info");
    } catch (e) { showToast("Lỗi AI.", "danger"); }
    finally { setIsLoading(false); setInput(''); }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(transferAmount);
    if (amountInVnd <= 0 || amountInVnd > balances[transferFrom]) return showToast("Số dư không đủ.", "danger");
    if (transferFrom === transferTo) return showToast("Hũ nguồn và hũ đích phải khác nhau.", "info");
    
    const transferId = `trf_${Date.now()}`;
    const tx1: Transaction = { 
      id: Date.now().toString(), 
      type: 'expense', 
      amount: amountInVnd, 
      description: `Chuyển: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, 
      jarType: transferFrom, 
      timestamp: Date.now(),
      transferGroupId: transferId
    };
    const tx2: Transaction = { 
      id: (Date.now()+1).toString(), 
      type: 'income', 
      amount: amountInVnd, 
      description: `Nhận: ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, 
      jarType: transferTo, 
      timestamp: Date.now(),
      transferGroupId: transferId
    };
    
    setBalances(prev => {
      const nb = { ...prev };
      nb[transferFrom] -= amountInVnd;
      nb[transferTo] += amountInVnd;
      return nb;
    });
    
    setTransactions(p => [tx1, tx2, ...p]);
    setIsTransferModalOpen(false);
    setTransferAmount('');
    showToast("Đã chuyển!");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanPrincipalStr) return;
    const principalVnd = parseFormattedNumber(loanPrincipalStr);
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : (loanForm.loanJar as JarType);
    const loanId = editingLoanId || Date.now().toString();
    
    const syntheticTx: Transaction = {
        id: `loan_${loanId}`,
        type: loanForm.type === LoanType.BORROW ? 'income' : 'expense',
        amount: principalVnd,
        description: `${loanForm.type === LoanType.BORROW ? 'Vay từ' : 'Cho vay'}: ${loanForm.lenderName}`,
        jarType: finalLoanJar,
        timestamp: Date.now(),
        loanId: loanId
    };
    
    if (editingLoanId) {
       const oldLoan = loans.find(l => l.id === editingLoanId);
       if (oldLoan) {
          const oldSyntheticTx: Transaction = { id: `loan_${oldLoan.id}`, type: oldLoan.type === LoanType.BORROW ? 'income' : 'expense', amount: oldLoan.principal, description: `Đảo ngược tác động`, jarType: oldLoan.loanJar, timestamp: Date.now(), loanId: oldLoan.id };
          updateBalances(oldSyntheticTx, syntheticTx);
       }
       setLoans(p => p.map(l => l.id === editingLoanId ? { ...l, ...loanForm, principal: principalVnd, loanJar: finalLoanJar } as Loan : l));
       setEditingLoanId(null);
       showToast("Cập nhật thành công!");
    } else {
       const newLoan: Loan = { ...loanForm as Loan, id: loanId, principal: principalVnd, paidAmount: 0, loanJar: finalLoanJar };
       setLoans(p => [newLoan, ...p]);
       updateBalances(null, syntheticTx);
       showToast("Đã lưu khoản vay!");
    }
    setIsLoanModalOpen(false);
    setLoanPrincipalStr('');
    setLoanForm({ type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '', purpose: '' });
  };

  const handleOpenNewLoan = () => {
    setEditingLoanId(null);
    setLoanForm({ type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '', purpose: '' });
    setLoanPrincipalStr('');
    setIsLoanModalOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentLoanId || !paymentForm.amountStr) return;
    const amountVnd = parseFormattedNumber(paymentForm.amountStr);
    const targetLoan = loans.find(l => l.id === paymentLoanId);
    if (!targetLoan || amountVnd <= 0) return;

    const remainingVnd = targetLoan.principal - targetLoan.paidAmount;
    if (amountVnd > remainingVnd + 0.01) {
       const label = targetLoan.type === LoanType.BORROW ? 'thanh toán' : 'thu hồi';
       alert(`Số tiền bạn nhập vượt quá số tiền ${label}!`);
       return;
    }

    const finalJar = targetLoan.loanJar;
    const txType = targetLoan.type === LoanType.BORROW ? 'expense' : 'income';
    const txLabel = targetLoan.type === LoanType.BORROW ? 'Thanh toán nợ' : 'Thu hồi nợ';

    const payTx: Transaction = {
      id: `pay_${Date.now()}`,
      type: txType,
      amount: amountVnd,
      description: `[${txLabel}] ${targetLoan.lenderName}${paymentForm.note ? ': ' + paymentForm.note : ''}`,
      jarType: finalJar,
      timestamp: new Date(paymentForm.date).getTime(),
      loanId: paymentLoanId,
      imageUrl: paymentForm.imageUrl
    };

    updateBalances(null, payTx);
    setLoans(p => p.map(l => l.id === paymentLoanId ? { ...l, paidAmount: l.paidAmount + amountVnd } : l));
    
    setIsLoanPaymentModalOpen(false);
    setPaymentForm({ amountStr: '', date: getTodayString(), jar: JarType.NEC as JarType | 'AUTO', note: '', imageUrl: '' });
    setPaymentLoanId(null);
    showToast("Thành công!");
  };

  const handleSaveRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVnd = parseFormattedNumber(recurringAmountStr);
    if (!recurringForm.description || amountVnd <= 0) return;
    
    const duration = SUBSCRIPTION_DURATIONS[recurringForm.subscriptionType as SubscriptionType] || 30;
    const start = new Date(recurringForm.startDate!);
    const end = new Date(start);
    end.setDate(start.getDate() + duration);

    const newTpl: RecurringTemplate = {
      ...recurringForm as RecurringTemplate,
      id: Date.now().toString(),
      amount: amountVnd,
      endDate: end.toISOString().split('T')[0],
      isActive: true
    };
    setRecurringTemplates(p => [...p, newTpl]);
    setRecurringAmountStr('');
    setRecurringForm(prev => ({ ...prev, description: '' })); 
    setIsRecurringModalOpen(false);
    showToast("Đã thêm định kỳ!");
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;
    const newEvent: EventGroup = {
      id: Date.now().toString(),
      name: eventName,
      date: getTodayString(),
      transactions: []
    };
    setEvents(p => [...p, newEvent]);
    setIsEventModalOpen(false);
    setEventName('');
    showToast("Đã tạo sự kiện!");
  };

  const handleEventEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVnd = parseFormattedNumber(eventManualAmount);
    if (!eventManualDesc.trim() || amountVnd <= 0 || !activeEventId) return;
    
    const newTx: Transaction = {
      id: Date.now().toString(),
      type: eventManualType,
      amount: amountVnd,
      description: eventManualDesc,
      timestamp: Date.now()
    };

    setEvents(prev => prev.map(ev => 
      ev.id === activeEventId ? { ...ev, transactions: [newTx, ...ev.transactions] } : ev
    ));
    
    setEventManualAmount('');
    setEventManualDesc('');
    showToast("Đã thêm vào sự kiện!");
  };

  const handlePushEventToHistory = (event: EventGroup) => {
    if (event.transactions.length === 0) return;
    const totalIncome = event.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = event.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netAmount = Math.abs(totalIncome - totalExpense);
    const mainType = totalIncome >= totalExpense ? 'income' : 'expense';

    const mainTx: Transaction = {
      id: `ev_main_${event.id}`,
      type: mainType,
      amount: netAmount,
      description: `[Sự kiện] ${event.name}`,
      jarType: JarType.PLAY, 
      timestamp: Date.now()
    };
    setTransactions(p => [mainTx, ...p]);
    updateBalances(null, mainTx);
    setEvents(p => p.filter(e => e.id !== event.id));
    showToast("Đã lưu vào lịch sử chung!");
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      if (tx.transferGroupId) {
        const group = transactions.filter(t => t.transferGroupId === tx.transferGroupId);
        group.forEach(g => updateBalances(g, null));
        setTransactions(p => p.filter(t => t.transferGroupId !== tx.transferGroupId));
        showToast("Đã hoàn tác giao dịch chuyển tiền.");
      } else {
        updateBalances(tx, null);
        setTransactions(p => p.filter(t => t.id !== id));
        showToast("Đã xóa giao dịch.");
      }
    }
    setIsHistoryDetailModalOpen(false);
    setIsDeleteConfirmModalOpen(false);
    setSelectedTx(null);
  };

  const handleTripleDelete = (id: string) => {
    if (deleteResetTimer.current) clearTimeout(deleteResetTimer.current);
    
    if (deleteClickData.id === id) {
      const nextCount = deleteClickData.count + 1;
      if (nextCount >= 3) {
        handleDeleteTransaction(id);
        setDeleteClickData({ id: '', count: 0 });
      } else {
        setDeleteClickData({ id, count: nextCount });
        deleteResetTimer.current = setTimeout(() => {
          setDeleteClickData({ id: '', count: 0 });
        }, 1500);
      }
    } else {
      setDeleteClickData({ id, count: 1 });
      deleteResetTimer.current = setTimeout(() => {
        setDeleteClickData({ id, count: 0 });
      }, 1500);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setManualType(tx.type);
    setManualAmount(formatDots((tx.amount * EXCHANGE_RATES[settings.currency]).toString()));
    setManualDesc(tx.description);
    setManualNote(tx.note || '');
    setManualJar(tx.jarType || 'AUTO');
    setManualDate(new Date(tx.timestamp).toISOString().split('T')[0]);
    setIsEntryModalOpen(true);
    setIsHistoryDetailModalOpen(false);
  };

  const handleEditLoan = (loan: Loan) => {
     setEditingLoanId(loan.id);
     setLoanForm({ ...loan, loanJar: loan.loanJar || 'AUTO' });
     setLoanPrincipalStr(formatDots((loan.principal * EXCHANGE_RATES[settings.currency]).toString()));
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
                description: `Hoàn tác xóa khoản nợ với ${loan.lenderName}`,
                jarType: loan.loanJar,
                timestamp: Date.now()
            };
            updateBalances(null, reversalTx);
        }
        setLoans(p => p.filter(l => l.id !== id));
        showToast("Đã xóa khoản nợ.");
    }
  };

  const handlePayLoan = (loan: Loan) => {
     setPaymentLoanId(loan.id);
     setPaymentForm({ amountStr: '', date: getTodayString(), jar: JarType.NEC as JarType | 'AUTO', note: '', imageUrl: '' });
     setIsLoanPaymentModalOpen(true);
  };

  const handleLoanPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoanForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openCalculator = (target: 'manual' | 'loan' | 'payment' | 'recurring' | 'event' | 'transfer') => {
    setCalcTarget(target);
    setCalcExpr('');
    setIsCalcOpen(true);
  };

  const onCalcPress = (val: string) => {
    if (val === 'C') return setCalcExpr('');
    if (val === '=') {
      const res = evaluateMath(calcExpr);
      if (res) {
        const formatted = formatDots(res);
        if (calcTarget === 'manual') setManualAmount(formatted);
        else if (calcTarget === 'loan') setLoanPrincipalStr(formatted);
        else if (calcTarget === 'payment') setPaymentForm(p => ({...p, amountStr: formatted}));
        else if (calcTarget === 'recurring') setRecurringAmountStr(formatted);
        else if (calcTarget === 'event') setEventManualAmount(formatted);
        else if (calcTarget === 'transfer') setTransferAmount(formatted);
        setIsCalcOpen(false);
      }
      return;
    }
    setCalcExpr(prev => prev + val);
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
    if (window.confirm("BẠN CÓ CHỨC CHẮN MUỐN XÓA TẤT CẢ?")) {
      setTransactions([]);
      setBalances({ [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 });
      setLoans([]);
      setRecurringTemplates([]);
      setEvents([]);
      localStorage.clear();
      showToast("Dữ liệu đã xóa.");
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
                Thu: convertValue(monthT.filter(t => t.type === 'income').reduce((s: number, t: Transaction) => s + t.amount, 0)),
                Chi: convertValue(monthT.filter(t => t.type === 'expense').reduce((s: number, t: Transaction) => s + t.amount, 0)),
            });
        }
    } else {
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dayT = transactions.filter(tx => new Date(tx.timestamp).toDateString() === d.toDateString());
            data.push({
                name: d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' }),
                Thu: convertValue(dayT.filter(t => t.type === 'income').reduce((s: number, t: Transaction) => s + t.amount, 0)),
                Chi: convertValue(dayT.filter(t => t.type === 'expense').reduce((s: number, t: Transaction) => s + t.amount, 0)),
            });
        }
    }
    return data;
  }, [transactions, settings.currency, settings.language, chartRange]);

  const rangeTotalsVnd = useMemo(() => {
    let income = 0;
    let expense = 0;
    const count = chartRange === 'week' ? 7 : chartRange === 'month' ? 30 : 12;
    
    if (chartRange === 'year') {
        const d = new Date();
        for (let i = 11; i >= 0; i--) {
            const checkD = new Date(); checkD.setMonth(d.getMonth() - i);
            transactions.forEach(tx => {
                const txD = new Date(tx.timestamp);
                if (txD.getMonth() === checkD.getMonth() && txD.getFullYear() === checkD.getFullYear()) {
                    if (tx.type === 'income') income += tx.amount;
                    else expense += tx.amount;
                }
            });
        }
    } else {
        const d = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const checkD = new Date(); checkD.setDate(d.getDate() - i);
            transactions.forEach(tx => {
                if (new Date(tx.timestamp).toDateString() === checkD.toDateString()) {
                    if (tx.type === 'income') income += tx.amount;
                    else expense += tx.amount;
                }
            });
        }
    }
    return { income, expense };
  }, [transactions, chartRange]);

  const pieData = useMemo(() => {
    return Object.entries(balances).map(([type, amount]) => ({
      name: t[`jar_${type.toLowerCase()}_name`],
      value: Math.max(0, amount as number),
      color: JAR_CONFIG[type as JarType].color
    })).filter(d => d.value > 0);
  }, [balances, settings.currency, t]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchType = historyFilter === 'all' || tx.type === historyFilter;
      const matchJar = historyJarFilter === 'all' || tx.jarType === historyJarFilter;
      const txDateStr = new Date(tx.timestamp).toISOString().split('T')[0];
      const matchFromDate = !historyFromDateFilter || txDateStr >= historyFromDateFilter;
      const matchToDate = !historyToDateFilter || txDateStr <= historyToDateFilter;
      return matchType && matchJar && matchFromDate && matchToDate;
    });
  }, [transactions, historyFilter, historyJarFilter, historyFromDateFilter, historyToDateFilter]);

  const displayedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleTxCount);
  }, [filteredTransactions, visibleTxCount]);

  const [onboardingForm, setOnboardingForm] = useState({ name: '', gender: 'male' as 'male' | 'female' });

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans flex flex-col items-center overflow-x-hidden pt-[calc(var(--sat,0px)+120px)] pb-[calc(var(--sab,0px)+100px)]">
      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'success' ? 'bg-indigo-600' : 'bg-slate-800'} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-2xl animate-in slide-in-from-top-4`} style={{ top: 'calc(var(--sat, 0px) + 12px)' }}>
          {toast.msg}
        </div>
      )}

      {isAuthModalOpen && !currentUser && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/90 backdrop-blur-2xl p-4">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[3rem] w-full max-md:max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
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
              <button 
                onClick={() => onboardingForm.name.trim() && setCurrentUser({ id: Date.now().toString(), displayName: onboardingForm.name, gender: onboardingForm.gender, email: '', provider: 'local' })} 
                disabled={!onboardingForm.name.trim()} 
                className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-blue-500/30 ring-4 ring-blue-50"
              >
                {t.onboarding_start}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-indigo-100 shadow-sm" style={{ paddingTop: 'var(--sat, 0px)' }}>
        <div className="max-w-5xl mx-auto flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className="p-2 -ml-2 text-slate-500 hover:text-indigo-600 transition-colors"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
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
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[12px] font-black text-slate-900 uppercase leading-none tracking-tighter">{t.appTitle}</span>
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
                { label: t.stats_jars, val: (Object.values(balances) as number[]).reduce((a: number, b: number) => a + b, 0), icon: '💰', colorClass: 'text-slate-900' }, 
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
                <JarVisual 
                  key={type} 
                  jar={{
                    ...JAR_CONFIG[type],
                    name: t[`jar_${type.toLowerCase()}_name`],
                    description: t[`jar_${type.toLowerCase()}_desc`]
                  }} 
                  balance={balances[type]} 
                  currency={settings.currency} 
                  convertValue={convertValue} 
                  onTransferClick={() => { setTransferFrom(type); setIsTransferModalOpen(true); }} 
                />
              ))}
            </section>
          </>
        )}
        {activeTab === 'history' && (
          <section className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-[500px]">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <span className="text-xl">📜</span>
                   <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{t.history_title}</h3>
                </div>
                <button 
                  onClick={() => setIsHistoryFilterModalOpen(true)}
                  className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                  <span className="text-[9px] font-black uppercase tracking-tighter">{t.history_filter}</span>
                </button>
             </div>
             
             <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {displayedTransactions.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 italic">{t.history_empty}</p>
                   </div>
                ) : (
                  <>
                    {displayedTransactions.map(tx => (
                      <div 
                        key={tx.id} 
                        onDoubleClick={() => { setSelectedTx(tx); setIsHistoryDetailModalOpen(true); }}
                        className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all cursor-default flex items-center justify-between group relative overflow-hidden select-none hover:border-indigo-200 hover:bg-white active:bg-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{tx.type === 'income' ? '↑' : '↓'}</div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 line-clamp-1 leading-tight">{tx.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[7px] font-black text-slate-400 uppercase">{new Date(tx.timestamp).toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : 'en-US')}</span>
                              {tx.jarType && <span className="text-[6px] font-black bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-500 uppercase">{t[`jar_${tx.jarType.toLowerCase()}_name`]}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <p className={`text-[11px] font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</p>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all ml-1">
                              <button onClick={(e) => { e.stopPropagation(); handleEditTransaction(tx); }} className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm text-[10px]">✏️</button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleTripleDelete(tx.id); }} 
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm text-[10px] ${deleteClickData.id === tx.id ? 'bg-red-600 text-white scale-110' : 'bg-red-50 text-red-600'}`}
                              >
                                {deleteClickData.id === tx.id ? '❓' : '🗑️'}
                              </button>
                           </div>
                        </div>
                      </div>
                    ))}
                    {filteredTransactions.length > visibleTxCount && (
                      <button 
                        onClick={() => setVisibleTxCount(prev => prev + 15)}
                        className="w-full py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-2xl transition-all"
                      >
                        {t.history_more}
                      </button>
                    )}
                  </>
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
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontStretch: 'condensed', fontWeight: 700, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatYAxis} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                    <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Tổng thu</p>
                      <p className="text-sm font-black text-emerald-700 tracking-tight">{formatCurrency(rangeTotalsVnd.income)}</p>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                      <p className="text-[9px] font-black text-rose-600 uppercase mb-1 tracking-widest">Tổng chi</p>
                      <p className="text-sm font-black text-rose-700 tracking-tight">{formatCurrency(rangeTotalsVnd.expense)}</p>
                  </div>
              </div>
            </section>
            
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl min-h-[350px]">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">🍕 {t.pie_title}</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}
        {activeTab === 'loans' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-3">
                <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📉</span> {t.loan_title}</h3>
                <button onClick={handleOpenNewLoan} className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">＋ {t.loan_new}</button>
              </div>
              {loans.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 bg-slate-50/30 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {loans.map(loan => {
                    const isCompleted = loan.paidAmount >= loan.principal;
                    const progress = Math.min(100, (loan.paidAmount / loan.principal) * 100);
                    return (
                      <div 
                        key={loan.id} 
                        onDoubleClick={() => { setSelectedLoan(loan); setIsLoanDetailModalOpen(true); }}
                        className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 group relative transition-all active:bg-white select-none overflow-hidden pb-10"
                      >
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm ${loan.type === LoanType.BORROW ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{loan.type === LoanType.BORROW ? '💸' : '🤝'}</div>
                              <div>
                                <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{loan.lenderName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[8px] font-bold text-slate-400">{loan.startDate}</p>
                                  {loan.imageUrl && <button onClick={(e) => { e.stopPropagation(); setViewingImageUrl(loan.imageUrl!); }} className="w-4 h-4 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[7px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm">📷</button>}
                                </div>
                              </div>
                           </div>
                           <div className="flex flex-col items-end">
                              {!isCompleted && <button onClick={(e) => { e.stopPropagation(); handlePayLoan(loan); }} className={`px-2 py-1 text-[7px] font-black uppercase rounded-lg shadow-sm mb-1 ${loan.type === LoanType.BORROW ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{loan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</button>}
                              <p className="text-[11px] font-black">{formatCurrency(loan.principal - loan.paidAmount)}</p>
                              <p className="text-[8px] font-bold text-slate-400 mt-0.5">{t.loan_paid}: {formatCurrency(loan.paidAmount)}</p>
                           </div>
                         </div>
                         <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2"><div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-indigo-500' : (loan.type === LoanType.BORROW ? 'bg-rose-400' : 'bg-emerald-400')}`} style={{ width: `${progress}%` }} /></div>
                         <div className="flex justify-between mt-2 px-1"><span className="text-[8px] font-bold text-slate-400 uppercase">{t.manual_allocation_only}: {progress.toFixed(0)}%</span><span className="text-[8px] font-bold text-slate-400 uppercase">{isCompleted ? 'Hoàn tất' : `${t.loan_rem}: ${formatCurrency(loan.principal - loan.paidAmount)}`}</span></div>
                         {loan.purpose && <p className="text-[8px] font-bold text-slate-400 mt-2 italic line-clamp-1 border-t border-slate-100 pt-1 tracking-tight">{t.manual_note}: {loan.purpose}</p>}
                         <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all z-20">
                            {!isCompleted && <button onClick={(e) => { e.stopPropagation(); handleEditLoan(loan); }} className="w-7 h-7 bg-white text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white shadow-md border border-indigo-100 text-[10px]">✏️</button>}
                            <button onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); handleDeleteLoan(loan.id); }} className="w-7 h-7 bg-white text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white shadow-md border border-rose-100 text-[10px]">🗑️</button>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-3">
                <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📅</span> {t.recurring_title}</h3>
                <button onClick={() => setIsRecurringModalOpen(true)} className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">＋ {t.recurring_add}</button>
              </div>
              {recurringTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 bg-slate-50/30 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div>
              ) : (
                <div className="space-y-3">
                  {recurringTemplates.map(tpl => {
                    const today = new Date();
                    const end = new Date(tpl.endDate);
                    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isNearEnd = diff <= 3 && diff >= 0;

                    return (
                      <div key={tpl.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group transition-all active:bg-white relative">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]`}>🔄</div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800">{tpl.description}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                              Bắt đầu: {tpl.startDate} • Thuê bao: {tpl.subscriptionType}
                            </p>
                            {isNearEnd && <p className="text-[7px] font-black text-red-500 uppercase animate-pulse">⚠️ Sắp hết hạn ({diff} ngày)</p>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <p className={`text-[11px] font-black ${tpl.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tpl.type === 'income' ? '+' : '-'}{formatCurrency(tpl.amount)}</p>
                          <button onClick={() => setRecurringTemplates(p => p.filter(x => x.id !== tpl.id))} className="text-[8px] font-black text-rose-500 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Xóa mẫu</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl mb-10">
              <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-3">
                <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>🎊</span> {t.event_title}</h3>
                <button onClick={() => setIsEventModalOpen(true)} className="px-4 py-2 bg-rose-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg hover:bg-rose-700 active:scale-95 transition-all">{t.event_add}</button>
              </div>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 bg-slate-50/30 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map(ev => {
                    const currentFilter = eventFilters[ev.id] || 'all';
                    const displayedTxs = ev.transactions.filter(t => currentFilter === 'all' || t.type === currentFilter);
                    const totalIncome = ev.transactions.filter(t => t.type === 'income').reduce((s, x) => s + x.amount, 0);
                    const totalExpense = ev.transactions.filter(t => t.type === 'expense').reduce((s, x) => s + x.amount, 0);
                    const netBalance = totalIncome - totalExpense;
                    
                    return (
                      <div key={ev.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4 transition-all hover:border-rose-200 active:bg-slate-100">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-[12px] font-black text-slate-800 uppercase">{ev.name}</h4>
                            <p className="text-[8px] font-bold text-slate-400">{ev.date} • {ev.transactions.length} GD</p>
                            <div className="mt-1 flex items-center gap-2 w-full">
                              <span className="text-[7px] font-black text-emerald-600 uppercase">Thu: {formatCurrency(totalIncome)}</span>
                              <span className="text-[7px] font-black text-rose-600 uppercase">Chi: {formatCurrency(totalExpense)}</span>
                              <span className={`text-[7px] font-black uppercase ml-auto px-2 py-0.5 rounded bg-white shadow-sm border border-slate-100 ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                Tổng: {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1 ml-4">
                             <div className="flex gap-1">
                                {['all', 'income', 'expense'].map(f => (
                                  <button key={f} onClick={() => setEventFilters(p => ({...p, [ev.id]: f as any}))} className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase transition-all ${currentFilter === f ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                                    {f === 'all' ? 'Tất cả' : f === 'income' ? 'Thu' : 'Chi'}
                                  </button>
                                ))}
                             </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setActiveEventId(ev.id); setIsEventEntryModalOpen(true); }} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">Nhập liệu</button>
                           <button onClick={() => handlePushEventToHistory(ev)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[8px] font-black uppercase active:scale-95 transition-all">{t.event_save_history}</button>
                           <button onDoubleClick={() => setEvents(p => p.filter(x => x.id !== ev.id))} className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-[10px] hover:bg-rose-100 transition-all shadow-sm active:scale-95">🗑️</button>
                        </div>
                        {displayedTxs.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/50 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                             {displayedTxs.map(et => (
                               <div key={et.id} className="flex justify-between items-center text-[9px] font-bold text-slate-500 group">
                                 <div className="flex items-center gap-1.5">
                                   <span className={`w-1.5 h-1.5 rounded-full ${et.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                   <span>{et.description}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   <span className={et.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>{formatCurrency(et.amount)}</span>
                                   <button onDoubleClick={() => {
                                      setEvents(prev => prev.map(e => e.id === ev.id ? {...e, transactions: e.transactions.filter(tx => tx.id !== et.id)} : e));
                                   }} className="opacity-0 group-hover:opacity-100 text-red-500 text-[8px] ml-1">✕</button>
                                 </div>
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-indigo-100/50 p-2 shadow-2xl" style={{ paddingBottom: 'calc(var(--sab, 0px) + 12px)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-around">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 min-w-[70px] ${activeTab === 'home' ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}>
            <span className="text-xl">🏠</span>
            <span className="text-[8px] font-black uppercase whitespace-nowrap tracking-tight">{t.nav_home}</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 min-w-[70px] ${activeTab === 'history' ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}>
            <span className="text-xl">📜</span>
            <span className="text-[8px] font-black uppercase whitespace-nowrap tracking-tight">{t.nav_history}</span>
          </button>
          <div className="relative flex items-center justify-center px-4 -mt-2">
            <button onClick={() => setIsEntryModalOpen(true)} className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all -translate-y-5 ring-4 ring-white">
              <span className="text-3xl font-light">＋</span>
            </button>
          </div>
          <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center gap-1 p-2 min-w-[70px] ${activeTab === 'overview' ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}>
            <span className="text-xl">📊</span>
            <span className="text-[8px] font-black uppercase whitespace-nowrap tracking-tight">{t.nav_overview}</span>
          </button>
          <button onClick={() => setActiveTab('loans')} className={`flex flex-col items-center gap-1 p-2 min-w-[70px] ${activeTab === 'loans' ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}>
            <span className="text-xl">🏦</span>
            <span className="text-[8px] font-black uppercase whitespace-nowrap tracking-tight">{t.nav_loans}</span>
          </button>
        </div>
      </div>

      {/* HISTORY FILTER MODAL - REDESIGNED */}
      {isHistoryFilterModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsHistoryFilterModalOpen(false)}>
          <div 
            className="bg-white rounded-[2.5rem] w-full max-w-sm p-7 shadow-2xl animate-in zoom-in-95" 
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase mb-6 tracking-widest border-b pb-4">
              <span className="text-lg">🔍</span> {t.history_filter}
            </h2>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_type}</label>
                <select 
                  value={historyFilter} 
                  onChange={e => setHistoryFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[10px] font-black outline-none focus:border-indigo-300 transition-all"
                >
                  <option value="all">{t.history_all}</option>
                  <option value="income">Thu nhập</option>
                  <option value="expense">Chi tiêu</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.history_jar}</label>
                <select 
                  value={historyJarFilter} 
                  onChange={e => setHistoryJarFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[10px] font-black outline-none focus:border-indigo-300 transition-all"
                >
                  <option value="all">Tất cả các hũ</option>
                  {Object.values(JarType).map(type => (
                    <option key={type} value={type}>{JAR_CONFIG[type].icon} {t[`jar_${type.toLowerCase()}_name`]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={historyFromDateFilter} onChange={e => setHistoryFromDateFilter(e.target.value)} className="w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 text-[9px] font-black text-slate-700 outline-none" />
                <input type="date" value={historyToDateFilter} onChange={e => setHistoryToDateFilter(e.target.value)} className="w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 text-[9px] font-black text-slate-700 outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3">
                <button onClick={() => setIsHistoryFilterModalOpen(false)} className="py-3 bg-slate-100 text-slate-400 font-black uppercase text-[8px] rounded-xl active:scale-95 transition-all">Hủy</button>
                <button onClick={() => { setHistoryFilter('all'); setHistoryJarFilter('all'); setHistoryFromDateFilter(''); setHistoryToDateFilter(''); }} className="py-3 bg-slate-50 text-indigo-400 border border-indigo-100 font-black uppercase text-[8px] rounded-xl active:scale-95 transition-all">Reset</button>
                <button onClick={() => setIsHistoryFilterModalOpen(false)} className="py-3 bg-indigo-600 text-white font-black uppercase text-[8px] rounded-xl shadow-lg shadow-indigo-100 active:scale-95 transition-all">Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENTRY MODAL - REDESIGNED */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl relative animate-in zoom-in-95 border border-slate-100">
            <h2 className="text-[12px] font-black text-slate-800 flex items-center gap-2 uppercase mb-6 tracking-widest border-b pb-4">
              <span className="text-lg">📝</span> {editingTransactionId ? t.manual_edit : t.manual_title}
            </h2>
            <form onSubmit={handleManualSubmit} className="space-y-5">
               <div className="flex bg-slate-100 p-1 rounded-2xl h-11 border border-slate-200">
                  <button type="button" onClick={() => { setManualType('expense'); setManualJar(JarType.NEC); }} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${manualType === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}>{t.manual_expense}</button>
                  <button type="button" onClick={() => { setManualType('income'); setManualJar('AUTO'); }} className={`flex-1 text-[9px] font-black rounded-xl transition-all ${manualType === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>{t.manual_income}</button>
               </div>
               
               <div className="space-y-1.5">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label>
                 <div className="relative">
                    <input 
                      required 
                      type="text" 
                      inputMode="numeric" 
                      value={manualAmount} 
                      onChange={e => setManualAmount(formatDots(e.target.value))} 
                      placeholder={`Nhập số tiền (${settings.currency})`} 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-4 pr-12 h-12 text-lg font-black outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:text-[10px] placeholder:font-normal" 
                    />
                    <button 
                      type="button" 
                      onClick={() => openCalculator('manual')} 
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xl shadow-lg active:scale-90 transition-all"
                    >
                      🧮
                    </button>
                 </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_desc}</label>
                  <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Nhập nội dung giao dịch..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[11px] font-bold outline-none focus:border-indigo-300 transition-all placeholder:text-slate-300 placeholder:text-[10px] placeholder:font-normal" />
               </div>

               <div className="space-y-1.5">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_jar_img}</label>
                 <select 
                    value={manualJar} 
                    onChange={e => setManualJar(e.target.value as any)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[11px] font-black outline-none focus:border-indigo-300 transition-all"
                  >
                    <option value="AUTO">{t.manual_auto}</option>
                    {Object.values(JarType).map(type => (
                      <option key={type} value={type}>{JAR_CONFIG[type].icon} {t[`jar_${type.toLowerCase()}_name`]}</option>
                    ))}
                  </select>
               </div>

               <div className="grid grid-cols-1 gap-4">
                 <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[11px] font-bold outline-none" />
                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_note}</label>
                    <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="Ghi chú thêm (tùy chọn)..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-11 text-[11px] font-bold outline-none placeholder:text-slate-300 placeholder:text-[10px] placeholder:font-normal" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3 pt-4">
                  <button type="button" onClick={() => { setIsEntryModalOpen(false); setEditingTransactionId(null); }} className="py-4 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-2xl active:scale-95 transition-all">{t.manual_cancel}</button>
                  <button type="submit" className="py-4 bg-indigo-600 text-white font-black uppercase text-[9px] rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all">{editingTransactionId ? t.manual_update : t.manual_save}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* REMAINDER OF MODALS - NO CHANGES AS PER REQUEST */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 border border-slate-100">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest border-b pb-4">
              <span className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg text-lg">⇄</span> 
              {t.transfer_title}
            </h2>
            <form onSubmit={handleTransferSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.transfer_from}</label>
                  <select 
                    value={transferFrom} 
                    onChange={e => setTransferFrom(e.target.value as JarType)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 h-12 text-[10px] font-black outline-none focus:border-indigo-300"
                  >
                    {Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.transfer_to}</label>
                  <select 
                    value={transferTo} 
                    onChange={e => setTransferTo(e.target.value as JarType)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 h-12 text-[10px] font-black outline-none focus:border-indigo-300"
                  >
                    {Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.transfer_amount}</label>
                <div className="flex gap-2">
                  <input required type="text" inputMode="numeric" value={transferAmount} onChange={e => setTransferAmount(formatDots(e.target.value))} placeholder={`0 (${settings.currency})`} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 h-14 text-sm font-black outline-none focus:border-indigo-300" />
                  <button type="button" onClick={() => openCalculator('transfer')} className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm border-2 border-slate-100 active:scale-95 transition-all">🧮</button>
                </div>
                <p className="text-[8px] font-bold text-slate-400 ml-1">Số dư hiện tại: <span className="text-indigo-600">{formatCurrency(balances[transferFrom])}</span></p>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.transfer_cancel}</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all">{t.transfer_confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCalcOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-[320px] p-6 shadow-2xl animate-in zoom-in-95 border border-white/50">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Máy tính tài chính</span>
              <button onClick={() => setIsCalcOpen(false)} className="text-slate-400 hover:text-red-500 p-2">✕</button>
            </div>
            <div className="bg-slate-900 rounded-3xl p-5 mb-6 text-right shadow-inner min-h-[80px] flex flex-col justify-end">
              <div className="text-slate-400 text-[10px] font-bold overflow-hidden text-ellipsis mb-1">{calcExpr || '0'}</div>
              <div className="text-white text-2xl font-black">{evaluateMath(calcExpr) || '0'}</div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {['(', ')', '%', '/'].map(btn => (
                <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all active:scale-90">{btn}</button>
              ))}
              {['7', '8', '9', '*'].map(btn => (
                <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:scale-90">{btn}</button>
              ))}
              {['4', '5', '6', '-'].map(btn => (
                <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:scale-90">{btn}</button>
              ))}
              {['1', '2', '3', '+'].map(btn => (
                <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:scale-90">{btn}</button>
              ))}
              <button onClick={() => onCalcPress('C')} className="h-14 rounded-2xl bg-rose-50 text-rose-600 font-black text-lg shadow-sm hover:bg-rose-600 hover:text-white transition-all active:scale-90">C</button>
              <button onClick={() => onCalcPress('0')} className="h-14 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:scale-90">0</button>
              <button onClick={() => onCalcPress('.')} className="h-14 rounded-2xl bg-white border border-slate-100 text-slate-700 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:scale-90">.</button>
              <button onClick={() => onCalcPress('=')} className="h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-indigo-200">=</button>
            </div>
          </div>
        </div>
      )}

      {isLoanDetailModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
             <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6 border-b pb-4"><span>🏦</span> {t.loan_detail_title}</h2>
             <div className="space-y-4 text-[11px] font-bold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_partner}:</span><span className="text-slate-900 font-black uppercase">{selectedLoan.lenderName}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Loại:</span><span className={selectedLoan.type === LoanType.BORROW ? 'text-rose-600' : 'text-emerald-600'}>{selectedLoan.type === LoanType.BORROW ? t.loan_i_owe : t.loan_owes_me}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Danh mục:</span><span className="text-slate-900">{selectedLoan.category === LoanCategory.BANK ? 'Ngân hàng' : 'Cá nhân'}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_principal}:</span><span className="text-slate-900 font-black">{formatCurrency(selectedLoan.principal)}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_paid_label}:</span><span className="text-emerald-600">{formatCurrency(selectedLoan.paidAmount)}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_rem}:</span><span className="text-rose-600 font-black">{formatCurrency(selectedLoan.principal - selectedLoan.paidAmount)}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_jar_label}:</span><span className="text-indigo-600 uppercase">{selectedLoan.loanJar ? t[`jar_${selectedLoan.loanJar.toLowerCase()}_name`] : t.manual_auto}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-2"><span>{t.loan_date_label}:</span><span className="text-slate-900">{selectedLoan.startDate}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setIsLoanDetailModalOpen(false)} className="py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-xl active:scale-95 transition-all">Đóng</button>
                <button onClick={() => { setIsLoanDetailModalOpen(false); handlePayLoan(selectedLoan); }} className="py-3 bg-indigo-600 text-white font-black uppercase text-[9px] rounded-xl shadow-lg active:scale-95 transition-all">{selectedLoan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</button>
             </div>
          </div>
        </div>
      )}

      {isLoanPaymentModalOpen && paymentLoanId && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
             {(() => {
                const l = loans.find(x => x.id === paymentLoanId);
                const title = l?.type === LoanType.BORROW ? t.loan_pay : t.loan_recover;
                const icon = l?.type === LoanType.BORROW ? '💸' : '🤝';
                return (
                  <>
                    <h2 className="text-[12px] font-black text-slate-800 flex items-center gap-2 uppercase mb-4 tracking-widest border-b pb-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shadow text-white ${l?.type === LoanType.BORROW ? 'bg-rose-600' : 'bg-emerald-600'}`}>{icon}</span> {title}
                    </h2>
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label>
                          <div className="flex gap-2">
                             <input required type="text" inputMode="numeric" value={paymentForm.amountStr} onChange={e => setPaymentForm({...paymentForm, amountStr: formatDots(e.target.value)})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 text-[11px] font-black outline-none focus:border-indigo-400" placeholder="0" />
                             <button type="button" onClick={() => {
                                const target = loans.find(x => x.id === paymentLoanId);
                                if (target) {
                                  const rem = target.principal - target.paidAmount;
                                  setPaymentForm(prev => ({...prev, amountStr: formatDots((rem * EXCHANGE_RATES[settings.currency]).toString())}));
                                }
                             }} className="px-2 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-[8px] font-black uppercase border border-indigo-100 shadow-sm active:scale-95 transition-all">Còn lại</button>
                             <button type="button" onClick={() => openCalculator('payment')} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg shadow-sm border border-slate-200">🧮</button>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày tháng</label>
                            <input required type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 text-[10px] font-bold outline-none" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Hũ nguồn</label>
                            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 h-10 text-[10px] font-black flex items-center text-indigo-600 uppercase tracking-tighter truncate">
                               {l?.loanJar ? t[`jar_${l.loanJar.toLowerCase()}_name`] : t.manual_auto}
                            </div>
                         </div>
                       </div>
                       <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => { setIsLoanPaymentModalOpen(false); setPaymentLoanId(null); }} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-xl active:scale-95">HỦY</button>
                          <button type="submit" className={`flex-[2] py-3 text-white font-black uppercase text-[9px] rounded-xl shadow active:scale-95 ${l?.type === LoanType.BORROW ? 'bg-rose-600' : 'bg-emerald-600'}`}>XÁC NHẬN</button>
                       </div>
                    </form>
                  </>
                );
             })()}
          </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-7 shadow-2xl relative animate-in zoom-in-95 border border-slate-100">
            <h2 className="text-[13px] font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest border-b pb-4"><span className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg text-[14px]">🏦</span> {editingLoanId ? t.loan_edit : t.loan_new}</h2>
            <form onSubmit={handleSaveLoan} className="space-y-5">
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95 ${loanForm.type === LoanType.BORROW ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}>💸 {t.loan_i_owe}</button>
                <button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95 ${loanForm.type === LoanType.LEND ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>🤝 {t.loan_owes_me}</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_partner}</label>
                  <input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_jar_label}</label>
                  <select value={loanForm.loanJar} onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as any})} className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none">
                    <option value="AUTO">{t.manual_auto}</option>
                    {Object.values(JarType).map(jt => <option key={jt} value={jt}>{t[`jar_${jt.toLowerCase()}_name`]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_date_label}</label>
                  <input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.loan_principal}</label>
                  <div className="flex gap-2">
                     <input required type="text" inputMode="numeric" value={loanPrincipalStr} onChange={e => setLoanPrincipalStr(formatDots(e.target.value))} className="flex-1 px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="0" />
                     <button type="button" onClick={() => openCalculator('loan')} className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-lg border border-slate-200 shadow-sm">🧮</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsLoanModalOpen(false); setEditingLoanId(null); }} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-xl active:scale-95">HỦY BỎ</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase text-[9px] rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">{t.save_loan}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-lg:max-w-lg p-6 shadow-2xl relative animate-in zoom-in-95 border border-slate-100">
            <h2 className="text-[12px] font-black text-slate-800 flex items-center gap-2 uppercase mb-5 tracking-widest border-b pb-3"><span className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow text-lg">🔄</span> {t.recurring_add}</h2>
            <form onSubmit={handleSaveRecurring} className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Bắt đầu</label>
                   <input type="date" value={recurringForm.startDate} onChange={e => setRecurringForm({...recurringForm, startDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold h-10" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Kỳ hạn</label>
                   <select value={recurringForm.subscriptionType} onChange={e => setRecurringForm({...recurringForm, subscriptionType: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none h-10">
                      <option value="1d">1 ngày</option>
                      <option value="1w">1 tuần</option>
                      <option value="1m">1 tháng</option>
                      <option value="3m">3 tháng</option>
                      <option value="1y">1 năm</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label>
                  <div className="flex gap-2">
                     <input required type="text" inputMode="numeric" value={recurringAmountStr} onChange={e => setRecurringAmountStr(formatDots(e.target.value))} placeholder={`0 (${settings.currency})`} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none h-10" />
                     <button type="button" onClick={() => openCalculator('recurring')} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg border border-slate-200 shadow-sm">🧮</button>
                  </div>
               </div>
               <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_desc}</label>
                  <input required type="text" value={recurringForm.description} onChange={e => setRecurringForm({...recurringForm, description: e.target.value})} placeholder="..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none h-10" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <select value={recurringForm.jarType} onChange={e => setRecurringForm({...recurringForm, jarType: e.target.value as any})} className="bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none h-10">
                    <option value="AUTO">{t.manual_auto}</option>
                    {Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}
                 </select>
                 <select value={recurringForm.type} onChange={e => setRecurringForm({...recurringForm, type: e.target.value as any})} className="bg-slate-50 border border-slate-200 rounded-xl px-3 text-[10px] font-bold outline-none h-10">
                    <option value="expense">{t.manual_expense}</option>
                    <option value="income">{t.manual_income}</option>
                 </select>
               </div>
               <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsRecurringModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-xl active:scale-95">Hủy bỏ</button>
                  <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white font-black uppercase text-[9px] rounded-xl shadow active:scale-95">Lưu mẫu</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {isEventModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-xs p-8 shadow-2xl relative animate-in zoom-in-95">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest border-b pb-4"><span className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg text-lg">🎉</span> {t.event_add}</h2>
            <form onSubmit={handleSaveEvent} className="space-y-6">
               <input required type="text" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Tên sự kiện" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-[11px] font-bold outline-none h-14" />
               <div className="flex gap-3">
                  <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button>
                  <button type="submit" className="flex-[2] py-4 bg-rose-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all">{t.onboarding_start}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {isEventEntryModalOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-xs p-8 shadow-2xl relative animate-in zoom-in-95">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest border-b pb-4">📝 {t.event_entry_title}</h2>
            <form onSubmit={handleEventEntrySubmit} className="space-y-4">
               <div className="flex bg-slate-100 p-1 rounded-xl h-10 mb-2">
                  <button type="button" onClick={() => setEventManualType('expense')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${eventManualType === 'expense' ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}>CHI TIÊU</button>
                  <button type="button" onClick={() => setEventManualType('income')} className={`flex-1 text-[9px] font-black rounded-lg transition-all ${eventManualType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>THU NHẬP</button>
               </div>
               <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label>
                  <div className="flex gap-2">
                     <input required type="text" inputMode="numeric" value={eventManualAmount} onChange={e => setEventManualAmount(formatDots(e.target.value))} placeholder={`0 (${settings.currency})`} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-[11px] font-bold outline-none h-14" />
                     <button type="button" onClick={() => openCalculator('event')} className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-sm border-2 border-slate-100">🧮</button>
                  </div>
               </div>
               <input required type="text" value={eventManualDesc} onChange={e => setEventManualDesc(e.target.value)} placeholder="Nội dung" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-[11px] font-bold outline-none h-14" />
               <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setIsEventEntryModalOpen(false); setActiveEventId(null); }} className="flex-1 py-3 bg-slate-100 text-slate-400 font-black uppercase text-[9px] rounded-2xl active:scale-95">HỦY</button>
                  <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-black uppercase text-[9px] rounded-2xl shadow-lg active:scale-95 transition-all">THÊM</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative ml-auto h-full w-full max-sm:max-w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" style={{ paddingTop: 'var(--sat, 0px)' }}>
            <div className="p-5 border-b flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t.settings_title}</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {settingsTab === 'app' && (
                <div className="space-y-10">
                   <div className="space-y-4">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.currency}</label>
                      <div className="bg-slate-50 p-1 rounded-2xl border-2 border-slate-200 flex gap-1">
                        {['VND', 'JPY', 'USD'].map(curr => <button key={curr} onClick={() => setSettings({...settings, currency: curr as any})} className={`flex-1 py-2.5 text-[9px] font-black rounded-xl transition-all active:scale-95 ${settings.currency === curr ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{curr}</button>)}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.language}</label>
                      <div className="bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-200 flex flex-col gap-1">
                        {['vi', 'en', 'ja'].map((code) => {
                          const display = code === 'vi' ? t.lang_vi : code === 'en' ? t.lang_en : t.lang_ja;
                          return <button key={code} onClick={() => setSettings({...settings, language: code as any})} className={`w-full py-3 text-[9px] font-bold rounded-xl transition-all text-center active:scale-95 ${settings.language === code ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{display}</button>;
                        })}
                      </div>
                   </div>
                   <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t.settings_notification}</label>
                        <input type="checkbox" checked={settings.notificationsEnabled} onChange={e => setSettings({...settings, notificationsEnabled: e.target.checked})} className="w-5 h-5 accent-indigo-600" />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 leading-tight">{t.settings_notification_desc}</p>
                      {settings.notificationsEnabled && (
                        <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 animate-in fade-in duration-300">
                          <input type="time" value={settings.notificationTime} onChange={e => setSettings({...settings, notificationTime: e.target.value})} className="w-full bg-transparent text-sm font-black text-center outline-none text-slate-700" />
                        </div>
                      )}
                   </div>
                </div>
              )}
              {settingsTab === 'policy' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 text-[11px] leading-relaxed">
                  <h3 className="text-[14px] font-black text-red-600 uppercase text-center mb-6">CHÍNH SÁCH BẢO MẬT & MIỄN TRỪ TRÁCH NHIỆM</h3>
                  <div className="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-4">
                    <p><strong>1. Quyền riêng tư tuyệt đối:</strong> Ứng dụng FinAi cam kết không lưu trữ bất kỳ dữ liệu tài chính nào của người dùng trên máy chủ (server). Mọi dữ liệu đều được lưu trữ trực tiếp trên thiết bị cá nhân (LocalStorage/Browser Storage) của chính bạn.</p>
                    <p><strong>2. An toàn mạng:</strong> Chúng tôi tuân thủ nghiêm ngặt Luật An toàn thông tin mạng và Luật An ninh mạng Việt Nam. Vì dữ liệu không được tải lên mạng, nguy cơ rò rỉ dữ liệu cá nhân từ hệ thống là bằng 0.</p>
                    <p><strong>3. Trách nhiệm người dùng:</strong> Do đặc thù lưu trữ tại chỗ, người dùng có trách nhiệm tự bảo mật thiết bị truy cập và sao lưu dữ liệu (qua tính năng Export CSV).</p>
                    <p><strong>4. Miễn trừ trách nhiệm:</strong> FinAi không chịu trách nhiệm cho bất kỳ mất mát dữ liệu nào do lỗi thiết bị, xóa bộ nhớ trình duyệt, hoặc hành vi xâm nhập trái phép vào thiết bị của người dùng.</p>
                  </div>
                </div>
              )}
              {settingsTab === 'guide' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                  <h3 className="text-[14px] font-black text-indigo-600 uppercase text-center">HƯỚNG DẪN SỬ DỤNG</h3>
                  <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] space-y-6">
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed italic text-center">Chào mừng đến với hành trình tự do tài chính cùng FINAI!</p>
                    <div className="space-y-4">
                      <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">1</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Nhập liệu nhanh bằng AI tại thanh tìm kiếm trên cùng. (Vd: "Cơm trưa 35k")</p>
                      </div>
                      <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">2</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Tỉ lệ hũ (55, 10, 10, 10, 10, 5) giúp bạn cân bằng cuộc sống.</p>
                      </div>
                      <div className="flex gap-4 items-start">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0">3</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">Hãy nhớ sao lưu dữ liệu định kỳ bằng tính năng Xuất CSV trong tab Dữ liệu.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {settingsTab === 'info' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex flex-col items-center py-10 space-y-4">
                     <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-xl overflow-hidden border border-slate-100 p-1">
                        <img src="FinAi_icon.png" className="w-full h-full object-cover rounded-2xl" alt="FinAi Logo" />
                     </div>
                     <div className="text-center">
                        <h2 className="text-xl font-black text-slate-800 tracking-tighter">FinAi</h2>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">Dựa trên nguyên tắc quản lý tài chính 6 lọ của T. Harv Eker</p>
                        <p className="text-[9px] font-black text-indigo-600 uppercase mt-4 tracking-widest">THIẾT KẾ BỞI LOONG LEE</p>
                        <p className="text-[8px] font-bold text-slate-400 italic mt-1">Version {APP_VERSION}</p>
                     </div>
                  </div>
                  <div className="space-y-4 border-t pt-8">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t.settings_connect}</h3>
                     <a href="https://www.facebook.com/duclongka" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 group transition-all hover:bg-blue-100/50 active:scale-95"><div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg font-black">f</div><span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">FACEBOOK</span></a>
                     <div className="flex items-center gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100"><div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-lg">💬</div><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase">ZALO</span><span className="text-[10px] font-black text-emerald-800 uppercase">0964.855.899</span></div></div>
                     <a href="mailto:longld@itsupro.org" className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 group transition-all hover:bg-indigo-100/50 active:scale-95"><div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-lg">✉️</div><div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase">{t.support_email}</span><span className="text-[10px] font-black text-indigo-800 truncate">longld@itsupro.org</span></div></a>
                  </div>
                </div>
              )}
              {settingsTab === 'export' && (
                <div className="space-y-6 pt-5">
                   <button onClick={exportToCSV} className="w-full py-5 bg-emerald-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><span>📤</span> {t.settings_data_export}</button>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><span>📥</span> {t.settings_data_import}</button>
                   <input type="file" hidden ref={fileInputRef} />
                   <button onClick={handleResetData} className="w-full py-5 bg-red-600 text-white text-[11px] font-black uppercase rounded-3xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><span>⚠️</span> {t.settings_data_reset}</button>
                </div>
              )}
            </div>
            <div className="p-3 border-t grid grid-cols-5 items-center justify-around bg-slate-50" style={{ paddingBottom: 'calc(var(--sab, 0px) + 12px)' }}>
              {[ { id: 'app', icon: '⚙️', label: t.settings_app }, { id: 'export', icon: '📁', label: t.settings_data }, { id: 'info', icon: 'ℹ️', label: t.settings_info }, { id: 'policy', icon: '🛡️', label: t.settings_policy }, { id: 'guide', icon: '📖', label: t.settings_guide } ].map(tab => (
                <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-1 py-1 rounded-xl transition-all active:scale-95 ${settingsTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>
                  <span className="text-base">{tab.icon}</span>
                  <span className="text-[6px] font-black uppercase text-center leading-none">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewingImageUrl && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setViewingImageUrl(null)}>
          <button onClick={() => setViewingImageUrl(null)} className="absolute top-8 right-8 text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-all z-10 active:scale-90">✕</button>
          <img src={viewingImageUrl} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" alt="Receipt Preview" />
        </div>
      )}
    </div>
  );
};

export default App;
