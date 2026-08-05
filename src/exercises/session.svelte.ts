/*
 * Practice-session state machine (brief §7/§8). Drives one focused loop over a
 * unit's exercises: answer → check (pure grader) → feedback + FSRS rating →
 * next. DB and scheduler live behind db/queries + scheduler/*; this class holds
 * the reactive UI state and the flow, so Session.svelte stays presentational.
 */

import {
  getExercisesForUnit,
  getCardByItem,
  getSetting,
  markUnitStarted,
  markUnitCompleted,
} from '../db/queries';
import { parseExercise, type ExerciseView } from './model';
import {
  gradeMc,
  gradeCloze,
  gradeTypedTranslation,
  gradeListeningDictation,
  gradeWordOrder,
  gradeMatch,
  type GradeResult,
} from './graders';
import {
  makeScheduler,
  deriveRating,
  GRADES,
  SCHEDULER_CONFIG,
  type IntervalPreview,
} from '../scheduler/fsrs';
import { gradeCard } from '../scheduler/queue';
import { onSessionComplete } from '../ads/ads';
import { stats } from '../ui/stats.svelte';
import type { CardRow } from '../db/types';
import type { Grade } from 'ts-fsrs';

export type Phase = 'loading' | 'resume' | 'answering' | 'feedback' | 'done' | 'empty';

/** Above this, a correct answer is treated as slow → suggests Hard (brief §5). */
const SLOW_MS = 25_000;

/** Score fraction that must be *exceeded* to complete a unit and unlock the next. */
const PASS_THRESHOLD = 0.4;

/**
 * The only types that require the keyboard. Everything else — multiple-choice
 * (including fill-the-blank shown as MC), matching, and word-order tiles — is
 * "tap-only" and is ordered ahead of these, so the opening questions never
 * require typing.
 */
const TYPING_TYPES = new Set(['cloze', 'typed_translation', 'listening_dictation']);

/** In-place-safe Fisher–Yates shuffle (new array); reshuffles every session. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Order a unit's exercises for one session: all tap-only questions first
 * (multiple-choice, MC fill-the-blank, matching, word-order tiles), then the
 * typed ones last. Each group is shuffled, so the early questions are always a
 * varied, no-typing mix and the order still changes every attempt.
 */
function orderForSession(views: ExerciseView[]): ExerciseView[] {
  const tapOnly = views.filter((v) => !TYPING_TYPES.has(v.type));
  const typing = views.filter((v) => TYPING_TYPES.has(v.type));
  return [...shuffled(tapOnly), ...shuffled(typing)];
}

/** localStorage key holding an in-progress session for a unit (for resume). */
function savedKey(unitId: number): string {
  return `lexiq.session.${unitId}`;
}

interface SavedSession {
  /** Exercise ids in the shuffled order they were presented. */
  orderIds: number[];
  /** Index of the question the learner was on (>= 1 to be worth resuming). */
  index: number;
  correctCount: number;
}

export class Session {
  phase = $state<Phase>('loading');
  index = $state(0);
  total = $state(0);
  correctCount = $state(0);

  /** Response holders, one per input style; reset between exercises. */
  mcChoice = $state<string | null>(null);
  text = $state('');
  /** word_order: the bank indices the user has placed, in order. */
  tokens = $state<number[]>([]);
  mapping = $state<Record<string, string>>({});

  /** Feedback state, populated by check(). */
  result = $state<GradeResult | null>(null);
  preview = $state<IntervalPreview[]>([]);
  suggested = $state<Grade | null>(null);

  /** Non-fatal error surfaced to the UI (e.g. a failed DB write on grading). */
  error = $state<string | null>(null);

  /** Set on completion if finishing this unit unlocked the next one. */
  unlockedUnitId = $state<number | null>(null);
  unlockedTitle = $state<string | null>(null);
  /** Whether the finished session cleared the pass bar (see PASS_THRESHOLD). */
  passed = $state(false);

  #views: ExerciseView[] = [];
  /** The unit's exercises as loaded (unordered); reordered per session/resume. */
  #loadedViews: ExerciseView[] = [];
  /** A recoverable in-progress session detected on load, pending the user's choice. */
  #saved: SavedSession | null = null;
  #card: CardRow | null = null;
  #retention: number = SCHEDULER_CONFIG.defaultRetention;
  #startedAt = 0;
  #unitId = 0;

  /** Percentage a learner must beat to advance (for the summary copy). */
  get passPercent(): number {
    return Math.round(PASS_THRESHOLD * 100);
  }

  get current(): ExerciseView | null {
    return this.#views[this.index] ?? null;
  }

  get hasCard(): boolean {
    return this.#card !== null;
  }

  async load(unitId: number): Promise<void> {
    this.phase = 'loading';
    this.#unitId = unitId;
    this.unlockedUnitId = null;
    this.unlockedTitle = null;
    this.passed = false;
    const rows = await getExercisesForUnit(unitId);
    this.#loadedViews = rows.map(parseExercise);
    const retentionSetting = await getSetting('target_retention');
    if (retentionSetting !== null) this.#retention = Number(retentionSetting);

    if (this.#loadedViews.length === 0) {
      this.total = 0;
      this.phase = 'empty';
      return;
    }
    // If a partly-finished session was saved, offer to resume instead of restart.
    this.#saved = this.#readSaved();
    if (this.#saved !== null) {
      this.phase = 'resume';
      return;
    }
    this.#startWith(orderForSession(this.#loadedViews), 0, 0);
  }

  /** Continue the saved in-progress session (same order + position). */
  resume(): void {
    const saved = this.#saved;
    if (saved === null) {
      this.startOver();
      return;
    }
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient local lookup, not reactive state
    const byId = new Map(this.#loadedViews.map((v) => [v.id, v]));
    const ordered = saved.orderIds
      .map((id) => byId.get(id))
      .filter((v): v is ExerciseView => v !== undefined);
    // Guard against content having changed under the saved session.
    if (ordered.length !== this.#loadedViews.length) {
      this.startOver();
      return;
    }
    const index = Math.min(saved.index, ordered.length - 1);
    this.#startWith(ordered, index, saved.correctCount);
  }

  /** Discard any saved progress and start a fresh, reshuffled session. */
  startOver(): void {
    this.#clearSaved();
    this.#startWith(orderForSession(this.#loadedViews), 0, 0);
  }

  #startWith(views: ExerciseView[], index: number, correctCount: number): void {
    this.#views = views;
    this.total = views.length;
    this.index = index;
    this.correctCount = correctCount;
    // Best-effort: mark the unit started (available → in_progress).
    void markUnitStarted(this.#unitId).catch(() => {});
    this.#beginExercise();
  }

  #readSaved(): SavedSession | null {
    try {
      const raw = localStorage.getItem(savedKey(this.#unitId));
      if (raw === null) return null;
      const s = JSON.parse(raw) as SavedSession;
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient local set, not reactive state
      const ids = new Set(this.#loadedViews.map((v) => v.id));
      const sameSet =
        Array.isArray(s.orderIds) &&
        s.orderIds.length === ids.size &&
        s.orderIds.every((id) => ids.has(id));
      // Only worth resuming from the second question onward.
      if (!sameSet || typeof s.index !== 'number' || s.index < 1) return null;
      return s;
    } catch {
      return null;
    }
  }

  #writeSaved(): void {
    if (this.index < 1) return; // nothing meaningful to resume yet
    try {
      const saved: SavedSession = {
        orderIds: this.#views.map((v) => v.id),
        index: this.index,
        correctCount: this.correctCount,
      };
      localStorage.setItem(savedKey(this.#unitId), JSON.stringify(saved));
    } catch {
      /* storage full/unavailable — resume is best-effort */
    }
  }

  #clearSaved(): void {
    try {
      localStorage.removeItem(savedKey(this.#unitId));
    } catch {
      /* best-effort */
    }
    this.#saved = null;
  }

  #beginExercise(): void {
    this.mcChoice = null;
    this.text = '';
    this.tokens = [];
    this.mapping = {};
    this.result = null;
    this.preview = [];
    this.suggested = null;
    this.#card = null;
    this.#startedAt = Date.now();
    this.phase = 'answering';
    // Persist position so an accidental exit can be resumed (from Q2 onward).
    this.#writeSaved();
  }

  /** Whether the current response is complete enough to check. */
  get canCheck(): boolean {
    const c = this.current;
    if (c === null) return false;
    switch (c.type) {
      case 'mc':
        return this.mcChoice !== null;
      case 'cloze':
      case 'typed_translation':
      case 'listening_dictation':
        return this.text.trim().length > 0;
      case 'word_order':
        return this.tokens.length > 0;
      case 'match':
        return c.pairs.every((p) => this.mapping[p.fr] !== undefined);
    }
  }

  async check(): Promise<void> {
    const c = this.current;
    if (c === null || this.phase !== 'answering') return;

    let result: GradeResult;
    switch (c.type) {
      case 'mc':
        result = gradeMc(c.answer, this.mcChoice ?? '');
        break;
      case 'cloze':
        result = gradeCloze(c.answer, c.accepted, this.text);
        break;
      case 'typed_translation':
        result = gradeTypedTranslation(c.answer, c.accepted, this.text);
        break;
      case 'listening_dictation':
        result = gradeListeningDictation(c.answer, c.accepted, this.text);
        break;
      case 'word_order':
        result = gradeWordOrder(
          c.answer,
          c.accepted,
          this.tokens.map((i) => c.bank[i] ?? ''),
        );
        break;
      case 'match':
        result = gradeMatch(c.pairs, this.mapping);
        break;
    }

    this.result = result;
    if (result.correct) this.correctCount++;

    try {
      // Load the linked card (if any) to schedule + preview intervals.
      this.#card =
        c.vocabId !== null
          ? await getCardByItem('vocab', c.vocabId)
          : c.sentenceId !== null
            ? await getCardByItem('sentence', c.sentenceId)
            : null;

      if (this.#card !== null) {
        const elapsed = Date.now() - this.#startedAt;
        const scheduler = makeScheduler(this.#retention);
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient clock value passed to a pure fn, not stored reactive state
        this.preview = scheduler.previewIntervals(this.#card, new Date());
        this.suggested = deriveRating({
          correct: result.correct,
          usedHint: false,
          slow: result.correct && elapsed > SLOW_MS,
        });
      }
    } catch (e) {
      // Card lookup/preview failed — still show feedback, just without ratings.
      this.error = e instanceof Error ? e.message : String(e);
      this.#card = null;
    }
    this.phase = 'feedback';
  }

  /** Apply an FSRS grade to the linked card, then advance. */
  async rate(grade: Grade): Promise<void> {
    if (this.#card !== null) {
      try {
        await gradeCard(this.#card.id, grade, Date.now() - this.#startedAt);
        void stats.refresh(); // update the live status bar (XP, due, streak)
      } catch (e) {
        // Never hang silently: show what failed and let the user retry/skip.
        this.error = e instanceof Error ? e.message : String(e);
        return;
      }
    }
    this.error = null;
    this.#advance();
  }

  /**
   * Practice flow: apply the auto-derived rating (from correctness + speed) and
   * advance. Keeps FSRS scheduling working without asking the learner to
   * self-rate — the single "Next" button in practice calls this. Falls back to
   * Good when there's no linked card (rate() then just advances).
   */
  async next(): Promise<void> {
    await this.rate(this.suggested ?? GRADES[2]!);
  }

  /** Advance without scheduling (used to skip past a failed grade write). */
  skip(): void {
    this.error = null;
    this.#advance();
  }

  /** Advance past an exercise that has no card to schedule. */
  continue(): void {
    this.#advance();
  }

  #advance(): void {
    if (this.index + 1 >= this.total) {
      // The session is over: clear the resume checkpoint and gate completion on
      // the pass bar. Falling short leaves the next unit locked — the learner
      // redoes the whole set (see Session.svelte's summary).
      this.#clearSaved();
      this.passed = this.total > 0 && this.correctCount / this.total > PASS_THRESHOLD;
      this.phase = 'done';
      // Session boundary: maybe show an interstitial (Android + online + flag on;
      // no-op otherwise). Never fires mid-lesson — only here, at the summary.
      void onSessionComplete();
      if (this.passed) void this.#complete();
      return;
    }
    this.index++;
    this.#beginExercise();
  }

  /** On passing: mark the unit complete and unlock the next (best-effort). */
  async #complete(): Promise<void> {
    try {
      const result = await markUnitCompleted(this.#unitId);
      this.unlockedUnitId = result.unlockedUnitId;
      this.unlockedTitle = result.unlockedTitle;
    } catch {
      // Progress writeback is non-critical to showing the summary.
    }
  }

  // --- word_order helpers (track used bank indices, in placement order) ---
  addToken(bankIndex: number): void {
    if (!this.tokens.includes(bankIndex)) this.tokens = [...this.tokens, bankIndex];
  }
  removeToken(slot: number): void {
    this.tokens = this.tokens.filter((_, i) => i !== slot);
  }
}
