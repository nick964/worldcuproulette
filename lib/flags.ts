// Flag images via flagcdn.com, keyed on the team's `code` column.
// Codes are ISO 3166-1 alpha-2, except England (gb-eng) and Scotland (gb-sct),
// which flagcdn also serves.
export type FlagSize = "w80" | "w160" | "w320" | "w640" | "w1280";

export function flagUrl(code: string, size: FlagSize = "w320"): string {
  return `https://flagcdn.com/${size}/${code}.png`;
}
