import type { Account, BillingRepository, Transaction } from "./billing";

export function createMemoryBillingRepository(): BillingRepository {
  const accounts = new Map<number, Account>();
  const emails = new Map<string, number>();
  const keys = new Map<string, number>();
  const balances = new Map<number, number>();
  const transactions: Transaction[] = [];
  let nextAccount = 1;
  let nextTransaction = 1;

  return {
    async createAccount(email: string): Promise<number> {
      const existing = emails.get(email);
      if (existing !== undefined) {
        return existing;
      }
      const id = nextAccount++;
      accounts.set(id, { id, email });
      emails.set(email, id);
      return id;
    },
    async findAccountByEmail(email: string): Promise<number | null> {
      return emails.get(email) ?? null;
    },
    async createApiKey(accountId: number): Promise<string> {
      const key = randomKey();
      keys.set(key, accountId);
      return key;
    },
    async findAccountByApiKey(key: string): Promise<number | null> {
      return keys.get(key) ?? null;
    },
    async getBalance(accountId: number): Promise<number> {
      return balances.get(accountId) ?? 0;
    },
    async addCredits(accountId: number, amount: number, ref: string, type: string, applyAt: string | null): Promise<void> {
      if (!applyAt) {
        balances.set(accountId, (balances.get(accountId) ?? 0) + amount);
      }
      transactions.push({
        id: nextTransaction++,
        accountId,
        type,
        amount,
        ref,
        status: applyAt ? "pending" : "applied",
        applyAt,
        createdAt: new Date().toISOString(),
      });
    },
    async spendCredit(accountId: number, ref: string): Promise<boolean> {
      const balance = balances.get(accountId) ?? 0;
      if (balance < 1) {
        return false;
      }
      balances.set(accountId, balance - 1);
      transactions.push({
        id: nextTransaction++,
        accountId,
        type: "spend",
        amount: -1,
        ref,
        status: "applied",
        applyAt: null,
        createdAt: new Date().toISOString(),
      });
      return true;
    },
    async settlePending(accountId: number, now: string): Promise<void> {
      const pending = transactions.filter(
        (t) => t.accountId === accountId && t.status === "pending" && t.applyAt !== null && t.applyAt <= now,
      );
      for (const transaction of pending) {
        balances.set(accountId, (balances.get(accountId) ?? 0) + transaction.amount);
        transaction.status = "applied";
      }
    },
    async usage(accountId: number): Promise<Record<string, number>> {
      const result: Record<string, number> = {};
      for (const transaction of transactions) {
        if (transaction.accountId === accountId && transaction.type === "spend") {
          const key = transaction.ref ?? "other";
          result[key] = (result[key] ?? 0) + 1;
        }
      }
      return result;
    },
    async transactions(accountId: number): Promise<Transaction[]> {
      return transactions.filter((t) => t.accountId === accountId).slice().reverse();
    },
  };
}

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
