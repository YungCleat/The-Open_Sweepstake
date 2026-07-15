export type View = 'leaderboard' | 'teams' | 'field' | 'admin';

export type TeamScore = {
  team: Team;
  golfers: { golfer: Golfer; scores: Score[] }[];
  totalScore: number;
  cutPenalty: number;
  finalScore: number;
  roundsPlayed: number;
};

import type { Team, Golfer, Score } from './supabase';
