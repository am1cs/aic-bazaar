import type { Idl } from '@coral-xyz/anchor';
import generatedIdl from './idl.json';

// Genuine Anchor 0.32.1 build output, copied from contracts/target/idl.
// Keep byte-for-byte in sync with contracts/idl/aic_bazaar.json after rebuilds.
export const bundledIdl: Idl = generatedIdl as Idl;
