import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client- Info, Apikey",
};

const TOURNAMENT_ID = "R2026100";
const LEADERBOARD_URL = `https://www.pgatour.com/tournaments/2026/the-open-championship/${TOURNAMENT_ID}/leaderboard`;

type PlayerRow = {
  __typename: string;
  player?: {
    displayName: string;
    firstName: string;
    lastName: string;
    country: string;
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
  currentRound?: number;
};

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

    // Fetch all golfers from database
    const { data: golfers, error: golferError } = await supabase
      .from("golfers")
      .select("id, name");

    if (golferError) throw golferError;

    // Build name -> id map (case-insensitive)
    const golferMap = new Map<string, string>();
    for (const g of golfers) {
      golferMap.set(g.name.toLowerCase(), g.id);
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundNames: string[] = [];

    for (const player of leaderboardData.players) {
      if (player.__typename !== "PlayerRowV3" || !player.player || !player.scoringData) {
        continue;
      }

      const name = player.player.displayName;
      const golferId = golferMap.get(name.toLowerCase());

      if (!golferId) {
        notFoundCount++;
        notFoundNames.push(name);
        continue;
      }

      const sd = player.scoringData;
      const rounds = sd.rounds || [];
      const isCut = sd.position === "CUT";

      // Process each round that has a score
      for (let i = 0; i < rounds.length; i++) {
        const roundNum = i + 1;
        const roundScore = rounds[i];

        if (roundScore === "-" || roundScore === "") {
          // No score for this round yet
          continue;
        }

        const totalStrokes = parseInt(roundScore);
        if (isNaN(totalStrokes)) continue;

        // Calculate score to par for this round (par 71 for Royal Birkdale)
        // We'll use total_to_par from the API's total field for cumulative
        // For individual round score, we need to calculate from total
        // The API gives us the total (cumulative) and individual round scores

        // For cut players, they only have 2 rounds
        // For active players, they have rounds up to currentRound
        const cumulativeTotal = parseInt(sd.total);
        const scoreToPar = isNaN(cumulativeTotal) ? 0 : cumulativeTotal;

        // Calculate this round's score to par
        let roundScoreToPar: number;
        if (i === 0) {
          roundScoreToPar = totalStrokes - 71;
        } else {
          // Need previous total to calculate this round's delta
          const prevTotal = parseInt(rounds[i - 1]);
          if (!isNaN(prevTotal)) {
            roundScoreToPar = totalStrokes - prevTotal;
          } else {
            roundScoreToPar = totalStrokes - 71;
          }
        }

        // For the latest round, use the API's total field
        // For earlier rounds, calculate cumulative from round scores
        let cumulativeToPar: number;
        if (i === rounds.length - 1 || (isCut && i === 1)) {
          cumulativeToPar = isNaN(cumulativeTotal) ? roundScoreToPar : cumulativeTotal;
        } else {
          // Calculate cumulative from individual rounds
          let totalPar = 0;
          for (let j = 0; j <= i; j++) {
            const s = parseInt(rounds[j]);
            if (!isNaN(s)) {
              totalPar += s - 71;
            }
          }
          cumulativeToPar = totalPar;
        }

        // Upsert score
        const { error: upsertError } = await supabase
          .from("scores")
          .upsert(
            {
              golfer_id: golferId,
              round: roundNum,
              score_to_par: roundScoreToPar,
              total_to_par: cumulativeToPar,
              cut: isCut,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "golfer_id,round" }
          );

        if (upsertError) {
          console.error(`Error upserting score for ${name} R${roundNum}:`, upsertError);
        } else {
          updatedCount++;
        }
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
