import { useMemo, useState } from 'react';
import { Search, Flag } from 'lucide-react';
import type { Golfer } from '../lib/supabase';

type Props = {
  golfers: Golfer[];
  selectedGolferIds?: Set<string>;
  onToggleGolfer?: (golfer: Golfer) => void;
  pickMode?: boolean;
};

export default function FieldView({ golfers, selectedGolferIds, onToggleGolfer, pickMode }: Props) {
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('');

  const countries = useMemo(() => {
    const set = new Set(golfers.map((g) => g.country));
    return Array.from(set).sort();
  }, [golfers]);

  const filtered = useMemo(() => {
    return golfers.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
      const matchesCountry = !countryFilter || g.country === countryFilter;
      return matchesSearch && matchesCountry;
    });
  }, [golfers, search, countryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Golfer[]>();
    for (const g of filtered) {
      if (!map.has(g.country)) map.set(g.country, []);
      map.get(g.country)!.push(g);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search golfers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
          />
        </div>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {pickMode && selectedGolferIds && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
          Click a golfer to add or remove them from your team. You can only pick one golfer per country.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {grouped.map(([country, golferList]) => (
          <div key={country} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
              <Flag className="w-4 h-4 text-stone-500" />
              <h3 className="text-sm font-semibold text-stone-800">{country}</h3>
              <span className="text-xs text-stone-400 ml-auto">{golferList.length}</span>
            </div>
            <div className="divide-y divide-stone-100">
              {golferList.map((g) => {
                const selected = selectedGolferIds?.has(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => onToggleGolfer?.(g)}
                    disabled={pickMode && !selected && selectedGolferIds?.has(g.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                      pickMode
                        ? selected
                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'text-stone-700 hover:bg-stone-50'
                        : 'text-stone-700'
                    }`}
                  >
                    <span>{g.name}</span>
                    {selected && <span className="text-xs font-medium text-emerald-600">Selected</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
