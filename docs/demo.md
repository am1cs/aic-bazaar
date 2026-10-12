# AIC Bazaar — three-minute frontend demo

Status: **NOT RUN**. This is a proposed walkthrough. A human wallet signing session has not been performed for this frontend.

## Evidence and setup

Use Solana Devnet. The examples below were fetched from the friend implementation and may be inspected as existing on-chain evidence. They do not demonstrate that this frontend has successfully submitted a transaction from the user's Phantom wallet.

| Example | Deal address | Budget | Bond | Milestones |
| --- | --- | --- | --- | --- |
| Completed | `E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d` | 0.30 SOL | 0.03 SOL | 0.06 / 0.09 / 0.15 SOL |
| Resolved dispute | `98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN` | 0.30 SOL | 0.03 SOL | 0.06 / 0.09 / 0.15 SOL |

Open the local preview URL printed by the development server. Have a Devnet wallet available for connection if wallet behavior is being demonstrated. Refresh both examples before presenting them; an old fetch is not a guarantee of the current account state.

Use synthetic content only, for example: **“Sample brand kit — demo only”**. The immutable template has **Concept**, **Draft**, and **Final** milestones. Never insert an actual client brief or confidential file into the demo. The landing page's 20 / 30 / 50 percent graphic is labeled illustrative; final receives the exact remaining lamports.

## Walkthrough — target 2 minutes 50 seconds

1. **0:00–0:25 — Establish the workflow.** Open the landing page. Show the Devnet indicator and the illustrative funding-to-approval flow. Explain that a client funds a deal, the freelancer submits work, and approvals release funds in milestone order.
2. **0:25–1:05 — Review the create form.** Open Create deal. Show the participant address fields, budget, freelancer bond, and three milestone amounts. Use 0.30 SOL, 0.03 SOL, and 0.06 / 0.09 / 0.15 SOL. Briefly demonstrate one invalid input, then fix it and inspect the review summary. Creating a real Devnet transaction is a separate wallet check unless the presenter chooses to sign it.
3. **1:05–1:50 — Inspect the completed example.** Load `E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d`. Verify its fetched status, participant addresses, 0.30 SOL budget, and three 20 / 30 / 50 percent milestones. Explain the meaning of a paid stage and the confirmation links. Identify this as a pre-existing friend-chain example.
4. **1:50–2:25 — Inspect the resolved example.** Load `98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN`. Point to the fetched resolution state and the role-dependent action rules. Show that an unrelated connected wallet cannot perform privileged actions.
5. **2:25–2:50 — State the verification boundary.** Show the transaction feedback area and one available explorer link. Identify the completed local checks and the remaining wallet checks from `usability.md`. End on the actual deal detail page.

## Separate wallet acceptance session

Do this after the short demo. Record wallet connection, account creation, confirmation, participant actions, and refreshed balances against the current deployed program. A successful Devnet action must have its own confirmed signature; showing the example addresses above is not a substitute. Record cancellation and rejected signing behavior as well as successful behavior.

Do not advertise the acceptance session as complete until the human has signed and the interface has re-fetched the confirmed account state.
