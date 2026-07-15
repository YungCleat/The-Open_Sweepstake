import { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, Users, Flag, Settings, RefreshCw, Activity } from 'lucide-react';
import type { Golfer, Score, Team, TeamGolfer } from './lib/supabase';
import { supabase } from './lib/supabase';
import Leaderboard from './components/Leaderboard';
import TeamBuilder from './components/TeamBuilder';
import FieldView from './components/FieldView';
import AdminPanel from './components/AdminPanel';

type View = 'leaderboard' | 'teams' | 'field' | 'admin';

const REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes

export default function App() {
  const [view, setView] = useState<View>('leaderboard');
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamGolfers, setTeamGolfers] = useState<TeamGolfer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    const [gRes, tRes, tgRes, sRes] = await Promise.all([
      supabase.from('golfers').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('team_golfers').select('*'),
      supabase.from('scores').select('*'),
    ]);

    if (gRes.data) setGolfers(gRes.data as Golfer[]);
    if (tRes.data) setTeams(tRes.data as Team[]);
    if (tgRes.data) setTeamGolfers(tgRes.data as TeamGolfer[]);
    if (sRes.data) setScores(sRes.data as Score[]);
  }, []);

  const syncScores = useCallback(async () => {
    setRefreshing(true);
    setSyncStatus('Syncing live scores...');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/update-scores`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        if (result.tournamentStatus === 'NOT_STARTED') {
          setSyncStatus('Tournament starts July 16');
        } else {
          setSyncStatus(`Updated ${result.updated} scores`);
          await fetchData();
          setLastUpdated(new Date());
        }
      } else {
        setSyncStatus('Sync failed');
      }
    } catch (e) {
      setSyncStatus('Sync failed');
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
      // Sync scores on initial load
      await syncScores();
    })();
  }, [fetchData, syncScores]);

  useEffect(() => {
    // Auto-refresh every 3 minutes
    intervalRef.current = setInterval(() => {
      syncScores();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [syncScores]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  async function handleRefresh() {
    await syncScores();
  }

  const navItems: { id: View; label: string; icon: typeof Trophy }[] = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'teams', label: 'Manage Teams', icon: Users },
    { id: 'field', label: 'The Field', icon: Flag },
    { id: 'admin', label: 'Admin', icon: Settings },
  ];

  const OPEN_LOGO = 'https://www.theopen.com/-/media/images/logo-the-open-symbol.png?w=320';
  const BIRKDALE_HERO = 'https://www.theopen.com/-/media/images---news-articles/2026/03/birkdale_clubhouse.jpg?w=1440';

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-200 via-stone-100 to-stone-100">
      {/* Hero Header */}
      <header className="relative sticky top-0 z-30 shadow-lg">
        {/* Background image with gradient overlay */}
        <div className="absolute inset-0">
          <img
            src={BIRKDALE_HERO}
            alt="Royal Birkdale clubhouse at sunset"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/85 via-stone-900/90 to-stone-900/95" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src={OPEN_LOGO}
                alt="The Open Championship"
                className="w-10 h-10 object-contain drop-shadow-lg"
              />
              <div>
                <h1 className="text-base font-bold leading-tight text-white">The Open Championship Pool</h1>
                <p className="text-xs leading-tight text-amber-300/90">The 154th Open · Royal Birkdale · July 16-19, 2026</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {syncStatus && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-300">
                  <Activity className={`w-3.5 h-3.5 ${refreshing ? 'animate-pulse text-emerald-400' : ''}`} />
                  <span>{syncStatus}</span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-50"
                title="Sync live scores"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {/* Spacer to reveal more of the background image */}
          <div className="relative h-[60px] sm:h-[84px]" />
        </div>

        {/* Nav */}
        <nav className="relative border-t border-white/10 bg-stone-900/60 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      active
                        ? 'border-amber-400 text-white'
                        : 'border-transparent text-stone-400 hover:text-white hover:border-stone-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
        {/* Claret accent stripe */}
        <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {view === 'leaderboard' && (
              <div className="space-y-6">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold text-stone-900">Leaderboard</h2>
                    <p className="text-sm text-stone-500 mt-1">
                      Cumulative score to par across all 6 golfers. Cut penalty: +3 per remaining day per cut golfer.
                    </p>
                    {lastUpdated && (
                      <p className="text-xs text-stone-400 mt-1">
                        Last synced: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 3 minutes
                      </p>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-amber-800">Live scoring</span>
                  </div>
                </div>
                <Leaderboard teams={teams} teamGolfers={teamGolfers} golfers={golfers} scores={scores} />
              </div>
            )}

            {view === 'teams' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Manage Teams</h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Pick 6 golfers, one from each country. Create, edit, or delete participant teams.
                  </p>
                </div>
                <TeamBuilder golfers={golfers} onTeamCreated={refreshData} />
              </div>
            )}

            {view === 'field' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">The Field</h2>
                  <p className="text-sm text-stone-500 mt-1">
                    The {golfers.length} qualified golfers for the 154th Open at Royal Birkdale.
                  </p>
                </div>
                <FieldView golfers={golfers} />
              </div>
            )}

            {view === 'admin' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900">Admin Panel</h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Manage teams and enter golfer scores per round. Cut penalties are auto-calculated.
                  </p>
                </div>
                <AdminPanel
                  teams={teams}
                  teamGolfers={teamGolfers}
                  golfers={golfers}
                  scores={scores}
                  onDataChange={refreshData}
                />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-8 border-t-4 border-amber-600/30 bg-stone-900 text-stone-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={OPEN_LOGO}
                alt="The Open Championship"
                className="w-8 h-8 object-contain opacity-80"
              />
              <div>
                <p className="text-sm font-semibold text-white">The Open Championship Pool</p>
                <p className="text-xs text-stone-400">Royal Birkdale 2026 · Live scores auto-sync every 3 minutes</p>
              </div>
            </div>
            <p className="text-xs text-stone-500">The 154th Open · Royal Birkdale, Southport</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
