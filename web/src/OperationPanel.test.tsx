import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationResult } from '../../shared/api';
import OperationPanel from './OperationPanel';
import { OperationController, type StorageLike } from './transactions/engine';

const mocks = vi.hoisted(() => ({
  controller: null as OperationController | null,
  connection: { getSignatureStatuses: vi.fn() },
}));

vi.mock('@solana/wallet-adapter-react', () => ({ useConnection: () => ({ connection: mocks.connection }) }));
vi.mock('./config', () => ({
  explorer: (kind: string, value: string) => `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}?cluster=devnet`,
}));
vi.mock('./transactions/useOperation', async (importOriginal) => {
  const original = await importOriginal<typeof import('./transactions/useOperation')>();
  return { ...original, useOperation: () => original.useOperation(mocks.controller ?? undefined) };
});

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const origin = { action: 'Open dispute', wallet: 'originating-wallet', dealAddress: 'originating-deal' };
const receipt: MutationResult = { signature: 'known-public-signature', dealAddress: origin.dealAddress, deal: null, refreshError: 'RPC read failed' };

function sdkError(outcomeUnknown: boolean, withSignature = true) {
  return Object.assign(new Error(outcomeUnknown ? 'Confirmation is uncertain.' : 'The transaction failed on-chain.'), {
    code: outcomeUnknown ? 'rpc_error' : 'transaction_failed',
    ...(withSignature ? { signature: receipt.signature } : {}),
    ...(outcomeUnknown ? { outcomeUnknown: true } : {}),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function Harness({ connectedWallet = 'current-wallet' }: { connectedWallet?: string }) {
  const location = useLocation();
  return <>
    <output data-testid="route">{location.pathname}</output>
    <output data-testid="connected-wallet">{connectedWallet}</output>
    <Link to="/deal/another-deal">Go elsewhere</Link>
    <OperationPanel />
  </>;
}

function view(connectedWallet = 'current-wallet') {
  return render(<MemoryRouter initialEntries={['/create']}><Harness connectedWallet={connectedWallet} /></MemoryRouter>);
}

async function unknown(withSignature = true) {
  const mutation = vi.fn(async () => { throw sdkError(true, withSignature); });
  await mocks.controller!.run(origin, mutation);
  return mutation;
}

beforeEach(() => {
  mocks.controller = new OperationController(new MemoryStorage());
  mocks.connection.getSignatureStatuses.mockReset();
});
afterEach(cleanup);

describe('public transaction receipts and recovery', () => {
  it('shows a known on-chain failure with its signature without treating it as unknown', async () => {
    await mocks.controller!.run(origin, async () => { throw sdkError(false); });
    view();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText(receipt.signature)).toBeTruthy();
    expect(screen.getByText('The transaction failed on-chain.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check transaction status' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss receipt' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /View transaction on Devnet/ }).getAttribute('href')).toContain(receipt.signature);
  });

  it('shows an uncertain signature with a status check and no dismissal', async () => {
    await unknown();
    view();
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check transaction status' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dismiss receipt' })).toBeNull();
    expect(screen.getByText(receipt.signature)).toBeTruthy();
  });

  it.each([
    { label: 'absent', status: null, state: 'unknown' },
    { label: 'processed', status: { err: null, confirmationStatus: 'processed' }, state: 'unknown' },
    { label: 'confirmed', status: { err: null, confirmationStatus: 'confirmed' }, state: 'confirmed' },
    { label: 'failed', status: { err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'confirmed' }, state: 'failed' },
  ])('an RPC $label result updates the receipt without navigating or repeating the mutation', async ({ status, state }) => {
    const mutation = await unknown();
    mocks.connection.getSignatureStatuses.mockResolvedValue({ value: [status] });
    view();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check transaction status' })); });
    expect(mocks.connection.getSignatureStatuses).toHaveBeenCalledWith([receipt.signature], { searchTransactionHistory: true });
    expect(mocks.controller!.getSnapshot().attempt?.state).toBe(state);
    expect(screen.getByTestId('route').textContent).toBe('/create');
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('does not override navigation that occurs while an RPC status check is pending', async () => {
    await unknown();
    const pending = deferred<{ value: [{ err: null; confirmationStatus: 'confirmed' }] }>();
    mocks.connection.getSignatureStatuses.mockReturnValue(pending.promise);
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Check transaction status' }));
    expect(screen.getByText('Checking the transaction status on Devnet…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Check transaction status' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Follow the request in your wallet/)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Go elsewhere' }));
    expect(screen.getByTestId('route').textContent).toBe('/deal/another-deal');
    await act(async () => { pending.resolve({ value: [{ err: null, confirmationStatus: 'confirmed' }] }); await pending.promise; });
    expect(screen.getByTestId('route').textContent).toBe('/deal/another-deal');
    expect(mocks.controller!.getSnapshot().attempt?.state).toBe('confirmed');
  });

  it('labels a confirmed refresh error as a transaction and offers no repeat operation', async () => {
    const mutation = vi.fn(async () => receipt);
    await mocks.controller!.run(origin, mutation);
    view();
    expect(screen.getByText('confirmed')).toBeTruthy();
    expect(screen.getByText('The transaction is confirmed; account refresh failed. Refresh the deal instead of repeating the operation.')).toBeTruthy();
    expect(screen.queryByText(/Payment is confirmed/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check transaction status' })).toBeNull();
    expect(screen.queryByRole('button', { name: /retry|repeat|pay/i })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Open deal' }));
    expect(screen.getByTestId('route').textContent).toBe(`/deal/${receipt.dealAddress}`);
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('keeps the originating wallet visible after the connected account changes', async () => {
    await unknown();
    const rendered = view('wallet-at-first-render');
    expect(screen.getByText(origin.wallet)).toBeTruthy();
    rendered.rerender(<MemoryRouter initialEntries={['/create']}><Harness connectedWallet="newly-connected-wallet" /></MemoryRouter>);
    expect(screen.getByTestId('connected-wallet').textContent).toBe('newly-connected-wallet');
    expect(screen.getByText(origin.wallet)).toBeTruthy();
    expect(mocks.controller!.getSnapshot().attempt?.wallet).toBe(origin.wallet);
    expect(screen.getByRole('link', { name: 'Open deal' }).getAttribute('href')).toBe(`/deal/${origin.dealAddress}`);
  });

  it('explains a missing signature and exposes wallet activity without allowing dismissal', async () => {
    await unknown(false);
    view();
    expect(screen.getByText(/No signature was returned before the operation was interrupted/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Check wallet activity/ }).getAttribute('href')).toContain(`/address/${origin.wallet}`);
    expect(screen.queryByRole('button', { name: 'Check transaction status' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss receipt' })).toBeNull();
  });

  it('waits for the real SDK result before displaying a signature or confirmation', async () => {
    const pending = deferred<MutationResult>();
    const run = mocks.controller!.run(origin, () => pending.promise);
    view();
    expect(screen.getByText('pending')).toBeTruthy();
    expect(screen.getByText(/Follow the request in your wallet/)).toBeTruthy();
    expect(screen.queryByText(receipt.signature)).toBeNull();
    expect(screen.queryByRole('link', { name: /View transaction on Devnet/ })).toBeNull();
    await act(async () => { pending.resolve(receipt); await run; });
    expect(screen.getByText(receipt.signature)).toBeTruthy();
    expect(screen.getByText('confirmed')).toBeTruthy();
  });
});
