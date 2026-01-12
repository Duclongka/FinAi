
export enum JarType {
  NEC = 'NEC', // Necessities
  LTS = 'LTS', // Long-term Savings
  EDU = 'EDU', // Education
  PLAY = 'PLAY', // Play
  FFA = 'FFA', // Financial Freedom
  GIVE = 'GIVE', // Give
}

export interface JarInfo {
  type: JarType;
  name: string;
  description: string;
  ratio: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  jarType?: JarType;
  timestamp: number;
  rawText?: string;
  note?: string;
  imageUrl?: string;
  loanId?: string; // Liên kết với khoản vay/nợ
}

export type JarBalance = Record<JarType, number>;

export interface AIAnalysisResult {
  action: 'create' | 'update' | 'delete';
  targetId?: string;
  amount?: number;
  jarType?: JarType;
  description?: string;
  isExpense?: boolean;
}

export enum LoanCategory {
  BANK = 'BANK',
  PERSONAL = 'PERSONAL'
}

export enum LoanType {
  BORROW = 'BORROW', // Vay (Tiền thu vào)
  LEND = 'LEND'     // Cho vay (Tiền chi ra)
}

export interface Loan {
  id: string;
  type: LoanType;
  category: LoanCategory;
  lenderName: string; // Tên đối tác (người vay/người cho vay/ngân hàng)
  principal: number; // Số tiền gốc
  interestRate?: number; 
  startDate: string; 
  termInMonths?: number;
  paidAmount: number; // Đã trả/Đã thu hồi
  isUrgent: boolean; 
  purpose?: string; // Mục đích vay/cho vay
  loanJar?: JarType; // Hũ liên quan để hoàn trả chính xác
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  password?: string;
  provider: 'google' | 'local';
}

export interface AppSettings {
  pin: string;
  pinEnabled: boolean;
  faceIdEnabled: boolean;
  currency: 'VND' | 'JPY' | 'USD';
  language: 'vi' | 'en' | 'ja';
  notificationsEnabled: boolean;
  jarRatios: Record<JarType, number>;
}
