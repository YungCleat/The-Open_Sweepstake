import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Golfer = {
  id: string;
  name: string;
  country: string;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  owner_name: string | null;
  created_at: string;
};

export type TeamGolfer = {
  id: string;
  team_id: string;
  golfer_id: string;
  created_at: string;
};

export type Score = {
  id: string;
  golfer_id: string;
  round: number;
  score_to_par: number;
  total_to_par: number;
  cut: boolean;
  updated_at: string;
};

export type TeamWithGolfers = Team & {
  team_golfers: { golfer: Golfer }[];
};

export type GolferWithScore = Golfer & {
  scores: Score[];
};
