
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { JarType, Transaction, JarBalance, Loan, LoanCategory, LoanType, User, AppSettings, RecurringTemplate, EventGroup, FutureGroup, SubscriptionType } from './types';
import { JAR_CONFIG } from './constants';
import { analyzeTransactionText, getFinancialAdvice, importTransactionsAI } from './services/geminiService';
import JarVisual from './components/JarVisual';
import AuthForms from './components/AuthForms';
import { onAuthStateChanged, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth, db } from './services/firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type AppTab = 'home' | 'history' | 'overview' | 'loans';
type ExpandedSection = 'loans' | 'recurring' | 'events' | 'future' | null;

const SUBSCRIPTION_DURATIONS: Record<SubscriptionType, number> = {
  '1d': 1, '3d': 3, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095
};

const EXCHANGE_RATES = {
  VND: 1,
  USD: 1 / 25400,
  JPY: 1 / 168,
};

const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const sanitizeData = (data: any): any => {
  return JSON.parse(JSON.stringify(data, (key, value) => 
    value === undefined ? null : value
  ));
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

const getAmountHint = (val: string, currency: string, lang: string) => {
  const num = parseInt(val.replace(/,/g, '')) || 0;
  if (num === 0) return "";
  if (lang === 'vi' && currency === 'VND') {
    const ty = Math.floor(num / 1000000000);
    const trieu = Math.floor((num % 1000000000) / 1000000);
    const ngan = Math.floor((num % 1000000) / 1000);
    const dong = num % 1000;
    let parts = [];
    if (ty > 0) parts.push(`${ty} tỷ`);
    if (trieu > 0) parts.push(`${trieu} triệu`);
    if (ngan > 0) parts.push(`${ngan} ngàn`);
    if (dong > 0 || (ty === 0 && trieu === 0 && ngan === 0)) parts.push(`${dong} đồng`);
    return parts.join(" ");
  } else if (lang === 'ja' && currency === 'JPY') {
    const man = Math.floor(num / 10000);
    const sen = Math.floor((num % 10000) / 1000);
    const yen = num % 1000;
    let parts = [];
    if (man > 0) parts.push(`${man}万`);
    if (sen > 0) parts.push(`${sen}千`);
    if (yen > 0 || (man === 0 && sen === 0)) parts.push(`${yen}円`);
    return parts.join(" ");
  }
  return "";
};

const AmountHintLabel = ({ val, currency, lang }: { val: string, currency: string, lang: string }) => {
  const hint = getAmountHint(val, currency, lang);
  if (!hint) return null;
  return <p className="text-[9px] font-bold text-indigo-500 mt-1 italic animate-in fade-in slide-in-from-left-2">✨ {hint}</p>;
};

const HelpTooltip = ({ content, position = 'top' }: { content: string, position?: 'top' | 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 text-[8px] flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600 transition-colors border border-slate-200"
      >
        ?
      </button>
      {isOpen && (
        <div 
          className={`absolute z-[100] right-0 w-48 p-2.5 bg-slate-800 text-white text-[9px] font-medium rounded-xl shadow-2xl animate-in fade-in pointer-events-none leading-relaxed border border-slate-700 ${
            position === 'top' ? 'bottom-full mb-2 slide-in-from-bottom-1' : 'top-full mt-2 slide-in-from-top-1'
          }`}
        >
          {content}
          <div 
            className={`absolute right-1 w-2 h-2 bg-slate-800 rotate-45 ${
              position === 'top' ? 'top-full -translate-y-1' : 'bottom-full translate-y-1'
            }`} 
          />
        </div>
      )}
    </div>
  );
};

const TRANSLATIONS: Record<string, any> = {
  vi: {
    appTitle: "FinAi",
    stats_jars: "Tiền hũ",
    stats_jars_help: "Tổng số tiền hiện có của 6 hũ tài chính bên dưới.",
    stats_debt: "Nợ phải trả",
    stats_debt_help: "Tổng số tiền nợ mà bạn phải trả. Chi tiết có trong phần 'Quản lý vay nợ'.",
    stats_lent: "Đang cho vay",
    stats_lent_help: "Tổng số tiền bạn đang cho ai đó vay. Chi tiết có trong phần 'Quản lý vay nợ'.",
    stats_net: "Tài sản ròng",
    stats_net_help: "Tổng số tiền sau khi trừ đi các khoản chi và nợ phải trả (tức số tiền thực tế bạn đang có).",
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
    history_title: "Lịch sử giao dịch",
    history_title_help: "Nơi lưu tất cả các giao dịch bạn đã thực hiện. Bạn có thể chọn bộ lọc để lọc theo thu chi, theo hũ hoặc ngày tháng. Bạn có thể nhấn double để xem chi tiết từng GD, sửa hoặc xóa GD đó. Việc xóa GD sẽ ảnh hưởng đến số tiền có ở 1 trong 6 hũ mà GD đó đã thực hiện.",
    history_filter: "BỘ LỌC",
    history_type: "Loại",
    history_jar: "Hũ",
    history_date: "Ngày",
    history_from: "Từ ngày",
    history_to: "Đến ngày",
    history_all: "Tất cả",
    history_inc_only: "Chỉ Thu",
    history_exp_only: "Chỉ Chi",
    history_more: "+Xem thêm GD",
    history_empty: "Danh sách trống",
    loan_title: "Quản lý vay nợ",
    loan_title_help: "Nơi quản lý tất cả giao dịch bạn cho ai đó vay hoặc bạn đang vay ai đó.",
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
    loan_add_img: "THÊM Ảnh",
    settings_title: "CÀI ĐẶT ỨNG DỤNG",
    settings_data: "Dữ liệu",
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
    onboarding_name: "Họ và tên",
    onboarding_gender: "Giới tính",
    onboarding_male: "NAM",
    onboarding_female: "NỮ",
    onboarding_start: "BẮT ĐẦU NGAY",
    transfer_title: "Chuyển tiền giữa các hũ",
    transfer_from: "Từ hũ",
    transfer_to: "Đến hũ",
    transfer_amount: "Số tiền muốn chuyển",
    transfer_cancel: "Hủy bỏ",
    transfer_confirm: "Xác nhận chuyển",
    save_loan: "LƯU KHOẢN VAY",
    view_photo: "XEM ẢNH",
    support_email: "EMAIL GÓP Ý",
    guide_video_btn: "XEM VIDEO QUY TẮC 6 LỌ",
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
    recurring_title: "Giao dịch định kỳ",
    recurring_title_help: "Nơi bạn thêm các giao dịch có tính chu kỳ cố định. Ví dụ: tiền thuê bao internet (160k/tháng), tiền thuê bao camera ...",
    recurring_add: "THÊM ĐỊNH KỲ",
    recurring_freq: "Chu kỳ lặp lại",
    event_title: "GD theo sự kiện",
    event_title_help: "Nơi bạn quản lý các giao dịch theo tính chất sự kiện, tạm thời (ví dụ: tổ chức sinh nhật, cưới hỏi, ăn dỗ ...). Giao dịch loại này được tách riêng, không liên quan với các giao dịch chung khác, trừ khi bạn lưu nó mới xuất hiện ở 1 trong 6 hũ bạn chọn.",
    event_add: "+Tạo SK mới",
    event_save_history: "Lưu",
    event_delete: "Xóa sự kiện",
    event_entry_title: "NHẬP LIỆU SỰ KIỆN",
    future_title: "GD tương lai",
    future_title_help: "Nơi bạn quản lý các giao dịch bạn dự định mua sắm hoặc chi tiêu trong tương lai. Giao dịch loại này không liên quan đến dữ liệu chung, chỉ khi bạn đã thực hiện và muốn lưu thì nó mới xuất hiện ở 1 trong 6 hũ bạn chọn.",
    future_add: "+Tạo dự định mới",
    future_save_history: "Lưu",
    future_entry_title: "NHẬP LIỆU TƯƠNG LAI",
    history_detail_title: "CHI TIẾT GIAO DỊCH",
    confirm_delete_title: "XÁC NHẬN XÓA",
    confirm_delete_msg: "Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch này?",
    loan_detail_title: "THÔNG TIN GIAO DỊCH VAY NỢ",
    account_info: "Thông tin tài khoản",
    logout_btn: "ĐĂNG XUẤT",
    login_btn: "ĐĂNG NHẬP",
    register_btn: "ĐĂNG KÝ",
    guest_user: "Khách",
    policy_1: "1. Chính sách bảo mật",
    policy_2: "2. Luật an ninh mạng 2018",
    policy_3: "3. Bảo vệ dữ liệu cá nhân",
    policy_4: "4. Miễn trừ trách nhiệm",
    event_jar_select: "Chọn hũ để lưu tổng kết",
    future_jar_select: "Chọn hũ cho từng GD",
    event_auto_select: "Tự động phân bổ (6 Hũ)",
    loan_back_btn: "HỦY BỎ",
    calculator_title: "Máy tính",
    calculator_close: "Đóng",
    event_sum_total: "Tổng",
    event_sum_inc: "Thu",
    event_sum_exp: "Chi",
    event_sum_net: "Tổng Thu/Chi",
    event_sum_net_label: "Tổng Thu/Chi",
    event_add_btn: "Thêm",
    loan_partner_placeholder: "Đối tác / Nội dung",
    recurring_start_date: "Ngày bắt đầu",
    auth_email_label: "Email",
    auth_password_label: "Mật khẩu",
    auth_confirm_password_label: "Xác nhận mật khẩu",
    auth_google_btn: "Đăng nhập với Google",
    auth_or: "Hoặc",
    auth_no_account: "Chưa có thành viên?",
    auth_have_account: "Đã có tài khoản?",
    auth_sign_in_now: "Đăng nhập ngay",
    auth_sign_up_now: "Đăng ký ngay",
    change_pwd_btn: "Thay đổi mật khẩu",
    change_pwd_sent: "Đã gửi email yêu cầu thay đổi mật khẩu. Hãy vào email của bạn để tiếp tục và quay lại ứng dụng đăng nhập với mật khẩu mới.",
    avatar_upload_label: "Cập nhật ảnh đại diện",
    pin_setup_title: "CÀI ĐẶT MÃ PIN",
    pin_enter_title: "NHẬP MÃ PIN",
    pin_confirm_title: "XÁC NHẬN MÃ PIN",
    pin_incorrect: "Mã PIN không chính xác",
    pin_enabled_label: "Sử dụng mã PIN bảo mật",
    pin_change_label: "Đổi mã PIN",
    faceid_label: "Sử dụng FaceID/Vân tay",
    loading_data: "Đang tải dữ liệu...",
    freq_daily: "Hàng ngày",
    freq_weekly: "Hàng tuần",
    freq_monthly: "Hàng tháng",
    freq_yearly: "Hàng năm",
    ai_quota_exceeded: "Giới hạn AI đã đạt mức tối đa. Vui lòng thử lại sau hoặc nâng cấp tài khoản."
  },
  en: {
    appTitle: "FinAi",
    stats_jars: "Jar Balances",
    stats_jars_help: "Total current money in the 6 financial jars below.",
    stats_debt: "Debt Payable",
    stats_debt_help: "Total amount of debt you have to pay. Details are in the 'Loan Management' section.",
    stats_lent: "Money Lent",
    stats_lent_help: "Total amount of money you have lent to others. Details are in the 'Loan Management' section.",
    stats_net: "Net Asset",
    stats_net_help: "Total amount after subtracting expenses and debt (actual money you possess).",
    advice_title: "Expert Advice",
    chart_title: "INCOME & EXPENSE",
    pie_title: "JAR ALLOCATION",
    chart_week: "Week",
    chart_month: "Month",
    chart_year: "Year",
    manual_title: "New Transaction",
    manual_edit: "EDITING TRANSACTION",
    manual_cancel: "CANCEL",
    manual_type: "Type",
    manual_expense: "EXPENSE",
    manual_income: "INCOME",
    manual_amount: "Amount",
    manual_desc: "Description",
    manual_note: "Note",
    manual_jar_img: "Allocation",
    manual_allocation_only: "Allocation",
    manual_date_label: "Date",
    manual_auto: "✨ Auto allocate 6 jars",
    manual_save: "SAVE TRANSACTION",
    manual_update: "SAVE CHANGES",
    history_title: "Transaction History",
    history_title_help: "Storage for all transactions performed. You can filter by type, jar, or date. You can double click to view details, edit or delete. Deleting will affect jar balances.",
    history_filter: "FILTER",
    history_type: "Type",
    history_jar: "Jar",
    history_date: "Date",
    history_from: "From Date",
    history_to: "To Date",
    history_all: "All",
    history_inc_only: "Income Only",
    history_exp_only: "Expense Only",
    history_more: "+View more",
    history_empty: "List is empty",
    loan_title: "Loan management",
    loan_title_help: "Manage all transactions where you lent money to or borrowed from someone.",
    loan_new: "NEW LOAN",
    loan_edit: "EDIT LOAN",
    loan_pay: "PAY OFF",
    loan_recover: "RECOVER",
    loan_i_owe: "I OWE",
    loan_owes_me: "OWES ME",
    loan_rem: "Rem",
    loan_paid: "Paid",
    loan_partner: "Partner",
    loan_principal: "Principal",
    loan_paid_label: "Paid/Recovered",
    loan_jar_label: "Related Jar",
    loan_date_label: "Execute Date",
    loan_img_label: "Document Image",
    loan_add_img: "ADD PHOTO",
    settings_title: "APP SETTINGS",
    settings_data: "Data",
    settings_data_export: "EXPORT CSV",
    settings_data_import: "IMPORT DATA (AI)",
    settings_data_reset: "RESET ALL DATA",
    settings_info: "INFO",
    settings_connect: "FEEDBACK",
    settings_policy: "LEGAL",
    settings_guide: "GUIDE",
    settings_app: "SETTINGS",
    settings_notification: "NOTIFICATION TIMER",
    settings_notification_desc: "Daily spending reminder",
    currency: "CURRENCY",
    language: "LANGUAGE",
    lang_vi: "Vietnamese",
    lang_en: "English",
    lang_ja: "Japanese",
    user_label: "App Settings",
    ai_placeholder: "Enter transaction via AI (e.g., Lunch 5$)...",
    onboarding_welcome: "Welcome to FINAI",
    onboarding_desc: "Let us know your info to start your financial freedom journey.",
    onboarding_name: "Full Name",
    onboarding_gender: "Gender",
    onboarding_male: "MALE",
    onboarding_female: "FEMALE",
    onboarding_start: "START NOW",
    transfer_title: "Transfer Between Jars",
    transfer_from: "From Jar",
    transfer_to: "To Jar",
    transfer_amount: "Amount to transfer",
    transfer_cancel: "Cancel",
    transfer_confirm: "Confirm Transfer",
    save_loan: "SAVE LOAN",
    view_photo: "VIEW PHOTO",
    support_email: "SUPPORT EMAIL",
    guide_video_btn: "WATCH 6-JAR RULE VIDEO",
    nav_home: "HOME",
    nav_entry: "ENTRY",
    nav_history: "HISTORY",
    nav_overview: "OVERVIEW",
    nav_loans: "OTHERS",
    nav_menu: "MENU",
    jar_nec_name: "Necessities",
    jar_nec_desc: "For essential monthly expenses like rent, utilities, food, etc.",
    jar_lts_name: "Savings",
    jar_lts_desc: "Long-term savings for big future goals like house, car, or travel.",
    jar_edu_name: "Education",
    jar_edu_desc: "Investing in knowledge and skills to improve self-value.",
    jar_play_name: "Play",
    jar_play_desc: "For entertainment and leisure like travel, movies, shopping.",
    jar_ffa_name: "Invest",
    jar_ffa_desc: "Investments to increase income and achieve financial freedom.",
    jar_give_name: "Give",
    jar_give_desc: "To support charities or help friends and community.",
    recurring_title: "Recurring transactions",
    recurring_title_help: "Add transactions with fixed cycles, e.g., internet subscription, utilities.",
    recurring_add: "ADD RECURRING",
    recurring_freq: "Repeat Cycle",
    event_title: "Event transactions",
    event_title_help: "Manage transactions for specific events (e.g., birthday, wedding). These are isolated until saved to a jar.",
    event_add: "+New Event",
    event_save_history: "Save",
    event_delete: "Delete event",
    event_entry_title: "EVENT ENTRY",
    future_title: "Future transactions",
    future_title_help: "Manage planned future purchases. These don't affect main data until executed and saved to a jar.",
    future_add: "+New Future Task",
    future_save_history: "Save",
    future_entry_title: "FUTURE ENTRY",
    history_detail_title: "TRANSACTION DETAILS",
    confirm_delete_title: "CONFIRM DELETE",
    confirm_delete_msg: "Are you sure you want to permanently delete this?",
    loan_detail_title: "LOAN TRANSACTION INFO",
    account_info: "Account Information",
    logout_btn: "LOGOUT",
    login_btn: "LOGIN",
    register_btn: "REGISTER",
    guest_user: "Guest",
    policy_1: "1. Privacy Policy",
    policy_2: "2. Cybersecurity Law 2018",
    policy_3: "3. Personal Data Protection",
    policy_4: "4. Disclaimer",
    event_jar_select: "Select jar to save summary",
    future_jar_select: "Select jar for each item",
    event_auto_select: "Auto Allocate (6 Jars)",
    loan_back_btn: "CANCEL",
    calculator_title: "Calculator",
    calculator_close: "Close",
    event_sum_total: "Total",
    event_sum_inc: "Inc",
    event_sum_exp: "Exp",
    event_sum_net: "Total Net",
    event_sum_net_label: "Total Net",
    event_add_btn: "Add",
    loan_partner_placeholder: "Partner / Content",
    recurring_start_date: "Start Date",
    auth_email_label: "Email",
    auth_password_label: "Password",
    auth_confirm_password_label: "Confirm Password",
    auth_google_btn: "Sign in with Google",
    auth_or: "Or",
    auth_no_account: "No account?",
    auth_have_account: "Already have an account?",
    auth_sign_in_now: "Sign in now",
    auth_sign_up_now: "Sign up now",
    change_pwd_btn: "Change Password",
    change_pwd_sent: "Password reset email sent. Please check your inbox and re-login with the new password.",
    avatar_upload_label: "Update Avatar",
    pin_setup_title: "PIN SETUP",
    pin_enter_title: "ENTER PIN",
    pin_confirm_title: "CONFIRM PIN",
    pin_incorrect: "Incorrect PIN",
    pin_enabled_label: "Enable Security PIN",
    pin_change_label: "Change PIN",
    faceid_label: "Use Biometrics",
    loading_data: "Loading data...",
    freq_daily: "Daily",
    freq_weekly: "Weekly",
    freq_monthly: "Monthly",
    freq_yearly: "Yearly",
    ai_quota_exceeded: "AI quota exceeded. Please try again later."
  },
  ja: {
    appTitle: "FinAi",
    stats_jars: "口座残高",
    stats_jars_help: "下の6つの貯金箱にある合計金額です。",
    stats_debt: "負債額",
    stats_debt_help: "返済が必要な負債の総額です。詳細は「貸借管理」セクションにあります。",
    stats_lent: "貸付金",
    stats_lent_help: "誰かに貸しているお金 của総額です。詳細は「貸借管理」セクションにあります。",
    stats_net: "純資産",
    stats_net_help: "支出と負債を差し引いた後の合計金額（実際に所有しているお金）です。",
    advice_title: "専門家のアドバイス",
    chart_title: "収支グラフ",
    pie_title: "貯金箱の配分",
    chart_week: "週",
    chart_month: "月",
    chart_year: "年",
    manual_title: "新規取引追加",
    manual_edit: "取引編集中",
    manual_cancel: "キャンセル",
    manual_type: "取引タイプ",
    manual_expense: "支出",
    manual_income: "収入",
    manual_amount: "金額",
    manual_desc: "内容",
    manual_note: "メモ",
    manual_jar_img: "配分",
    manual_allocation_only: "配分",
    manual_date_label: "日付",
    manual_auto: "✨ 6つの貯金箱に自動配分",
    manual_save: "取引を保存",
    manual_update: "変更を保存",
    history_title: "取引履歴",
    history_title_help: "実行されたすべての取引の保存場所。タイプ、貯金箱、または日付でフィルタリングできます。ダブルクリックで詳細表示、編集、削除が可能です。削除すると貯金箱の残高に影響します。",
    history_filter: "フィルター",
    history_type: "タイプ",
    history_jar: "貯金箱",
    history_date: "日付",
    history_from: "開始日",
    history_to: "終了日",
    history_all: "すべて",
    history_inc_only: "収入のみ",
    history_exp_only: "支出のみ",
    history_more: "+詳細を表示",
    history_empty: "履歴はありません",
    loan_title: "貸借管理",
    loan_title_help: "お金を貸したり借りたりしたすべての取引を管理します。",
    loan_new: "新規貸借記録",
    loan_edit: "貸借を編集",
    loan_pay: "返済",
    loan_recover: "回収",
    loan_i_owe: "借金",
    loan_owes_me: "貸金",
    loan_rem: "残高",
    loan_paid: "既済",
    loan_partner: "相手先",
    loan_principal: "元金",
    loan_paid_label: "返済/回収済",
    loan_jar_label: "関連貯金箱",
    loan_date_label: "実施日",
    loan_img_label: "証憑写真",
    loan_add_img: "写真追加",
    settings_title: "アプリ設定",
    settings_data: "データ",
    settings_data_export: "CSV出力",
    settings_data_import: "データ取込 (AI)",
    settings_data_reset: "全データ削除",
    settings_info: "情報",
    settings_connect: "フィードバック",
    settings_policy: "法的事項",
    settings_guide: "使い方",
    settings_app: "設定",
    settings_notification: "通知タイマー",
    settings_notification_desc: "毎日の記帳忘れ防止",
    currency: "通貨",
    language: "言語",
    lang_vi: "ベトナム語",
    lang_en: "英語",
    lang_ja: "日本語",
    user_label: "アプリ設定",
    ai_placeholder: "AIで入力 (例: ランチ 1000円)...",
    onboarding_welcome: "FINAIへようこそ",
    onboarding_desc: "家計管理を始めるために、あなたの情報を教えてください。",
    onboarding_name: "お名前",
    onboarding_gender: "性別",
    onboarding_male: "男性",
    onboarding_female: "女性",
    onboarding_start: "今すぐ始める",
    transfer_title: "貯金箱間の移動",
    transfer_from: "移動元",
    transfer_to: "移動先",
    transfer_amount: "移動金額",
    transfer_cancel: "キャンセル",
    transfer_confirm: "移動を確定",
    save_loan: "貸借を保存",
    view_photo: "写真を見る",
    support_email: "サポートメール",
    guide_video_btn: "6つの貯金箱ルールの動画",
    nav_home: "ホーム",
    nav_entry: "入力",
    nav_history: "履歴",
    nav_overview: "統計",
    nav_loans: "その他",
    nav_menu: "メニュー",
    jar_nec_name: "生活費",
    jar_nec_desc: "家賃、光熱費、食費などの必須支出用。",
    jar_lts_name: "長期貯蓄",
    jar_lts_desc: "住宅、車、旅行などの将来 của大きな目標用。",
    jar_edu_name: "教育",
    jar_edu_desc: "自己成長のための学習やスキルアップ投資用。",
    jar_play_name: "娯楽",
    jar_play_desc: "旅行、映画、ショッピングなどの楽しみ用。",
    jar_ffa_name: "資産運用",
    jar_ffa_desc: "将来の経済적自由のための投資用。",
    jar_give_name: "寄付",
    jar_give_desc: "慈善団体への寄付や友人へのサポート用。",
    recurring_title: "定期取引",
    recurring_title_help: "インターネット代や固定費など、一定 của周期を持つ取引を追加します。",
    recurring_add: "定期追加",
    recurring_freq: "繰り返し周期",
    event_title: "イベント取引",
    event_title_help: "誕生日や結婚式などの特定のイベントの取引を管理します。貯金箱に保存されるまで分離されています。",
    event_add: "+新規イベント",
    event_save_history: "保存",
    event_delete: "削除",
    event_entry_title: "イベント入力",
    future_title: "将来の取引",
    future_title_help: "将来 của購入予定を管理します. 実行して貯金箱に保存されるまで、メインデータには影響しません。",
    future_add: "+新規予定",
    future_save_history: "保存",
    future_entry_title: "予定入力",
    history_detail_title: "取引詳細",
    confirm_delete_title: "削除確認",
    confirm_delete_msg: "本当に削除してもよろしいですか？",
    loan_detail_title: "貸借取引詳細",
    account_info: "アカウント情報",
    logout_btn: "ログアウト",
    login_btn: "ログイン",
    register_btn: "新規登録",
    guest_user: "ゲスト",
    policy_1: "1. プライバシーポリシー",
    policy_2: "2. サイバーセキュリティ法 2018",
    policy_3: "3. 個人データ保護",
    policy_4: "4. 免責事項",
    event_jar_select: "まとめ保存先の貯金箱を選択",
    future_jar_select: "実行保存先の貯金箱を選択",
    event_auto_select: "自動配分 (6つ)",
    loan_back_btn: "キャンセル",
    calculator_title: "電卓",
    calculator_close: "閉じる",
    event_sum_total: "合計",
    event_sum_inc: "収入",
    event_sum_exp: "支出",
    event_sum_net: "純収支",
    event_sum_net_label: "純収支",
    event_add_btn: "追加",
    loan_partner_placeholder: "相手先 / 内容",
    recurring_start_date: "開始日",
    auth_email_label: "メールアドレス",
    auth_password_label: "パワード",
    auth_confirm_password_label: "パスワード（確認）",
    auth_google_btn: "Googleでログイン",
    auth_or: "または",
    auth_no_account: "アカウントをお持ちでない方",
    auth_have_account: "既にアカウントをお持ちの方",
    auth_sign_in_now: "ログインする",
    auth_sign_up_now: "新規登録する",
    change_pwd_btn: "パワード変更",
    change_pwd_sent: "パワードリセット의メールを送信しました。メールを確認し、新しいパスワードで再ログインしてください。",
    avatar_upload_label: "アバターを更新",
    pin_setup_title: "PIN設定",
    pin_enter_title: "PIN入力",
    pin_confirm_title: "PIN確認",
    pin_incorrect: "PINが正しくありません",
    pin_enabled_label: "PINロックを有効化",
    pin_change_label: "PINを変更",
    faceid_label: "生体認証を使用",
    loading_data: "データを読み込み中...",
    freq_daily: "毎日",
    freq_weekly: "毎週",
    freq_monthly: "毎月",
    freq_yearly: "毎年",
    ai_quota_exceeded: "AIクォータを超えました。後でもう一度お試しください。"
  }
};

const App: React.FC = () => {
  const APP_VERSION = "v6.3.4";
  const SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; 
  
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
  const [balances, setBalances] = useState<JarBalance>({
    [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0,
    [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [futureGroups, setFutureGroups] = useState<FutureGroup[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isAppInitialLoading, setIsAppInitialLoading] = useState(true);

  const [isPinOverlayOpen, setIsPinOverlayOpen] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSetupStep, setPinSetupStep] = useState<'closed' | 'enter' | 'confirm'>('closed');
  const [tempPin, setTempPin] = useState('');

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info' | 'danger'} | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasswordResetSent, setIsPasswordResetSent] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'policy' | 'guide' | 'app'>('app');
  
  const [isHistoryFilterModalOpen, setIsHistoryFilterModalOpen] = useState(false);
  const [isHistoryDetailModalOpen, setIsHistoryDetailModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [historyJarFilter, setHistoryJarFilter] = useState<JarType | 'all'>('all');
  const [historyFromDateFilter, setHistoryFromDateFilter] = useState<string>(''); 
  const [historyToDateFilter, setHistoryToDateFilter] = useState<string>(''); 
  const [visibleTxCount, setVisibleTxCount] = useState(5);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Use a single state for accordion expansion in the "GD Khác" tab
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

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
  const [calcTarget, setCalcTarget] = useState<'manual' | 'loan' | 'payment' | 'recurring' | 'event' | 'future' | 'transfer'>('manual');

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isLoanDetailModalOpen, setIsLoanDetailModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isLoanPaymentModalOpen, setIsLoanPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amountStr: '', date: getTodayString(), jar: JarType.NEC as JarType | 'AUTO', note: '', imageUrl: '' });
  const [paymentLoanId, setPaymentLoanId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanPrincipalStr, setLoanPrincipalStr] = useState('');
  const [loanForm, setLoanForm] = useState<Omit<Partial<Loan>, 'loanJar'> & { loanJar: JarType | 'AUTO' }>({
    type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '', purpose: ''
  });

  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isRecurringDetailModalOpen, setIsRecurringDetailModalOpen] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringTemplate | null>(null);
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
  
  const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventGroup | null>(null);
  const [isEventJarSelectorOpen, setIsEventJarSelectorOpen] = useState(false);
  const [eventToSave, setEventToSave] = useState<EventGroup | null>(null);

  const [isFutureModalOpen, setIsFutureModalOpen] = useState(false);
  const [futureName, setFutureName] = useState('');
  const [activeFutureId, setActiveFutureId] = useState<string | null>(null);
  const [isFutureEntryModalOpen, setIsFutureEntryModalOpen] = useState(false);
  const [futureManualAmount, setFutureManualAmount] = useState('');
  const [futureManualDesc, setFutureManualDesc] = useState('');
  const [futureManualNote, setFutureManualNote] = useState('');
  const [futureManualType, setFutureManualType] = useState<'income' | 'expense'>('expense');
  const [futureFilters, setFutureFilters] = useState<Record<string, 'all' | 'income' | 'expense'>>({});
  const [isFutureJarSelectorOpen, setIsFutureJarSelectorOpen] = useState(false);
  const [futureToSave, setFutureToSave] = useState<FutureGroup | null>(null);

  const [transferFrom, setTransferFrom] = useState<JarType>(JarType.NEC);
  const [transferTo, setTransferTo] = useState<JarType>(JarType.LTS);
  const [transferAmount, setTransferAmount] = useState('');

  const [deleteClickData, setDeleteClickData] = useState({ id: '', count: 0 });
  const deleteResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [chartRange, setChartRange] = useState<'week' | 'month' | 'year'>('week');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.vi;

  const handleSectionAccordion = (section: ExpandedSection, isForced = false) => {
    if (isForced) {
      setExpandedSection(section);
      return;
    }
    setExpandedSection(prev => prev === section ? null : section);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        const lastAuth = localStorage.getItem('last_auth_time');
        const now = Date.now();
        if (lastAuth && (now - parseInt(lastAuth)) > SESSION_TIMEOUT) {
          handleSignOut();
          setIsAppInitialLoading(false);
          return;
        }
        if (!lastAuth) localStorage.setItem('last_auth_time', now.toString());
        setCurrentUser({ 
          id: firebaseUser.uid, 
          email: firebaseUser.email || '', 
          displayName: firebaseUser.displayName || 'Người dùng', 
          gender: 'male', 
          avatarUrl: firebaseUser.photoURL || undefined,
          provider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'local' 
        });
        setIsAuthModalOpen(false);
      } else {
        setCurrentUser(null);
        setIsCloudLoaded(false);
        setIsAuthModalOpen(true);
        setIsPinVerified(false);
        localStorage.removeItem('last_auth_time');
      }
      setIsAppInitialLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && !isCloudLoaded) {
      const loadFromCloud = async () => {
        try {
          const docRef = doc(db, "users_data", currentUser.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.balances) setBalances(data.balances);
            if (data.transactions) setTransactions(data.transactions);
            if (data.loans) setLoans(data.loans);
            if (data.recurringTemplates) setRecurringTemplates(data.recurringTemplates);
            if (data.events) setEvents(data.events);
            if (data.futureGroups) setFutureGroups(data.futureGroups);
            if (data.settings) setSettings(data.settings);
            if (data.currentUserData?.avatarUrl) {
               setCurrentUser(prev => prev ? ({...prev, avatarUrl: data.currentUserData.avatarUrl}) : null);
            }
          }
          setIsCloudLoaded(true);
        } catch (err) {
          console.error("Firestore Load Error:", err);
          setIsCloudLoaded(true);
        }
      };
      loadFromCloud();
    }
  }, [currentUser?.id, isCloudLoaded]);

  useEffect(() => {
    if (currentUser && isCloudLoaded) {
      const timeoutId = setTimeout(async () => {
        try {
          const docRef = doc(db, "users_data", currentUser.id);
          const rawData = {
            balances,
            transactions,
            loans,
            recurringTemplates,
            events,
            futureGroups,
            settings,
            currentUserData: {
               avatarUrl: currentUser.avatarUrl || null 
            },
            lastUpdated: Date.now()
          };
          await setDoc(docRef, sanitizeData(rawData), { merge: true });
        } catch (err) {
          console.error("Firestore Sync Error:", err);
        }
      }, 3000); 
      return () => clearTimeout(timeoutId);
    }
  }, [balances, transactions, loans, recurringTemplates, events, futureGroups, settings, currentUser, isCloudLoaded]);

  useEffect(() => {
    if (currentUser && settings.pinEnabled && !isPinVerified) {
      setIsPinOverlayOpen(true);
    } else {
      setIsPinOverlayOpen(false);
    }
  }, [currentUser, settings.pinEnabled, isPinVerified]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
  }, [balances, stats, currentUser?.id, settings.language]);

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
    const formatted = val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 512) {
         alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 512KB để tối ưu hệ thống.");
         return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        if (currentUser) {
          if (auth.currentUser) {
             await updateProfile(auth.currentUser, { photoURL: base64String });
          }
          setCurrentUser({...currentUser, avatarUrl: base64String});
          showToast("Avatar OK");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin.length === 6) {
        if (pinSetupStep === 'confirm') {
          if (nextPin === tempPin) {
            setSettings({ ...settings, pin: nextPin, pinEnabled: true });
            setPinSetupStep('closed');
            setIsPinVerified(true);
            showToast("PIN OK");
          } else {
            showToast(t.pin_incorrect, "danger");
            setPinInput('');
          }
        } else if (pinSetupStep === 'enter') {
          setTempPin(nextPin);
          setPinInput('');
          setPinSetupStep('confirm');
        } else {
          if (nextPin === settings.pin) {
            setIsPinVerified(true);
            setIsPinOverlayOpen(false);
            setPinInput('');
          } else {
            showToast(t.pin_incorrect, "danger");
            setPinInput('');
          }
        }
      }
    }
  };

  const handlePinDelete = () => setPinInput(p => p.slice(0, -1));

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(manualAmount);
    if (amountInVnd <= 0 || !manualDesc.trim()) return;
    const newTrans: Transaction = {
      id: editingTransactionId || Date.now().toString(), type: manualType,
      amount: amountInVnd, description: manualDesc, note: manualNote,
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
    setManualAmount(''); setManualDesc(''); setManualNote('');
    setManualJar(manualType === 'expense' ? JarType.NEC : 'AUTO');
    setManualDate(getTodayString());
    setIsEntryModalOpen(false);
    setActiveTab('history');
    showToast(t.history_detail_title + " OK");
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
        showToast("AI OK");
      } else showToast(t.history_empty, "info");
    } catch (e: any) {
      if (e?.message?.includes("429") || e?.status === 429) {
        showToast(t.ai_quota_exceeded, "danger");
      } else {
        showToast("AI Error", "danger");
      }
    }
    finally { setIsLoading(false); setInput(''); }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const imported = await importTransactionsAI(text);
        if (imported.length === 0) {
          showToast("Không tìm thấy dữ liệu hợp lệ trong file", "info");
          return;
        }

        const newTxs: Transaction[] = imported.map(item => ({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
          type: item.type || 'expense',
          amount: item.amount || 0,
          description: item.description || "Giao dịch nhập từ file",
          jarType: item.jarType,
          timestamp: item.timestamp || Date.now(),
          note: "Nhập liệu tự động bằng AI"
        }));

        setBalances(prev => {
          const nb = { ...prev };
          const ratios = settings.jarRatios;
          newTxs.forEach(tx => {
            const factor = tx.type === 'income' ? 1 : -1;
            if (tx.jarType) {
              nb[tx.jarType] += tx.amount * factor;
            } else {
              Object.values(JarType).forEach(type => {
                nb[type as JarType] += tx.amount * ratios[type as JarType] * factor;
              });
            }
          });
          return nb;
        });

        setTransactions(prev => [...newTxs, ...prev]);
        showToast(`Đã nhập thành công ${newTxs.length} giao dịch`, "success");
      } catch (err) {
        showToast("Lỗi khi xử lý file bằng AI", "danger");
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInVnd = parseFormattedNumber(transferAmount);
    if (amountInVnd <= 0 || amountInVnd > balances[transferFrom]) return showToast("Balance error", "danger");
    if (transferFrom === transferTo) return showToast("Same jar", "info");
    const transferId = `trf_${Date.now()}`;
    const tx1: Transaction = { id: Date.now().toString(), type: 'expense', amount: amountInVnd, description: `[${t.transfer_title}] ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferFrom, timestamp: Date.now(), transferGroupId: transferId };
    const tx2: Transaction = { id: (Date.now()+1).toString(), type: 'income', amount: amountInVnd, description: `[${t.transfer_title}] ${JAR_CONFIG[transferFrom].name} ➔ ${JAR_CONFIG[transferTo].name}`, jarType: transferTo, timestamp: Date.now(), transferGroupId: transferId };
    setBalances(prev => {
      const nb = { ...prev };
      nb[transferFrom] -= amountInVnd;
      nb[transferTo] += amountInVnd;
      return nb;
    });
    setTransactions(p => [tx1, tx2, ...p]);
    setIsTransferModalOpen(false);
    setTransferAmount('');
    showToast("Transfer OK");
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.lenderName || !loanPrincipalStr) return;
    const principalVnd = parseFormattedNumber(loanPrincipalStr);
    const finalLoanJar = loanForm.loanJar === 'AUTO' ? undefined : (loanForm.loanJar as JarType);
    const loanId = editingLoanId || Date.now().toString();
    const syntheticTx: Transaction = { id: `loan_${loanId}`, type: loanForm.type === LoanType.BORROW ? 'income' : 'expense', amount: principalVnd, description: `${loanForm.type === LoanType.BORROW ? t.loan_i_owe : t.loan_owes_me}: ${loanForm.lenderName}`, jarType: finalLoanJar, timestamp: Date.now(), loanId: loanId };
    if (editingLoanId) {
       const oldLoan = loans.find(l => l.id === editingLoanId);
       if (oldLoan) {
          const oldSyntheticTx: Transaction = { id: `loan_${oldLoan.id}`, type: oldLoan.type === LoanType.BORROW ? 'income' : 'expense', amount: oldLoan.principal, description: `Undo`, jarType: oldLoan.loanJar, timestamp: Date.now(), loanId: oldLoan.id };
          updateBalances(oldSyntheticTx, syntheticTx);
       }
       setLoans(p => p.map(l => l.id === editingLoanId ? { ...l, ...loanForm, principal: principalVnd, loanJar: finalLoanJar } as Loan : l));
       setEditingLoanId(null);
    } else {
       const newLoan: Loan = { ...loanForm as Loan, id: loanId, principal: principalVnd, paidAmount: 0, loanJar: finalLoanJar };
       setLoans(p => [newLoan, ...p]);
       updateBalances(null, syntheticTx);
    }
    setIsLoanModalOpen(false);
    setLoanPrincipalStr('');
    setLoanForm({ type: LoanType.BORROW, lenderName: '', principal: 0, paidAmount: 0, startDate: getTodayString(), category: LoanCategory.BANK, isUrgent: false, loanJar: 'AUTO', imageUrl: '', purpose: '' });
  };

  const handleDeleteLoan = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    const initialImpactTx: Transaction = { id: `rev_init_${loan.id}`, type: loan.type === LoanType.BORROW ? 'income' : 'expense', amount: loan.principal, description: `Reverse initial loan`, jarType: loan.loanJar, timestamp: Date.now() };
    updateBalances(initialImpactTx, null);
    const associatedTxs = transactions.filter(tx => tx.loanId === loanId);
    associatedTxs.forEach(tx => { updateBalances(tx, null); });
    setTransactions(p => p.filter(tx => tx.loanId !== loanId));
    setLoans(p => p.filter(l => l.id !== loanId));
    showToast("Loan removed");
  };

  const handleOpenNewLoan = () => {
    handleSectionAccordion('loans', true);
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
    if (amountVnd > remainingVnd + 0.01) { alert(t.confirm_delete_msg); return; }
    const payTx: Transaction = { id: `pay_${Date.now()}`, type: targetLoan.type === LoanType.BORROW ? 'expense' : 'income', amount: amountVnd, description: `[${targetLoan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}] ${targetLoan.lenderName}`, jarType: targetLoan.loanJar, timestamp: new Date(paymentForm.date).getTime(), loanId: paymentLoanId, imageUrl: paymentForm.imageUrl };
    updateBalances(null, payTx);
    setLoans(p => p.map(l => l.id === paymentLoanId ? { ...l, paidAmount: l.paidAmount + amountVnd } : l));
    setTransactions(p => [payTx, ...p]);
    setIsLoanPaymentModalOpen(false);
    setPaymentForm({ amountStr: '', date: getTodayString(), jar: JarType.NEC as JarType | 'AUTO', note: '', imageUrl: '' });
    setPaymentLoanId(null);
    showToast("Payment OK");
  };

  const handleSaveRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVnd = parseFormattedNumber(recurringAmountStr);
    if (!recurringForm.description || amountVnd <= 0) return;
    const duration = SUBSCRIPTION_DURATIONS[recurringForm.subscriptionType as SubscriptionType] || 30;
    const start = new Date(recurringForm.startDate!);
    const end = new Date(start);
    end.setDate(start.getDate() + duration);
    const newTpl: RecurringTemplate = { ...recurringForm as RecurringTemplate, id: Date.now().toString(), amount: amountVnd, endDate: end.toISOString().split('T')[0], isActive: true };
    setRecurringTemplates(p => [...p, newTpl]);
    setRecurringAmountStr('');
    setIsRecurringModalOpen(false);
    showToast("Recurring OK");
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;
    const newEvent: EventGroup = { id: Date.now().toString(), name: eventName, date: getTodayString(), transactions: [] };
    setEvents(p => [...p, newEvent]);
    setIsEventModalOpen(false);
    setEventName('');
    showToast("Event OK");
  };

  const handleEventEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVnd = parseFormattedNumber(eventManualAmount);
    if (!eventManualDesc.trim() || amountVnd <= 0 || !activeEventId) return;
    const newTx: Transaction = { id: Date.now().toString(), type: eventManualType, amount: amountVnd, description: eventManualDesc, timestamp: Date.now() };
    setEvents(prev => prev.map(ev => ev.id === activeEventId ? { ...ev, transactions: [newTx, ...ev.transactions] } : ev));
    setEventManualAmount(''); setEventManualDesc('');
    showToast("Added");
  };

  const handleDeleteEventTransaction = (eventId: string, txId: string) => {
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, transactions: ev.transactions.filter(t => t.id !== txId) } : ev));
    showToast("Removed");
  };

  const handlePushEventToHistory = (event: EventGroup, jarType: JarType | 'AUTO') => {
    if (event.transactions.length === 0) return;
    const totalIncome = event.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = event.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netAmount = Math.abs(totalIncome - totalExpense);
    const mainType = totalIncome >= totalExpense ? 'income' : 'expense';
    const mainTx: Transaction = { id: `ev_main_${event.id}`, type: mainType, amount: netAmount, description: `[${t.event_title}] ${event.name}`, jarType: jarType === 'AUTO' ? undefined : jarType as JarType, timestamp: Date.now() };
    setTransactions(p => [mainTx, ...p]);
    updateBalances(null, mainTx);
    setEvents(p => p.filter(e => e.id !== event.id));
    setIsEventJarSelectorOpen(false);
    setEventToSave(null);
    showToast("Saved to History");
  };

  const handleSaveFuture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!futureName.trim()) return;
    const newFuture: FutureGroup = { id: Date.now().toString(), name: futureName, date: getTodayString(), transactions: [] };
    setFutureGroups(p => [...p, newFuture]);
    setIsFutureModalOpen(false);
    setFutureName('');
    showToast("Future Plan OK");
  };

  const handleFutureEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVnd = parseFormattedNumber(futureManualAmount);
    if (!futureManualDesc.trim() || amountVnd <= 0 || !activeFutureId) return;
    const newTx: Transaction = { 
      id: Date.now().toString(), 
      type: futureManualType, 
      amount: amountVnd, 
      description: futureManualDesc, 
      note: futureManualNote,
      timestamp: Date.now() 
    };
    setFutureGroups(prev => prev.map(f => f.id === activeFutureId ? { ...f, transactions: [newTx, ...f.transactions] } : f));
    setFutureManualAmount(''); setFutureManualDesc(''); setFutureManualNote('');
    showToast("Added Plan");
  };

  const handleDeleteFutureTransaction = (futureId: string, txId: string) => {
    setFutureGroups(prev => prev.map(f => f.id === futureId ? { ...f, transactions: f.transactions.filter(t => t.id !== txId) } : f));
    showToast("Removed Plan");
  };

  const handlePushFutureToHistory = (future: FutureGroup, jarType: JarType | 'AUTO') => {
    if (future.transactions.length === 0) return;
    future.transactions.forEach((ft, idx) => {
      const realTx: Transaction = { ...ft, id: `fut_real_${future.id}_${idx}_${Date.now()}`, description: `[${t.future_title}] ${future.name}: ${ft.description}`, jarType: jarType === 'AUTO' ? undefined : jarType as JarType, timestamp: Date.now() };
      setTransactions(p => [realTx, ...p]);
      updateBalances(null, realTx);
    });
    setFutureGroups(p => p.filter(f => f.id !== future.id));
    setIsFutureJarSelectorOpen(false);
    setFutureToSave(null);
    showToast("Plans Executed");
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      if (tx.transferGroupId) {
        const group = transactions.filter(t => t.transferGroupId === tx.transferGroupId);
        group.forEach(g => updateBalances(g, null));
        setTransactions(p => p.filter(t => t.transferGroupId !== tx.transferGroupId));
      } else {
        updateBalances(tx, null);
        setTransactions(p => p.filter(t => t.id !== id));
      }
    }
    setIsHistoryDetailModalOpen(false);
    setSelectedTx(null);
  };

  const handleTripleDelete = (id: string) => {
    if (deleteResetTimer.current) clearTimeout(deleteResetTimer.current);
    if (deleteClickData.id === id) {
      const nextCount = deleteClickData.count + 1;
      if (nextCount >= 3) {
        if (events.find(e => e.id === id)) setEvents(prev => prev.filter(e => e.id !== id));
        else if (futureGroups.find(f => f.id === id)) setFutureGroups(prev => prev.filter(f => f.id !== id));
        else if (loans.find(l => l.id === id)) handleDeleteLoan(id);
        else handleDeleteTransaction(id);
        setDeleteClickData({ id: '', count: 0 });
        showToast("Removed");
      } else {
        setDeleteClickData({ id, count: nextCount });
        deleteResetTimer.current = setTimeout(() => { setDeleteClickData({ id: '', count: 0 }); }, 1500);
      }
    } else {
      setDeleteClickData({ id, count: 1 });
      deleteResetTimer.current = setTimeout(() => { setDeleteClickData({ id: '', count: 0 }); }, 1500);
    }
  };

  const openCalculator = (target: 'manual' | 'loan' | 'payment' | 'recurring' | 'event' | 'future' | 'transfer') => {
    setCalcTarget(target); setCalcExpr(''); setIsCalcOpen(true);
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
        else if (calcTarget === 'future') setFutureManualAmount(formatted);
        else if (calcTarget === 'transfer') setTransferAmount(formatted);
        setIsCalcOpen(false);
      }
      return;
    }
    setCalcExpr(prev => prev + val);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return showToast("No data");
    const header = "ID,Type,Amount (VND),Description,Jar,Date\n";
    const rows = transactions.map(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString();
      return `${tx.id},${tx.type},${tx.amount},"${tx.description}",${tx.jarType || "AUTO"},${date}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `finai_export_${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("CSV OK");
  };

  const handleResetData = () => {
    if (window.confirm("RESET ALL?")) {
      setTransactions([]); setBalances({ [JarType.NEC]: 0, [JarType.LTS]: 0, [JarType.EDU]: 0, [JarType.PLAY]: 0, [JarType.FFA]: 0, [JarType.GIVE]: 0 });
      setLoans([]); setRecurringTemplates([]); setEvents([]); setFutureGroups([]);
      localStorage.clear(); showToast("Reset OK");
    }
  };

  const handleSignOut = () => {
    signOut(auth).then(() => {
      setCurrentUser(null);
      setIsCloudLoaded(false);
      setIsAuthModalOpen(true);
      setIsPinVerified(false);
      localStorage.removeItem('last_auth_time');
      showToast("Signed out", "success");
    });
  };

  const handleChangePassword = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setIsPasswordResetSent(true);
      setIsSettingsOpen(false);
    } catch (err: any) {
      alert("Lỗi khi gửi email: " + err.message);
    }
  };

  const chartData = useMemo(() => {
    const data: { name: string; Thu: number; Chi: number }[] = [];
    const count = chartRange === 'week' ? 7 : chartRange === 'month' ? 30 : 12;
    if (chartRange === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const label = d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : settings.language === 'ja' ? 'ja-JP' : 'en-US', { month: '2-digit', year: 'numeric' });
        const monthT = transactions.filter(tx => {
          const txD = new Date(tx.timestamp);
          return txD.getMonth() === d.getMonth() && txD.getFullYear() === d.getFullYear();
        });
        data.push({ name: label, Thu: convertValue(monthT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)), Chi: convertValue(monthT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)) });
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dayT = transactions.filter(tx => new Date(tx.timestamp).toDateString() === d.toDateString());
        data.push({ name: d.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : settings.language === 'ja' ? 'ja-JP' : 'en-US', { day: '2-digit', month: '2-digit' }), Thu: convertValue(dayT.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)), Chi: convertValue(dayT.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)) });
      }
    }
    return data;
  }, [transactions, settings.currency, settings.language, chartRange]);

  const rangeTotalsVnd = useMemo(() => {
    let income = 0; let expense = 0;
    const count = chartRange === 'week' ? 7 : chartRange === 'month' ? 30 : 12;
    if (chartRange === 'year') {
      const d = new Date();
      for (let i = 11; i >= 0; i--) {
        const checkD = new Date(); checkD.setMonth(d.getMonth() - i);
        transactions.forEach(tx => {
          const txD = new Date(tx.timestamp);
          if (txD.getMonth() === checkD.getMonth() && txD.getFullYear() === checkD.getFullYear()) { if (tx.type === 'income') income += tx.amount; else expense += tx.amount; }
        });
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        const checkD = new Date(); checkD.setDate(new Date().getDate() - i);
        transactions.forEach(tx => { if (new Date(tx.timestamp).toDateString() === checkD.toDateString()) { if (tx.type === 'income') income += tx.amount; else expense += tx.amount; } });
      }
    }
    return { income, expense, net: income - expense };
  }, [transactions, chartRange]);

  const pieData = useMemo(() => {
    return Object.entries(balances).map(([type, amount]) => ({ name: t[`jar_${type.toLowerCase()}_name`], value: Math.max(0, amount as number), color: JAR_CONFIG[type as JarType].color })).filter(d => d.value > 0);
  }, [balances, t]);

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

  const displayedTransactions = useMemo(() => filteredTransactions.slice(0, visibleTxCount), [filteredTransactions, visibleTxCount]);

  if (isAppInitialLoading) {
    return (
      <div className="fixed inset-0 z-[1000] bg-[#ebf0f3] flex flex-col items-center justify-center animate-in fade-in duration-500">
         <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
         <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">FinAi</h1>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t.loading_data}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col items-center pt-[calc(var(--sat,0px)+120px)] pb-[calc(var(--sab,0px)+100px)]">
      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-[1000] bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-2xl animate-in slide-in-from-top-4`} style={{ top: 'calc(var(--sat, 0px) + 12px)' }}>
          {toast.msg}
        </div>
      )}

      {isAuthModalOpen && <AuthForms t={t} onSuccess={() => setIsAuthModalOpen(false)} />}

      {isPinOverlayOpen && (
        <div className="fixed inset-0 z-[800] flex flex-col items-center justify-center bg-[#ebf0f3] animate-in fade-in duration-300">
           <div className="flex flex-col items-center mb-10">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-lg">🔒</div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t.pin_enter_title}</h2>
              <div className="flex gap-3 mt-8">
                 {[...Array(6)].map((_, i) => (
                   <div key={i} className={`w-3 h-3 rounded-full border-2 border-indigo-200 transition-all ${pinInput.length > i ? 'bg-indigo-600 border-indigo-600 scale-125' : 'bg-white'}`} />
                 ))}
              </div>
           </div>
           <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => handlePinDigit(n.toString())} className="w-16 h-16 rounded-2xl nm-button-white text-xl font-black text-slate-700 active:scale-95 transition-all">{n}</button>
              ))}
              <div />
              <button onClick={() => handlePinDigit('0')} className="w-16 h-16 rounded-2xl nm-button-white text-xl font-black text-slate-700 active:scale-95 transition-all">0</button>
              <button onClick={handlePinDelete} className="w-16 h-16 rounded-2xl nm-button-white text-xl font-black text-rose-500 active:scale-95 transition-all">⌫</button>
           </div>
           <button onClick={handleSignOut} className="mt-12 text-[10px] font-black text-indigo-600 uppercase tracking-widest underline underline-offset-4">{t.logout_btn}</button>
        </div>
      )}

      {pinSetupStep !== 'closed' && (
        <div className="fixed inset-0 z-[700] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
           <button onClick={() => { setPinSetupStep('closed'); setPinInput(''); setTempPin(''); }} className="absolute top-10 right-10 w-10 h-10 flex items-center justify-center text-slate-400 text-2xl">✕</button>
           <div className="flex flex-col items-center mb-10">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">{pinSetupStep === 'enter' ? t.pin_setup_title : t.pin_confirm_title}</h2>
              <div className="flex gap-3 mt-6">
                 {[...Array(6)].map((_, i) => (
                   <div key={i} className={`w-3 h-3 rounded-full border-2 border-indigo-200 transition-all ${pinInput.length > i ? 'bg-indigo-600 border-indigo-600' : 'bg-white'}`} />
                 ))}
              </div>
           </div>
           <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => handlePinDigit(n.toString())} className="w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-100 text-xl font-black text-slate-700 active:bg-indigo-50 active:border-indigo-200 transition-all">{n}</button>
              ))}
              <div />
              <button onClick={() => handlePinDigit('0')} className="w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-100 text-xl font-black text-slate-700 active:bg-indigo-50 active:border-indigo-200 transition-all">0</button>
              <button onClick={handlePinDelete} className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-100 text-xl font-black text-rose-500 active:scale-95 transition-all">⌫</button>
           </div>
        </div>
      )}

      {isPasswordResetSent && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6">
          <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] p-9 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center text-center relative border border-slate-100">
            <div className="w-20 h-20 bg-blue-100/50 rounded-full flex items-center justify-center mb-7 border border-blue-100 shadow-inner">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-4 mb-8">
              <p className="text-[11px] font-bold text-slate-500 bg-slate-50 p-5 rounded-2xl border border-slate-100 leading-normal">{t.change_pwd_sent}</p>
            </div>
            <button onClick={() => { setIsPasswordResetSent(false); handleSignOut(); }} className="w-[80%] h-[46px] rounded-2xl bg-blue-600 text-white font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-blue-700">{t.login_btn}</button>
          </div>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-b border-indigo-100 shadow-sm" style={{ paddingTop: 'var(--sat, 0px)' }}>
        <div className="max-w-5xl mx-auto flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 -ml-2 text-slate-500 hover:text-indigo-600 focus:outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-100 p-0.5 overflow-hidden shadow-inner flex items-center justify-center bg-indigo-50">
                  <img src={currentUser?.avatarUrl || DEFAULT_AVATAR} className="w-full h-full rounded-full object-cover" alt="User Avatar" />
                </div>
                <div className="flex flex-col">
                  <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em]">👋 HI, <span className="text-slate-900">{currentUser?.displayName || t.guest_user}</span></div>
                  <div className="flex items-center gap-2 mt-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>📅 {currentTime.toLocaleDateString(settings.language === 'vi' ? 'vi-VN' : settings.language === 'ja' ? 'ja-JP' : 'en-US')}</span>
                    <div className="w-[1px] h-2 bg-slate-200"></div>
                    <span>⏰ {currentTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[12px] font-black text-slate-900 uppercase leading-none">{t.appTitle}</span>
              <span className="text-[8px] font-black text-indigo-500 uppercase mt-0.5">{APP_VERSION}</span>
            </div>
          </div>
          <form onSubmit={handleProcessInput} className="relative w-full">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t.ai_placeholder} className="w-full bg-slate-100 border-2 border-slate-200 rounded-full px-5 py-2.5 text-[11px] font-normal outline-none focus:border-indigo-400 transition-all" />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center">
              {isLoading ? <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨"}
            </button>
          </form>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto px-4 space-y-8 animate-in fade-in duration-500">
        {activeTab === 'home' && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t.stats_jars, val: (Object.values(balances) as number[]).reduce((a, b) => a + b, 0), icon: '💰', colorClass: 'text-slate-900', help: t.stats_jars_help, helpPos: 'bottom' as const }, 
                { label: t.stats_debt, val: stats.debt, icon: '📉', colorClass: 'text-blue-600', help: t.stats_debt_help, helpPos: 'bottom' as const }, 
                { label: t.stats_lent, val: stats.lent, icon: '🤝', colorClass: 'text-red-600', help: t.stats_lent_help, helpPos: 'bottom' as const }, 
                { label: t.stats_net, val: stats.net, icon: '💎', dark: true, colorClass: 'text-white', help: t.stats_net_help, helpPos: 'bottom' as const }
              ].map((s, i) => (
                <div key={i} className={`${s.dark ? 'bg-indigo-600 text-white' : 'bg-white'} p-4 rounded-2xl border-2 border-slate-100 shadow-md relative group`}>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <HelpTooltip content={s.help} position={s.helpPos} />
                  </div>
                  <p className="text-[8px] font-black uppercase opacity-60 mb-1">{s.label}</p>
                  <h3 className={`text-base font-black truncate ${s.colorClass}`}>{formatCurrency(s.val)}</h3>
                </div>
              ))}
            </section>
            <section className="bg-white p-5 rounded-[2.5rem] border-2 border-indigo-50 shadow-xl shadow-indigo-100/50 flex items-center gap-5 relative overflow-hidden group">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg z-10">
                {isAdviceLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "🦉"}
              </div>
              <div className="space-y-1 z-10 flex-1">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{t.advice_title}</h4>
                <p className="text-[12px] font-bold text-slate-700 italic leading-relaxed">"{aiAdvice}"</p>
              </div>
            </section>
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.values(JarType).map(type => (
                <JarVisual key={type} jar={{ ...JAR_CONFIG[type], name: t[`jar_${type.toLowerCase()}_name`], description: t[`jar_${type.toLowerCase()}_desc`] }} balance={balances[type]} currency={settings.currency} convertValue={convertValue} onTransferClick={() => { setTransferFrom(type); setIsTransferModalOpen(true); }} />
              ))}
            </section>
          </>
        )}

        {activeTab === 'history' && (
          <section className="bg-white p-5 rounded-[2.5rem] border-2 border-slate-200 shadow-xl min-h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                  {t.history_title}
                  <HelpTooltip content={t.history_title_help} position="bottom" />
                </h3>
              </div>
              <button onClick={() => setIsHistoryFilterModalOpen(true)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                <span className="text-[9px] font-black uppercase tracking-tighter">{t.history_filter}</span>
              </button>
            </div>
            <div className="space-y-2">
              {displayedTransactions.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-[10px] font-bold text-slate-400 italic bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">{t.history_empty}</div> : (
                <>
                  {displayedTransactions.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        if (activeItemId === tx.id) {
                          setSelectedTx(tx);
                          setIsHistoryDetailModalOpen(true);
                        } else {
                          setActiveItemId(tx.id);
                        }
                      }}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group relative overflow-hidden transition-all hover:bg-white active:bg-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{tx.type === 'income' ? '↑' : '↓'}</div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 line-clamp-1">{tx.description}</p>
                          <div className="flex items-center gap-2 text-[7px] font-black text-slate-400 uppercase mt-0.5">
                            <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                            {tx.jarType && <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-500">{t[`jar_${tx.jarType.toLowerCase()}_name`]}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-[11px] font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</p>
                        <div className={`flex gap-1 transition-all ml-1 ${activeItemId === tx.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'} group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto`}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingTransactionId(tx.id); setManualType(tx.type); setManualAmount(formatDots((tx.amount * EXCHANGE_RATES[settings.currency]).toString())); setManualDesc(tx.description); setManualNote(tx.note || ''); setManualJar(tx.jarType || 'AUTO'); setManualDate(new Date(tx.timestamp).toISOString().split('T')[0]); setIsEntryModalOpen(true); }} className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px]">✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); handleTripleDelete(tx.id); }} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] ${deleteClickData.id === tx.id ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}>{deleteClickData.id === tx.id ? '❓' : '🗑️'}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredTransactions.length > visibleTxCount && <button onClick={() => setVisibleTxCount(prev => prev + 15)} className="w-full py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-2xl">{t.history_more}</button>}
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">📊 {t.chart_title}</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  {['week', 'month', 'year'].map(r => (
                    <button key={r} onClick={() => setChartRange(r as any)} className={`px-3 py-1 text-[8px] font-black uppercase rounded-lg ${chartRange === r ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{t[`chart_${r}`]}</button>
                  ))}
                </div>
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => settings.currency === 'VND' ? (v >= 1000000 ? (v/1000000).toFixed(1)+'tr' : (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)) : v} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', fontSize: '10px' }} />
                    <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex items-center justify-between gap-2 pt-4 border-t border-slate-50">
                <div className="flex-1 bg-emerald-50 p-3 rounded-2xl border border-emerald-100"><p className="text-[8px] font-black text-emerald-600 uppercase mb-0.5">{t.event_sum_inc}</p><p className="text-[10px] font-black text-emerald-700">{formatCurrency(rangeTotalsVnd.income)}</p></div>
                <div className="flex-1 bg-rose-50 p-3 rounded-2xl border border-rose-100"><p className="text-[8px] font-black text-rose-600 uppercase mb-0.5">{t.event_sum_exp}</p><p className="text-[10px] font-black text-rose-700">{formatCurrency(rangeTotalsVnd.expense)}</p></div>
                <div className="flex-1 bg-indigo-50 p-3 rounded-2xl border border-indigo-100"><p className="text-[8px] font-black text-indigo-600 uppercase mb-0.5">{t.event_sum_net}</p><p className="text-[10px] font-black text-indigo-700">{rangeTotalsVnd.net >= 0 ? '+' : ''}{formatCurrency(rangeTotalsVnd.net)}</p></div>
              </div>
            </section>
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 border-b pb-2">🍕 {t.pie_title}</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '1rem', border: 'none', fontSize: '10px' }} />
                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'loans' && (
          <div className="space-y-8 animate-in fade-in duration-300 pb-20">
            {/* VAY NỢ SECTION */}
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl relative group">
              <div className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity">
                <HelpTooltip content={t.loan_title_help} position="bottom" />
              </div>
              <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => handleSectionAccordion('loans')}>
                <div className="flex items-center gap-2">
                  <span className={`transition-transform duration-300 text-slate-400 ${expandedSection === 'loans' ? 'rotate-0' : '-rotate-90'}`}>▼</span>
                  <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📉</span> {t.loan_title} ({loans.length})</h3>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleOpenNewLoan(); }} className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 text-2xl font-light">＋</button>
              </div>
              {expandedSection === 'loans' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="w-full h-[1px] bg-slate-100 mb-6" />
                  {loans.length === 0 ? <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {loans.map(loan => (
                        <div 
                          key={loan.id} 
                          onClick={() => {
                            if (activeItemId === loan.id) {
                              setSelectedLoan(loan);
                              setIsLoanDetailModalOpen(true);
                            } else {
                              setActiveItemId(loan.id);
                            }
                          }}
                          className="bg-slate-50 rounded-2xl border border-slate-100 p-4 group relative pb-10 cursor-pointer transition-all hover:bg-white"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm ${loan.type === LoanType.BORROW ? 'bg-rose-50' : 'bg-emerald-50'}`}>{loan.type === LoanType.BORROW ? '💸' : '🤝'}</div>
                              <div><p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{loan.lenderName}</p><p className="text-[8px] font-bold text-slate-400 mt-0.5">{loan.startDate}</p></div>
                            </div>
                            <div className="flex flex-col items-end">
                              {loan.paidAmount < loan.principal && <button onClick={(e) => { e.stopPropagation(); setPaymentLoanId(loan.id); setPaymentForm({ amountStr: '', date: getTodayString(), jar: JarType.NEC, note: '', imageUrl: '' }); setIsLoanPaymentModalOpen(true); }} className={`px-2 py-1 text-[7px] font-black uppercase rounded-lg shadow-sm mb-1 ${loan.type === LoanType.BORROW ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{loan.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</button>}
                              <p className="text-[11px] font-black">{formatCurrency(loan.principal - loan.paidAmount)}</p>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2"><div className={`h-full ${loan.type === LoanType.BORROW ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${(loan.paidAmount/loan.principal)*100}%` }} /></div>
                          <div className="flex justify-between mt-2 px-1 text-[8px] font-bold text-slate-400 uppercase"><span>{t.loan_paid}: {formatCurrency(loan.paidAmount)}</span><span>{t.loan_rem}: {formatCurrency(loan.principal - loan.paidAmount)}</span></div>
                          <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 transition-all ${activeItemId === loan.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'} group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto`}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingLoanId(loan.id); setLoanForm({...loan, loanJar: loan.loanJar || 'AUTO'}); setLoanPrincipalStr(formatDots((loan.principal * EXCHANGE_RATES[settings.currency]).toString())); setIsLoanModalOpen(true); }} className="w-7 h-7 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-md border border-indigo-100 text-[10px]">✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); handleTripleDelete(loan.id); }} className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md text-[10px] transition-all ${deleteClickData.id === loan.id ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-rose-600 border border-rose-100'}`}>{deleteClickData.id === loan.id ? (deleteClickData.count >= 2 ? '❓' : deleteClickData.count) : '🗑️'}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ĐỊNH KỲ SECTION */}
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl relative group">
              <div className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity">
                <HelpTooltip content={t.recurring_title_help} position="bottom" />
              </div>
              <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => handleSectionAccordion('recurring')}>
                <div className="flex items-center gap-2">
                  <span className={`transition-transform duration-300 text-slate-400 ${expandedSection === 'recurring' ? 'rotate-0' : '-rotate-90'}`}>▼</span>
                  <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>📅</span> {t.recurring_title} ({recurringTemplates.length})</h3>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleSectionAccordion('recurring', true); setIsRecurringModalOpen(true); }} className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 text-2xl font-light">＋</button>
              </div>
              {expandedSection === 'recurring' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="w-full h-[1px] bg-slate-100 mb-6" />
                  {recurringTemplates.length === 0 ? <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div> : (
                    <div className="space-y-3">
                      {recurringTemplates.map(tpl => (
                        <div key={tpl.id} onDoubleClick={() => { setSelectedRecurring(tpl); setIsRecurringDetailModalOpen(true); }} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">🔄</div>
                            <div><p className="text-[11px] font-black text-slate-800">{tpl.description}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{t.recurring_start_date}: {tpl.startDate} • {tpl.subscriptionType}</p></div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-3">
                               <p className={`text-[11px] font-black ${tpl.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tpl.type === 'income' ? '+' : '-'}{formatCurrency(tpl.amount)}</p>
                               <button onClick={(e) => { e.stopPropagation(); setRecurringTemplates(p => p.filter(x => x.id !== tpl.id)); }} className="w-6 h-6 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* SỰ KIỆN SECTION */}
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl relative group">
              <div className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity">
                <HelpTooltip content={t.event_title_help} position="bottom" />
              </div>
              <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => handleSectionAccordion('events')}>
                <div className="flex items-center gap-2">
                  <span className={`transition-transform duration-300 text-slate-400 ${expandedSection === 'events' ? 'rotate-0' : '-rotate-90'}`}>▼</span>
                  <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>🎊</span> {t.event_title} ({events.length})</h3>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleSectionAccordion('events', true); setIsEventModalOpen(true); }} className="w-10 h-10 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 text-2xl font-light">＋</button>
              </div>
              {expandedSection === 'events' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="w-full h-[1px] bg-slate-100 mb-6" />
                  {events.length === 0 ? <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div> : (
                    <div className="grid grid-cols-1 gap-6">
                      {events.map(ev => {
                        const activeFilter = eventFilters[ev.id] || 'all';
                        const filteredTxs = ev.transactions.filter(t => activeFilter === 'all' || t.type === activeFilter);
                        const totalInc = ev.transactions.filter(t => t.type === 'income').reduce((s, x) => s + x.amount, 0);
                        const totalExp = ev.transactions.filter(t => t.type === 'expense').reduce((s, x) => s + x.amount, 0);
                        return (
                          <div key={ev.id} className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-6 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center"><div><h4 className="text-[12px] font-black text-slate-800 uppercase leading-tight">{ev.name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ev.date} • {ev.transactions.length} GD</p></div></div>
                            <div className="flex items-center justify-between gap-2 pt-2">
                              <div className="flex bg-white rounded-lg p-0.5 border border-slate-100 shadow-sm">{['all', 'income', 'expense'].map(f => <button key={f} onClick={() => setEventFilters({...eventFilters, [ev.id]: f as any})} className={`px-2 py-1 text-[7px] font-black uppercase rounded-md transition-all ${activeFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>{f === 'all' ? t.history_all : f === 'income' ? t.event_sum_inc : t.event_sum_exp}</button>)}</div>
                              <div className="flex gap-2"><button onClick={() => { setEventToSave(ev); setIsEventJarSelectorOpen(true); }} className="py-2 px-4 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase shadow-sm active:scale-95 transition-all">{t.event_save_history}</button><button onClick={(e) => { e.stopPropagation(); handleTripleDelete(ev.id); }} className={`py-2 px-4 rounded-xl text-[8px] font-black uppercase shadow-sm transition-all active:scale-95 ${deleteClickData.id === ev.id ? 'bg-red-600 text-white animate-pulse' : 'bg-red-50 text-red-600 border border-red-100'}`}>{deleteClickData.id === ev.id ? `Xóa? (${deleteClickData.count}/3)` : 'Xóa'}</button></div>
                            </div>
                            <div className="bg-white/70 rounded-2xl p-4 border border-slate-200/50 space-y-2 max-h-[180px] overflow-y-auto shadow-inner mt-2">{filteredTxs.length === 0 ? <p className="text-center text-[9px] text-slate-300 italic py-4">{t.history_empty}</p> : filteredTxs.map(et => (<div key={et.id} className="flex justify-between items-center text-[10px] py-2 border-b border-slate-100 last:border-none"><span className="text-slate-700 font-bold">{et.description}</span><div className="flex items-center gap-2"><span className={et.type === 'income' ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{formatCurrency(et.amount)}</span><button onClick={() => handleDeleteEventTransaction(ev.id, et.id)} className="w-5 h-5 flex items-center justify-center text-rose-300 hover:text-rose-600 font-black transition-colors">✕</button></div></div>))}</div>
                            <div className="flex items-center justify-center gap-6 py-2 border-t border-slate-200/50 mt-2 flex-wrap"><span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">{t.event_sum_inc}: {formatCurrency(totalInc)}</span><span className="text-[8px] font-black text-rose-600 uppercase tracking-tighter">{t.event_sum_exp}: {formatCurrency(totalExp)}</span><span className="text-[9px] font-black uppercase text-slate-900 px-3 py-1 bg-white rounded-full border border-slate-100 shadow-sm ring-2 ring-indigo-50/50">{t.event_sum_total}: {formatCurrency(Math.abs(totalInc - totalExp))}</span></div>
                            <div className="flex justify-center pt-1"><button onClick={() => { setActiveEventId(ev.id); setIsEventEntryModalOpen(true); }} className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all text-2xl font-light">＋</button></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* TƯƠNG LAI SECTION */}
            <section className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-xl mb-10 relative group">
              <div className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity">
                <HelpTooltip content={t.future_title_help} position="bottom" />
              </div>
              <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => handleSectionAccordion('future')}>
                <div className="flex items-center gap-2">
                  <span className={`transition-transform duration-300 text-slate-400 ${expandedSection === 'future' ? 'rotate-0' : '-rotate-90'}`}>▼</span>
                  <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><span>🔮</span> {t.future_title} ({futureGroups.length})</h3>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleSectionAccordion('future', true); setIsFutureModalOpen(true); }} className="w-10 h-10 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 text-2xl font-light">＋</button>
              </div>
              {expandedSection === 'future' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="w-full h-[1px] bg-slate-100 mb-6" />
                  {futureGroups.length === 0 ? <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] py-10 text-slate-400 italic text-[10px] font-bold">{t.history_empty}</div> : (
                    <div className="grid grid-cols-1 gap-6">
                      {futureGroups.map(fg => {
                        const activeFilter = futureFilters[fg.id] || 'all';
                        const filteredTxs = fg.transactions.filter(t => activeFilter === 'all' || t.type === activeFilter);
                        const totalInc = fg.transactions.filter(t => t.type === 'income').reduce((s, x) => s + x.amount, 0);
                        const totalExp = fg.transactions.filter(t => t.type === 'expense').reduce((s, x) => s + x.amount, 0);
                        return (
                          <div key={fg.id} className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-6 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center"><div><h4 className="text-[12px] font-black text-slate-800 uppercase leading-tight">{fg.name}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{fg.date} • {fg.transactions.length} Dự định</p></div></div>
                            <div className="flex items-center justify-between gap-2 pt-2">
                              <div className="flex bg-white rounded-lg p-0.5 border border-slate-100 shadow-sm">{['all', 'income', 'expense'].map(f => <button key={f} onClick={() => setFutureFilters({...futureFilters, [fg.id]: f as any})} className={`px-2 py-1 text-[7px] font-black uppercase rounded-md transition-all ${activeFilter === f ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400'}`}>{f === 'all' ? t.history_all : f === 'income' ? t.event_sum_inc : t.event_sum_exp}</button>)}</div>
                              <div className="flex gap-2"><button onClick={() => { setFutureToSave(fg); setIsFutureJarSelectorOpen(true); }} className="py-2 px-4 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase shadow-sm active:scale-95 transition-all">{t.future_save_history}</button><button onClick={(e) => { e.stopPropagation(); handleTripleDelete(fg.id); }} className={`py-2 px-4 rounded-xl text-[8px] font-black uppercase shadow-sm transition-all active:scale-95 ${deleteClickData.id === fg.id ? 'bg-red-600 text-white animate-pulse' : 'bg-red-50 text-red-600 border border-red-100'}`}>{deleteClickData.id === fg.id ? `Xóa? (${deleteClickData.count}/3)` : 'Xóa'}</button></div>
                            </div>
                            <div className="bg-white/70 rounded-2xl p-4 border border-slate-200/50 space-y-2 max-h-[180px] overflow-y-auto shadow-inner mt-2">{filteredTxs.length === 0 ? <p className="text-center text-[9px] text-slate-300 italic py-4">{t.history_empty}</p> : filteredTxs.map(ft => (<div key={ft.id} className="flex justify-between items-center text-[10px] py-2 border-b border-slate-100 last:border-none"><span className="text-slate-700 font-bold">{ft.description}</span><div className="flex items-center gap-2"><span className={ft.type === 'income' ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{formatCurrency(ft.amount)}</span><button onClick={() => handleDeleteFutureTransaction(fg.id, ft.id)} className="w-5 h-5 flex items-center justify-center text-rose-300 hover:text-rose-600 font-black transition-colors">✕</button></div></div>))}</div>
                            <div className="flex items-center justify-center gap-6 py-2 border-t border-slate-200/50 mt-2 flex-wrap text-[8px] font-black uppercase tracking-tighter"><span className="text-emerald-600">{t.event_sum_inc}: {formatCurrency(totalInc)}</span><span className="text-rose-600">{t.event_sum_exp}: {formatCurrency(totalExp)}</span></div>
                            <div className="flex justify-center pt-1"><button onClick={() => { setActiveFutureId(fg.id); setIsFutureEntryModalOpen(true); }} className="w-10 h-10 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all text-2xl font-light">＋</button></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-indigo-100/50 p-2 shadow-2xl" style={{ paddingBottom: 'calc(var(--sab, 0px) + 12px)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-around">
          {[{ id: 'home', icon: '🏠', label: t.nav_home }, { id: 'history', icon: '📜', label: t.nav_history }, { id: 'entry', icon: '＋', special: true }, { id: 'overview', icon: '📊', label: t.nav_overview }, { id: 'loans', icon: '🏦', label: t.nav_loans }].map(btn => btn.special ? (
            <div key={btn.id} className="relative flex items-center justify-center px-4 -mt-2"><button onClick={() => setIsEntryModalOpen(true)} className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all -translate-y-5 ring-4 ring-white"><span className="text-3xl font-light">＋</span></button></div>
          ) : (
            <button key={btn.id} onClick={() => setActiveTab(btn.id as AppTab)} className={`flex flex-col items-center gap-1 p-2 min-w-[70px] transition-all ${activeTab === btn.id ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}><span className="text-xl">{btn.icon}</span><span className="text-[8px] font-black uppercase tracking-tight">{btn.label}</span></button>
          ))}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative ml-auto h-full w-full max-sm:max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" style={{ paddingTop: 'var(--sat, 0px)' }}>
            <div className="p-5 border-b flex items-center justify-between bg-slate-50/50"><h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t.settings_title}</h2><button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500 p-2 text-xl focus:outline-none">✕</button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {settingsTab === 'app' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.account_info}</label>
                    <div className="nm-flat p-5 rounded-3xl flex flex-col items-center text-center gap-2">
                       <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                          <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-indigo-50 flex items-center justify-center"><img src={currentUser?.avatarUrl || DEFAULT_AVATAR} className="w-full h-full object-cover" alt="User Avatar" /></div>
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"><span className="text-white text-[8px] font-black uppercase">Sửa</span></div>
                          <input type="file" alt="upload avatar" ref={avatarInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleAvatarChange} />
                       </div>
                       <button onClick={() => avatarInputRef.current?.click()} className="text-[8px] font-black text-indigo-600 uppercase mt-1 active:opacity-60">{t.avatar_upload_label}</button>
                       <div className="mt-2"><p className="text-[11px] font-black text-slate-800 uppercase">{currentUser?.displayName || t.guest_user}</p><p className="text-[9px] font-medium text-slate-400">{currentUser?.email || ""}</p></div>
                       <div className="w-full h-[1px] bg-slate-100 my-2" />
                       <div className="w-full space-y-2 text-left mt-2">
                          <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><span className="text-lg">🛡️</span><span className="text-[10px] font-black text-slate-600 uppercase">{t.pin_enabled_label}</span></div><button onClick={() => { if (settings.pinEnabled) setSettings({...settings, pinEnabled: false}); else { setPinSetupStep('enter'); setPinInput(''); } }} className={`w-10 h-5 rounded-full relative transition-all duration-300 ${settings.pinEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${settings.pinEnabled ? 'right-1' : 'left-1'}`} /></button></div>
                          {settings.pinEnabled && <button onClick={() => { setPinSetupStep('enter'); setPinInput(''); }} className="w-full p-3 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded-xl border border-indigo-100 text-center active:bg-indigo-100 transition-all">{t.pin_change_label}</button>}
                       </div>
                       <div className="w-full h-[1px] bg-slate-100 my-2" />
                       {currentUser ? <><button onClick={handleChangePassword} className="text-blue-600 font-semibold text-[9px] mb-2 hover:underline active:opacity-60 transition-all">{t.change_pwd_btn}</button><button onClick={handleSignOut} className="w-full py-3 nm-button-white text-rose-500 text-[10px] font-black rounded-xl uppercase tracking-widest">{t.logout_btn}</button></> : <div className="flex gap-2 w-full"><button onClick={() => setIsAuthModalOpen(true)} className="flex-1 py-3 nm-button-white text-indigo-600 text-[10px] font-black rounded-xl uppercase tracking-widest">{t.login_btn}</button><button onClick={() => setIsAuthModalOpen(true)} className="flex-1 py-3 nm-button-teal text-[10px] font-black rounded-xl uppercase tracking-widest">{t.register_btn}</button></div>}
                    </div>
                  </div>
                  <div className="space-y-2"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.currency}</label><select value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value as any})} className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 text-[11px] font-normal outline-none focus:border-indigo-400 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat"><option value="VND">VND</option><option value="JPY">JPY</option><option value="USD">USD</option></select></div>
                  <div className="space-y-2"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.language}</label><select value={settings.language} onChange={e => setSettings({...settings, language: e.target.value as any})} className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 text-[11px] font-normal outline-none focus:border-indigo-400 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat"><option value="vi">{t.lang_vi}</option><option value="en">{t.lang_en}</option><option value="ja">{t.lang_ja}</option></select></div>
                  <div className="space-y-2"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.settings_data}</label><div className="bg-slate-50 rounded-2xl border-2 border-slate-100 overflow-hidden"><button onClick={exportToCSV} className="w-full flex items-center gap-3 px-5 py-4 border-b border-slate-100 active:bg-emerald-50 text-[10px] font-bold text-slate-600"><span>📤</span> {t.settings_data_export}</button><button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-5 py-4 border-b border-slate-100 active:bg-indigo-50 text-[10px] font-bold text-slate-600"><span>📥</span> {t.settings_data_import}</button><input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFile} /><button onClick={handleResetData} className="w-full flex items-center gap-3 px-5 py-4 active:bg-red-50 text-[10px] font-bold text-red-600"><span>⚠️</span> {t.settings_data_reset}</button></div></div>
                </div>
              )}
              {settingsTab === 'info' && (
                <div className="space-y-10 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter">FinAi</h2>
                    <p className="text-[9px] font-bold text-slate-500">Quản lý tài chính cá nhân thông minh</p>
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest pt-2">THIẾT KẾ BỞI LOONG LEE</p>
                    <p className="text-[8px] font-bold text-slate-400 italic">Version {APP_VERSION}</p>
                  </div>
                  <div className="space-y-3 pt-8 border-t border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">{t.settings_connect}</h3>
                    <div className="space-y-2">
                      <a href="https://www.facebook.com/duclongka" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-blue-200 active:bg-blue-50 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">f</span>
                          <span className="text-[10px] font-black text-slate-600 uppercase">Facebook</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 underline">duclongka</span>
                      </a>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-sm">💬</span>
                          <span className="text-[10px] font-black text-slate-600 uppercase">Zalo</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-800">0964 855 899</span>
                      </div>
                      <a href="mailto:longld@itsupro.org" className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 active:bg-indigo-50 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm">✉️</span>
                          <span className="text-[10px] font-black text-slate-600 uppercase">Email</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-800 truncate">longld@itsupro.org</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {settingsTab === 'policy' && <div className="animate-in fade-in space-y-6"><h3 className="text-[13px] font-black text-rose-600 uppercase text-center mb-2">{t.settings_policy}</h3><div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 space-y-5 text-[10px] font-medium text-rose-900 leading-relaxed"><p><strong>{t.policy_1}:</strong> Ứng dụng FINAI cam kết không lưu trữ bất kỳ dữ liệu tài chính nào của người dùng trên máy chủ (server). Mọi dữ liệu đều được lưu trữ trực tiếp trên thiết bị cá nhân (LocalStorage/Browser Storage) của chính bạn.</p><p><strong>{t.policy_2}:</strong> Chúng tôi tuân thủ nghiêm ngặt Luật An toàn thông tin mạng và Luật An ninh mạng Việt Nam. Vì dữ liệu không được tải lên mạng, nguy cơ rò rỉ dữ liệu cá nhân từ hệ thống là bằng 0.</p><p><strong>{t.policy_3}:</strong> Do đặc thù lưu trữ tại chỗ, người dùng có trách nhiệm tự bảo mật thiết bị truy cập và sao lưu dữ liệu (qua tính năng Export CSV).</p><p><strong>{t.policy_4}:</strong> FINAI không chịu trách nhiệm cho bất kỳ mất bát dữ liệu nào do lỗi thiết bị, xóa bộ nhớ trình duyệt, hoặc hành vi xâm nhập trái phép vào thiết bị của người dùng.</p><p className="text-center font-black pt-4 border-t border-rose-200 uppercase tracking-tighter">* Dựa trên Luật An ninh mạng Việt Nam 2018 và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</p></div></div>}
              {settingsTab === 'guide' && <div className="animate-in fade-in space-y-6"><h3 className="text-[13px] font-black text-indigo-600 uppercase text-center mb-2">{t.settings_guide}</h3><div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-6"><div className="flex gap-4 items-center"><span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">1</span><p className="text-[10px] font-bold text-slate-700 leading-relaxed">Sử dụng AI: Nhập nhanh giao dịch tại thanh tìm kiếm trên cùng. (Ví dụ: "Sáng ăn phở 50k hũ thiết yếu")</p></div><div className="flex gap-4 items-center"><span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">2</span><p className="text-[10px] font-bold text-slate-700 leading-relaxed">Quy tắc 6 Hũ: Hệ thống tự động chia thu nhập của bạn theo tỉ lệ (55%, 10%, 10%, 10%, 10%, 5%).</p></div><div className="flex gap-4 items-center"><span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">3</span><p className="text-[10px] font-bold text-slate-700 leading-relaxed">Vay nợ: Quản lý các khoản nợ phải trả và nợ thu hồi một cách minh bạch.</p></div><div className="flex gap-4 items-center"><span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">4</span><p className="text-[10px] font-bold text-slate-700 leading-relaxed">Dữ liệu: Mọi thông tin lưu trên máy bạn. Hãy xuất CSV định kỳ để sao lưu!</p></div><div className="pt-6 border-t border-indigo-200 mt-2 space-y-4 text-center"><h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Video tài liệu tham khảo</h4><p className="text-[9px] font-bold text-slate-500">Tìm hiểu chi tiết hơn về quy tắc 6 chiếc lọ để quản lý tài chính cá nhân thông minh qua video sau:</p><button onClick={() => window.open('https://fb.watch/EVNQ463bNS/', '_blank')} className="w-full py-4 border-2 border-emerald-400 rounded-2xl text-[9px] font-black text-emerald-600 flex items-center justify-center gap-2 hover:bg-emerald-50 active:scale-95 transition-all">🎬 {t.guide_video_btn}</button></div></div></div>}
            </div>
            <div className="p-3 border-t grid grid-cols-4 items-center justify-around bg-slate-50" style={{ paddingBottom: 'calc(var(--sab, 0px) + 12px)' }}>{[{ id: 'app', icon: '⚙️', label: t.settings_app }, { id: 'info', icon: 'ℹ️', label: t.settings_info }, { id: 'policy', icon: '🛡️', label: t.settings_policy }, { id: 'guide', icon: '📖', label: t.settings_guide }].map(tab => <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all ${settingsTab === tab.id ? 'bg-white shadow-lg shadow-indigo-100 text-indigo-600' : 'text-slate-400'}`}><span className="text-base">{tab.icon}</span><span className="text-[7px] font-black uppercase text-center leading-none">{tab.label}</span></button>)}</div>
          </div>
        </div>
      )}

      {isEntryModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-[12px] font-black text-slate-800 uppercase mb-5 tracking-widest text-center">{editingTransactionId ? t.manual_edit : t.manual_title}</h2>
            <form onSubmit={handleManualSubmit} className="space-y-4">
               <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-slate-200"><button type="button" onClick={() => setManualType('expense')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${manualType === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.manual_expense}</button><button type="button" onClick={() => setManualType('income')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${manualType === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.manual_income}</button></div>
               <div className="space-y-1"><div className="relative"><input required type="text" inputMode="numeric" value={manualAmount} onChange={e => setManualAmount(formatDots(e.target.value))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-4 pr-12 h-12 text-sm font-black outline-none focus:border-indigo-400 placeholder:text-[10px]" /><button type="button" onClick={() => openCalculator('manual')} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 text-slate-400 text-2xl active:scale-90">🧮</button></div><AmountHintLabel val={manualAmount} currency={settings.currency} lang={settings.language} /></div>
               <input required type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder={t.manual_desc} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-bold outline-none" />
               <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.manual_jar_img}</label><select value={manualJar} onChange={e => setManualJar(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-normal outline-none"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {t[`jar_${type.toLowerCase()}_name`]}</option>)}</select></div>
               <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.manual_date_label}</label><input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-normal outline-none text-center min-w-0 max-w-full appearance-none" /></div>
               <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder={t.manual_note} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-bold outline-none" />
               <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setIsEntryModalOpen(false); setEditingTransactionId(null); }} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button><button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95">{editingTransactionId ? t.manual_update : t.manual_save}</button></div>
            </form>
          </div>
        </div>
      )}

      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-[12px] font-black text-slate-800 uppercase mb-5 tracking-widest text-center">{t.recurring_add}</h2>
            <form onSubmit={handleSaveRecurring} className="space-y-4">
               <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-slate-200"><button type="button" onClick={() => setRecurringForm({...recurringForm, type: 'expense'})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${recurringForm.type === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.manual_expense}</button><button type="button" onClick={() => setRecurringForm({...recurringForm, type: 'income'})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${recurringForm.type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.manual_income}</button></div>
               <div className="space-y-1"><div className="relative"><input required type="text" inputMode="numeric" value={recurringAmountStr} onChange={e => setRecurringAmountStr(formatDots(e.target.value))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-4 pr-12 h-12 text-sm font-black outline-none focus:border-indigo-400 placeholder:text-[10px]" /><button type="button" onClick={() => openCalculator('recurring')} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 text-slate-400 text-2xl active:scale-90">🧮</button></div><AmountHintLabel val={recurringAmountStr} currency={settings.currency} lang={settings.language} /></div>
               <input required type="text" value={recurringForm.description} onChange={e => setRecurringForm({...recurringForm, description: e.target.value})} placeholder={t.manual_desc} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-bold outline-none" />
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.recurring_freq}</label><select value={recurringForm.subscriptionType} onChange={e => setRecurringForm({...recurringForm, subscriptionType: e.target.value as SubscriptionType})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 h-12 text-[10px] font-normal outline-none"><option value="1d">{t.freq_daily}</option><option value="1w">{t.freq_weekly}</option><option value="1m">{t.freq_monthly}</option><option value="1y">{t.freq_yearly}</option></select></div>
                 <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.manual_jar_img}</label><select value={recurringForm.jarType} onChange={e => setRecurringForm({...recurringForm, jarType: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 h-12 text-[10px] font-normal outline-none"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}</select></div>
               </div>
               <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.recurring_start_date}</label><input type="date" value={recurringForm.startDate} onChange={e => setRecurringForm({...recurringForm, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-normal outline-none text-center min-w-0 max-w-full appearance-none" /></div>
               <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsRecurringModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button><button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95">＋</button></div>
            </form>
          </div>
        </div>
      )}

      {isHistoryFilterModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryFilterModalOpen(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl border-2 border-slate-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-[11px] font-black text-slate-800 uppercase mb-6 tracking-widest text-center">📜 {t.history_filter}</h2>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.history_type}</label><select value={historyFilter} onChange={e => setHistoryFilter(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-12 text-[10px] font-normal outline-none"><option value="all">{t.history_all}</option><option value="income">{t.event_sum_inc}</option><option value="expense">{t.event_sum_exp}</option></select></div>
              <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.history_jar}</label><select value={historyJarFilter} onChange={e => setHistoryJarFilter(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 h-12 text-[10px] font-normal outline-none"><option value="all">{t.history_all}</option>{Object.values(JarType).map(type => <option key={type} value={type}>{JAR_CONFIG[type].icon} {t[`jar_${type.toLowerCase()}_name`]}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-1 min-w-0"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.history_from}</label><input type="date" value={historyFromDateFilter} onChange={e => setHistoryFromDateFilter(e.target.value)} className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 text-[10px] font-normal min-w-0 appearance-none" /></div><div className="space-y-1 min-w-0"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.history_to}</label><input type="date" value={historyToDateFilter} onChange={e => setHistoryToDateFilter(e.target.value)} className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 text-[10px] font-normal min-w-0 appearance-none" /></div></div>
              <div className="grid grid-cols-3 gap-2 pt-4"><button onClick={() => setIsHistoryFilterModalOpen(false)} className="py-3 bg-slate-100 text-slate-400 font-black uppercase text-[8px] rounded-xl">{t.calculator_close}</button><button onClick={() => { setHistoryFilter('all'); setHistoryJarFilter('all'); setHistoryFromDateFilter(''); setHistoryToDateFilter(''); }} className="py-3 bg-indigo-50 text-indigo-400 font-black uppercase text-[8px] rounded-xl">Reset</button><button onClick={() => setIsHistoryFilterModalOpen(false)} className="py-3 bg-indigo-600 text-white font-black uppercase text-[8px] rounded-xl shadow-lg">OK</button></div>
            </div>
          </div>
        </div>
      )}

      {isEventModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-xs p-8 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest text-center">🎊 {t.event_add}</h2>
            <form onSubmit={handleSaveEvent} className="space-y-6"><input required type="text" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 text-[11px] font-bold outline-none h-14" /><div className="flex gap-3"><button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button><button type="submit" className="flex-[2] py-4 bg-rose-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all">OK</button></div></form>
          </div>
        </div>
      )}

      {isFutureModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-xs p-8 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase mb-6 tracking-widest text-center">🔮 {t.future_add}</h2>
            <form onSubmit={handleSaveFuture} className="space-y-6"><input required type="text" value={futureName} onChange={e => setFutureName(e.target.value)} placeholder="..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 text-[11px] font-bold outline-none h-14" /><div className="flex gap-3"><button type="button" onClick={() => setIsFutureModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button><button type="submit" className="flex-[2] py-4 bg-sky-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all">OK</button></div></form>
          </div>
        </div>
      )}

      {isEventEntryModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-[340px] p-6 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-300">
             <h2 className="text-[13px] font-black text-slate-800 uppercase mb-4 tracking-widest flex items-center justify-center gap-2"><span>📝</span> {t.event_entry_title}</h2>
             <div className="w-full h-[1px] bg-slate-100 mb-4" />
             <form onSubmit={handleEventEntrySubmit} className="space-y-4">
               <div className="flex bg-slate-50 p-1 rounded-xl border-2 border-slate-200 shadow-sm"><button type="button" onClick={() => setEventManualType('expense')} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${eventManualType === 'expense' ? 'bg-[#e11d48] text-white shadow-md' : 'text-slate-400'}`}>CHI TIÊU</button><button type="button" onClick={() => setEventManualType('income')} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${eventManualType === 'income' ? 'bg-[#059669] text-white shadow-md' : 'text-slate-400'}`}>THU NHẬP</button></div>
               <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label><div className="relative"><input required type="text" inputMode="numeric" value={eventManualAmount} onChange={e => setEventManualAmount(formatDots(e.target.value))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-4 pr-12 h-11 text-lg font-black text-slate-800 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:text-sm" /><button type="button" onClick={() => openCalculator('event')} className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl active:scale-90">🧮</button></div><AmountHintLabel val={eventManualAmount} currency={settings.currency} lang={settings.language} /></div>
               <div className="space-y-1.5"><input required type="text" value={eventManualDesc} onChange={e => setEventManualDesc(e.target.value)} placeholder={t.manual_desc} className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 h-11 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-400 placeholder:text-[10px] placeholder:font-normal" /></div>
               <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setIsEventEntryModalOpen(false); setActiveEventId(null); }} className="flex-1 py-3 bg-[#f1f5f9] text-slate-500 font-black uppercase text-[10px] rounded-xl active:scale-95 border border-slate-200 shadow-sm">{t.manual_cancel}</button><button type="submit" className="flex-[1.8] py-3 bg-[#4f46e5] text-white font-black uppercase text-[14px] rounded-xl shadow-lg active:scale-95">＋</button></div>
             </form>
          </div>
        </div>
      )}

      {isFutureEntryModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-[340px] p-6 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-300">
             <h2 className="text-[13px] font-black text-slate-800 uppercase mb-4 tracking-widest flex items-center justify-center gap-2"><span>📋</span> {t.future_entry_title}</h2>
             <div className="w-full h-[1px] bg-slate-100 mb-4" />
             <form onSubmit={handleFutureEntrySubmit} className="space-y-4">
               <div className="flex bg-slate-50 p-1 rounded-xl border-2 border-slate-200 shadow-sm"><button type="button" onClick={() => setFutureManualType('expense')} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${futureManualType === 'expense' ? 'bg-[#0ea5e9] text-white shadow-md' : 'text-slate-400'}`}>CHI TIÊU</button><button type="button" onClick={() => setFutureManualType('income')} className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${futureManualType === 'income' ? 'bg-[#06b6d4] text-white shadow-md' : 'text-slate-400'}`}>THU NHẬP</button></div>
               <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.manual_amount}</label><div className="relative"><input required type="text" inputMode="numeric" value={futureManualAmount} onChange={e => setFutureManualAmount(formatDots(e.target.value))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl pl-4 pr-12 h-11 text-lg font-black text-slate-800 outline-none focus:border-sky-400 transition-all placeholder:text-slate-300 placeholder:text-sm" /><button type="button" onClick={() => openCalculator('future')} className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl active:scale-90">🧮</button></div><AmountHintLabel val={futureManualAmount} currency={settings.currency} lang={settings.language} /></div>
               <div className="space-y-1.5"><input required type="text" value={futureManualDesc} onChange={e => setFutureManualDesc(e.target.value)} placeholder={t.manual_desc} className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 h-11 text-[11px] font-bold text-slate-800 outline-none focus:border-sky-400 transition-all placeholder:text-slate-400 placeholder:text-[10px] placeholder:font-normal" /></div>
               <div className="space-y-1.5"><input type="text" value={futureManualNote} onChange={e => setFutureManualNote(e.target.value)} placeholder={t.manual_note} className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 h-11 text-[11px] font-bold text-slate-800 outline-none focus:border-sky-400 transition-all placeholder:text-slate-400 placeholder:text-[10px] placeholder:font-normal" /></div>
               <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setIsFutureEntryModalOpen(false); setActiveFutureId(null); }} className="flex-1 py-3 bg-[#f1f5f9] text-slate-500 font-black uppercase text-[10px] rounded-xl active:scale-95 border border-slate-200 shadow-sm">{t.manual_cancel}</button><button type="submit" className="flex-[1.8] py-3 bg-sky-600 text-white font-black uppercase text-[14px] rounded-xl shadow-lg active:scale-95">＋</button></div>
             </form>
          </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl relative animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-[12px] font-black text-slate-800 uppercase mb-5 tracking-widest text-center">＋ {editingLoanId ? t.loan_edit : t.loan_new}</h2>
            <form onSubmit={handleSaveLoan} className="space-y-4">
              <div className="flex p-1 rounded-2xl border-2 border-slate-200 bg-slate-100"><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.BORROW})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${loanForm.type === LoanType.BORROW ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.loan_i_owe}</button><button type="button" onClick={() => setLoanForm({...loanForm, type: LoanType.LEND})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${loanForm.type === LoanType.LEND ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>{t.loan_owes_me}</button></div>
              <input required type="text" value={loanForm.lenderName} onChange={e => setLoanForm({...loanForm, lenderName: e.target.value})} placeholder={t.loan_partner_placeholder} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-bold outline-none placeholder:text-slate-300 placeholder:font-normal" /><select value={loanForm.loanJar} onChange={e => setLoanForm({...loanForm, loanJar: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-normal outline-none"><option value="AUTO">{t.manual_auto}</option>{Object.values(JarType).map(jt => <option key={jt} value={jt}>{t[`jar_${jt.toLowerCase()}_name`]}</option>)}</select>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="min-w-0 flex-1"><input type="date" value={loanForm.startDate} onChange={e => setLoanForm({...loanForm, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[10px] font-normal outline-none text-center min-w-0 appearance-none" /></div>
                <div className="space-y-1 min-w-0 flex-1"><div className="relative"><input required type="text" inputMode="numeric" value={loanPrincipalStr} onChange={e => setLoanPrincipalStr(formatDots(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[11px] font-black outline-none" placeholder="0" /><button type="button" onClick={() => openCalculator('loan')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-400 text-xl active:scale-95">🧮</button></div><AmountHintLabel val={loanPrincipalStr} currency={settings.currency} lang={settings.language} /></div>
              </div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => { setIsLoanModalOpen(false); setEditingLoanId(null); }} className="flex-1 py-3 border-2 border-slate-200 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.loan_back_btn}</button><button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg">＋</button></div>
            </form>
          </div>
        </div>
      )}

      {isLoanPaymentModalOpen && paymentLoanId && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl animate-in zoom-in-95 border-2 border-slate-200">
            {(() => {
                const l = loans.find(x => x.id === paymentLoanId);
                return (
                  <>
                    <h2 className="text-[12px] font-black text-slate-800 uppercase mb-5 tracking-widest text-center">{l?.type === LoanType.BORROW ? t.loan_pay : t.loan_recover}</h2>
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                       <div className="space-y-1"><div className="relative"><input required type="text" inputMode="numeric" value={paymentForm.amountStr} onChange={e => setPaymentForm({...paymentForm, amountStr: formatDots(e.target.value)})} placeholder="0" className="w-full pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[12px] font-black outline-none" /><button type="button" onClick={() => openCalculator('payment')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-400 text-xl active:scale-95">🧮</button></div><AmountHintLabel val={paymentForm.amountStr} currency={settings.currency} lang={settings.language} /><button type="button" onClick={() => { const rem = l!.principal - l!.paidAmount; setPaymentForm({...paymentForm, amountStr: formatDots((rem * EXCHANGE_RATES[settings.currency]).toString())}); }} className="text-[8px] font-black text-indigo-600 uppercase mt-1">{t.loan_rem} ({formatCurrency(l!.principal - l!.paidAmount)})</button></div>
                       <div className="grid grid-cols-2 gap-3 items-end"><div className="space-y-1 min-w-0"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.manual_date_label}</label><input required type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[10px] font-normal outline-none text-center min-w-0 appearance-none" /></div><div className="space-y-1 min-w-0"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.loan_jar_label}</label><div className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 h-12 text-[9px] font-normal flex items-center text-slate-500 overflow-hidden truncate">{l?.loanJar ? t[`jar_${l.loanJar.toLowerCase()}_name`] : t.manual_auto}</div></div></div>
                       <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsLoanPaymentModalOpen(false)} className="flex-1 py-3 border-2 border-slate-200 text-slate-400 font-black uppercase text-[10px] rounded-2xl">{t.manual_cancel}</button><button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg">＋</button></div>
                    </form>
                  </>
                );
            })()}
          </div>
        </div>
      )}

      {isHistoryDetailModalOpen && selectedTx && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-8 shadow-2xl animate-in zoom-in-95 border-2 border-slate-200">
             <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest text-center mb-6">{t.history_detail_title}</h2>
             <div className="space-y-4 text-[11px] font-bold text-slate-600">
                <div className="flex justify-between border-b pb-2"><span>{t.manual_desc}:</span><span className="text-slate-900">{selectedTx.description}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.manual_amount}:</span><span className={selectedTx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(selectedTx.amount)}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.history_jar}:</span><span className="text-indigo-600">{selectedTx.jarType ? t[`jar_${selectedTx.jarType.toLowerCase()}_name`] : t.manual_auto}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.history_date}:</span><span>{new Date(selectedTx.timestamp).toLocaleString()}</span></div>
                {selectedTx.note && <div className="flex flex-col border-b pb-2"><span>{t.manual_note}:</span><span className="text-slate-400 font-normal italic mt-1">{selectedTx.note}</span></div>}
             </div>
             <button onClick={() => setIsHistoryDetailModalOpen(false)} className="w-full mt-8 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl">{t.calculator_close}</button>
          </div>
        </div>
      )}

      {isLoanDetailModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-8 shadow-2xl animate-in zoom-in-95 border-2 border-slate-200">
             <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest text-center mb-6">{t.loan_detail_title}</h2>
             <div className="space-y-4 text-[11px] font-bold text-slate-600">
                <div className="flex justify-between border-b pb-2"><span>{t.history_type}:</span><span>{selectedLoan.type === LoanType.BORROW ? t.loan_i_owe : t.loan_owes_me}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_partner}:</span><span className="text-slate-900 uppercase">{selectedLoan.lenderName}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_principal}:</span><span className="text-slate-900">{formatCurrency(selectedLoan.principal)}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_paid_label}:</span><span className="text-emerald-600">{formatCurrency(selectedLoan.paidAmount)}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_rem}:</span><span className="text-rose-600">{formatCurrency(selectedLoan.principal - selectedLoan.paidAmount)}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_jar_label}:</span><span className="text-indigo-600 uppercase">{selectedLoan.loanJar ? t[`jar_${selectedLoan.loanJar.toLowerCase()}_name`] : t.manual_auto}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t.loan_date_label}:</span><span>{selectedLoan.startDate}</span></div>
             </div>
             <button onClick={() => setIsLoanDetailModalOpen(false)} className="w-full mt-8 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl">{t.calculator_close}</button>
          </div>
        </div>
      )}

      {isEventJarSelectorOpen && eventToSave && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl border-2 border-slate-200">
             <h2 className="text-xs font-black text-slate-800 uppercase mb-5 tracking-widest text-center">{t.event_jar_select}</h2>
             <div className="grid grid-cols-2 gap-2"><button onClick={() => handlePushEventToHistory(eventToSave, 'AUTO')} className="col-span-2 py-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase border-2 border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">{t.event_auto_select}</button>{Object.values(JarType).map(jt => <button key={jt} onClick={() => handlePushEventToHistory(eventToSave, jt)} className="py-4 bg-slate-50 text-slate-600 rounded-2xl text-[9px] font-black uppercase border-2 border-slate-100 hover:border-indigo-400 transition-all flex flex-col items-center gap-1"><span className="text-lg">{JAR_CONFIG[jt].icon}</span>{t[`jar_${jt.toLowerCase()}_name`]}</button>)}</div>
             <button onClick={() => setIsEventJarSelectorOpen(false)} className="w-full mt-6 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button>
          </div>
        </div>
      )}

      {isFutureJarSelectorOpen && futureToSave && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-7 shadow-2xl border-2 border-slate-200">
             <h2 className="text-xs font-black text-slate-800 uppercase mb-5 tracking-widest text-center">{t.future_jar_select}</h2>
             <div className="grid grid-cols-2 gap-2"><button onClick={() => handlePushFutureToHistory(futureToSave, 'AUTO')} className="col-span-2 py-4 bg-sky-50 text-sky-600 rounded-2xl text-[10px] font-black uppercase border-2 border-sky-100 hover:bg-sky-600 hover:text-white transition-all">{t.event_auto_select}</button>{Object.values(JarType).map(jt => <button key={jt} onClick={() => handlePushFutureToHistory(futureToSave, jt)} className="py-4 bg-slate-50 text-slate-600 rounded-2xl text-[9px] font-black uppercase border-2 border-slate-100 hover:border-sky-400 transition-all flex flex-col items-center gap-1"><span className="text-lg">{JAR_CONFIG[jt].icon}</span>{t[`jar_${jt.toLowerCase()}_name`]}</button>)}</div>
             <button onClick={() => setIsFutureJarSelectorOpen(false)} className="w-full mt-6 py-4 bg-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.manual_cancel}</button>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-sm:max-w-sm p-8 shadow-2xl animate-in zoom-in-95 border-2 border-slate-200">
            <h2 className="text-sm font-black text-slate-800 text-center mb-6 tracking-widest uppercase">{t.transfer_title}</h2>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.transfer_from}</label><select value={transferFrom} onChange={e => setTransferFrom(e.target.value as JarType)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 h-12 text-[10px] font-normal outline-none">{Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}</select></div><div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.transfer_to}</label><select value={transferTo} onChange={e => setTransferTo(e.target.value as JarType)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 h-12 text-[10px] font-normal outline-none">{Object.values(JarType).map(type => <option key={type} value={type}>{t[`jar_${type.toLowerCase()}_name`]}</option>)}</select></div></div>
              <div className="space-y-1"><label className="text-[8px] font-normal text-slate-400 uppercase tracking-widest ml-1">{t.transfer_amount}</label><div className="relative"><input required type="text" inputMode="numeric" value={transferAmount} onChange={e => setTransferAmount(formatDots(e.target.value))} placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 h-12 text-[11px] font-black outline-none placeholder:text-[9px]" /><button type="button" onClick={() => openCalculator('transfer')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-400 text-xl active:scale-95">🧮</button></div><AmountHintLabel val={transferAmount} currency={settings.currency} lang={settings.language} /><p className="text-[8px] font-bold text-slate-400 ml-1 mt-2">Balance: <span className="text-indigo-600">{formatCurrency(balances[transferFrom])}</span></p></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-3 border-2 border-slate-200 text-slate-400 font-black uppercase text-[10px] rounded-2xl active:scale-95">{t.transfer_cancel}</button><button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg">{t.transfer_confirm}</button></div>
            </form>
          </div>
        </div>
      )}

      {isCalcOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white/95 rounded-[2.5rem] w-full max-w-[320px] p-7 shadow-2xl border-2 border-slate-200">
            <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 mb-6 text-right shadow-inner min-h-[100px] flex flex-col justify-end"><div className="text-slate-400 text-[10px] font-bold overflow-hidden text-ellipsis mb-1">{calcExpr || '0'}</div><div className="text-slate-900 text-2xl font-black">{evaluateMath(calcExpr) || '0'}</div></div>
            <div className="grid grid-cols-4 gap-3">{['(', ')', '%', '/'].map(btn => <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-slate-100 text-slate-700 font-black text-lg active:scale-90 transition-all">{btn}</button>)}{['7', '8', '9', '*'].map(btn => <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-lg active:scale-90 transition-all">{btn}</button>)}{['4', '5', '6', '-'].map(btn => <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-lg active:scale-90 transition-all">{btn}</button>)}{['1', '2', '3', '+'].map(btn => <button key={btn} onClick={() => onCalcPress(btn)} className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-lg active:scale-90 transition-all">{btn}</button>)}<button onClick={() => onCalcPress('C')} className="h-14 rounded-2xl bg-rose-50 text-rose-600 font-black text-lg active:scale-90">C</button><button onClick={() => onCalcPress('0')} className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-lg active:scale-90">0</button><button onClick={() => onCalcPress('.')} className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-lg active:scale-90">.</button><button onClick={() => onCalcPress('=')} className="h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-xl active:scale-95 shadow-indigo-200">=</button></div>
            <button onClick={() => setIsCalcOpen(false)} className="w-full mt-6 py-4 text-slate-400 font-black uppercase text-[10px]">{t.calculator_close}</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
