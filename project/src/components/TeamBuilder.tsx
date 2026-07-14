import { useState, useEffect, useMemo } from 'react';
import { X, Flag, Users, Save, AlertCircle } from 'lucide-react';
import type { Golfer, Team } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { TEAM_SIZE } from '../lib/scoring';
import FieldView from './FieldView';

type Props = {
  golfers: Golfer[];
  onTeamCreated: () => void;
  editingTeam?: Team | null;
  editingGolferIds?: Set<string>;
};

export default function TeamBuilder({ golfers, onTeamCreated, editingTeam, editingGolferIds }: Props) {
  const [teamName, setTeamName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTeam) {
      setTeamName(editingTeam.name);
      setOwnerName(editingTeam.owner_name || '');
      if (editingGolferIds) setSelectedIds(new Set(editingGolferIds));
    } else {
      setTeamName('');
      setOwnerName('');
      setSelectedIds(new Set());
    }
    setError(null);
  }, [editingTeam, editingGolferIds]);

  const selectedGolfers = useMemo(
    () => golfers.filter((g) => selectedIds.has(g.id)),
    [golfers, selectedIds]
  );

  const selectedCountries = useMemo(() => {
    const map = new Map<string, Golfer>();
    for (const g of selectedGolfers) {
      map.set(g.country, g);
    }
    return map;
  }, [selectedGolfers]);

  function toggleGolfer(golfer: Golfer) {
    setError(null);
    const next = new Set(selectedIds);
    if (next.has(golfer.id)) {
      next.delete(golfer.id);
    } else {
      if (next.size >= TEAM_SIZE) {
        setError(`You can only pick ${TEAM_SIZE} golfers.`);
        return;
      }
      if (selectedCountries.has(golfer.country)) {
        setError(`You already have a golfer from ${golfer.country}. You can only pick one per country.`);
        return;
      }
      next.add(golfer.id);
    }
    setSelectedIds(next);
  }

  async function handleSave() {
    setError(null);
    if (!teamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    if (selectedIds.size !== TEAM_SIZE) {
      setError(`You must pick exactly ${TEAM_SIZE} golfers. You have ${selectedIds.size}.`);
      return;
    }
    setSaving(true);
    try {
      let teamId: string;
      if (editingTeam) {
        const { error: updateErr } = await supabase
          .from('teams')
          .update({ name: teamName.trim(), owner_name: ownerName.trim() || null })
          .eq('id', editingTeam.id);
        if (updateErr) throw updateErr;

        await supabase.from('team_golfers').delete().eq('team_id', editingTeam.id);
        teamId = editingTeam.id;
      } else {
        const { data: teamData, error: teamErr } = await supabase
          .from('teams')
          .insert({ name: teamName.trim(), owner_name: ownerName.trim() || null })
          .select()
          .single();
        if (teamErr) throw teamErr;
        teamId = teamData.id;
      }

      const inserts = Array.from(selectedIds).map((golfer_id) => ({ team_id: teamId, golfer_id }));
      const { error: tgErr } = await supabase.from('team_golfers').insert(inserts);
      if (tgErr) throw tgErr;

      setTeamName('');
      setOwnerName('');
      setSelectedIds(new Set());
      onTeamCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to save team.');
    } finally {
      setSaving(false);
    }
  }

  function removeGolfer(g: Golfer) {
    const next = new Set(selectedIds);
    next.delete(g.id);
    setSelectedIds(next);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-stone-900">
            {editingTeam ? 'Edit Team' : 'Create New Team'}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Team Name *</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Team Claret Jug"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Participant Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">
              Selected: {selectedIds.size} / {TEAM_SIZE}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingTeam ? 'Update Team' : 'Save Team'}
                </>
              )}
            </button>
          </div>

          {selectedGolfers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedGolfers.map((g) => (
                <div
                  key={g.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800"
                >
                  <Flag className="w-3 h-3 text-emerald-500" />
                  <span className="font-medium">{g.name}</span>
                  <span className="text-emerald-500">·</span>
                  <span className="text-emerald-600">{g.country}</span>
                  <button
                    onClick={() => removeGolfer(g)}
                    className="ml-0.5 text-emerald-400 hover:text-emerald-700 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <FieldView golfers={golfers} selectedGolferIds={selectedIds} onToggleGolfer={toggleGolfer} pickMode />
    </div>
  );
}
