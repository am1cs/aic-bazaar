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

The user requested a temporary public Cloudflare preview for joint Devnet testing: https://americans-gardening-banners-keep.trycloudflare.com/. The local production preview and tunnel must keep running; a tunnel restart changes the hostname. Vercel publication has not been performed.

The visual system follows the supplied `design/` reference and the user's Leonardo.ai direction: a black CSS 3D typography room, violet brand planes, centered white copy and pill actions. Accessible text shades replace reference combinations with insufficient contrast. Fonts use local system fallbacks because the reference supplies font names, not licensed font files.

Motion is a landing-page enhancement: finite introductory reveals, scroll-driven room depth and staggered content movement, ambient room motion while visible, and fine-pointer depth. Scroll work uses one coalesced animation frame and stable layout measurements. The visible Motion on/off control pauses decoration, and native reduced-motion preferences force a static readable view. Unsupported observers fail open. Financial state and wallet operations remain separate from decorative motion.

The GLOW gallery displays three violet static illustrated previews with no video/fullscreen or download controls. These covers are separate from the original delivery files, which remain available through the public deal and preserve their recorded SHA-256 hashes.

The sticky header provides real Create/Explore links, section navigation, documentation and the wallet control. Dropdowns and the mobile disclosure support keyboard navigation and Escape. Anchor navigation places focus on the destination below the sticky header.

No mutations run automatically. Read-only `getDeal()` works without Phantom. Connect a participant wallet for an explicit operation. Unknown transaction outcomes lock further mutations; confirm the saved signature before repeating anything. A confirmed receipt with an account-refresh error offers refresh, not another payment.

Before creating a deal, choose a signing wallet for the human arbiter. The form defaults to the public deployment arbiter but accepts another validated distinct wallet for joint testing. Its reviewed address becomes immutable on creation. See `docs/usability.md` for the two fresh-deal Phantom payout/dispute acceptance steps.

Deliveries: host the material, paste its HTTPS delivery link, and select the same delivered file. Selection does not upload the file. The client previews the saved on-chain URL with a native image or MP4 player; failures retain the external link. GitHub `blob` pages are HTML pages, not direct file URLs, so they may only open externally. The public `/demo/materials` route checks the same preview component against existing synthetic demo assets and an intentionally unavailable URL, without any transaction.

Format validation belongs to the partner's published `src/lib/media.ts`, exporting `validateMilestoneFile(file, index): Promise<void>`. `src/lib/milestoneValidation.ts` explicitly imports and calls that export before hashing; the shared module is a build requirement. No checks are duplicated or bypassed. Actual integration tests validate all three unchanged demo files through this production loader and reject images for video stages. The partner's `providers.tsx` Phantom reconnection is merged unchanged; the partner owns final Vercel deployment of the combined corrections.

The session journal stores only public attempt/receipt metadata; balances always come from the chain. If a page reloads before the SDK returns a signature, recovery is limited to manual wallet/Explorer verification. Unknown creation recovery does not yet expose the generated PDA through the SDK error. These limits are documented in the working specification.

`npm test` uses controlled SDK/RPC boundaries; it does not prove live Phantom signing. `verify:devnet` performs actual read-only SDK checks against the two deployed demonstration deals and simulates a fresh create through the real SDK, using a public funded customer address and deliberately stopping before signing. No private key is loaded, no transaction is broadcast, and no funds move in that check. Human wallet operations, two usability sessions, and final video publishing are recorded separately, with unrun checks labeled honestly.

Phantom compatibility: the current SDK rejects any signed message differing from its pre-sign snapshot. Phantom can automatically add priority-fee instructions to unsigned transactions without an explicit compute budget ([official behavior](https://docs.phantom.com/developer-powertools/solana-priority-fees)). A narrowly scoped Vite plugin routes only `sdk/src/index.ts`'s internal `./transport` import through `src/sdkTransportBridge.ts`. The bridge adds an explicit 200,000-CU limit and zero priority fee before calling the unmodified SDK transport. These match the existing one-program-instruction defaults. Size, funds, simulation, exact signed-message, signature, confirmation and recovery checks all remain in the genuine SDK. The bridge rejects changed instruction layouts, other programs and pre-existing signatures; remove or review it when part 1 changes transaction preparation. SDK, contract, shared types and deployment files are not edited. The same plugin runs in development, production and Vitest.

Dependency audit after the scoped bn.js patch reports 27 findings (15 high, 12 moderate), mainly propagated through Anchor Node workspace and native-wallet tooling paths. Installed browser exports and the built bundle were reviewed; no blanket major overrides were applied. This is a Devnet prototype and an audit count is not a claim of zero vulnerabilities or mainnet readiness.
