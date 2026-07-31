/*
 * Exercise generator (build-time). Turns a unit's authored vocab + sentences
 * into exercise rows spanning all six types, so I author the meaningful content
 * (words, sentences, teaching) once and don't hand-type ~600 mechanical drills.
 *
 * Determinism: all randomness flows through a seeded RNG so a given curriculum
 * always produces the same exercises (reproducible builds). Pure — no IO.
 *
 * Exercise row conventions (must match the Phase 4 graders):
 *   mc                 prompt=question; answer=correct option; distractors=JSON[3]
 *   cloze              prompt=sentence with "____"; answer=blanked word
 *   typed_translation  prompt=source text; answer=target text; direction set
 *   word_order         prompt=English hint; answer=full French sentence (tokens
 *                      are the answer split on spaces; UI shuffles them)
 *   listening_dictation prompt=instruction; answer=French sentence (audio later)
 *   match              prompt=instruction; answer=JSON array of {fr,en} pairs
 */

import type { ExerciseType, Direction } from '../../src/db/types';
import type { UnitDef, VocabDef, SentenceDef } from '../curriculum/types';

export interface GeneratedExercise {
  type: ExerciseType;
  direction: Direction | null;
  prompt: string;
  answer: string;
  accepted_alternatives: string[] | null;
  distractors: string[] | null;
  /** Link hints resolved to sentence_id / vocab_id by the seed builder. */
  sentence_fr: string | null;
  vocab_lemma: string | null;
}

// --- deterministic RNG (mulberry32) ---
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Pick up to n distractor strings from pool, excluding `exclude`. */
export function pickDistractors(
  exclude: string,
  pool: readonly string[],
  n: number,
  rng: () => number,
): string[] {
  const candidates = pool.filter((p) => p !== exclude);
  return shuffle(candidates, rng).slice(0, n);
}

const CONFIG = {
  distractorCount: 3, // options per MC = 1 correct + 3 distractors
  matchGroupSize: 5, // pairs per match exercise
} as const;

// Short function words we avoid blanking in cloze (prefer content words).
const CLOZE_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'a', 'au',
  'aux', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce',
  'ça', 'que', 'qui', 'ne', 'pas', 'en', 'se', 'sa', 'son', 'ses', 'mes', 'tes',
  'est', 'sont', 'me', 'te', 'y', 'ni', 'si', 'car',
]);

const TRAILING_PUNCT = /[.,!?;:…»)]+$/u;

function stripPunct(token: string): string {
  return token.replace(/^[«("¿¡]+/u, '').replace(TRAILING_PUNCT, '');
}

// --- vocab exercises ---

export function generateVocabMc(
  target: VocabDef,
  otherVocab: readonly VocabDef[],
  rng: () => number,
): GeneratedExercise {
  const distractors = pickDistractors(
    target.lemma_fr,
    otherVocab.map((v) => v.lemma_fr),
    CONFIG.distractorCount,
    rng,
  );
  return {
    type: 'mc',
    direction: 'en_fr',
    prompt: target.translation_en,
    answer: target.lemma_fr,
    accepted_alternatives: null,
    distractors,
    sentence_fr: null,
    vocab_lemma: target.lemma_fr,
  };
}

/** Reverse MC: show the French word, pick the English meaning. */
export function generateVocabMcReverse(
  target: VocabDef,
  otherVocab: readonly VocabDef[],
  rng: () => number,
): GeneratedExercise {
  const distractors = pickDistractors(
    target.translation_en,
    otherVocab.map((v) => v.translation_en),
    CONFIG.distractorCount,
    rng,
  );
  return {
    type: 'mc',
    direction: 'fr_en',
    prompt: target.lemma_fr,
    answer: target.translation_en,
    accepted_alternatives: null,
    distractors,
    sentence_fr: null,
    vocab_lemma: target.lemma_fr,
  };
}

export function generateMatch(group: readonly VocabDef[]): GeneratedExercise {
  const pairs = group.map((v) => ({ fr: v.lemma_fr, en: v.translation_en }));
  return {
    type: 'match',
    direction: null,
    prompt: 'Match the French words to their English meaning.',
    answer: JSON.stringify(pairs),
    accepted_alternatives: null,
    distractors: null,
    sentence_fr: null,
    vocab_lemma: null,
  };
}

// --- sentence exercises ---

/**
 * Build a cloze from a sentence by blanking one content word — preferring a word
 * that is one of the unit's vocab lemmas, else the longest non-stopword. Returns
 * null if no suitable word exists.
 */
export function makeCloze(
  sentence: SentenceDef,
  vocabLemmas: ReadonlySet<string>,
  rng: () => number,
): GeneratedExercise | null {
  const tokens = sentence.text_fr.split(/\s+/);

  interface Candidate {
    index: number;
    word: string;
    isVocab: boolean;
  }
  const candidates: Candidate[] = [];
  tokens.forEach((token, index) => {
    if (token.includes("'") || token.includes('’')) return; // skip elisions
    const word = stripPunct(token);
    const lower = word.toLowerCase();
    if (word.length < 3 || CLOZE_STOPWORDS.has(lower)) return;
    candidates.push({ index, word, isVocab: vocabLemmas.has(lower) });
  });
  if (candidates.length === 0) return null;

  const vocabCandidates = candidates.filter((c) => c.isVocab);
  const pickFrom = vocabCandidates.length > 0 ? vocabCandidates : candidates;
  // Prefer longer words; deterministic tiebreak via rng.
  pickFrom.sort((a, b) => b.word.length - a.word.length || (rng() < 0.5 ? -1 : 1));
  const chosen = pickFrom[0]!;

  const original = tokens[chosen.index]!;
  const trailing = original.match(TRAILING_PUNCT)?.[0] ?? '';
  const blankTokens = tokens.slice();
  blankTokens[chosen.index] = `____${trailing}`;

  return {
    type: 'cloze',
    direction: null,
    prompt: blankTokens.join(' '),
    answer: chosen.word,
    accepted_alternatives: [chosen.word.toLowerCase()],
    distractors: null,
    sentence_fr: sentence.text_fr,
    vocab_lemma: null,
  };
}

export function makeTypedTranslation(sentence: SentenceDef): GeneratedExercise {
  return {
    type: 'typed_translation',
    direction: 'en_fr',
    prompt: sentence.text_en,
    answer: sentence.text_fr,
    accepted_alternatives: null,
    distractors: null,
    sentence_fr: sentence.text_fr,
    vocab_lemma: null,
  };
}

export function makeWordOrder(sentence: SentenceDef): GeneratedExercise {
  return {
    type: 'word_order',
    direction: 'en_fr',
    prompt: sentence.text_en,
    answer: sentence.text_fr,
    accepted_alternatives: null,
    distractors: null,
    sentence_fr: sentence.text_fr,
    vocab_lemma: null,
  };
}

export function makeListeningDictation(sentence: SentenceDef): GeneratedExercise {
  return {
    type: 'listening_dictation',
    direction: null,
    prompt: 'Type the sentence you hear.',
    answer: sentence.text_fr,
    accepted_alternatives: null,
    distractors: null,
    sentence_fr: sentence.text_fr,
    vocab_lemma: null,
  };
}

/**
 * Per-unit exercise budget (upper bounds; each is capped by how much vocab /
 * how many sentences the unit actually has, so small units just get fewer).
 * Aims for ~30 exercises so learners get more practice and can't simply
 * memorise a fixed 15-question script. The session shuffles order at runtime.
 */
const BUDGET = {
  mcEnFr: 7, // recognition: English prompt → pick French
  mcFrEn: 6, // recognition: French prompt → pick English
  matchGroups: 2, // recognition: groups of 5
  cloze: 5, // production: fill the blank
  typed: 4, // production: type the French translation
  wordOrder: 3, // production: arrange the tokens
  dictation: 3, // production: type what you hear
} as const;

/**
 * Generate a ~30-exercise set for a unit spanning all six types, drawn from its
 * authored vocab + sentences. Deterministic for a given seed.
 *
 * Sentence-based types each draw from an independent shuffle of the unit's
 * sentences, so a unit with only a handful of sentences still yields variety:
 * the same sentence may appear under different exercise types (cloze vs.
 * word-order), which drills a different skill each time.
 */
export function generateExercisesForUnit(
  unit: UnitDef,
  seed: number,
): GeneratedExercise[] {
  const rng = mulberry32(seed);
  const out: GeneratedExercise[] = [];
  const vocabLemmas = new Set(unit.vocab.map((v) => v.lemma_fr.toLowerCase()));

  // Vocab MC, both directions — distractors drawn from the rest of the vocab.
  for (const v of shuffle(unit.vocab, rng).slice(0, BUDGET.mcEnFr)) {
    out.push(generateVocabMc(v, unit.vocab, rng));
  }
  for (const v of shuffle(unit.vocab, rng).slice(0, BUDGET.mcFrEn)) {
    out.push(generateVocabMcReverse(v, unit.vocab, rng));
  }

  // Match: up to two groups of 5 from the vocab.
  const matchPool = shuffle(unit.vocab, rng);
  for (
    let i = 0, groups = 0;
    i + CONFIG.matchGroupSize <= matchPool.length && groups < BUDGET.matchGroups;
    i += CONFIG.matchGroupSize, groups++
  ) {
    out.push(generateMatch(matchPool.slice(i, i + CONFIG.matchGroupSize)));
  }

  // Sentence-based production types, each from its own shuffle.
  const take = (n: number): SentenceDef[] => shuffle(unit.sentences, rng).slice(0, n);
  for (const s of take(BUDGET.cloze)) {
    const cloze = makeCloze(s, vocabLemmas, rng);
    if (cloze) out.push(cloze);
  }
  for (const s of take(BUDGET.typed)) out.push(makeTypedTranslation(s));
  for (const s of take(BUDGET.wordOrder)) out.push(makeWordOrder(s));
  for (const s of take(BUDGET.dictation)) out.push(makeListeningDictation(s));

  // Prepend any hand-authored exercises so they take priority in ordering.
  const authored: GeneratedExercise[] = (unit.exercises ?? []).map((e) => ({
    type: e.type,
    direction: e.direction ?? null,
    prompt: e.prompt,
    answer: e.answer,
    accepted_alternatives: e.accepted_alternatives ?? null,
    distractors: e.distractors ?? null,
    sentence_fr: e.sentence_fr ?? null,
    vocab_lemma: null,
  }));

  return [...authored, ...out];
}
