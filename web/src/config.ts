import manifest from '../../deployment/devnet.json';
import receipts from '../../deployment/demo-transactions.json';
export const deployment = manifest;
export const demoReceipts = receipts.transactions;
export const explorer = (kind: 'address' | 'tx', value: string) => `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}?cluster=devnet`;
export const rpcEndpoint = import.meta.env.VITE_DEVNET_RPC_URL || manifest.rpcUrl;
