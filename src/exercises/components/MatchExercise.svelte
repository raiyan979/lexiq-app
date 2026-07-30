<script lang="ts">
  import type { Session } from '../session.svelte';
  import type { MatchView } from '../model';
  import { normalizeText } from '../graders';

  interface Props {
    session: Session;
    view: MatchView;
    disabled: boolean;
  }
  let { session, view, disabled }: Props = $props();

  // Tap-to-connect matching (replaces a native <select> per row, which triggered
  // the clunky OS picker on mobile): tap a French word to focus it, then tap its
  // English translation from the pool below. Matching is 1:1 — each English chip
  // is used once and returns to the pool if you re-pick a row.
  // The French word currently focused. A writable $derived: it resets to the
  // first word whenever `view` changes (new exercise — the session also resets
  // `mapping` then), but the `active = …` assignments in focusRow/pick persist
  // through the current exercise.
  let active = $derived<string | null>(view.leftFr[0] ?? null);

  function expectedEn(fr: string): string {
    return view.pairs.find((p) => p.fr === fr)?.en ?? '';
  }

  // English options not yet assigned to any French word.
  const remaining = $derived.by(() => {
    const taken = new Set(Object.values(session.mapping));
    return view.rightEn.filter((en) => !taken.has(en));
  });

  function rowClass(fr: string): string {
    if (disabled) {
      const chosen = session.mapping[fr];
      if (chosen === undefined) return 'wrong';
      return normalizeText(chosen) === normalizeText(expectedEn(fr)) ? 'correct' : 'wrong';
    }
    if (fr === active) return 'active';
    return session.mapping[fr] !== undefined ? 'filled' : '';
  }

  function focusRow(fr: string): void {
    if (disabled) return;
    // Re-selecting a filled row frees its English back into the pool.
    if (session.mapping[fr] !== undefined) delete session.mapping[fr];
    active = fr;
  }

  function pick(en: string): void {
    if (disabled || active === null) return;
    session.mapping[active] = en;
    // Auto-advance to the next unmatched word for quick tapping.
    active = view.leftFr.find((fr) => session.mapping[fr] === undefined) ?? null;
  }
</script>

<p class="prompt-label mono">{view.prompt}</p>
{#if !disabled}
  <p class="hint">Tap a word, then tap its English match below.</p>
{/if}

<div class="rows">
  {#each view.leftFr as fr (fr)}
    <button type="button" class="row {rowClass(fr)}" {disabled} aria-pressed={fr === active} onclick={() => focusRow(fr)}>
      <span class="fr">{fr}</span>
      <span class="slot" class:empty={session.mapping[fr] === undefined}>{session.mapping[fr] ?? 'Tap to match'}</span>
    </button>
  {/each}
</div>

{#if !disabled}
  <div class="pool" aria-label="English options">
    {#each remaining as en (en)}
      <button type="button" class="chip" onclick={() => pick(en)}>{en}</button>
    {/each}
    {#if remaining.length === 0}
      <span class="pool-done mono">All matched — tap Check.</span>
    {/if}
  </div>
{/if}

<style>
  .prompt-label {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-2);
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-4);
  }
  .rows {
    display: grid;
    gap: var(--space-2);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3);
    align-items: center;
    text-align: left;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
  }
  .row:disabled {
    cursor: default;
  }
  .row.active {
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
  .row.filled {
    border-color: var(--accent-dim);
  }
  .row.correct {
    border-color: var(--success);
  }
  .row.wrong {
    border-color: var(--error);
  }
  .fr {
    font-size: var(--reading-size);
    font-weight: 600;
  }
  .slot {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-text);
    text-align: right;
  }
  .slot.empty {
    color: var(--text-dim);
    font-weight: 400;
    font-style: italic;
  }
  .pool {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  .chip {
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .chip:active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .pool-done {
    color: var(--text-dim);
    font-size: 13px;
    align-self: center;
  }
</style>
