# AIC Bazaar SDK

TypeScript source package consumed by the web application using `file:../sdk`.
Anchor is pinned to 0.32.1 and `@solana/web3.js` to 1.98.4. The package imports
the dependency-free types in `../shared/api.ts`; keep the repository layout.

```ts
import { createBazaarClient } from '@aic-bazaar/sdk';

const client = createBazaarClient({
  connection, // @solana/web3.js v1 Connection configured for Devnet
  wallet: anchorWallet ?? null, // useAnchorWallet() from wallet-adapter-react
  programId, // genuine deployed address from deployment/devnet.json
});
const deal = await client.getDeal(dealAddress); // no wallet required
```

`BazaarClientOptions` accepts `connection: Connection`, `programId: PublicKey |
string`, and `wallet: TransactionWallet | null`. `TransactionWallet` has
`publicKey: PublicKey` and generic `signTransaction` / `signAllTransactions`
methods for web3.js `Transaction | VersionedTransaction`, compatible with
React wallet adapter's `useAnchorWallet()` result. Mutations use a legacy
transaction and the connected wallet's signature; the SDK never creates or
stores a private key. All amounts crossing the public API are integer strings.
`calculateAmounts(budgetLamports)` returns exact BigInt budget, bond, and stage
amounts for display; serialize the BigInts explicitly when needed.

## Network and deployment

The SDK verifies the RPC genesis hash and executable program account. A
different network or mismatched bundled IDL address is rejected. Missing
deployment configuration must be shown as unavailable by the UI, not replaced
with a made-up program address or the system program. The IDL is copied from
the genuine Anchor build output and bundled in this package.

`allowLocalValidator: true` is available only for tests at an HTTP(S) loopback
endpoint (`localhost`, `127.0.0.1`, or `[::1]`) whose genesis is not mainnet.
The default is false. This flag never permits mainnet and must not be set in
the hosted application.

## Receipts and errors

Every mutation checks input and available state, estimates fees, simulates,
requests the wallet signature, submits, confirms using signature + blockhash +
lastValidBlockHeight, and reads the updated account. Roles and money rules are
also enforced by the program; SDK checks are only an early UX guard.

- A failed, rejected, or expired/uncertain transaction never returns success.
- `BazaarSdkError` exposes the shared `code`. If `outcomeUnknown` is true, show
  its `signature` and check the transaction before offering a retry.
- A confirmed transaction with an unavailable account read returns `deal: null`
  and `refreshError`. Show the confirmed receipt and offer `getDeal()` refresh;
  do not offer to repeat that payment.
- The SDK does not retry signed financial operations automatically.

## Checks

```sh
cd sdk
npm ci
npm run typecheck
npm test
```

Unit tests cover UTF-8 limits, participant validation, exact money rounding,
account normalization, wire encoding, wallet rejection, failed simulation,
signature recovery, and confirmed-but-unreadable receipts. RPC unit tests use
explicit mocks and do not constitute on-chain escrow verification. Program
integration tests and Devnet evidence are recorded separately by part 1.
