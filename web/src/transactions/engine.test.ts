import { describe, expect, it, vi } from 'vitest';
import type { MutationResult } from '../../../shared/api';
import { ATTEMPT_STORAGE_KEY, OperationController, type OperationContext, type SignatureStatusConnection, type StorageLike } from './engine';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const context: OperationContext = { action: 'Approve Concept', wallet: 'origin-wallet', dealAddress: 'deal-a' };
const receipt: MutationResult = { signature: 'public-signature', dealAddress: 'deal-a', deal: null, refreshError: 'Deal read unavailable' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function sdkError(code = 'rpc_error', options: { signature?: string; outcomeUnknown?: boolean } = {}) {
  return Object.assign(new Error('An actionable SDK error.'), { code, ...options });
}

function statusConnection(status: 'processed' | 'confirmed' | 'finalized' | null, err: unknown = null) {
  return {
    getSignatureStatuses: vi.fn(async () => ({ value: status === null ? [null] : [{ err, confirmationStatus: status }] })),
  } satisfies SignatureStatusConnection;
}

async function uncertain(storage = new MemoryStorage(), withSignature = true) {
  const controller = new OperationController(storage);
  await controller.run(context, async () => {
    throw sdkError('rpc_error', { outcomeUnknown: true, ...(withSignature ? { signature: receipt.signature } : {}) });
  });
  return controller;
}

describe('the shared operation controller', () => {
  it('acquires the lock synchronously and never calls a double-click or overlapping operation', async () => {
    const controller = new OperationController(new MemoryStorage());
    const pending = deferred<MutationResult>();
    const first = vi.fn(() => pending.promise);
    const duplicate = vi.fn(async () => receipt);

    const running = controller.run(context, first);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(controller.getSnapshot().attempt?.state).toBe('pending');
    expect(await controller.run({ action: 'Create', wallet: 'different-wallet' }, duplicate)).toBeNull();
    expect(first).toHaveBeenCalledTimes(1);
    expect(duplicate).not.toHaveBeenCalled();
    pending.resolve(receipt);
    expect(await running).toBe(receipt);
    expect(controller.getSnapshot().busy).toBe(false);
  });

  it('provides stable immutable snapshots and notifies subscriptions only on changes', async () => {
    const controller = new OperationController(new MemoryStorage());
    const initial = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(initial);
    expect(Object.isFrozen(initial)).toBe(true);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    await controller.run(context, async () => receipt);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).not.toBe(initial);
    expect(Object.isFrozen(controller.getSnapshot().attempt)).toBe(true);
    unsubscribe();
    controller.clearResolved();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('journals only public attempt metadata and preserves the originating wallet and deal', async () => {
    const storage = new MemoryStorage();
    const controller = new OperationController(storage);
    const origin = { ...context, financialBalance: '999', rawTransaction: 'never-save-this' };
    const pending = deferred<MutationResult>();
    const run = controller.run(origin, () => pending.promise);
    origin.wallet = 'new-wallet';
    origin.dealAddress = 'different-route';
    expect(controller.getSnapshot().attempt).toMatchObject({ wallet: context.wallet, dealAddress: 'deal-a' });
    expect(Object.keys(JSON.parse(storage.getItem(ATTEMPT_STORAGE_KEY)!)).sort()).toEqual(['action', 'dealAddress', 'id', 'startedAt', 'state', 'wallet']);
    pending.resolve(receipt);
    await run;
    expect(controller.getSnapshot().attempt?.wallet).toBe(context.wallet);
    expect(storage.getItem(ATTEMPT_STORAGE_KEY)).not.toContain('never-save-this');
  });

  it('restores an interrupted pending attempt as unknown and blocks another mutation', async () => {
    const storage = new MemoryStorage();
    const running = new OperationController(storage);
    const pending = deferred<MutationResult>();
    const run = running.run(context, () => pending.promise);
    const restored = new OperationController(storage);
    expect(restored.getSnapshot()).toMatchObject({ busy: false, attempt: { state: 'unknown', wallet: context.wallet, dealAddress: 'deal-a' }, error: { outcomeUnknown: true } });
    expect(JSON.parse(storage.getItem(ATTEMPT_STORAGE_KEY)!).state).toBe('unknown');
    const repeat = vi.fn(async () => receipt);
    expect(await restored.run(context, repeat)).toBeNull();
    restored.clearResolved();
    expect(restored.getSnapshot().attempt?.state).toBe('unknown');
    expect(repeat).not.toHaveBeenCalled();
    pending.resolve(receipt);
    await run;
  });

  it('keeps confirmed receipts with failed deal refresh confirmed, including after reload', async () => {
    const storage = new MemoryStorage();
    const controller = new OperationController(storage);
    expect(await controller.run(context, async () => receipt)).toBe(receipt);
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'confirmed', signature: receipt.signature, refreshError: receipt.refreshError }, error: null, busy: false });
    const restored = new OperationController(storage);
    expect(restored.getSnapshot().attempt?.state).toBe('confirmed');
    restored.clearResolved();
    expect(restored.getSnapshot().attempt).toBeNull();
    expect(storage.getItem(ATTEMPT_STORAGE_KEY)).toBeNull();
  });

  it('allows a separate explicit action after a known resolved attempt', async () => {
    const controller = new OperationController(new MemoryStorage());
    await controller.run(context, async () => receipt);
    const firstId = controller.getSnapshot().attempt?.id;
    const second = vi.fn(async () => ({ ...receipt, signature: 'second-signature' }));
    await controller.run({ ...context, action: 'Open dispute' }, second);
    expect(second).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().attempt?.id).not.toBe(firstId);
    expect(controller.getSnapshot().attempt?.action).toBe('Open dispute');
  });

  it.each(['transaction_failed', 'rpc_error', 'user_rejected'])('a %s error with a signature is failed unless outcomeUnknown is true', async (code) => {
    const controller = new OperationController(new MemoryStorage());
    const mutation = vi.fn(async () => { throw sdkError(code, { signature: receipt.signature }); });
    expect(await controller.run(context, mutation)).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'failed', signature: receipt.signature }, error: { code, outcomeUnknown: false } });
    expect(mutation).toHaveBeenCalledTimes(1);
    controller.clearResolved();
    expect(controller.getSnapshot().attempt).toBeNull();
  });

  it('preserves an unknown outcome and signature across reload and never retries automatically', async () => {
    const storage = new MemoryStorage();
    const controller = await uncertain(storage);
    const before = controller.getSnapshot();
    const repeated = vi.fn(async () => receipt);
    expect(await controller.run(context, repeated)).toBeNull();
    expect(controller.getSnapshot()).toBe(before);
    expect(repeated).not.toHaveBeenCalled();
    const restored = new OperationController(storage);
    expect(restored.getSnapshot().attempt).toMatchObject({ state: 'unknown', signature: receipt.signature, wallet: context.wallet });
  });

  it.each([null, 'processed'] as const)('keeps an RPC %s status unknown and blocked', async (status) => {
    const controller = await uncertain();
    const connection = statusConnection(status);
    await controller.check(connection);
    expect(connection.getSignatureStatuses).toHaveBeenCalledWith([receipt.signature], { searchTransactionHistory: true });
    expect(controller.getSnapshot()).toMatchObject({ busy: false, attempt: { state: 'unknown' }, error: { outcomeUnknown: true } });
    const mutation = vi.fn(async () => receipt);
    await controller.run(context, mutation);
    expect(mutation).not.toHaveBeenCalled();
    controller.clearResolved();
    expect(controller.getSnapshot().attempt?.state).toBe('unknown');
  });

  it.each(['confirmed', 'finalized'] as const)('accepts a real RPC %s status without inventing a deal', async (status) => {
    const controller = await uncertain();
    await controller.check(statusConnection(status));
    expect(controller.getSnapshot()).toMatchObject({ busy: false, attempt: { state: 'confirmed', signature: receipt.signature, dealAddress: 'deal-a' }, error: null });
    expect(controller.getSnapshot().attempt).not.toHaveProperty('deal');
    controller.clearResolved();
    expect(controller.getSnapshot().attempt).toBeNull();
  });

  it('keeps an uncertain create address absent after RPC confirmation', async () => {
    const controller = new OperationController(new MemoryStorage());
    await controller.run({ action: 'Create deal', wallet: 'customer-wallet' }, async () => { throw sdkError('rpc_error', { signature: receipt.signature, outcomeUnknown: true }); });
    await controller.check(statusConnection('confirmed'));
    expect(controller.getSnapshot().attempt).toMatchObject({ state: 'confirmed', wallet: 'customer-wallet' });
    expect(controller.getSnapshot().attempt?.dealAddress).toBeUndefined();
  });

  it('treats a returned on-chain err as failed even if its status is confirmed', async () => {
    const controller = await uncertain();
    await controller.check(statusConnection('confirmed', { InstructionError: [0, 'Custom'] }));
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'failed', signature: receipt.signature }, error: { code: 'transaction_failed', outcomeUnknown: false }, busy: false });
  });

  it('keeps a thrown RPC check unknown and leaves the original context intact', async () => {
    const controller = await uncertain();
    const connection: SignatureStatusConnection = { getSignatureStatuses: vi.fn(async () => { throw new Error('RPC unavailable'); }) };
    await controller.check(connection);
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'unknown', signature: receipt.signature, wallet: context.wallet, dealAddress: 'deal-a' }, error: { code: 'rpc_error', outcomeUnknown: true }, busy: false });
  });

  it('serializes status checks and blocks mutations while a status check runs', async () => {
    const controller = await uncertain();
    const response = deferred<{ value: [{ err: null; confirmationStatus: 'confirmed' }] }>();
    const connection = { getSignatureStatuses: vi.fn(() => response.promise) };
    const check = controller.check(connection);
    expect(controller.getSnapshot().busy).toBe(true);
    await controller.check(connection);
    const mutation = vi.fn(async () => receipt);
    await controller.run(context, mutation);
    expect(connection.getSignatureStatuses).toHaveBeenCalledTimes(1);
    expect(mutation).not.toHaveBeenCalled();
    response.resolve({ value: [{ err: null, confirmationStatus: 'confirmed' }] });
    await check;
    expect(controller.getSnapshot().attempt?.state).toBe('confirmed');
  });

  it('keeps an interrupted attempt with no signature unresolved and explains manual recovery', async () => {
    const controller = await uncertain(new MemoryStorage(), false);
    const connection = statusConnection('confirmed');
    await controller.check(connection);
    expect(connection.getSignatureStatuses).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'unknown' }, error: { outcomeUnknown: true } });
    expect(controller.getSnapshot().error?.message).toContain('originating wallet');
    controller.clearResolved();
    expect(controller.getSnapshot().attempt?.state).toBe('unknown');
  });

  it('records unexpected exceptions as unknown and rethrows instead of masking programming errors', async () => {
    const controller = new OperationController(new MemoryStorage());
    const unexpected = new TypeError('An unexpected integration bug');
    await expect(controller.run(context, async () => { throw unexpected; })).rejects.toBe(unexpected);
    expect(controller.getSnapshot()).toMatchObject({ busy: false, attempt: { state: 'unknown' }, error: { outcomeUnknown: true } });
    expect(controller.getSnapshot().error?.code).toBeUndefined();
  });

  it('rejects a receipt for another deal while preserving its signature for investigation', async () => {
    const controller = new OperationController(new MemoryStorage());
    await expect(controller.run(context, async () => ({ ...receipt, dealAddress: 'deal-b' }))).rejects.toThrow('different operation');
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'unknown', dealAddress: 'deal-a', signature: receipt.signature }, error: { outcomeUnknown: true } });
  });

  it('blocks mutations when the journal is corrupt rather than silently discarding an unresolved attempt', async () => {
    const storage = new MemoryStorage();
    storage.setItem(ATTEMPT_STORAGE_KEY, '{incomplete-json');
    const controller = new OperationController(storage);
    const mutation = vi.fn(async () => receipt);
    await controller.run(context, mutation);
    expect(mutation).not.toHaveBeenCalled();
    expect(controller.getSnapshot().attempt?.state).toBe('unknown');
  });

  it('refuses to invoke the SDK when the pending journal cannot be saved', async () => {
    const storage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('Storage disabled'); }, removeItem: () => {} };
    const controller = new OperationController(storage);
    const mutation = vi.fn(async () => receipt);
    await controller.run(context, mutation);
    expect(mutation).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'failed' }, error: { outcomeUnknown: false } });
    expect(controller.getSnapshot().error?.message).toContain('Nothing was submitted');
  });

  it('locks before a re-entrant storage adapter can attempt another operation', async () => {
    const storage = new MemoryStorage();
    const controller = new OperationController(storage);
    const repeat = vi.fn(async () => receipt);
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      void controller.run(context, repeat);
      original(key, value);
    };
    await controller.run(context, async () => receipt);
    expect(repeat).not.toHaveBeenCalled();
  });

  it('preserves a saved unknown signature if storage cannot persist the recovery transition', () => {
    const saved = JSON.stringify({ id: 'original-attempt', action: context.action, wallet: context.wallet, dealAddress: context.dealAddress, signature: receipt.signature, startedAt: 123, state: 'pending' });
    const storage: StorageLike = { getItem: () => saved, setItem: () => { throw new Error('Storage became read-only'); }, removeItem: () => {} };
    const controller = new OperationController(storage);
    expect(controller.getSnapshot().attempt).toMatchObject({ id: 'original-attempt', signature: receipt.signature, state: 'unknown' });
  });

  it('retains an actual confirmation if the browser fails to save the final receipt', async () => {
    const storage = new MemoryStorage();
    const controller = new OperationController(storage);
    const original = storage.setItem.bind(storage);
    let writes = 0;
    storage.setItem = (key, value) => {
      writes += 1;
      if (writes > 1) throw new Error('Storage became full');
      original(key, value);
    };
    await controller.run(context, async () => receipt);
    expect(controller.getSnapshot()).toMatchObject({ attempt: { state: 'confirmed', signature: receipt.signature }, error: { outcomeUnknown: false } });
    expect(controller.getSnapshot().error?.message).toContain('confirmed');
    // Reload remains conservative because the final receipt was not persisted.
    const restored = new OperationController(storage);
    expect(restored.getSnapshot().attempt?.state).toBe('unknown');
  });
});
