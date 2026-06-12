// Profanity / slur screening for user-supplied text that other members see
// (display names, pool names, notes). Uses obscenity's English dataset with
// the recommended transformers, which catch common evasions (leetspeak,
// spacing) without Scunthorpe-style false positives.

import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
