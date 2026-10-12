# AIC Bazaar web

React frontend for the real Devnet milestone escrow. Human creators, a named human arbiter, and test SOL only.

Run from `web/`:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run verify:devnet
```

Keep the complete repository layout: `web/`, `sdk/`, `shared/`, `deployment/`.
The dependency remains `file:../sdk`; Vite and TypeScript resolve the original SDK source and its shared types. SDK runtime dependencies are pinned in the frontend package and deduplicated so a clean web install does not require modifying the SDK owner's lockfile. Wallet Adapter versions are pinned to support web3.js 1.98.4. The compatible bn.js 5.2.5 security patch is scoped to web dependency resolution.

Vercel: Root Directory `web`, Include source files outside Root Directory enabled, install `npm ci`, build `npm run build`, Output Directory `dist`. `vercel.json` preserves direct deal/dispute routes. Only public Devnet configuration may enter the Vite bundle.

The current handoff is local-only at the user's request. Vercel publication has not been performed.

The visual system follows the supplied `design/` reference: black canvas, violet brand typography, white pill actions, compact labeled status chips. Accessible text shades replace reference combinations with insufficient contrast. Fonts use local system fallbacks because the reference supplies font names, not licensed font files. Decorative frames are original SVG illustrations; the GLOW gallery uses the exact public demo files and preserves their recorded hashes.

No mutations run automatically. Read-only `getDeal()` works without Phantom. Connect a participant wallet for an explicit operation. Unknown transaction outcomes lock further mutations; confirm the saved signature before repeating anything. A confirmed receipt with an account-refresh error offers refresh, not another payment.

The session journal stores only public attempt/receipt metadata; balances always come from the chain. If a page reloads before the SDK returns a signature, recovery is limited to manual wallet/Explorer verification. Unknown creation recovery does not yet expose the generated PDA through the SDK error. These limits are documented in the working specification.

`npm test` uses controlled SDK/RPC boundaries; it does not prove live Phantom signing. `verify:devnet` performs actual read-only SDK checks against the two deployed demonstration deals. Human wallet operations, two usability sessions, and final video publishing are recorded separately, with unrun checks labeled honestly.

Dependency audit after the scoped bn.js patch reports 27 findings (15 high, 12 moderate), mainly propagated through Anchor Node workspace and native-wallet tooling paths. Installed browser exports and the built bundle were reviewed; no blanket major overrides were applied. This is a Devnet prototype and an audit count is not a claim of zero vulnerabilities or mainnet readiness.
