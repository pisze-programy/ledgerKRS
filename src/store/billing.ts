export interface Account {
  id: number;
  email: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  type: string;
  amount: number;
  ref: string | null;
  status: string;
  applyAt: string | null;
  createdAt: string;
}

export interface BillingRepository {
  createAccount(email: string): Promise<number>;
  findAccountByEmail(email: string): Promise<number | null>;
  createApiKey(accountId: number): Promise<string>;
  findAccountByApiKey(key: string): Promise<number | null>;
  getBalance(accountId: number): Promise<number>;
  addCredits(accountId: number, amount: number, ref: string, type: string, applyAt: string | null): Promise<void>;
  spendCredit(accountId: number, ref: string): Promise<boolean>;
  settlePending(accountId: number, now: string): Promise<void>;
  usage(accountId: number): Promise<Record<string, number>>;
  transactions(accountId: number): Promise<Transaction[]>;
}
