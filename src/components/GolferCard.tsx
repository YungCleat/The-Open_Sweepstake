import { useState } from 'react';
import { Flag, Scissors } from 'lucide-react';
import type { Golfer, Score } from '../lib/supabase';
import { formatScore, getGolferCut, getGolferLatestTotal, getGolferRoundScore, getGolferThru, ROUNDS } from '../lib/scoring';

type Props = {
  golfer: Golfer;
  scores: Score[];
};

export default function GolferCard({ golfer, scores }: Props) {
  const [hovered, setHovered] = useState(false);
  const total = getGolferLatestTotal(scores);
  const cut = getGolferCut(scores);

  return (
    <div
      className="relative bg-white rounded-lg border border-stone-200 px-3 py-2 cursor-default transition hover:border-stone-300 hover:shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-1 mb-1">
        <Flag className="w-3 h-3 text-stone-400 flex-shrink-0" />
        <span className="text-xs font-medium text-stone-700 truncate">{golfer.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400">{golfer.country}</span>
        {total !== null ? (
          <div className="flex items-center gap-1">
            {(() => {
              const thru = getGolferThru(scores);
              return thru !== 'F' && thru !== '--' ? (
                <span className="text-[10px] text-stone-400 tabular-nums">thru {thru}</span>
              ) : thru === 'F' ? (
                <span className="text-[10px] text-stone-400">F</span>
              ) : null;
            })()}
            <span
              className={`text-xs font-semibold tabular-nums ${
                cut
                  ? 'text-amber-600'
                  : total < 0
                  ? 'text-emerald-600'
                  : total > 0
                  ? 'text-red-500'
                  : 'text-stone-600'
              }`}
            >
              {cut && <Scissors className="w-3 h-3 inline mr-0.5" />}
              {formatScore(total)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-stone-300">—</span>
        )}
      </div>

      {hovered && scores.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 w-44 bg-stone-900 text-white rounded-lg shadow-xl p-3 pointer-events-none">
          <div className="text-xs font-semibold mb-2 pb-1.5 border-b border-white/10">{golfer.name}</div>
          <div className="space-y-1">
            {ROUNDS.map((round) => {
              const roundScore = getGolferRoundScore(scores, round);
              return (
                <div key={round} className="flex items-center justify-between text-xs">
                  <span className="text-stone-400">Round {round}</span>
                  {roundScore !== null ? (
                    <span
                      className={`font-medium tabular-nums ${
                        roundScore < 0
                          ? 'text-emerald-400'
                          : roundScore > 0
                          ? 'text-red-400'
                          : 'text-stone-200'
                      }`}
                    >
                      {formatScore(roundScore)}
                    </span>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t border-white/10">
              <span className="text-stone-300 font-medium">Total</span>
              <span
                className={`font-bold tabular-nums ${
                  total !== null && total < 0
                    ? 'text-emerald-400'
                    : total !== null && total > 0
                    ? 'text-red-400'
                    : 'text-stone-200'
                }`}
              >
                {total !== null ? formatScore(total) : '—'}
              </span>
            </div>
            {cut && (
              <div className="flex items-center gap-1 text-xs text-amber-400 pt-1">
                <Scissors className="w-3 h-3" />
                <span>Cut</span>
              </div>
            )}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-stone-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}
