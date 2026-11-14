import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../utils/prisma';

export type Instrument = 'IDR' | 'POINTS' | 'BMC';
export type LedgerDirection = 'debit' | 'credit';

export interface LedgerEntryInput {
  userId: string;
  direction: LedgerDirection;
  amount: number;
  bucket?: 'available' | 'pending';
}

export interface PostLedgerInput {
  idempotencyKey: string;
  referenceCode?: string;
  txType: string;
  instrument: Instrument;
  description: string;
  metadata?: Record<string, any>;
  entries: LedgerEntryInput[];
}

export const generateReferenceCode = (prefix = 'NGP'): string => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

export async function getOrCreateWalletAccount(
  db: any,
  userId: string,
  instrument: Instrument
) {
  let account = await db.walletAccount.findUnique({
    where: { user_id_instrument: { user_id: userId, instrument } },
  });
  if (!account) {
    account = await db.walletAccount.create({
      data: {
        user_id: userId,
        instrument,
        available_balance: 0,
        pending_balance: 0,
      },
    });
  }
  return account;
}

export async function postLedgerTransaction(db: any = defaultPrisma, input: PostLedgerInput) {
  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    throw new Error('idempotencyKey is required for ledger transactions');
  }
  if (!input.entries || input.entries.length === 0) {
    throw new Error('At least one ledger entry is required');
  }

  const existing = await db.ledgerTransaction.findUnique({
    where: { idempotency_key: input.idempotencyKey },
    include: { entries: true },
  });
  if (existing) {
    return { transaction: existing, idempotent: true };
  }

  const refCode = input.referenceCode || generateReferenceCode('LDG');
  const createdTx = await db.ledgerTransaction.create({
    data: {
      reference_code: refCode,
      idempotency_key: input.idempotencyKey,
      tx_type: input.txType,
      instrument: input.instrument,
      status: 'posted',
      description: input.description,
      metadata: input.metadata ?? undefined,
    },
  });

  const createdEntries = [];
  for (const entry of input.entries) {
    if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
      throw new Error(`Invalid ledger entry amount: ${entry.amount}`);
    }
    const bucket = entry.bucket || 'available';
    const account = await getOrCreateWalletAccount(db, entry.userId, input.instrument);
    const currentBucket = bucket === 'pending' ? account.pending_balance : account.available_balance;
    const delta = entry.direction === 'credit' ? entry.amount : -entry.amount;
    const nextBucket = currentBucket + delta;

    if (nextBucket < 0) {
      throw new Error(`Insufficient ${input.instrument} ${bucket} balance for user ${entry.userId}`);
    }

    const updatedAccount = await db.walletAccount.update({
      where: { id: account.id },
      data: bucket === 'pending'
        ? { pending_balance: nextBucket }
        : { available_balance: nextBucket },
    });

    const balanceAfter =
      bucket === 'pending' ? updatedAccount.pending_balance : updatedAccount.available_balance;

    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        ledger_tx_id: createdTx.id,
        account_id: account.id,
        direction: entry.direction,
        amount: entry.amount,
        balance_after: balanceAfter,
      },
    });
    createdEntries.push(ledgerEntry);
  }

  return {
    transaction: { ...createdTx, entries: createdEntries },
    idempotent: false,
  };
}

export async function reverseLedgerTransaction(
  db: any = defaultPrisma,
  params: { originalTxId: string; idempotencyKey: string; reason: string; bucket?: 'available' | 'pending' }
) {
  const existingReversal = await db.ledgerTransaction.findUnique({
    where: { idempotency_key: params.idempotencyKey },
    include: { entries: true },
  });
  if (existingReversal) {
    return { transaction: existingReversal, idempotent: true };
  }

  const original = await db.ledgerTransaction.findUnique({
    where: { id: params.originalTxId },
    include: { entries: { include: { account: true } } },
  });
  if (!original) {
    throw new Error('Original ledger transaction not found');
  }
  if (original.status === 'reversed') {
    throw new Error('Ledger transaction already reversed');
  }

  const reversalTx = await db.ledgerTransaction.create({
    data: {
      reference_code: generateReferenceCode('REV'),
      idempotency_key: params.idempotencyKey,
      tx_type: 'refund_reversal',
      instrument: original.instrument,
      status: 'posted',
      reversal_of_id: original.id,
      description: `Reversal of ${original.reference_code}: ${params.reason}`,
      metadata: { original_reference: original.reference_code, reason: params.reason },
    },
  });

  const bucket = params.bucket || 'pending';
  const reversalEntries = [];
  for (const origEntry of original.entries) {
    const oppositeDirection: LedgerDirection = origEntry.direction === 'credit' ? 'debit' : 'credit';
    const account = await db.walletAccount.findUnique({ where: { id: origEntry.account_id } });
    if (!account) throw new Error('Account missing during reversal');

    const currentBucket = bucket === 'pending' ? account.pending_balance : account.available_balance;
    const delta = oppositeDirection === 'credit' ? origEntry.amount : -origEntry.amount;
    const nextBucket = Math.max(0, currentBucket + delta);

    await db.walletAccount.update({
      where: { id: account.id },
      data: bucket === 'pending'
        ? { pending_balance: nextBucket }
        : { available_balance: nextBucket },
    });

    const revEntry = await db.ledgerEntry.create({
      data: {
        ledger_tx_id: reversalTx.id,
        account_id: account.id,
        direction: oppositeDirection,
        amount: origEntry.amount,
        balance_after: nextBucket,
      },
    });
    reversalEntries.push(revEntry);
  }

  await db.ledgerTransaction.update({
    where: { id: original.id },
    data: { status: 'reversed' },
  });

  return {
    transaction: { ...reversalTx, entries: reversalEntries },
    idempotent: false,
  };
}

