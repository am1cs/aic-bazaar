import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BazaarClient, Deal, DealStatus, MutationResult } from '../../shared/api';
import DealPage from './DealPage';
import OperationPanel from './OperationPanel';
import { OperationController } from './transactions/engine';

const mocks = vi.hoisted(() => ({
  walletAddress: null as string | null,
  query: {
    data: null as Deal | null, error: null as string | null, loading: false, fresh: true,
    refresh: vi.fn<() => Promise<void>>(), adopt: vi.fn<(deal: Deal) => void>(),
  },
  client: {
    acceptDeal: vi.fn<BazaarClient['acceptDeal']>(),
    cancelUnaccepted: vi.fn<BazaarClient['cancelUnaccepted']>(),
    submitMilestone: vi.fn<BazaarClient['submitMilestone']>(),
    approveMilestone: vi.fn<BazaarClient['approveMilestone']>(),
    openDispute: vi.fn<BazaarClient['openDispute']>(),
    resolveDispute: vi.fn<BazaarClient['resolveDispute']>(),
  },
  controller: null as OperationController | null,
  connection: { getSignatureStatuses: vi.fn() },
  hashFile: vi.fn<(file: File) => Promise<string>>(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: mocks.walletAddress ? new PublicKey(mocks.walletAddress) : null }),
  useConnection: () => ({ connection: mocks.connection }),
}));
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Connect Phantom</button>,
}));
vi.mock('./hooks', () => ({
  useBazaarClient: () => mocks.client,
  useDeal: () => mocks.query,
}));
vi.mock('./lib/hashing', () => ({ MAX_FILE_BYTES: 128 * 1024 * 1024, hashFile: mocks.hashFile }));
vi.mock('./transactions/useOperation', () => ({
  useOperation: () => {
    const controller = mocks.controller!;
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    return { snapshot, run: controller.run, check: controller.check, clearResolved: controller.clearResolved };
  },
}));

const addresses = {
  client: Keypair.generate().publicKey.toBase58(), creator: Keypair.generate().publicKey.toBase58(),
  arbiter: Keypair.generate().publicKey.toBase58(), viewer: Keypair.generate().publicKey.toBase58(),
};
const dealAddress = 'E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d';
const signature = 'public-controlled-deal-signature';
const previousHash = 'e'.repeat(64);
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const mutationButtonNames = /Review & pay|Open dispute|Submit milestone|Submit replacement|Accept & deposit|Review settlement|Cancel & refund/;

function deal(status: DealStatus = 'active'): Deal {
  return {
    address: dealAddress, client: addresses.client, creator: addresses.creator, arbiter: addresses.arbiter,
    title: 'A vertical launch film', brief: 'A controlled component-test agreement.',
    referencesUrl: 'https://example.com/references', templateVersion: 1,
    budgetLamports: '1000009', bondLamports: '100000', remainingBudgetLamports: '1000009',
    lockedBondLamports: status === 'awaiting_creator' ? '0' : '100000', rentReserveLamports: '1',
    status, currentMilestone: 0, createdAt: 1, dispute: null, resolution: null,
    milestones: [
      { index: 0, amountLamports: '200001', dueAt: 4070952000, submission: null, paidAt: null },
      { index: 1, amountLamports: '300002', dueAt: 4071038400, submission: null, paidAt: null },
      { index: 2, amountLamports: '500006', dueAt: 4071124800, submission: null, paidAt: null },
    ],
  };
}

function submitted(value: Deal, index = value.currentMilestone!, revision: 1 | 2 = 1): Deal {
  value.milestones[index].submission = {
    url: `https://example.com/stage-${index}.mp4`, sha256: previousHash, revision, submittedAt: 1,
  };
  return value;
}

function afterPaidConcept(status: DealStatus = 'active'): Deal {
  const value = submitted(deal(status), 0);
  value.milestones[0].paidAt = 2;
  value.currentMilestone = 1;
  value.remainingBudgetLamports = '800008';
  if (status === 'disputed') value.dispute = { openedBy: addresses.client, reason: 'A decision is needed.', openedAt: 3 };
  return value;
}

function receipt(value: Deal = mocks.query.data!): MutationResult {
  return { signature, dealAddress, deal: value };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function tree() {
  return <MemoryRouter initialEntries={[`/deal/${dealAddress}`]}><OperationPanel /><Routes>
    <Route path="/deal/:address" element={<DealPage />} />
  </Routes></MemoryRouter>;
}

function renderPage() { return render(tree()); }
function confirm() { fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' })); }
function fileInput() { return screen.getByLabelText('Select the exact file to fingerprint') as HTMLInputElement; }

beforeEach(() => {
  sessionStorage.clear();
  mocks.walletAddress = addresses.viewer;
  mocks.query = {
    data: deal(), error: null, loading: false, fresh: true,
    refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), adopt: vi.fn<(value: Deal) => void>(),
  };
  for (const method of Object.values(mocks.client)) {
    method.mockReset();
    method.mockImplementation(async () => receipt());
  }
  mocks.hashFile.mockReset();
  mocks.hashFile.mockImplementation(async (file) => file.name === 'material-a.mp4' ? hashA : hashB);
  mocks.connection.getSignatureStatuses.mockReset();
  mocks.controller = new OperationController(sessionStorage);
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('deal roles, current submissions, and approval', () => {
  it('shows the agreement to unrelated and disconnected viewers without transaction actions', () => {
    const page = renderPage();
    expect(screen.getByRole('heading', { name: 'A vertical launch film' })).toBeDefined();
    expect(screen.queryByRole('button', { name: mutationButtonNames })).toBeNull();
    mocks.walletAddress = null;
    page.rerender(tree());
    expect(screen.getByRole('button', { name: 'Connect Phantom' })).toBeDefined();
    expect(screen.queryByRole('button', { name: mutationButtonNames })).toBeNull();
    for (const method of Object.values(mocks.client)) expect(method).not.toHaveBeenCalled();
  });

  it('requires the named creator to review before explicitly accepting and depositing', async () => {
    mocks.walletAddress = addresses.creator;
    mocks.query.data = deal('awaiting_creator');
    const accepted = deal('active');
    mocks.client.acceptDeal.mockResolvedValue(receipt(accepted));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Accept & deposit 0.0001 SOL' }));
    expect(screen.getByRole('region', { name: 'Accept the fixed project terms' })).toBeDefined();
    expect(mocks.client.acceptDeal).not.toHaveBeenCalled();
    confirm();
    await waitFor(() => expect(mocks.query.adopt).toHaveBeenCalledWith(accepted));
    expect(mocks.client.acceptDeal).toHaveBeenCalledExactlyOnceWith(dealAddress);
    expect(mocks.controller!.getSnapshot().attempt?.wallet).toBe(addresses.creator);
  });

  it.each([0, 1] as const)('submits the selected file fingerprint with expected prior revision %s', async (expectedRevision) => {
    mocks.walletAddress = addresses.creator;
    mocks.query.data = expectedRevision === 0 ? deal() : submitted(afterPaidConcept());
    const currentIndex = mocks.query.data.currentMilestone!;
    const url = `https://example.com/new-${expectedRevision}.mp4`;
    const file = new File(['material A'], 'material-a.mp4', { type: 'video/mp4' });
    renderPage();
    fireEvent.change(screen.getByLabelText('Material link'), { target: { value: url } });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    await screen.findByText(hashA);
    expect(mocks.hashFile).toHaveBeenCalledExactlyOnceWith(file);
    fireEvent.click(screen.getByRole('button', { name: expectedRevision === 0 ? 'Submit milestone' : 'Submit replacement' }));
    await waitFor(() => expect(mocks.client.submitMilestone).toHaveBeenCalledTimes(1));
    expect(mocks.client.submitMilestone).toHaveBeenCalledWith({ address: dealAddress, index: currentIndex, url, sha256: hashA, expectedRevision });
  });

  it('ignores the late hash for file A after file B was selected', async () => {
    mocks.walletAddress = addresses.creator;
    const a = deferred<string>(), b = deferred<string>();
    const fileA = new File(['A'], 'material-a.mp4'), fileB = new File(['B'], 'material-b.mp4');
    mocks.hashFile.mockImplementation((file) => file === fileA ? a.promise : b.promise);
    renderPage();
    fireEvent.change(screen.getByLabelText('Material link'), { target: { value: 'https://example.com/material-b.mp4' } });
    fireEvent.change(fileInput(), { target: { files: [fileA] } });
    fireEvent.change(fileInput(), { target: { files: [fileB] } });
    await act(async () => { b.resolve(hashB); await b.promise; });
    await screen.findByText(hashB);
    await act(async () => { a.resolve(hashA); await a.promise; });
    expect(screen.queryByText(hashA)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Submit milestone' }));
    await waitFor(() => expect(mocks.client.submitMilestone).toHaveBeenCalledTimes(1));
    expect(mocks.client.submitMilestone).toHaveBeenCalledWith({
      address: dealAddress, index: 0, url: 'https://example.com/material-b.mp4', sha256: hashB, expectedRevision: 0,
    });
  });

  it('requires a new file selection after another device advances the current milestone', async () => {
    mocks.walletAddress = addresses.creator;
    const page = renderPage();
    fireEvent.change(screen.getByLabelText('Material link'), { target: { value: 'https://example.com/concept.mp4' } });
    const previousFileInput = fileInput();
    fireEvent.change(previousFileInput, { target: { files: [new File(['Concept'], 'material-a.mp4')] } });
    await screen.findByText(hashA);
    expect((screen.getByRole('button', { name: 'Submit milestone' }) as HTMLButtonElement).disabled).toBe(false);

    // A fresh account read reports that Concept was submitted and paid elsewhere.
    mocks.query.data = afterPaidConcept();
    page.rerender(tree());
    expect(screen.getByRole('heading', { name: 'Submit Draft' })).toBeDefined();
    expect((screen.getByLabelText('Material link') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(hashA)).toBeNull();
    expect(fileInput()).not.toBe(previousFileInput);
    expect(fileInput().files?.length).toBe(0);
    const submit = screen.getByRole('button', { name: 'Submit milestone' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Material link'), { target: { value: 'https://example.com/draft.mp4' } });
    // Also verify the form handler rejects submission if browser controls are bypassed.
    fireEvent.submit(submit.closest('form')!);
    expect(mocks.client.submitMilestone).not.toHaveBeenCalled();
    expect(screen.getByText(/Select a file for this milestone/)).toBeDefined();

    fireEvent.change(fileInput(), { target: { files: [new File(['Draft'], 'material-b.mp4')] } });
    await screen.findByText(hashB);
    fireEvent.click(screen.getByRole('button', { name: 'Submit milestone' }));
    await waitFor(() => expect(mocks.client.submitMilestone).toHaveBeenCalledExactlyOnceWith({
      address: dealAddress, index: 1, url: 'https://example.com/draft.mp4', sha256: hashB, expectedRevision: 0,
    }));
  });

  it('ignores a pending fingerprint after its original milestone has advanced', async () => {
    mocks.walletAddress = addresses.creator;
    const pending = deferred<string>();
    mocks.hashFile.mockReturnValueOnce(pending.promise);
    const page = renderPage();
    fireEvent.change(screen.getByLabelText('Material link'), { target: { value: 'https://example.com/concept.mp4' } });
    fireEvent.change(fileInput(), { target: { files: [new File(['Concept'], 'material-a.mp4')] } });
    expect(screen.getByText('Calculating SHA-256…')).toBeDefined();

    mocks.query.data = afterPaidConcept();
    page.rerender(tree());
    await act(async () => { pending.resolve(hashA); await pending.promise; });
    expect(screen.getByRole('heading', { name: 'Submit Draft' })).toBeDefined();
    expect(screen.queryByText(hashA)).toBeNull();
    expect(screen.queryByText('material-a.mp4')).toBeNull();
    expect(screen.queryByText('Calculating SHA-256…')).toBeNull();
    expect((screen.getByRole('button', { name: 'Submit milestone' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.client.submitMilestone).not.toHaveBeenCalled();
  });

  it('approves only the captured index, revision, and hash, then refreshes on a stale rejection without retrying', async () => {
    mocks.walletAddress = addresses.client;
    mocks.query.data = submitted(afterPaidConcept());
    mocks.client.approveMilestone.mockRejectedValue(Object.assign(new Error('The material changed; refresh and review the replacement.'), { code: 'stale_submission' }));
    const page = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Review & pay' }));
    expect(mocks.client.approveMilestone).not.toHaveBeenCalled();
    const replacement = { ...mocks.query.data, milestones: [...mocks.query.data.milestones] as Deal['milestones'] };
    replacement.milestones[1] = { ...replacement.milestones[1], submission: { ...replacement.milestones[1].submission!, revision: 2, sha256: hashB } };
    mocks.query.data = replacement;
    page.rerender(tree());
    confirm();
    await waitFor(() => expect(mocks.query.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.client.approveMilestone).toHaveBeenCalledExactlyOnceWith({
      address: dealAddress, index: 1, expectedRevision: 1, expectedHash: previousHash,
    });
    expect(mocks.query.adopt).not.toHaveBeenCalled();
    expect(screen.getByText('The material changed; refresh and review the replacement.')).toBeDefined();
    expect(screen.queryByText('This transaction is confirmed on Solana Devnet.')).toBeNull();
  });

  it('allows a client to open a dispute before any material exists', async () => {
    mocks.walletAddress = addresses.client;
    renderPage();
    fireEvent.change(screen.getByLabelText('Reason for the dispute'), { target: { value: 'The agreed direction needs arbitration.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open dispute' }));
    await waitFor(() => expect(mocks.client.openDispute).toHaveBeenCalledTimes(1));
    expect(mocks.client.openDispute).toHaveBeenCalledWith(dealAddress, 'The agreed direction needs arbitration.');
    expect(mocks.client.submitMilestone).not.toHaveBeenCalled();
  });

  it('pauses payment controls when the current network data is stale', () => {
    mocks.walletAddress = addresses.client;
    mocks.query.data = submitted(afterPaidConcept());
    mocks.query.fresh = false;
    mocks.query.error = 'The RPC could not refresh this account.';
    renderPage();
    const pay = screen.getByRole('button', { name: 'Review & pay' }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    expect(screen.getByText(/These values may be out of date; actions stay paused/)).toBeDefined();
    fireEvent.click(pay);
    expect(screen.queryByRole('button', { name: 'Confirm in wallet' })).toBeNull();
    expect(mocks.client.approveMilestone).not.toHaveBeenCalled();
  });
});

describe('dispute settlements and retained history', () => {
  it.each([
    ['refund', '0.000800008', '0.0001'],
    ['pay_current', '0.000500006', '0.000400002'],
    ['creator_breach', '0.000900008', '0'],
  ] as const)('reviews exact %s settlement sums after Concept was already paid', async (outcome, clientSol, creatorSol) => {
    mocks.walletAddress = addresses.arbiter;
    mocks.query.data = submitted(afterPaidConcept('disputed'));
    const reason = 'A final decision under the agreed terms.';
    const settled: Deal = {
      ...mocks.query.data, status: 'resolved', currentMilestone: null, remainingBudgetLamports: '0', lockedBondLamports: '0',
      resolution: { outcome, reason, resolvedAt: 4 },
      milestones: mocks.query.data.milestones.map((stage) => ({ ...stage, paidAt: outcome === 'pay_current' && stage.index === 1 ? 4 : stage.paidAt })) as Deal['milestones'],
    };
    mocks.client.resolveDispute.mockResolvedValue(receipt(settled));
    renderPage();
    fireEvent.change(screen.getByLabelText('Settlement'), { target: { value: outcome } });
    fireEvent.change(screen.getByLabelText('Reason for your decision'), { target: { value: reason } });
    fireEvent.click(screen.getByRole('button', { name: 'Review settlement' }));
    const confirmation = screen.getByRole('region', { name: 'Confirm the final settlement' });
    expect(confirmation.textContent).toContain(`Client receives ${clientSol} SOL; creator receives ${creatorSol} SOL.`);
    expect(mocks.client.resolveDispute).not.toHaveBeenCalled();
    confirm();
    await waitFor(() => expect(mocks.client.resolveDispute).toHaveBeenCalledTimes(1));
    expect(mocks.client.resolveDispute).toHaveBeenCalledWith(dealAddress, outcome, reason);
    await waitFor(() => expect(mocks.query.adopt).toHaveBeenCalledWith(settled));
  });

  it('restricts resolution to the named arbiter and disables pay_current without a submission', () => {
    mocks.query.data = deal('disputed');
    mocks.walletAddress = addresses.client;
    const page = renderPage();
    expect(screen.queryByRole('button', { name: 'Review settlement' })).toBeNull();
    mocks.walletAddress = addresses.arbiter;
    page.rerender(tree());
    expect(screen.getByRole('button', { name: 'Review settlement' })).toBeDefined();
    const payCurrent = screen.getByRole('option', { name: 'Pay submitted current stage · refund future stages' }) as HTMLOptionElement;
    expect(payCurrent.disabled).toBe(true);
    expect(mocks.client.resolveDispute).not.toHaveBeenCalled();
  });

  it.each(['completed', 'resolved'] as const)('retains paid material links and hashes in a read-only %s deal', (status) => {
    const value = afterPaidConcept(status);
    value.currentMilestone = null;
    value.remainingBudgetLamports = '0';
    value.lockedBondLamports = '0';
    if (status === 'completed') {
      submitted(value, 1); submitted(value, 2);
      value.milestones[1].paidAt = 3; value.milestones[2].paidAt = 4;
    } else {
      value.dispute = { openedBy: addresses.client, reason: 'Resolve remaining stages.', openedAt: 3 };
      value.resolution = { outcome: 'refund', reason: 'Remaining stages were refunded.', resolvedAt: 4 };
    }
    mocks.query.data = value;
    mocks.walletAddress = addresses.client;
    renderPage();
    const links = screen.getAllByRole('link', { name: /Open submitted material/ });
    expect(links).toHaveLength(status === 'completed' ? 3 : 1);
    expect(links[0].getAttribute('href')).toBe('https://example.com/stage-0.mp4');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getAllByText(previousHash).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Accepted and paid.*This material reference is retained/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: mutationButtonNames })).toBeNull();
  });

  it('keeps a delayed acceptance receipt with its original wallet and refreshes only the current wallet query', async () => {
    mocks.walletAddress = addresses.creator;
    mocks.query.data = deal('awaiting_creator');
    const previousQuery = mocks.query;
    const pending = deferred<MutationResult>();
    mocks.client.acceptDeal.mockReturnValue(pending.promise);
    const page = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Accept & deposit 0.0001 SOL' }));
    confirm();
    mocks.walletAddress = addresses.viewer;
    mocks.query = { ...previousQuery, refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), adopt: vi.fn<(value: Deal) => void>() };
    page.rerender(tree());
    const accepted = deal('active');
    await act(async () => { pending.resolve(receipt(accepted)); await pending.promise; });
    await waitFor(() => expect(mocks.query.refresh).toHaveBeenCalledTimes(1));
    expect(previousQuery.refresh).not.toHaveBeenCalled();
    expect(previousQuery.adopt).not.toHaveBeenCalled();
    expect(mocks.query.adopt).not.toHaveBeenCalled();
    expect(mocks.controller!.getSnapshot().attempt?.wallet).toBe(addresses.creator);
    expect(screen.getByText(signature)).toBeDefined();
    expect(screen.queryByRole('button', { name: mutationButtonNames })).toBeNull();
    expect(mocks.client.acceptDeal).toHaveBeenCalledTimes(1);
  });
});
