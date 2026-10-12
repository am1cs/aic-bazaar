import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import type { CreateDealInput, Deal, MutationResult } from '../../shared/api';
import Create from './Create';
import OperationPanel from './OperationPanel';
import { deployment } from './config';
import { OperationController } from './transactions/engine';

const mocks = vi.hoisted(() => ({
  walletAddress: null as string | null,
  createDeal: vi.fn<(input: CreateDealInput) => Promise<MutationResult>>(),
  readiness: { ready: true, loading: false, error: '', verify: vi.fn() },
  controller: null as OperationController | null,
  connection: { getSignatureStatuses: vi.fn() },
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: mocks.walletAddress ? new PublicKey(mocks.walletAddress) : null }),
  useConnection: () => ({ connection: mocks.connection }),
}));
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Connect Phantom</button>,
}));
vi.mock('./hooks', () => ({
  useBazaarClient: () => ({ createDeal: mocks.createDeal }),
  useDeploymentReady: () => mocks.readiness,
}));
vi.mock('./transactions/useOperation', () => ({
  // Keep the actual lock, receipts, and unknown-result behavior in component tests.
  useOperation: () => {
    const controller = mocks.controller!;
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    return { snapshot, run: controller.run, check: controller.check, clearResolved: controller.clearResolved };
  },
}));

const DRAFT_KEY = 'aic-bazaar.create-draft.v1';
const clientAddress = Keypair.generate().publicKey.toBase58();
const creatorAddress = Keypair.generate().publicKey.toBase58();
const dealAddress = 'E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d';
const signature = 'public-controlled-create-signature';
const validDraft = {
  title: 'Vertical launch ad', brief: 'Fifteen seconds, vertical, with an agreed CTA.',
  creator: creatorAddress, referencesUrl: 'https://example.com/reference', budgetSol: '0.001000001',
  deadlines: ['2099-01-02T12:00', '2099-01-03T12:00', '2099-01-04T12:00'] as [string, string, string],
};

function expectedTerms(): CreateDealInput {
  return {
    title: validDraft.title, brief: validDraft.brief, creator: creatorAddress,
    arbiter: deployment.arbiterAddress, referencesUrl: validDraft.referencesUrl, budgetLamports: '1000001',
    deadlines: [new Date(2099, 0, 2, 12).getTime() / 1000, new Date(2099, 0, 3, 12).getTime() / 1000, new Date(2099, 0, 4, 12).getTime() / 1000],
  };
}

function confirmedDeal(): Deal {
  const terms = expectedTerms();
  return {
    ...terms, address: dealAddress, client: clientAddress, templateVersion: 1, status: 'awaiting_creator',
    bondLamports: '100000', remainingBudgetLamports: '1000001', lockedBondLamports: '0', rentReserveLamports: '1',
    currentMilestone: 0, createdAt: 1, dispute: null, resolution: null,
    milestones: [
      { index: 0, amountLamports: '200000', dueAt: terms.deadlines[0], submission: null, paidAt: null },
      { index: 1, amountLamports: '300000', dueAt: terms.deadlines[1], submission: null, paidAt: null },
      { index: 2, amountLamports: '500001', dueAt: terms.deadlines[2], submission: null, paidAt: null },
    ],
  };
}

function receipt(): MutationResult {
  return { signature, dealAddress, deal: confirmedDeal() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function DealDestination() {
  const { address } = useParams();
  return <h1>Opened deal {address}</h1>;
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/create']}><OperationPanel /><Routes>
    <Route path="/create" element={<Create />} />
    <Route path="/deal/:address" element={<DealDestination />} />
  </Routes></MemoryRouter>);
}

function input(label: string): HTMLInputElement | HTMLTextAreaElement {
  return screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
}

function fillForm(overrides: Partial<typeof validDraft> = {}) {
  const values = { ...validDraft, ...overrides };
  for (const [label, value] of [
    ['Project title', values.title], ['Brief', values.brief], ['Creator wallet', values.creator],
    ['Reference link · optional', values.referencesUrl], ['Total budget · Test SOL', values.budgetSol],
    ['Concept deadline', values.deadlines[0]], ['Draft deadline', values.deadlines[1]], ['Final deadline', values.deadlines[2]],
  ]) fireEvent.change(input(label), { target: { value } });
}

function review() {
  fireEvent.click(screen.getByRole('button', { name: 'Review & fund' }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.walletAddress = clientAddress;
  mocks.createDeal.mockReset();
  mocks.createDeal.mockImplementation(async (terms) => ({ ...receipt(), deal: { ...confirmedDeal(), ...terms } }));
  mocks.readiness.ready = true;
  mocks.readiness.loading = false;
  mocks.readiness.error = '';
  mocks.readiness.verify.mockReset();
  mocks.connection.getSignatureStatuses.mockReset();
  mocks.controller = new OperationController(sessionStorage);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe('creation validation and funding review', () => {
  it.each([
    '{invalid JSON',
    JSON.stringify({ ...validDraft, title: 5 }),
    JSON.stringify({ ...validDraft, deadlines: ['2099-01-02T12:00'] }),
    JSON.stringify({ ...validDraft, deadlines: [null, null, null] }),
  ])('ignores a corrupt saved draft rather than treating it as deal state: %s', (raw) => {
    localStorage.setItem(DRAFT_KEY, raw);
    renderPage();
    expect(input('Project title').value).toBe('');
    expect(input('Brief').value).toBe('');
    expect(input('Total budget · Test SOL').value).toBe('0.30');
    expect(input('Concept deadline').value).toBe('');
    expect(screen.queryByText('Confirm the complete agreement')).toBeNull();
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it('restores only form fields from a draft and discards added financial state', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...validDraft, status: 'completed', budgetLamports: '999', signature: 'injected' }));
    renderPage();
    expect(input('Project title').value).toBe(validDraft.title);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual(validDraft);
    expect(screen.queryByLabelText('Transaction receipt')).toBeNull();
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: '🙂'.repeat(17) }, /Title must be at most 64 UTF-8 bytes/],
    [{ brief: 'я'.repeat(101) }, /Brief must be at most 200 UTF-8 bytes/],
    [{ brief: ' ' }, /Brief must not be blank/],
    [{ referencesUrl: 'http://example.com' }, /HTTPS URL/],
    [{ referencesUrl: 'https://example.com/' + 'a'.repeat(181) }, /200 UTF-8 bytes/],
    [{ budgetSol: '1e-3' }, /complete decimal SOL amount/],
    [{ creator: clientAddress }, /different wallets/],
    [{ deadlines: ['2099-01-02T12:00', '2099-01-02T12:00', '2099-01-04T12:00'] }, /strictly increasing/],
  ] as const)('blocks review of invalid terms before requesting a signature: %j', (overrides, message) => {
    renderPage();
    fillForm(overrides as Partial<typeof validDraft>);
    review();
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent).join('\n')).toMatch(message);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it('counts exact UTF-8 boundaries and keeps the SDK idle until explicit confirmation', async () => {
    renderPage();
    fillForm({ title: '🙂'.repeat(16), brief: 'я'.repeat(100) });
    expect(screen.getByText('64/64 UTF-8 bytes')).toBeDefined();
    expect(screen.getByText('200/200 UTF-8 bytes')).toBeDefined();
    review();
    expect(screen.getByText('Confirm the complete agreement')).toBeDefined();
    expect(mocks.createDeal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(input('Project title').value).toBe('🙂'.repeat(16));
    expect(mocks.createDeal).not.toHaveBeenCalled();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mocks.createDeal).toHaveBeenCalledTimes(1));
  });

  it.each([
    { overrides: { title: '🙂'.repeat(17) }, label: 'Project title', id: 'title', message: 'Title must be at most 64 UTF-8 bytes.' },
    { overrides: { brief: ' ' }, label: 'Brief', id: 'brief', message: 'Brief must not be blank.' },
    { overrides: { creator: clientAddress }, label: 'Creator wallet', id: 'creator', message: 'Customer, creator, and arbiter must be different wallets.' },
    { overrides: { referencesUrl: 'http://example.com' }, label: 'Reference link · optional', id: 'references', message: 'Use a lowercase HTTPS URL without spaces, control characters, or backslashes.' },
    { overrides: { budgetSol: '1e-3' }, label: 'Total budget · Test SOL', id: 'budget', message: 'Enter a complete decimal SOL amount' },
  ])('links a validation error to $label and focuses the field before any wallet request', ({ overrides, label, id, message }) => {
    renderPage();
    fillForm(overrides);
    review();
    const control = input(label);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(`${id}-error`);
    expect(document.getElementById(`${id}-error`)?.textContent).toContain(message);
    expect(document.activeElement).toBe(control);
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it('links a deadline-order error to all three date fields and focuses the first', () => {
    renderPage();
    fillForm({ deadlines: ['2099-01-02T12:00', '2099-01-02T12:00', '2099-01-04T12:00'] });
    review();
    ['Concept deadline', 'Draft deadline', 'Final deadline'].forEach((label, index) => {
      expect(input(label).getAttribute('aria-invalid')).toBe('true');
      expect(input(label).getAttribute('aria-describedby')?.split(' ')).toContain(`deadline-${index}-error`);
    });
    expect(document.activeElement).toBe(input('Concept deadline'));
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it('passes exact integer lamports and local Unix deadlines to the SDK after confirmation', async () => {
    renderPage();
    fillForm();
    review();
    expect(mocks.createDeal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await screen.findByRole('heading', { name: `Opened deal ${dealAddress}` });
    expect(mocks.createDeal).toHaveBeenCalledExactlyOnceWith(expectedTerms());
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByText('This transaction is confirmed on Solana Devnet.')).toBeDefined();
  });

  it('keeps funding disabled without a connected wallet while allowing draft preparation', () => {
    mocks.walletAddress = null;
    renderPage();
    fillForm();
    expect((screen.getByRole('button', { name: 'Review & fund' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Connect Phantom' })).toBeDefined();
    expect(input('Project title').value).toBe(validDraft.title);
    expect(input('Project title').disabled).toBe(false);
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it.each([true, false])('keeps funding disabled while deployment is unavailable (loading=%s)', (loading) => {
    mocks.readiness.ready = false;
    mocks.readiness.loading = loading;
    mocks.readiness.error = loading ? '' : 'The Devnet RPC is unavailable.';
    renderPage();
    fillForm();
    expect((screen.getByRole('button', { name: 'Review & fund' }) as HTMLButtonElement).disabled).toBe(true);
    if (!loading) {
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
      expect(mocks.readiness.verify).toHaveBeenCalledTimes(1);
    }
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });

  it('invalidates the reviewed terms when the connected wallet changes', () => {
    const page = renderPage();
    fillForm();
    review();
    expect(screen.getByRole('button', { name: 'Confirm in wallet' })).toBeDefined();
    mocks.walletAddress = null;
    page.rerender(<MemoryRouter initialEntries={['/create']}><OperationPanel /><Routes><Route path="/create" element={<Create />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Review & fund' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.createDeal).not.toHaveBeenCalled();
  });
});

describe('creation transaction results', () => {
  it('locks the form and prevents overlapping confirmations while the SDK is pending', async () => {
    const pending = deferred<MutationResult>();
    mocks.createDeal.mockReturnValue(pending.promise);
    renderPage();
    fillForm();
    review();
    const confirm = screen.getByRole('button', { name: 'Confirm in wallet' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect((input('Project title').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Review & fund' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Follow the request in your wallet. Waiting for the transaction result.')).toBeDefined();
    await act(async () => { pending.resolve(receipt()); await pending.promise; });
    await screen.findByRole('heading', { name: `Opened deal ${dealAddress}` });
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });

  it.each(['user_rejected', 'transaction_failed'] as const)('preserves the draft and shows a failed receipt after %s without claiming success', async (code) => {
    const message = code === 'user_rejected' ? 'You cancelled the wallet request.' : 'The transaction failed on Devnet.';
    mocks.createDeal.mockRejectedValue(Object.assign(new Error(message), { code, ...(code === 'transaction_failed' ? { signature } : {}) }));
    renderPage();
    fillForm();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mocks.controller!.getSnapshot().attempt?.state).toBe('failed'));
    expect(screen.getByText(message)).toBeDefined();
    expect(screen.getByText('The operation did not complete successfully.')).toBeDefined();
    expect(screen.queryByText('This transaction is confirmed on Solana Devnet.')).toBeNull();
    expect(input('Project title').value).toBe(validDraft.title);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual(validDraft);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });

  it('keeps a confirmed receipt and navigates to the deal when the SDK refresh fails', async () => {
    mocks.createDeal.mockResolvedValue({ signature, dealAddress, deal: null, refreshError: 'The post-confirmation RPC read failed.' });
    renderPage();
    fillForm();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await screen.findByRole('heading', { name: `Opened deal ${dealAddress}` });
    expect(screen.getByText('This transaction is confirmed on Solana Devnet.')).toBeDefined();
    expect(screen.getByText(/account refresh failed. Refresh the deal instead of repeating the operation/)).toBeDefined();
    expect(screen.getByText(signature)).toBeDefined();
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });

  it('locks funding on an uncertain SDK result and never converts an absent RPC status into failure', async () => {
    mocks.createDeal.mockRejectedValue(Object.assign(new Error('Confirmation is unavailable; check this signature.'), {
      code: 'rpc_error', outcomeUnknown: true, signature,
    }));
    mocks.connection.getSignatureStatuses.mockResolvedValue({ value: [null] });
    renderPage();
    fillForm();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mocks.controller!.getSnapshot().attempt?.state).toBe('unknown'));
    expect((screen.getByRole('button', { name: 'Review & fund' }) as HTMLButtonElement).disabled).toBe(true);
    expect((input('Project title').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Check transaction status' }));
    await screen.findByText(/Its absence does not prove failure/);
    expect(mocks.controller!.getSnapshot().attempt?.state).toBe('unknown');
    expect(mocks.connection.getSignatureStatuses).toHaveBeenCalledExactlyOnceWith([signature], { searchTransactionHistory: true });
    expect(screen.queryByText('This transaction is confirmed on Solana Devnet.')).toBeNull();
    expect(screen.queryByText('The operation did not complete successfully.')).toBeNull();
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });

  it('treats a malformed SDK receipt as unknown and keeps the originating signature available', async () => {
    const mismatched = { ...confirmedDeal(), address: creatorAddress };
    mocks.createDeal.mockResolvedValue({ signature, dealAddress, deal: mismatched });
    renderPage();
    fillForm();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mocks.controller!.getSnapshot().attempt?.state).toBe('unknown'));
    expect(screen.getByText(signature)).toBeDefined();
    expect(screen.queryByRole('heading', { name: `Opened deal ${dealAddress}` })).toBeNull();
    expect(screen.queryByText('This transaction is confirmed on Solana Devnet.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });

  it('never re-enables the consumed creation confirmation after RPC recovery confirms it', async () => {
    mocks.createDeal.mockRejectedValue(Object.assign(new Error('Confirmation is uncertain.'), {
      code: 'rpc_error', outcomeUnknown: true, signature,
    }));
    mocks.connection.getSignatureStatuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'confirmed' }] });
    renderPage();
    fillForm();
    review();
    const oldConfirmation = screen.getByRole('button', { name: 'Confirm in wallet' });
    fireEvent.click(oldConfirmation);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    await waitFor(() => expect(mocks.controller!.getSnapshot().attempt?.state).toBe('unknown'));
    fireEvent.click(screen.getByRole('button', { name: 'Check transaction status' }));
    await waitFor(() => expect(mocks.controller!.getSnapshot().attempt?.state).toBe('confirmed'));
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(screen.getByText(/This creation is confirmed, but its deal address was not returned/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Find the created deal in Explorer/ }).getAttribute('href')).toBe(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    expect(screen.queryByRole('heading', { name: `Opened deal ${dealAddress}` })).toBeNull();
    fireEvent.click(oldConfirmation);
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
    // A separate creation requires a new explicit review, including the duplicate-budget warning.
    review();
    expect(screen.getByRole('button', { name: 'Confirm in wallet' })).toBeDefined();
    expect(mocks.createDeal).toHaveBeenCalledTimes(1);
  });
});
