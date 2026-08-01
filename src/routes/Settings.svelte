<script lang="ts">
  import { themeStore, type Theme } from '../ui/theme.svelte';
  import { prefs, type FontSize } from '../ui/prefs.svelte';
  import { audience, type Audience } from '../ui/audience.svelte';
  import { getSetting, setSetting, resetProgress } from '../db/queries';
  import { stats } from '../ui/stats.svelte';
  import { navigate } from '../ui/router.svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { openUrl } from '@tauri-apps/plugin-opener';

  // App version for the About section, read from the Tauri build (tauri.conf.json).
  // Falls back to a static string in a plain browser preview where the API is absent.
  let appVersion = $state('0.1.0');
  void getVersion()
    .then((v) => (appVersion = v))
    .catch(() => {
      /* not running under Tauri (dev preview) */
    });

  // Study settings live in the DB (the scheduler reads them); load current values.
  let newCards = $state(15);
  let retention = $state('0.9');
  let loaded = $state(false);
  let dbError = $state<string | null>(null);

  void (async () => {
    try {
      const nc = await getSetting('new_cards_per_day');
      const tr = await getSetting('target_retention');
      if (nc !== null) newCards = Number(nc);
      if (tr !== null) retention = tr;
      loaded = true;
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Settings unavailable (database not loaded).';
    }
  })();

  const THEMES: { value: Theme; label: string }[] = [
    { value: 'amber', label: 'Amber' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];
  const FONTS: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];
  const AUDIENCES: { value: Audience; label: string }[] = [
    { value: 'adult', label: 'Adult' },
    { value: 'child', label: 'Child' },
  ];
  const RETENTIONS = ['0.8', '0.85', '0.9', '0.95'];

  // The in-context AI helper ships only once the app is monetised. Hidden from
  // the current (feedback / pre-Play-Store) build — flip to true to restore the
  // Settings card when the feature is ready.
  const SHOW_AI = false;

  async function saveNewCards(v: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    newCards = clamped;
    await setSetting('new_cards_per_day', String(clamped));
    void stats.refresh(); // status bar shows the new/day target
  }

  async function saveRetention(v: string): Promise<void> {
    retention = v;
    await setSetting('target_retention', v);
  }

  // --- Feedback: opens a hosted form (no personal contact exposed); capped/month.
  // TODO: paste the real Google Form share link here; the card shows itself once
  // this is no longer the placeholder (see FEEDBACK_READY).
  const FEEDBACK_FORM_URL = 'https://forms.gle/REPLACE_ME';
  const FEEDBACK_READY = !FEEDBACK_FORM_URL.includes('REPLACE_ME');
  const FEEDBACK_MONTHLY_CAP = 4;
  const FEEDBACK_KEY = 'lexiq.feedback';

  function currentMonth(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }
  function readFeedbackCount(): number {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      if (raw === null) return 0;
      const v = JSON.parse(raw) as { month: string; count: number };
      return v.month === currentMonth() ? v.count : 0;
    } catch {
      return 0;
    }
  }

  let feedbackBusy = $state(false);
  let feedbackError = $state<string | null>(null);
  let feedbackUsed = $state(readFeedbackCount());
  const feedbackLeft = $derived(Math.max(0, FEEDBACK_MONTHLY_CAP - feedbackUsed));

  async function openFeedbackForm(): Promise<void> {
    if (feedbackLeft <= 0) return;
    feedbackBusy = true;
    feedbackError = null;
    try {
      await openUrl(FEEDBACK_FORM_URL);
      feedbackUsed = readFeedbackCount() + 1;
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ month: currentMonth(), count: feedbackUsed }));
    } catch {
      feedbackError = "Couldn't open the feedback form. Please check your connection and try again.";
    } finally {
      feedbackBusy = false;
    }
  }

  // Reset is destructive, so gate it behind an explicit confirm step.
  let confirmingReset = $state(false);
  let resetting = $state(false);
  let resetDone = $state(false);

  async function doReset(): Promise<void> {
    resetting = true;
    try {
      await resetProgress();
      void stats.refresh();
      resetDone = true;
      confirmingReset = false;
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Reset failed.';
    } finally {
      resetting = false;
    }
  }
</script>

<section class="view">
  <h1>Settings</h1>
  <p class="sub">Preferences are saved automatically.</p>

  <!-- Appearance -->
  <div class="card">
    <h2>Appearance</h2>
    <div class="row">
      <div class="label">
        <span class="name">Theme</span>
        <span class="hint">Colour scheme for the app.</span>
      </div>
      <div class="seg">
        {#each THEMES as t (t.value)}
          <button
            type="button"
            class="seg-btn"
            class:active={themeStore.theme === t.value}
            onclick={() => themeStore.set(t.value)}
          >{t.label}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <div class="label">
        <span class="name">Font size</span>
        <span class="hint">Reading text size across the app.</span>
      </div>
      <div class="seg">
        {#each FONTS as f (f.value)}
          <button
            type="button"
            class="seg-btn"
            class:active={prefs.fontSize === f.value}
            onclick={() => prefs.setFontSize(f.value)}
          >{f.label}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <div class="label">
        <span class="name">Reading level</span>
        <span class="hint">Child mode uses simpler chapter names. French stays the same.</span>
      </div>
      <div class="seg">
        {#each AUDIENCES as a (a.value)}
          <button
            type="button"
            class="seg-btn"
            class:active={audience.current === a.value}
            onclick={() => audience.set(a.value)}
          >{a.label}</button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Study -->
  <div class="card">
    <h2>Study</h2>
    {#if dbError}
      <p class="note">{dbError}</p>
    {:else if !loaded}
      <p class="note mono">Loading…</p>
    {:else}
      <div class="row">
        <div class="label">
          <span class="name">New cards per day</span>
          <span class="hint">How many new items to introduce daily.</span>
        </div>
        <input
          class="num mono"
          type="number"
          min="0"
          max="100"
          value={newCards}
          onchange={(e) => saveNewCards(Number(e.currentTarget.value))}
        />
      </div>
      <div class="row">
        <div class="label">
          <span class="name">Target retention</span>
          <span class="hint">Higher means more frequent reviews.</span>
        </div>
        <select class="select mono" value={retention} onchange={(e) => saveRetention(e.currentTarget.value)}>
          {#each RETENTIONS as r (r)}
            <option value={r}>{Math.round(Number(r) * 100)}%</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="row">
      <div class="label">
        <span class="name">Audio</span>
        <span class="hint">Play pronunciation clips automatically.</span>
      </div>
      <button
        type="button"
        class="toggle"
        class:on={prefs.audioEnabled}
        role="switch"
        aria-label="Audio"
        aria-checked={prefs.audioEnabled}
        onclick={() => prefs.setAudioEnabled(!prefs.audioEnabled)}
      >
        <span class="knob"></span>
      </button>
    </div>
  </div>

  <!-- AI (stub) — hidden until the feature ships; see SHOW_AI above. -->
  {#if SHOW_AI}
    <div class="card">
      <h2>AI assistant</h2>
      <div class="row">
        <div class="label">
          <span class="name">Explain-in-context <span class="badge mono">Coming soon</span></span>
          <span class="hint">An optional local AI helper. Disabled in this build.</span>
        </div>
        <button type="button" class="toggle" disabled aria-label="AI assistant" aria-checked="false" role="switch">
          <span class="knob"></span>
        </button>
      </div>
    </div>
  {/if}

  <!-- Data -->
  <div class="card danger">
    <h2>Data</h2>
    <div class="row">
      <div class="label">
        <span class="name">Reset progress</span>
        <span class="hint">Clears all reviews, streak, XP and unit unlocks. Content stays. Cannot be undone.</span>
      </div>
      {#if resetDone}
        <span class="done mono">Progress reset ✓</span>
      {:else if confirmingReset}
        <div class="confirm">
          <button type="button" class="btn danger-btn" disabled={resetting} onclick={doReset}>
            {resetting ? 'Resetting…' : 'Confirm reset'}
          </button>
          <button type="button" class="btn" disabled={resetting} onclick={() => (confirmingReset = false)}>
            Cancel
          </button>
        </div>
      {:else}
        <button type="button" class="btn" onclick={() => (confirmingReset = true)}>Reset…</button>
      {/if}
    </div>
    {#if resetDone}
      <div class="row">
        <button type="button" class="btn" onclick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    {/if}
  </div>

  <!-- Feedback — hidden until a real form link is configured (FEEDBACK_READY). -->
  {#if FEEDBACK_READY}
  <div class="card">
    <h2>Feedback</h2>
    <div class="row">
      <div class="label">
        <span class="name">Share feedback</span>
        <span class="hint">
          Found a bug or have an idea? Open the quick form — it takes a minute.
          {feedbackLeft} of {FEEDBACK_MONTHLY_CAP} left this month.
        </span>
      </div>
      <button
        type="button"
        class="btn primary"
        disabled={feedbackBusy || feedbackLeft <= 0}
        onclick={openFeedbackForm}
      >
        {feedbackLeft <= 0 ? 'Limit reached' : feedbackBusy ? 'Opening…' : 'Open form'}
      </button>
    </div>
    {#if feedbackError}
      <div class="row"><span class="fb-err">{feedbackError}</span></div>
    {/if}
  </div>
  {/if}

  <!-- About -->
  <div class="card">
    <h2>About</h2>
    <div class="row">
      <div class="label">
        <span class="name">Croqui <span class="badge mono">v{appVersion}</span></span>
        <span class="hint">Learn French offline, at your own pace.</span>
      </div>
    </div>
    <div class="row">
      <div class="label">
        <span class="name">Made by Raiyan Mirza</span>
        <span class="hint">An offline-first French course — A1 to B1, built for the phone.</span>
      </div>
    </div>
    <div class="row">
      <div class="label">
        <span class="name">Privacy &amp; Terms</span>
        <span class="hint">How your data is handled (it stays on your device) and terms of use.</span>
      </div>
      <button type="button" class="btn" onclick={() => navigate('/legal')}>View</button>
    </div>
  </div>
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  h1 {
    font-size: 28px;
    margin-bottom: var(--space-2);
  }
  .sub {
    color: var(--text-dim);
    margin-bottom: var(--space-6);
  }
  .note {
    color: var(--text-dim);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
    margin-bottom: var(--space-4);
  }
  .card.danger {
    border-color: var(--error);
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: var(--space-4);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--border);
  }
  .row:first-of-type {
    border-top: none;
  }
  .label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    color: var(--text);
    font-size: var(--reading-size);
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
  }
  .badge {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent-text);
    border: 1px solid var(--accent-dim);
    border-radius: 999px;
    padding: 1px var(--space-2);
    margin-left: var(--space-2);
  }
  /* Segmented control */
  .seg {
    display: inline-flex;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    padding: 2px;
    flex-shrink: 0;
  }
  .seg-btn {
    padding: var(--space-2) var(--space-4);
    font-size: 14px;
    color: var(--text-dim);
    background: transparent;
    border: none;
    border-radius: calc(var(--radius-button) - 2px);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .seg-btn.active {
    color: var(--on-accent);
    background: var(--accent);
    font-weight: 600;
  }
  .seg-btn:not(.active):hover {
    color: var(--text);
  }
  .num,
  .select {
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    padding: var(--space-2) var(--space-3);
    font-size: 14px;
    flex-shrink: 0;
  }
  .num {
    width: 72px;
    text-align: right;
  }
  .num:focus,
  .select:focus {
    outline: none;
    border-color: var(--accent);
  }
  /* Toggle switch */
  .toggle {
    width: 44px;
    height: 24px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }
  .toggle.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .toggle .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--text);
    transition: transform var(--transition-fast);
  }
  .toggle.on .knob {
    transform: translateX(20px);
    background: var(--on-accent);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    font-size: 14px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: border-color var(--transition-fast);
    flex-shrink: 0;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .danger-btn {
    color: var(--on-accent);
    background: var(--error);
    border-color: var(--error);
    font-weight: 600;
  }
  .btn.primary {
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
    font-weight: 600;
  }
  .fb-err {
    color: var(--error);
    font-size: 13px;
  }
  .confirm {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .done {
    color: var(--success);
    font-size: 14px;
    flex-shrink: 0;
  }
  /* Phones: the side-by-side label/control layout squeezes the description text
   * into a narrow, many-line column. Stack them so the hint gets the full width
   * and the control sits comfortably beneath it. */
  @media (max-width: 640px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    .seg {
      width: 100%;
    }
    .seg-btn {
      flex: 1;
      text-align: center;
    }
    .num,
    .select,
    .btn,
    .toggle {
      align-self: flex-start;
    }
    .confirm {
      align-self: flex-start;
    }
  }
</style>
