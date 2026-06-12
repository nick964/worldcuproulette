// Flag images, self-hosted from /public/flags (downloaded from flagcdn.com,
// June 2026 — 48 teams × 4 sizes, ~840KB total). Serving them first-party
// means no ad blocker, corporate proxy, or third-party CDN hiccup can blank
// the wheel. Codes are ISO 3166-1 alpha-2, except England (gb-eng) and
// Scotland (gb-sct).
export type FlagSize = "w80" | "w160" | "w320" | "w640";

export function flagUrl(code: string, size: FlagSize = "w320"): string {
  return `/flags/${size}/${code}.png`;
}
