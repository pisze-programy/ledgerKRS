import type { BillingRepository, Transaction } from "./billing";

export function createD1BillingRepository(db: D1Database): BillingRepository {
  return {
    async createAccount(email: string): Promise<number> {
      const result = await db
        .prepare(`INSERT OR IGNORE INTO accounts (email, created_at) VALUES (?, ?)`)
        .bind(email, new Date().toISOString())
        .run();
      const row = await db.prepare(`SELECT id FROM accounts WHERE email = ?`).bind(email).first<{ id: number }>();
      return row?.id ?? result.meta.last_row_id;
    },
    async findAccountByEmail(email: string): Promise<number | null> {
      const row = await db.prepare(`SELECT id FROM accounts WHERE email = ?`).bind(email).first<{ id: number }>();
      return row?.id ?? null;
    },
    async createApiKey(accountId: number): Promise<string> {
      const key = randomKey();
      await db
        .prepare(`INSERT INTO api_keys (key, account_id, created_at) VALUES (?, ?, ?)`)
        .bind(key, accountId, new Date().toISOString())
        .run();
      return key;
    },
    async findAccountByApiKey(key: string): Promise<number | null> {
      const row = await db
        .prepare(`SELECT account_id FROM api_keys WHERE key = ?`)
        .bind(key)
        .first<{ account_id: number }>();
      return row?.account_id ?? null;
    },
    async getBalance(accountId: number): Promise<number> {
      const row = await db
        .prepare(`SELECT balance FROM credits WHERE account_id = ?`)
        .bind(accountId)
        .first<{ balance: number }>();
      return row?.balance ?? 0;
    },
    async addCredits(accountId: number, amount: number, ref: string, type: string, applyAt: string | null): Promise<void> {
      const transaction = db
        .prepare(`INSERT INTO credit_transactions (account_id, type, amount, ref, status, apply_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(accountId, type, amount, ref, applyAt ? "pending" : "applied", applyAt, new Date().toISOString());
      if (applyAt) {
        await db.batch([
          db
            .prepare(`INSERT INTO credits (account_id, balance) VALUES (?, 0) ON CONFLICT(account_id) DO NOTHING`)
            .bind(accountId),
          transaction,
        ]);
        return;
      }
      await db.batch([
        db
          .prepare(`INSERT INTO credits (account_id, balance) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET balance = balance + excluded.balance`)
          .bind(accountId, amount),
        transaction,
      ]);
    },
    async spendCredit(accountId: number, ref: string): Promise<boolean> {
      const result = await db
        .prepare(`UPDATE credits SET balance = balance - 1 WHERE account_id = ? AND balance >= 1`)
        .bind(accountId)
        .run();
      if (result.meta.changes !== 1) {
        return false;
      }
      await db
        .prepare(`INSERT INTO credit_transactions (account_id, type, amount, ref, status, apply_at, created_at) VALUES (?, 'spend', -1, ?, 'applied', NULL, ?)`)
        .bind(accountId, ref, new Date().toISOString())
        .run();
      return true;
    },
    async settlePending(accountId: number, now: string): Promise<void> {
      const pending = await db
        .prepare(`SELECT id, amount FROM credit_transactions WHERE account_id = ? AND status = 'pending' AND apply_at IS NOT NULL AND apply_at <= ?`)
        .bind(accountId, now)
        .all<{ id: number; amount: number }>();
      for (const transaction of pending.results) {
        await db.batch([
          db.prepare(`UPDATE credits SET balance = balance + ? WHERE account_id = ?`).bind(transaction.amount, accountId),
          db.prepare(`UPDATE credit_transactions SET status = 'applied' WHERE id = ?`).bind(transaction.id),
        ]);
      }
    },
    async usage(accountId: number): Promise<Record<string, number>> {
      const rows = await db
        .prepare(`SELECT ref, COUNT(*) as n FROM credit_transactions WHERE account_id = ? AND type = 'spend' GROUP BY ref`)
        .bind(accountId)
        .all<{ ref: string | null; n: number }>();
      return Object.fromEntries(rows.results.map((row) => [row.ref ?? "other", row.n]));
    },
    async transactions(accountId: number): Promise<Transaction[]> {
      const rows = await db
        .prepare(`SELECT id, account_id, type, amount, ref, status, apply_at, created_at FROM credit_transactions WHERE account_id = ? ORDER BY id DESC`)
        .bind(accountId)
        .all<TransactionRow>();
      return rows.results.map(mapTransaction);
    },
  };
}

interface TransactionRow {
  id: number;
  account_id: number;
  type: string;
  amount: number;
  ref: string | null;
  status: string;
  apply_at: string | null;
  created_at: string;
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    amount: row.amount,
    ref: row.ref,
    status: row.status,
    applyAt: row.apply_at,
    createdAt: row.created_at,
  };
}

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
