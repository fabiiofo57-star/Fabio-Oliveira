
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
}

export interface UserProfile {
  name: string;
  email: string;
  profilePic: string;
  monthlyIncome: number;
  currency: string;
}

export interface ThemeConfig {
  primaryColor: string;
  isDarkMode: boolean;
}

export interface AppState {
  transactions: Transaction[];
  goals: FinancialGoal[];
  profile: UserProfile;
  theme: ThemeConfig;
}
