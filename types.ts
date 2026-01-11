
export enum JarType {
  NEC = 'NEC', // Necessities (55%)
  LTS = 'LTS', // Long-term Savings (10%)
  EDU = 'EDU', // Education (10%)
  PLAY = 'PLAY', // Play (10%)
  FFA = 'FFA', // Financial Freedom (10%)
  GIVE = 'GIVE', // Give (5%)
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
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  password?: string;
  provider: 'google' | 'local';
}
