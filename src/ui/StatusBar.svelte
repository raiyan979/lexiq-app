<script lang="ts">
  /*
   * Top status bar (§6): left = current view title, right = live status line.
   * Values come from the reactive `stats` store (app_state + review queue) and
   * refresh whenever progress changes. Format:
   *   streak 7d · due 42 · new 12/15 · 320 XP
   */
  import { stats } from './stats.svelte';

  interface Props {
    title: string;
  }
  let { title }: Props = $props();

  // Load the real figures once the shell mounts; grading refreshes them after.
  $effect(() => {
    void stats.refresh();
  });
</script>

<header class="statusbar">
  <div class="view-title">{title}</div>
  <div class="status mono" aria-label="Study status">
    <span>streak {stats.streakDays}d</span>
    <span class="sep">·</span>
    <span>due {stats.due}</span>
    <span class="sep">·</span>
    <span>new {stats.newDone}/{stats.newTarget}</span>
    <span class="sep">·</span>
    <span class="xp">{stats.xp} XP</span>
  </div>
</header>

<style>
  .statusbar {
    height: var(--statusbar-height);
    flex: 0 0 var(--statusbar-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-5);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .view-title {
    font-weight: 600;
    font-size: 15px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-dim);
  }
  /* Accent only on the values, sparingly (§7). */
  .status .xp {
    color: var(--accent-text);
  }
  .sep {
    opacity: 0.5;
  }
  /* Phones: clear the notch, tighten spacing, and shrink the status line so the
   * full streak/due/new/XP figures still fit a ~360px width. */
  @media (max-width: 640px) {
    /* Stack the title over the status line: on a phone width the two don't fit
     * comfortably side by side, and cramming them reads as cluttered. */
    .statusbar {
      flex: 0 0 auto;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 3px;
      height: auto;
      padding: var(--space-3) var(--space-4);
      padding-top: calc(var(--space-3) + env(safe-area-inset-top, 0px));
    }
    .view-title {
      font-size: 18px;
    }
    .status {
      font-size: 13px;
      gap: 8px;
    }
  }
</style>
