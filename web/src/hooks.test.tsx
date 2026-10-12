import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deal } from '../../shared/api';
import { useDeal } from './hooks';

const mocks = vi.hoisted(() => ({
  connection: { rpcEndpoint: 'https://api.devnet.solana.com' },
  wallet: null as object | null,
  createClient: vi.fn(),
  getDeal: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection: mocks.connection }),
  useAnchorWallet: () => mocks.wallet,
}));
vi.mock('@aic-bazaar/sdk', () => ({ createBazaarClient: mocks.createClient }));
vi.mock('./config', () => ({ deployment: { programId: 'public-test-program' } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function deal(address: string, title = address): Deal {
  return {
    address, title, client: 'customer', creator: 'creator', arbiter: 'arbiter',
    brief: 'Controlled read-only fixture.', referencesUrl: '', templateVersion: 1,
    budgetLamports: '1000000', bondLamports: '100000', remainingBudgetLamports: '1000000',
    lockedBondLamports: '0', rentReserveLamports: '1', status: 'awaiting_creator', currentMilestone: 0,
    milestones: [
      { index: 0, amountLamports: '200000', dueAt: 100, submission: null, paidAt: null },
      { index: 1, amountLamports: '300000', dueAt: 200, submission: null, paidAt: null },
      { index: 2, amountLamports: '500000', dueAt: 300, submission: null, paidAt: null },
    ],
    dispute: null, resolution: null, createdAt: 1,
  };
}

beforeEach(() => {
  mocks.wallet = null;
  mocks.getDeal.mockReset();
  mocks.createClient.mockReset();
  mocks.createClient.mockImplementation(() => ({ getDeal: mocks.getDeal }));
});
afterEach(cleanup);

describe('deal reads remain bound to their current route and wallet', () => {
  it('does not replace route B when the deferred route A response arrives last', async () => {
    const a = deferred<Deal>(), b = deferred<Deal>();
    mocks.getDeal.mockImplementation((address: string) => address === 'deal-a' ? a.promise : b.promise);
    const { result, rerender } = renderHook(({ address }) => useDeal(address), { initialProps: { address: 'deal-a' } });
    rerender({ address: 'deal-b' });
    expect(result.current.data).toBeNull();
    await act(async () => { b.resolve(deal('deal-b')); await b.promise; });
    expect(result.current.data?.address).toBe('deal-b');
    await act(async () => { a.resolve(deal('deal-a')); await a.promise; });
    expect(result.current.data?.address).toBe('deal-b');
    expect(result.current.fresh).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('ignores route A errors after route B has loaded successfully', async () => {
    const a = deferred<Deal>(), b = deferred<Deal>();
    mocks.getDeal.mockImplementation((address: string) => address === 'deal-a' ? a.promise : b.promise);
    const { result, rerender } = renderHook(({ address }) => useDeal(address), { initialProps: { address: 'deal-a' } });
    rerender({ address: 'deal-b' });
    await act(async () => { b.resolve(deal('deal-b')); await b.promise; });
    await act(async () => { a.reject(new Error('Old route failed')); await a.promise.catch(() => {}); });
    expect(result.current.data?.address).toBe('deal-b');
    expect(result.current.error).toBeNull();
    expect(result.current.fresh).toBe(true);
  });

  it('does not let an old refresh callback launch a new route A read or invalidate route B', async () => {
    const a = deferred<Deal>(), b = deferred<Deal>();
    mocks.getDeal.mockImplementation((address: string) => address === 'deal-a' ? a.promise : b.promise);
    const { result, rerender } = renderHook(({ address }) => useDeal(address), { initialProps: { address: 'deal-a' } });
    const oldRefresh = result.current.refresh;
    rerender({ address: 'deal-b' });
    // A pending mutation can retain this callback and invoke it after navigating to B.
    act(() => { void oldRefresh(); });
    expect(mocks.getDeal).toHaveBeenCalledTimes(2);
    await act(async () => { b.resolve(deal('deal-b')); await b.promise; });
    await act(async () => { a.resolve(deal('deal-a')); await a.promise; });
    expect(result.current.data?.address).toBe('deal-b');
    expect(result.current.fresh).toBe(true);
  });

  it('invalidates the old wallet client and rejects its retained refresh callback', async () => {
    const a = deferred<Deal>(), b = deferred<Deal>();
    mocks.wallet = { publicKey: 'wallet-a' };
    mocks.getDeal.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useDeal('same-deal'));
    const oldRefresh = result.current.refresh;
    mocks.wallet = { publicKey: 'wallet-b' };
    rerender();
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    act(() => { void oldRefresh(); });
    expect(mocks.getDeal).toHaveBeenCalledTimes(2);
    await act(async () => { b.resolve(deal('same-deal', 'Read using current wallet')); await b.promise; });
    await act(async () => { a.resolve(deal('same-deal', 'Read using previous wallet')); await a.promise; });
    expect(result.current.data?.title).toBe('Read using current wallet');
    expect(result.current.fresh).toBe(true);
  });

  it('does not start a read from a retained refresh callback after the hook unmounts', async () => {
    const pending = deferred<Deal>();
    mocks.getDeal.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useDeal('deal-a'));
    const oldRefresh = result.current.refresh;
    unmount();
    act(() => { void oldRefresh(); });
    expect(mocks.getDeal).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(deal('deal-a')); await pending.promise; });
  });

  it('keeps the newest of overlapping reads and pauses actions during refresh', async () => {
    const initial = deferred<Deal>(), older = deferred<Deal>(), newer = deferred<Deal>();
    mocks.getDeal.mockReturnValueOnce(initial.promise).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useDeal('deal-a'));
    await act(async () => { initial.resolve(deal('deal-a', 'Initial')); await initial.promise; });
    act(() => { void result.current.refresh(); void result.current.refresh(); });
    expect(result.current.fresh).toBe(false);
    expect(result.current.loading).toBe(true);
    await act(async () => { newer.resolve(deal('deal-a', 'Latest account read')); await newer.promise; });
    await act(async () => { older.resolve(deal('deal-a', 'Earlier account read')); await older.promise; });
    expect(result.current.data?.title).toBe('Latest account read');
    expect(result.current.fresh).toBe(true);
  });

  it('retains last-known data as stale after a failed current refresh', async () => {
    mocks.getDeal.mockResolvedValueOnce(deal('deal-a')).mockRejectedValueOnce(new Error('Current RPC unavailable'));
    const { result } = renderHook(() => useDeal('deal-a'));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.data?.address).toBe('deal-a');
    expect(result.current.error).toBe('Current RPC unavailable');
    expect(result.current.fresh).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('keeps the refresh callback stable through read completion and ordinary rerenders', async () => {
    const pending = deferred<Deal>();
    mocks.getDeal.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => useDeal('deal-a'));
    const refresh = result.current.refresh;
    await act(async () => { pending.resolve(deal('deal-a')); await pending.promise; });
    rerender();
    expect(result.current.refresh).toBe(refresh);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getDeal).toHaveBeenCalledTimes(1);
  });
});
