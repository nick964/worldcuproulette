// Live World Cup 2026 results → team points for the pool ranking.
//
// Data source: the community-maintained openfootball dataset
// (github.com/openfootball/worldcup.json). One keyless JSON fetch covers all
// 104 matches; scores are filled in as matches finish. Fetched server-side
// with a 10-minute revalidate so we never hammer the source.
//
// Pool scoring (shown in the UI):
//   - 3 points per win, 1 per draw, 0 per loss (FIFA group-stage scoring).
//   - Knockout matches: the winner gets 3 points; a match decided on
//     penalties counts as a win for the shootout winner (they advance).
//   - Goals/GD use the 120-minute score when extra time is played; penalty
//     shootout goals are not counted as goals.

const SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const REVALIDATE_SECONDS = 600;

// openfootball name → our teams.name (only the spellings that differ)
const ALIASES: Record<string, string> = {
  USA: "United States",
  Turkey: "Türkiye",
  "Czech Republic": "Czechia",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Ivory Coast": "Côte d'Ivoire",
};

type OFMatch = {
  round?: string;
  date?: string;
  group?: string;
  team1?: unknown;
  team2?: unknown;
  score?: {
    ft?: [number, number];
    et?: [number, number];
    p?: [number, number];
  };
};

export type TeamScore = {
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
};

export type Scoreboard = {
  // keyed by our teams.name
  byTeamName: Map<string, TeamScore>;
  matchesPlayed: number;
  totalMatches: number;
  ok: boolean;
};

const EMPTY_SCORE: TeamScore = {
  points: 0,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  gf: 0,
  ga: 0,
};

export function teamScore(
  board: Scoreboard,
  teamName: string,
): TeamScore {
  return board.byTeamName.get(teamName) ?? EMPTY_SCORE;
}

export async function getScoreboard(): Promise<Scoreboard> {
  try {
    const res = await fetch(SOURCE_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`Scores fetch failed: ${res.status}`);
    const data = (await res.json()) as { matches?: OFMatch[] };
    const matches = data.matches ?? [];

    const byTeamName = new Map<string, TeamScore>();
    const tally = (name: string): TeamScore => {
      let s = byTeamName.get(name);
      if (!s) {
        s = { ...EMPTY_SCORE };
        byTeamName.set(name, s);
      }
      return s;
    };

    let matchesPlayed = 0;
    for (const m of matches) {
      const ft = m.score?.ft;
      // Unplayed matches have no score; knockout slots are placeholders
      // ("1A", "W73") until the bracket fills in — skip both.
      if (!ft || typeof m.team1 !== "string" || typeof m.team2 !== "string") {
        continue;
      }
      const name1 = ALIASES[m.team1] ?? m.team1;
      const name2 = ALIASES[m.team2] ?? m.team2;
      const [g1, g2] = m.score?.et ?? ft;

      matchesPlayed++;
      const s1 = tally(name1);
      const s2 = tally(name2);
      s1.played++;
      s2.played++;
      s1.gf += g1;
      s1.ga += g2;
      s2.gf += g2;
      s2.ga += g1;

      let winner: 0 | 1 | 2 = g1 > g2 ? 1 : g2 > g1 ? 2 : 0;
      if (winner === 0 && m.score?.p) {
        const [p1, p2] = m.score.p;
        winner = p1 > p2 ? 1 : 2;
      }
      if (winner === 1) {
        s1.wins++;
        s1.points += 3;
        s2.losses++;
      } else if (winner === 2) {
        s2.wins++;
        s2.points += 3;
        s1.losses++;
      } else {
        s1.draws++;
        s1.points += 1;
        s2.draws++;
        s2.points += 1;
      }
    }

    return {
      byTeamName,
      matchesPlayed,
      totalMatches: matches.length || 104,
      ok: true,
    };
  } catch {
    // No live results (offline, source down, …): rank gracefully on zeros.
    return { byTeamName: new Map(), matchesPlayed: 0, totalMatches: 104, ok: false };
  }
}
