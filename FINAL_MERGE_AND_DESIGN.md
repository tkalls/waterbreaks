# FINAL PASS — 30 minutes to submission. One movement. Read fully, then execute in order.

You are merging a new frontend (from `frontend.zip`, already unzipped by Tobi locally — find it wherever he placed it, likely a sibling folder or `frontend-new/`) into the existing working codebase at `frontend/`, AND restyling everything to a new design direction, in a single pass. Do not ask clarifying questions — make the calls below and move. Time is the only constraint that matters now.

## Step 0 — inventory everything before touching anything
Don't skim or guess at what exists. Run, literally:
```
find frontend -type f -not -path "*/node_modules/*" -not -path "*/dist/*"
find <wherever the unzipped partner folder is> -type f
```
Then check real file sizes, not just names — a previous copy of this zip arrived as macOS metadata stubs (every file exactly 163 bytes, named `._App.tsx` etc., zero real content):
```
ls -la <unzipped partner folder>/src/App.tsx
```
If that file (or others) is suspiciously tiny (under ~300 bytes for a real component), the zip is corrupted the same way — stop, do not attempt to merge from it, tell Tobi directly, and proceed using only the existing working `frontend/` for the redesign. Do not silently skip files and continue as if the merge happened.

If the files are real: use the two `find` outputs as your literal checklist. Go through every file in the incoming folder one by one — read each with the Read tool before deciding keep/discard/merge. Don't decide based on filename alone; a `components/PredictionPanel.tsx` in both places needs an actual content comparison, not an assumption that they're equivalent.

## Non-negotiable — do not break these
- `frontend/src/lib/program.ts` and `frontend/src/lib/wallet.tsx` are tested and working: real Phantom connection, `placeBetFallback`, `placeBetOnChain`, `fetchOnChainRound`, `roundAccountToState`. Do not delete or logically alter these. If the new zip has its own versions of these files, **keep the existing ones** — only take new files from the zip that don't exist yet or are pure presentation (components, CSS).
- `App.tsx`'s state shape must survive: `freePick` (free, no wallet, tier 1) is separate from `myBetOption` (staked, tier 2). Don't collapse them back into one gated flow — that regression was already explicitly fixed once.
- Shared constants from `CONTRACT.md` stay fixed: devnet, 0.1 SOL stake, Brazil vs France, the three option labels, 90-second round.
- Framing: predict / stake / leaderboard. Never bet, wager, odds — check any new copy from the zip against this before keeping it.
- After merging, run `npx tsc --noEmit` and `npm run build` inside `frontend/`. If either fails, fix the error — do not ship a build that doesn't compile.

## Merge procedure
1. Diff the incoming zip's `src/` against the current `frontend/src/`.
2. For `lib/program.ts`, `lib/wallet.tsx`: keep current versions. Ignore incoming versions of these two files entirely.
3. For `App.tsx`: if the incoming version has new layout/JSX you want, port the *structure* over by hand into the current file rather than overwriting it — preserve every handler and state variable from the current version (`freePick`, `myBetOption`, `handleFreePick`, `handlePlaceBet`, the on-chain polling effect). If in doubt, keep current `App.tsx` and only change its styling/markup, not its logic.
4. For everything in `components/` and `styles/`: take the incoming files as the new base, then restyle per the design system below (the incoming versions almost certainly don't have it yet).
5. For `mockData.ts`: keep whichever version has the `RoundState`/`OptionKey` shape the current `program.ts` expects — don't let an incompatible type shape break the build.

## New design direction — replace the existing theme.css entirely
Drop the previous neon/chrome/halftone direction. The reference is 2020s Nike/New Balance/streetwear campaign graphics with 2000s football energy — bold flat color blocking, oversized condensed display type, ticket/pass-style utility typography. No gradients, no glow, no chrome text effects anywhere.

**Typography**
- Display/headline font: `Futura`, fallback stack `"Futura PT", "Futura", "Helvetica Neue", Arial, sans-serif` — bold weight, ALL CAPS, tight letter-spacing (`-0.01em` to `-0.02em`), large sizes for headlines (the match header, the prize pool number, the timer).
- Metadata/numeric font: a monospace, e.g. `"Space Mono", "IBM Plex Mono", monospace` — used for the countdown digits, wallet addresses, timestamps, anything that reads like a ticket stub or boarding pass.
- Two weights only: the bold display caps, and the regular mono. No script, no serif, no chrome gradients on text.

**Color system — flat color blocks, no gradients**
```
--ink:        #111111   (near-black, primary background/text)
--paper:      #F4EEE1   (warm off-white / "Blanco Perlato", light surface)
--yellow:     #F4E04D   (Icterine Yellow — primary accent, big blocks)
--orange:     #E8501F   (Orange Terracotta — CTA / stake button)
--red:        #E8341F   (hero red, used sparingly — confirmations, live indicator)
--navy:       #0B2B3C   (Lagoon — dark color-block sections, alt background)
--lavender:   #8B7FD6   (Mauve Purple — tertiary accent, badges)
```
Every surface is a flat, solid rectangle of one of these — no two-color gradients, no glassmorphism, no blur, no glow/box-shadow-as-light-source. Shadows if used at all are hard-edged offset shadows (e.g. `box-shadow: 6px 6px 0 var(--ink)`), like print registration marks, not soft drop shadows.

**Layout motifs**
- Cards are color-blocked rectangles, asymmetric sizes, like a Memphis-style swatch grid — not uniform rounded glass cards. Sharp or minimally rounded corners (0–4px radius), not the previous 18px pill-everything style.
- The match/round info card should look like a ticket or boarding pass: a dotted/dashed divider line partway through, small monospace metadata (round id, timestamps) in the corners, maybe a barcode-style repeating-line decoration as a pure CSS background pattern (`repeating-linear-gradient` of thin black bars) used sparingly on one element only.
- Headlines are oversized, stacked, tight-leading, ALL CAPS — think a poster, not a UI label. The match header (e.g. "BRAZIL VS FRANCE") and the prize pool SOL amount are the two places to go biggest and boldest.
- Small accent glyphs (a star, a simple geometric shape) can punctuate between words sparingly — don't overdo decorative icons.
- Buttons: solid flat color block, bold caps label, hard-edge offset shadow on press instead of a glow.

**Per-component direction**
- `MatchHeader`: big flat color block (navy or ink), huge Futura-caps team names, mono small-caps round label.
- `WaterBreakTimer`: large mono digits, color block background that shifts from yellow → orange → red as time runs out (flat color swap, not a gradient).
- `PrizePool`: ticket/pass styling — dotted divider, mono metadata, huge bold SOL number.
- `PredictionPanel`: each option is its own flat color block (cycle yellow/orange/lavender), selected state = solid ink block with paper text, not a glow.
- `ActivityFeed` / `Leaderboard`: monospace rows, ticket-stub aesthetic, thin black rule lines between rows instead of soft borders.
- `AchievementBadge` / `Confetti`: this is the one place you can have a little more energy — flat-color confetti pieces (rectangles, not soft circles), badge as a bold red or yellow flat block, no glow.

## Execution order given the clock
1. Replace `theme.css` with the new tokens above (5 min) — this alone changes the entire visual impression fastest.
2. Apply the color-block/Futura treatment to `MatchHeader`, `WaterBreakTimer`, `PrizePool`, `PredictionPanel` first — these are what's on screen most during the demo (10 min).
3. Pass remaining components if time allows (`ActivityFeed`, `Leaderboard`, `AchievementBadge`, `Confetti`) (5 min).
4. Merge any genuinely new logic from the zip only if it's low-risk; skip anything uncertain rather than debug it now (ongoing).
5. `npx tsc --noEmit && npm run build` — must pass clean (5 min).
6. If anything is still broken with under 5 minutes left, revert that one file to its last known-working version rather than leaving a build error. A less-styled working app beats a beautifully styled broken one.
