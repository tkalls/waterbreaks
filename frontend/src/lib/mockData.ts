// Mock-data layer so the demo always looks alive even if devnet is flaky
// or the program isn't deployed yet. Swap calls in lib/program.ts to real
// on-chain reads once `anchor deploy` gives you a program ID + IDL.

export type OptionKey = 0 | 1 | 2;

export interface RoundState {
  roundId: number;
  teamA: string;
  teamB: string;
  options: [string, string, string]; // [teamA scores, teamB scores, no goal]
  matchClock: string;
  deadlineMs: number; // epoch ms when betting closes
  totalPoolSol: number;
  optionPoolsSol: [number, number, number];
  participantCount: number;
  resolved: boolean;
  winningOption: OptionKey | null;
}

export interface ActivityItem {
  id: string;
  wallet: string;
  option: OptionKey;
  ts: number;
}

export interface LeaderboardEntry {
  wallet: string;
  payoutSol: number;
}

export function shortWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function randomFakeWallet(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 44; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function initialMockRound(): RoundState {
  return {
    roundId: 1,
    teamA: "Brazil",
    teamB: "France",
    options: ["Brazil scores next", "France scores next", "No goal this break"],
    matchClock: "72:00",
    deadlineMs: Date.now() + 90_000,
    totalPoolSol: 4.8,
    optionPoolsSol: [2.97, 1.34, 0.49],
    participantCount: 53,
    resolved: false,
    winningOption: null,
  };
}

export function initialActivity(): ActivityItem[] {
  const opts: OptionKey[] = [0, 1, 0, 0, 1, 2, 0];
  return opts.map((option, i) => ({
    id: `seed-${i}`,
    wallet: randomFakeWallet(),
    option,
    ts: Date.now() - (opts.length - i) * 4000,
  }));
}

export function mockLeaderboard(round: RoundState): LeaderboardEntry[] {
  if (round.winningOption === null) return [];
  const winnerCount = Math.max(3, Math.round(round.participantCount * 0.3));
  const winningPool = round.optionPoolsSol[round.winningOption] || 1;
  const perWinnerStake = winningPool / winnerCount;
  const payout = (perWinnerStake / winningPool) * round.totalPoolSol;
  return Array.from({ length: Math.min(winnerCount, 8) }, () => ({
    wallet: randomFakeWallet(),
    payoutSol: Number(payout.toFixed(2)),
  })).sort((a, b) => b.payoutSol - a.payoutSol);
}
