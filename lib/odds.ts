// Championship odds for the 48 teams — approximate pre-tournament outright
// (decimal) odds as of June 2026. Static by design: no API key, no DB column;
// tweak the numbers here whenever you like. Keys must match teams.name.
//
// "Chance to win it all" = implied probability (1/odds), normalized so the
// 48 teams sum to 100% (removes the bookmaker overround).

const ODDS: Record<string, number> = {
  // Group A
  Mexico: 51,
  "South Africa": 301,
  "South Korea": 101,
  Czechia: 201,
  // Group B
  Canada: 101,
  "Bosnia and Herzegovina": 251,
  Qatar: 501,
  Switzerland: 81,
  // Group C
  Brazil: 8,
  Morocco: 41,
  Haiti: 1001,
  Scotland: 201,
  // Group D
  "United States": 51,
  Paraguay: 201,
  Australia: 151,
  Türkiye: 81,
  // Group E
  Germany: 12,
  Curaçao: 1001,
  "Côte d'Ivoire": 151,
  Ecuador: 81,
  // Group F
  Netherlands: 16,
  Japan: 51,
  Sweden: 151,
  Tunisia: 251,
  // Group G
  Belgium: 28,
  Egypt: 151,
  Iran: 201,
  "New Zealand": 501,
  // Group H
  Spain: 6.5,
  "Cape Verde": 1001,
  "Saudi Arabia": 501,
  Uruguay: 34,
  // Group I
  France: 7,
  Senegal: 67,
  Iraq: 751,
  Norway: 51,
  // Group J
  Argentina: 9,
  Algeria: 151,
  Austria: 101,
  Jordan: 751,
  // Group K
  Portugal: 11,
  "DR Congo": 501,
  Uzbekistan: 501,
  Colombia: 34,
  // Group L
  England: 7.5,
  Croatia: 34,
  Ghana: 201,
  Panama: 501,
};

const TOTAL_INVERSE = Object.values(ODDS).reduce((sum, o) => sum + 1 / o, 0);

// Normalized win probability in percent, or null for unknown team names.
export function winChance(teamName: string): number | null {
  const odds = ODDS[teamName];
  if (!odds) return null;
  return (1 / odds / TOTAL_INVERSE) * 100;
}

// "12.3%", "0.5%", "<0.1%" — or null when we have no odds for the name.
export function winChanceLabel(teamName: string): string | null {
  const pct = winChance(teamName);
  if (pct === null) return null;
  if (pct < 0.05) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

// Favorite ranking among the 48 (1 = shortest odds; ties share a rank).
export function favoriteRank(teamName: string): number | null {
  const odds = ODDS[teamName];
  if (!odds) return null;
  let rank = 1;
  for (const o of Object.values(ODDS)) if (o < odds) rank++;
  return rank;
}

// American-style odds ("+650") — familiar sportsbook framing.
export function americanOdds(teamName: string): string | null {
  const odds = ODDS[teamName];
  if (!odds) return null;
  return odds >= 2
    ? `+${Math.round((odds - 1) * 100)}`
    : `${Math.round(-100 / (odds - 1))}`;
}

// "3rd" from 3, etc.
export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}
