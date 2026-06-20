# Partner brief — paste this into Claude Code

Open this `worldcup` folder in Claude Code (not a subfolder — `.claude/skills/` needs to be visible at the root so the 32 bundled Solana skills auto-discover). Your half is the frontend. Read `README.md` first for the full architecture; this file is just your task list.

## What already exists — don't rebuild it
`frontend/` is a working React + Vite app with real Phantom wallet connection (`@solana/wallet-adapter-react`), already type-checked and built successfully. Components: `MatchHeader`, `WaterBreakTimer`, `PredictionPanel`, `CommunityStats`, `ActivityFeed`, `PrizePool`, `Leaderboard`, `AchievementBadge`, `Confetti`. The design tokens are in `frontend/src/styles/theme.css`.

## Step 1 — lock the palette
Open the three files in `mockups/` in a browser (`option-a-canarinho.html`, `option-b-night-neon.html`, `option-c-tango-heritage.html`) — full static previews of every screen state. Whichever one we picked, your job is to bring `frontend/src/styles/theme.css` in line with it: swap the CSS variables at the top (`--wb-yellow`, `--wb-green`, etc. for option A; or the equivalent variable names you introduce for B/C) so the live React app matches the chosen mockup exactly, not just approximately.

## Step 2 — invoke the bundled skills, don't freehand it
This repo's `.claude/skills/` has exactly the playbooks for what's left:
- `frontend-design-guidelines` — layout, forms, interaction states. Apply it to `PredictionPanel.tsx` and `WaterBreakTimer.tsx` especially — those have the most interactive states (disabled, pending, locked, picked).
- `page-load-animations` — the entrance/celebration motion. Use it to tighten the confetti burst in `Confetti.tsx` and add a satisfying pop-in sequence when the round resolves.
- `design-taste` — run this as a gut-check pass at the end before judging. Ask it to roast the UI; fix only what it flags as actually broken, not stylistic nitpicks — we don't have time for polish-for-polish's-sake.
- `debug-program` — if `npm run dev` or any wallet/transaction flow breaks, use this instead of guessing.

Just ask Claude Code in plain English ("apply frontend design guidelines to the prediction panel") — these auto-activate.

## Step 3 — responsiveness + edge states
Test at a phone width (this gets demoed on someone's screen, but judges may lean in on a laptop too). Make sure: wallet-not-connected state, pending-transaction state, locked-market state, and resolved/leaderboard state all look intentional, not just functionally correct.

## What you do NOT need to touch
The Anchor program (`anchor/`) and the on-chain wiring in `frontend/src/lib/program.ts` — that's the other half of the team. If `VITE_PLACE_BET_MODE` is still `fallback` when you're testing locally, that's expected; don't "fix" it.

## Cost discipline
The skills in `.claude/skills/` cost nothing extra to have around — they're just files Claude Code reads when relevant, same token cost as a regular prompt. The actual lever for not burning budget: give Claude Code specific file names and concrete asks (like the steps above) instead of open-ended "make it better" prompts — vague prompts make it explore the whole codebase every time, which is what actually burns time and tokens.
