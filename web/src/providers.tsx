import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { rpcEndpoint } from './config';

// Wallet Standard already restores silently. Keep the legacy injected adapter
// silent too: a revoked permission must require a new user-initiated connection.
class RestoringPhantomWalletAdapter extends PhantomWalletAdapter {
  async autoConnect(): Promise<void> {
    if (this.readyState !== WalletReadyState.Installed) return;
    const phantomWindow = window as Window & {
      phantom?: { solana?: TrustedPhantomProvider };
      solana?: TrustedPhantomProvider;
    };
    const provider = phantomWindow.phantom?.solana ?? phantomWindow.solana;
    if (!provider?.isPhantom) return;
    if (!provider.isConnected) await provider.connect({ onlyIfTrusted: true });
    await super.autoConnect();
  }
}

interface TrustedPhantomProvider {
  isPhantom?: boolean;
  isConnected: boolean;
  connect(options: { onlyIfTrusted: true }): Promise<unknown>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new RestoringPhantomWalletAdapter()], []);
  return <ConnectionProvider endpoint={rpcEndpoint} config={{ commitment: 'confirmed' }}><WalletProvider wallets={wallets} autoConnect><WalletModalProvider>{children}</WalletModalProvider></WalletProvider></ConnectionProvider>;
}
