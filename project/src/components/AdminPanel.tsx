import { useState, useMemo } from 'react';
import { Trash2, Pencil, Scissors, ChevronDown, ChevronRight, Flag, Save, X } from 'lucide-react';
import type { Golfer, Score, Team, TeamGolfer } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { computeTeamScore, formatScore, getGolferCut, getGolferLatestTotal, ROUNDS } from '../lib/scoring';
import TeamBuilder from './TeamBuilder';

type Props = {
  teams: Team[];
  teamGolfers: TeamGolfer[];
  golfers: Golfer[];
  scores: Score[];
  onDataChange: () => void;
};

export default function AdminPanel({ teams, teamGolfers, golfers, scores, onDataChange }: Props) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingGolferIds, setEditingGolferIds] = useState<Set<string> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [scoreEdits, setScoreEdits] = useState<Record<string, { score_to_par: number; total_to_par: number; cut: boolean }>>({});
  const [savingScores, setSavingScores] = useState(false);

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

  function getTeamGolferIds(teamId: string): Set<string> {
    return new Set(teamGolfers.filter((tg) => tg.team_id === teamId).map((tg) => tg.golfer_id));
  }

  async function handleDeleteTeam(teamId: string) {
    await supabase.from('team_golfers').delete().eq('team_id', teamId);
    await supabase.from('teams').delete().eq('id', teamId);
    setConfirmDelete(null);
    setExpandedTeam(null);
    onDataChange();
  }

  function startEdit(team: Team) {
    setEditingTeam(team);
    setEditingGolferIds(getTeamGolferIds(team.id));
  }

  function cancelEdit() {
    setEditingTeam(null);
    setEditingGolferIds(null);
  }

  function onTeamUpdated() {
    setEditingTeam(null);
    setEditingGolferIds(null);
    onDataChange();
  }

  function toggleScoreEdit(golferId: string, round: number) {
    const key = `${golferId}-${round}`;
    if (scoreEdits[key]) {
      const next = { ...scoreEdits };
      delete next[key];
      setScoreEdits(next);
    } else {
      const existing = scoresByGolfer.get(golferId)?.find((s) => s.round === round);
      setScoreEdits({
        ...scoreEdits,
        [key]: {
          score_to_par: existing?.score_to_par ?? 0,
          total_to_par: existing?.total_to_par ?? 0,
          cut: existing?.cut ?? false,
        },
      });
    }
  }

  function updateScoreEdit(key: string, field: 'score_to_par' | 'total_to_par' | 'cut', value: number | boolean) {
    setScoreEdits({
      ...scoreEdits,
      [key]: { ...scoreEdits[key], [field]: value },
    });
  }

  async function saveScore(golferId: string, round: number) {
    const key = `${golferId}-${round}`;
    const edit = scoreEdits[key];
    if (!edit) return;
    setSavingScores(true);
    try {
      const existing = scoresByGolfer.get(golferId)?.find((s) => s.round === round);
      if (existing) {
        await supabase
          .from('scores')
          .update({
            score_to_par: edit.score_to_par,
            total_to_par: edit.total_to_par,
            cut: edit.cut,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('scores').insert({
          golfer_id: golferId,
          round,
          score_to_par: edit.score_to_par,
          total_to_par: edit.total_to_par,
          cut: edit.cut,
        });
      }
      const next = { ...scoreEdits };
      delete next[key];
      setScoreEdits(next);
      onDataChange();
    } finally {
      setSavingScores(false);
    }
  }

  if (editingTeam) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Edit Team</h2>
          <button
            onClick={cancelEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 transition"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
        <TeamBuilder
          golfers={golfers}
          onTeamCreated={onTeamUpdated}
          editingTeam={editingTeam}
          editingGolferIds={editingGolferIds || undefined}
        />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <h3 className="text-lg font-semibold text-stone-700">No teams to manage</h3>
        <p className="text-sm text-stone-500 mt-1">Create teams first from the Teams tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        Admin mode: You can delete or modify teams, and enter golfer scores for each round. Cut penalties are calculated
        automatically once Round 2 scores are entered.
      </div>

      {teams.map((team) => {
        const isExpanded = expandedTeam === team.id;
        const myTG = teamGolfers.filter((tg) => tg.team_id === team.id);
        const teamGolferData = myTG.map((tg) => ({
          golfer: golferMap.get(tg.golfer_id)!,
          scores: scoresByGolfer.get(tg.golfer_id) || [],
        }));
        const computed = computeTeamScore(teamGolferData, scores);

        return (
          <div key={team.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <button
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                className="text-stone-400 hover:text-stone-700 transition"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-900 truncate">{team.name}</h3>
                {team.owner_name && <p className="text-xs text-stone-500 truncate">{team.owner_name}</p>}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-stone-800">{formatScore(computed.finalScore)}</div>
                {computed.cutPenalty > 0 && (
                  <div className="text-xs text-amber-600">+{computed.cutPenalty} cut</div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => startEdit(team)}
                  className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                  title="Edit team"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(team.id)}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {confirmDelete === team.id && (
              <div className="px-5 py-3 bg-red-50 border-t border-red-200 flex items-center justify-between">
                <span className="text-sm text-red-700">Delete this team? This cannot be undone.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {isExpanded && (
              <div className="border-t border-stone-100">
                <div className="px-5 py-3 bg-stone-50">
                  <div className="text-xs font-medium text-stone-500 mb-3">Team Golfers & Scores</div>
                  <div className="space-y-2">
                    {teamGolferData.map(({ golfer, scores: gScores }) => {
                      const total = getGolferLatestTotal(gScores);
                      const cut = getGolferCut(gScores);
                      return (
                        <div key={golfer.id} className="bg-white rounded-lg border border-stone-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Flag className="w-3.5 h-3.5 text-stone-400" />
                              <span className="text-sm font-medium text-stone-800">{golfer.name}</span>
                              <span className="text-xs text-stone-400">{golfer.country}</span>
                              {cut && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                                  <Scissors className="w-3 h-3" /> Cut
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-semibold tabular-nums text-stone-700">
                              {total !== null ? formatScore(total) : '—'}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {ROUNDS.map((round) => {
                              const existing = gScores.find((s) => s.round === round);
                              const editKey = `${golfer.id}-${round}`;
                              const isEditing = !!scoreEdits[editKey];
                              return (
                                <div key={round} className="text-center">
                                  <div className="text-xs text-stone-400 mb-1">R{round}</div>
                                  {isEditing ? (
                                    <div className="space-y-1">
                                      <input
                                        type="number"
                                        value={scoreEdits[editKey].score_to_par}
                                        onChange={(e) =>
                                          updateScoreEdit(editKey, 'score_to_par', parseInt(e.target.value) || 0)
                                        }
                                        placeholder="Rd"
                                        className="w-full px-1.5 py-1 text-xs text-center border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      />
                                      <input
                                        type="number"
                                        value={scoreEdits[editKey].total_to_par}
                                        onChange={(e) =>
                                          updateScoreEdit(editKey, 'total_to_par', parseInt(e.target.value) || 0)
                                        }
                                        placeholder="Tot"
                                        className="w-full px-1.5 py-1 text-xs text-center border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      />
                                      <label className="flex items-center justify-center gap-1 text-xs text-stone-500">
                                        <input
                                          type="checkbox"
                                          checked={scoreEdits[editKey].cut}
                                          onChange={(e) => updateScoreEdit(editKey, 'cut', e.target.checked)}
                                          className="w-3 h-3"
                                        />
                                        Cut
                                      </label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => saveScore(golfer.id, round)}
                                          disabled={savingScores}
                                          className="flex-1 px-1.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                                        >
                                          <Save className="w-3 h-3 mx-auto" />
                                        </button>
                                        <button
                                          onClick={() => toggleScoreEdit(golfer.id, round)}
                                          className="px-1.5 py-1 text-xs text-stone-500 hover:text-stone-800 transition"
                                        >
                                          <X className="w-3 h-3 mx-auto" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => toggleScoreEdit(golfer.id, round)}
                                      className={`w-full px-2 py-1.5 text-xs font-medium rounded transition ${
                                        existing
                                          ? existing.total_to_par < 0
                                            ? 'text-emerald-600 hover:bg-emerald-50'
                                            : existing.total_to_par > 0
                                            ? 'text-red-500 hover:bg-red-50'
                                            : 'text-stone-600 hover:bg-stone-100'
                                          : 'text-stone-300 hover:bg-stone-100'
                                      }`}
                                    >
                                      {existing ? formatScore(existing.total_to_par) : '—'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
