# Frontend brief — Water Break

**Before you write any copy:** this is a fan space, not a betting app. Read "What this is — say this exactly" at the top of `README.md` — it has the full say-this/not-that table. Every label, button, and tooltip you write should read like "predict," "stake," "leaderboard," never "bet," "wager," or "odds." (Internal code names like `place_bet` in the source files are fine to leave as-is — nobody but the team reads those. This is about anything a fan or judge actually sees.)

You own everything the fan sees and touches. Your teammate owns the Anchor program and on-chain wiring (their brief is `BACKEND_BRIEF.md` — don't worry about that half). Open this `worldcup` folder directly in Claude Code (not a subfolder — `.claude/skills/` has to be visible at the root for the bundled skills to auto-discover).

## What exists already — your starting point, not a finished product
`frontend/` is a working React + Vite app, type-checked and built successfully:
- Real Phantom wallet connection via `@solana/wallet-adapter-react` (`src/lib/wallet.tsx`)
- A devnet transaction path that's already live — staking a prediction sends a real, signed, Explorer-verifiable transaction (`src/lib/program.ts`, `placeBetFallback`). Your teammate will eventually swap this to the real Anchor program call; you don't need to touch that file's logic, just keep the UI hooked to whatever it returns.
- Components: `MatchHeader`, `WaterBreakTimer`, `PredictionPanel`, `CommunityStats`, `ActivityFeed`, `PrizePool`, `Leaderboard`, `AchievementBadge`, `Confetti` — all functional, none of them well art-directed yet.
- A first-pass design system in `src/styles/theme.css` — scrap it. It didn't land. You have full creative freedom on visual direction.

## Visual direction: yours to set
The brief was "2000s joga bonito, vibrant, exciting" — World Cup energy, not generic crypto-app energy. The previous attempt (now in `mockups-v1-rejected/`, ignore it) over-indexed on a specific 2002-Brazil-kit palette and it read as costume rather than design. Don't inherit that direction. Use the bundled skills instead of guessing:

- `.claude/skills/design-taste` — start here. Ask it directly for a visual direction for a "live World Cup fan space during stoppage breaks" before writing any CSS. Let it argue with you about references, type, color — that argument is the point.
- `.claude/skills/brand-design` — once you have a direction, use this to actually build the type pairing, color system, and component states.
- `.claude/skills/frontend-design-guidelines` — apply once the visual language exists, to the interactive states specifically: `PredictionPanel.tsx` (disabled / pending / locked / picked) and `WaterBreakTimer.tsx` (urgency as the clock runs down).
- `.claude/skills/page-load-animations` — the win moment (`Confetti.tsx`, the leaderboard reveal) is the emotional payoff for judges. Make it land.
- `.claude/skills/debug-program` — if a wallet/transaction flow breaks while you're testing, use this rather than guessing at the fix.

Just ask Claude Code in plain English — these activate automatically on relevant requests.

## Concrete task list
1. Define the visual direction (colors, type, one signature motif) and apply it to `theme.css`.
2. Restyle all 9 components to match — don't leave any in the old look.
3. Nail every interactive state on `PredictionPanel` and `WaterBreakTimer` (connect / pending / locked / picked / countdown-urgency).
4. Make the resolve → leaderboard → confetti → achievement-badge sequence feel like a payoff, not a state change.
5. Pass every line of UI copy through the say-this/not-that table in `README.md` — no "bet," "wager," or "odds" anywhere.
6. Test at phone width and laptop width — this gets demoed live, both could happen.
7. Final pass: ask `design-taste` to roast it, fix only what's actually broken (not nitpicks) — time is the constraint, not perfection.

## Stay in your lane
Don't touch `anchor/` or the on-chain logic inside `frontend/src/lib/program.ts`. If `VITE_PLACE_BET_MODE` is still `fallback` while you're working, that's expected — it'll flip to `anchor` once your teammate deploys.

## Cost discipline
Skills cost nothing extra to have around — they're just files Claude Code reads when relevant. The thing that actually burns time and budget is vague prompts ("make it better") that make Claude Code re-explore the whole codebase. Use the concrete task list above instead.
