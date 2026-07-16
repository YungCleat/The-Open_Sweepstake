import type { Golfer, Score } from './supabase';

export const ROUNDS = [1, 2, 3, 4];
export const TEAM_SIZE = 6;
export const CUT_PENALTY_PER_DAY = 3;

export function getGolferTotalScore(scores: Score[]): number {
  if (scores.length === 0) return 0;
  const latest = scores.reduce((max, s) => (s.round > max.round ? s : max), scores[0]);
  return latest.total_to_par;
}

export function getGolferCut(scores: Score[]): boolean {
  if (scores.length === 0) return false;
  return scores.some((s) => s.cut);
}

export function getGolferRoundScore(scores: Score[], round: number): number | null {
  const s = scores.find((sc) => sc.round === round);
  return s ? s.score_to_par : null;
}

export function getGolferLatestTotal(scores: Score[]): number | null {
  if (scores.length === 0) return null;
  const latest = scores.reduce((max, s) => (s.round > max.round ? s : max), scores[0]);
  return latest.total_to_par;
}

export function getMaxRoundPlayed(allScores: Score[]): number {
  if (allScores.length === 0) return 0;
  return Math.max(...allScores.map((s) => s.round));
}

export function getCurrentRound(allScores: Score[]): number {
  return getMaxRoundPlayed(allScores);
}

export function isCutFinalized(allScores: Score[]): boolean {
  const maxRound = getMaxRoundPlayed(allScores);
  return maxRound >= 2;
}

export function computeTeamScore(
  teamGolfers: { golfer: Golfer; scores: Score[] }[],
  allScores: Score[]
): { totalScore: number; cutPenalty: number; finalScore: number; roundsPlayed: number } {
  let totalScore = 0;
  let cutPenalty = 0;
  const maxRound = getMaxRoundPlayed(allScores);
  const cutFinalized = maxRound >= 2;

  for (const { scores } of teamGolfers) {
    const latestTotal = getGolferLatestTotal(scores);
    if (latestTotal !== null) {
      totalScore += latestTotal;
    }

    const isCut = getGolferCut(scores);
    if (isCut && cutFinalized) {
      const remainingDays = 4 - 2;
      cutPenalty += remainingDays * CUT_PENALTY_PER_DAY;
    }
  }

  return {
    totalScore,
    cutPenalty,
    finalScore: totalScore + cutPenalty,
    roundsPlayed: maxRound,
  };
}

export function formatScore(score: number): string {
  if (score === 0) return 'E';
  if (score > 0) return `+${score}`;
  return `${score}`;
}
