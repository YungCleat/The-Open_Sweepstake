import { useMemo } from 'react';
import { Trophy, TrendingUp, Scissors } from 'lucide-react';
import type { Golfer, Score, Team, TeamGolfer } from '../lib/supabase';
import { computeTeamScore, formatScore, getMaxRoundPlayed } from '../lib/scoring';
import GolferCard from './GolferCard';

type Props = {
  teams: Team[];
  teamGolfers: TeamGolfer[];
  golfers: Golfer[];
  scores: Score[];
};

export default function Leaderboard({ teams, teamGolfers, golfers, scores }: Props) {
  const golferMap = useMemo(() => {
    const m = new Map<string, Golfer>();
    golfers.forEach((g) => m.set(g.id, g));
    return m;
  }, [golfers]);

  const scoresByGolfer = useMemo(() => {
    const m = new Map<string, Score[]>();
    for (const s of scores) {
      if (!m.has(s.golfer_id)) m.set(s.golfer_id, []);
      m.get(s.golfer_id)!.push(s);
    }
    return m;
  }, [scores]);

  const teamData = useMemo(() => {
    return teams.map((team) => {
      const myTG = teamGolfers.filter((tg) => tg.team_id === team.id);
      const teamGolfersData = myTG.map((tg) => {
        const golfer = golferMap.get(tg.golfer_id)!;
        const gScores = scoresByGolfer.get(tg.golfer_id) || [];
        return { golfer, scores: gScores };
      });
      const computed = computeTeamScore(teamGolfersData, scores);
      return { team, golfers: teamGolfersData, ...computed };
    });
  }, [teams, teamGolfers, golferMap, scoresByGolfer, scores]);

  const sorted = useMemo(() => {
    return [...teamData].sort((a, b) => {
      if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
      return a.team.name.localeCompare(b.team.name);
    });
  }, [teamData]);

  const maxRound = getMaxRoundPlayed(scores);

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <Trophy className="w-10 h-10 text-stone-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-stone-700">No teams yet</h3>
        <p className="text-sm text-stone-500 mt-1">Create a team to see the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {maxRound > 0 && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <TrendingUp className="w-4 h-4" />
          <span>
            Showing scores through Round {maxRound} of 4
            {maxRound >= 2 && ' · cut penalty applied'}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((entry, idx) => {
          const isLeader = idx === 0;
          const isUnderPar = entry.finalScore < 0;
          const isOverPar = entry.finalScore > 0;
          return (
            <div
              key={entry.team.id}
              className={`bg-white rounded-xl border overflow-hidden transition ${
                isLeader ? 'border-emerald-300 shadow-sm' : 'border-stone-200'
              }`}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    isLeader
                      ? 'bg-emerald-600 text-white'
                      : idx === 1
                      ? 'bg-stone-300 text-stone-700'
                      : idx === 2
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 truncate">{entry.team.name}</h3>
                  {entry.team.owner_name && (
                    <p className="text-xs text-stone-500 truncate">{entry.team.owner_name}</p>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-bold tabular-nums ${
                      isUnderPar
                        ? 'text-emerald-600'
                        : isOverPar
                        ? 'text-red-500'
                        : 'text-stone-700'
                    }`}
                  >
                    {formatScore(entry.finalScore)}
                  </div>
                  {entry.cutPenalty > 0 && (
                    <div className="text-xs text-amber-600 flex items-center justify-end gap-0.5 mt-0.5">
                      <Scissors className="w-3 h-3" />
                      +{entry.cutPenalty} cut penalty
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {entry.golfers.map(({ golfer, scores: gScores }) => (
                    <GolferCard key={golfer.id} golfer={golfer} scores={gScores} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
