import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOURNAMENT_ID = "R2026100";
const LEADERBOARD_URL = `https://www.pgatour.com/tournaments/2026/the-open-championship/${TOURNAMENT_ID}/leaderboard`;
const COURSE_PAR = 70;

type PlayerRow = {
  __typename: string;
  player?: {
    displayName: string;
  };
  scoringData?: {
    position: string;
    total: string;
    score: string;
    thru: string;
    rounds: string[];
    currentRound: number;
    playerState: string;
  };
};

type LeaderboardData = {
  players: PlayerRow[];
  tournamentStatus: string;
};

const NAME_ALIASES: Record<string, string> = {
  "thomas sloman": "Tom Sloman",
  "sam bairstow": "Samuel Bairstow",
  "nico echavarria": "Nicolas Echavarria",
  "jose luis ballester": "Josele Ballester",
  "liv grinberg": "Lev Grinberg",
  "dan bradbury": "Daniel Bradbury",
  "joe dean": "Joseph Dean",
  "andy sullivan": "Andrew Sullivan",
  "bard bjoernevikl skogen": "Baard Bjoernevik Skogen",
};

function normalizeName(name: string): string {
  const replacements: Record<string, string> = {
    "ø": "o", "Ø": "o", "å": "a", "Å": "a", "æ": "ae", "Æ": "ae",
    "é": "e", "É": "e", "è": "e", "È": "e", "ê": "e", "Ê": "e",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ä": "a", "Ä": "a",
    "ñ": "n", "Ñ": "n", "ç": "c", "Ç": "c", "ß": "ss",
    "á": "a", "Á": "a", "à": "a", "À": "a", "â": "a", "Â": "a",
    "í": "i", "Í": "i", "ó": "o", "Ó": "o", "ú": "u", "Ú": "u",
    "ý": "y", "Ý": "y", "ÿ": "y", "Ÿ": "y",
    "ï": "i", "Ï": "i", "ë": "e", "Ë": "e",
  };
  let result = name;
  for (const [from, to] of Object.entries(replacements)) {
    result = result.replaceAll(from, to);
  }
  return result.toLowerCase().replace(/[^a-z]/g, "");
}

function parseScore(val: string): number {
  const n = parseInt(val);
  return isNaN(n) ? 0 : n;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const response = await fetch(LEADERBOARD_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
    );

    if (!match) {
      throw new Error("Could not find __NEXT_DATA__ in page");
    }

    const nextData = JSON.parse(match[1]);
    const pageProps = nextData?.props?.pageProps;
    const dehydratedState = pageProps?.dehydratedState;
    const queries = dehydratedState?.queries || [];

    let leaderboardData: LeaderboardData | null = null;

    for (const q of queries) {
      const key = q?.queryKey;
      if (Array.isArray(key) && key[0] === "leaderboard") {
        leaderboardData = q?.state?.data;
        break;
      }
    }

    if (!leaderboardData) {
      throw new Error("No leaderboard data found in page");
    }

    const tournamentStatus = leaderboardData.tournamentStatus;

    if (tournamentStatus === "NOT_STARTED") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Tournament has not started yet",
          tournamentStatus,
          updated: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: golfers, error: golferError } = await supabase
      .from("golfers")
      .select("id, name");

    if (golferError) throw golferError;

    const golferMap = new Map<string, string>();
    for (const g of golfers) {
      golferMap.set(normalizeName(g.name), g.id);
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundNames: string[] = [];
    const scoresToUpsert: {
      golfer_id: string;
      round: number;
      score_to_par: number;
      total_to_par: number;
      cut: boolean;
      thru: string;
      updated_at: string;
    }[] = [];

    for (const player of leaderboardData.players) {
      if (player.__typename !== "PlayerRowV3" || !player.player || !player.scoringData) {
        continue;
      }

      const name = player.player.displayName;
      const aliasName = NAME_ALIASES[name.toLowerCase()] || name;
      const golferId = golferMap.get(normalizeName(aliasName));

      if (!golferId) {
        notFoundCount++;
        notFoundNames.push(name);
        continue;
      }

      const sd = player.scoringData;
      const rounds = sd.rounds || [];
      const isCut = sd.position === "CUT";
      const thru = sd.thru || "F";
      const totalToPar = parseScore(sd.total);
      const currentRound = sd.currentRound || 1;

      let cumulativeToPar = 0;

      for (let i = 0; i < rounds.length; i++) {
        const roundNum = i + 1;
        const roundScore = rounds[i];

        if (roundScore === "-" || roundScore === "") {
          continue;
        }

        const strokes = parseInt(roundScore);
        if (isNaN(strokes)) continue;

        const roundScoreToPar = strokes - COURSE_PAR;
        cumulativeToPar += roundScoreToPar;

        scoresToUpsert.push({
          golfer_id: golferId,
          round: roundNum,
          score_to_par: roundScoreToPar,
          total_to_par: cumulativeToPar,
          cut: isCut,
          thru: "F",
          updated_at: new Date().toISOString(),
        });
      }

      const playerScores = scoresToUpsert.filter((s) => s.golfer_id === golferId);

      if (playerScores.length === 0) {
        const liveScoreToPar = parseScore(sd.score);
        scoresToUpsert.push({
          golfer_id: golferId,
          round: currentRound,
          score_to_par: liveScoreToPar,
          total_to_par: totalToPar,
          cut: isCut,
          thru: thru,
          updated_at: new Date().toISOString(),
        });
      } else {
        const lastCompletedRound = Math.max(...playerScores.map((s) => s.round));

        if (currentRound > lastCompletedRound) {
          const liveScoreToPar = parseScore(sd.score);
          scoresToUpsert.push({
            golfer_id: golferId,
            round: currentRound,
            score_to_par: liveScoreToPar,
            total_to_par: totalToPar,
            cut: isCut,
            thru: thru,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (scoresToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("scores")
        .upsert(scoresToUpsert, { onConflict: "golfer_id,round" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      } else {
        updatedCount = scoresToUpsert.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tournamentStatus,
        updated: updatedCount,
        notFound: notFoundCount,
        notFoundNames: notFoundNames.slice(0, 20),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
