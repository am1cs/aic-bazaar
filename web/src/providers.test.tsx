import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { StrictMode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletName } from '@solana/wallet-adapter-phantom';
import { AppProviders } from './providers';

// Exercise the genuine WalletProvider and Phantom adapter against a controlled
// injected provider. No wallet extension, network calls or signatures are used.
vi.mock('./config', () => ({ rpcEndpoint: 'https://api.devnet.solana.com' }));

class InjectedPhantom extends EventEmitter {
  isPhantom = true;
  isConnected = false;
  publicKey = new PublicKey('RoBbvk9K1mKvpn8HymvYFb46386YRUFqhUfTrjo2TT4');
  trusted = true;
  connect = vi.fn(async (options?: { onlyIfTrusted?: boolean }) => {
    if (options?.onlyIfTrusted && !this.trusted) throw new Error('Site is no longer trusted');
    this.isConnected = true;
    return { publicKey: this.publicKey };
  });
  disconnect = vi.fn(async () => { this.isConnected = false; this.emit('disconnect'); });
  signTransaction = vi.fn();
  signAllTransactions = vi.fn();
  signAndSendTransaction = vi.fn();
}

let phantom: InjectedPhantom;

function Probe() {
  const wallet = useWallet();
  return <>
    <output aria-label="Wallet state">{wallet.connected ? wallet.publicKey?.toBase58() : 'disconnected'}</output>
    <button onClick={() => wallet.select(PhantomWalletName)}>Select Phantom</button>
    <button onClick={() => void wallet.disconnect()}>Disconnect</button>
  </>;
}

function mount() { return render(<AppProviders><Probe /></AppProviders>); }

beforeEach(() => {
  localStorage.clear();
  phantom = new InjectedPhantom();
  Object.defineProperty(window, 'phantom', { configurable: true, value: { solana: phantom } });
  Object.defineProperty(window, 'isPhantomInstalled', { configurable: true, value: true });
});
afterEach(() => {
  cleanup();
  delete (window as Window & { phantom?: unknown }).phantom;
  delete (window as Window & { isPhantomInstalled?: boolean }).isPhantomInstalled;
});

describe('Phantom connection restoration', () => {
  it('restores Wallet Standard Phantom through its genuine silent connection', async () => {
    localStorage.setItem('walletName', '"Phantom"');
    const account = { address: phantom.publicKey.toBase58(), publicKey: phantom.publicKey.toBytes(), chains: ['solana:devnet'], features: ['solana:signTransaction'] };
    let accounts: typeof account[] = [];
    const connect = vi.fn(async () => { accounts = [account]; return { accounts }; });
    const signTransaction = vi.fn();
    const wallet = {
      version: '1.0.0', name: 'Phantom', icon: 'data:image/svg+xml;base64,', chains: ['solana:devnet'],
      get accounts() { return accounts; },
      features: {
        'standard:connect': { version: '1.0.0', connect },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signTransaction },
      },
    };
    let unregister = () => {};
    const register = (api: { register(value: typeof wallet): () => void }) => { unregister = api.register(wallet); };
    const ready = (event: Event) => register((event as CustomEvent).detail);
    window.addEventListener('wallet-standard:app-ready', ready);
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
    mount();
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(account.address));
    expect(connect).toHaveBeenCalledExactlyOnceWith({ silent: true });
    expect(phantom.connect).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    cleanup();
    window.removeEventListener('wallet-standard:app-ready', ready);
    unregister();
  });

  it('restores silently with the app’s StrictMode lifecycle', async () => {
    localStorage.setItem('walletName', '"Phantom"');
    render(<StrictMode><AppProviders><Probe /></AppProviders></StrictMode>);
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    expect(phantom.connect).toHaveBeenCalled();
    for (const [options] of phantom.connect.mock.calls) expect(options).toEqual({ onlyIfTrusted: true });
    expect(phantom.signTransaction).not.toHaveBeenCalled();
  });

  it('does not connect a first-time visitor without a selected wallet', async () => {
    mount();
    await act(async () => {});
    expect(screen.getByLabelText('Wallet state').textContent).toBe('disconnected');
    expect(phantom.connect).not.toHaveBeenCalled();
  });

  it('restores a remembered wallet silently after a page reload', async () => {
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Select Phantom' }));
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    expect(phantom.connect).toHaveBeenLastCalledWith();
    expect(localStorage.getItem('walletName')).toBe('"Phantom"');
    first.unmount();
    phantom.isConnected = false;
    phantom.connect.mockClear();
    mount();
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    expect(phantom.connect).toHaveBeenCalledExactlyOnceWith({ onlyIfTrusted: true });
    expect(phantom.signTransaction).not.toHaveBeenCalled();
    expect(phantom.signAllTransactions).not.toHaveBeenCalled();
    expect(phantom.signAndSendTransaction).not.toHaveBeenCalled();
  });

  it('respects manual disconnect on this page and subsequent reloads', async () => {
    localStorage.setItem('walletName', '"Phantom"');
    const first = mount();
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(localStorage.getItem('walletName')).toBeNull());
    expect(screen.getByLabelText('Wallet state').textContent).toBe('disconnected');
    first.unmount();
    phantom.connect.mockClear();
    mount();
    await act(async () => {});
    expect(phantom.connect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Wallet state').textContent).toBe('disconnected');
  });

  it('leaves revoked permission disconnected, then allows an explicit connection', async () => {
    localStorage.setItem('walletName', '"Phantom"');
    phantom.trusted = false;
    mount();
    await waitFor(() => expect(localStorage.getItem('walletName')).toBeNull());
    expect(phantom.connect).toHaveBeenCalledExactlyOnceWith({ onlyIfTrusted: true });
    expect(screen.getByLabelText('Wallet state').textContent).toBe('disconnected');
    fireEvent.click(screen.getByRole('button', { name: 'Select Phantom' }));
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    expect(phantom.connect).toHaveBeenLastCalledWith();
  });

  it('updates the active account after Phantom switches wallets', async () => {
    localStorage.setItem('walletName', '"Phantom"');
    mount();
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(phantom.publicKey.toBase58()));
    const next = new PublicKey('8Et821ouFKAf9nLgGgXZmRQNZ1LGGN7sLvMD8VTXp18W');
    act(() => { phantom.publicKey = next; phantom.emit('accountChanged', next); });
    await waitFor(() => expect(screen.getByLabelText('Wallet state').textContent).toBe(next.toBase58()));
    expect(phantom.signTransaction).not.toHaveBeenCalled();
  });
});
