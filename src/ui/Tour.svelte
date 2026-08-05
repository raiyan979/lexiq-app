<script lang="ts">
  /*
   * First-run guided tour. Walks the learner through the main sections with a
   * spotlight + a bubble + an arrow pointing at each nav destination, with
   * Back / Next / Skip controls. Targets are located by the `data-tour` path
   * attribute on the nav items, picking whichever instance is actually visible
   * (sidebar on tablet/desktop, bottom bar on phone), so it works in both
   * layouts and repositions on resize.
   */
  import { onMount } from 'svelte';
  import { tour } from './tourState.svelte';

  interface Step {
    path: string;
    title: string;
    body: string;
  }

  // One step per primary destination, in nav order.
  const steps: Step[] = [
    {
      path: '/',
      title: 'Welcome to Croqui! 👋',
      body: 'This is your Dashboard — your daily progress, streak, and what to learn next, all in one place.',
    },
    {
      path: '/learn',
      title: 'Learn',
      body: 'All the chapters live here. Tap one to start its lessons and exercises.',
    },
    {
      path: '/review',
      title: 'Review',
      body: 'Practice words you’ve learned. Croqui brings them back right before you’d forget.',
    },
    {
      path: '/library',
      title: 'Library',
      body: 'Browse every word and sentence — tap any of them to hear it spoken.',
    },
    {
      path: '/stats',
      title: 'Stats',
      body: 'Track your progress: words learned, accuracy, and your streak over time.',
    },
    {
      path: '/settings',
      title: 'Settings',
      body: 'Theme, audio, text size, and privacy — adjust everything here. You can replay this tour from here too.',
    },
  ];

  let stepIndex = $state(0);
  const step = $derived(steps[stepIndex]!);
  const isLast = $derived(stepIndex === steps.length - 1);

  // Target rectangle + chosen bubble placement, recomputed per step / resize.
  let rect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let place = $state<'right' | 'top'>('top');

  const PAD = 6; // spotlight padding around the target
  const GAP = 14; // gap between target and bubble
  const BW = 260; // bubble width (matches CSS max-width)

  function locate(): void {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tour="${step.path}"]`),
    );
    // Pick the visible instance (the hidden nav has a zero-size rect).
    const el = nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!el) {
      rect = null;
      return;
    }
    const r = el.getBoundingClientRect();
    rect = { top: r.top, left: r.left, width: r.width, height: r.height };
    // Distinguish by vertical position first: a bottom-nav tab sits near the
    // bottom of the screen → bubble above it. Otherwise it's a left-rail sidebar
    // item → bubble to the right (if there's room), else above.
    const nearBottom = r.bottom > window.innerHeight - 120;
    const roomRight = r.left < window.innerWidth * 0.4 && r.right + BW + GAP < window.innerWidth;
    place = !nearBottom && roomRight ? 'right' : 'top';
  }

  // Reposition whenever the step changes.
  $effect(() => {
    void stepIndex;
    locate();
  });

  onMount(() => {
    locate();
    const onResize = (): void => locate();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  });

  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

  // Four dim panels around the target form the spotlight cutout — much cheaper
  // and more reliable to render than a single huge box-shadow.
  const mask = $derived.by(() => {
    if (!rect) return null;
    const x = rect.left - PAD;
    const y = rect.top - PAD;
    const w = rect.width + PAD * 2;
    const h = rect.height + PAD * 2;
    return {
      top: `top:0;left:0;right:0;height:${Math.max(0, y)}px;`,
      bottom: `top:${y + h}px;left:0;right:0;bottom:0;`,
      left: `top:${y}px;left:0;width:${Math.max(0, x)}px;height:${h}px;`,
      right: `top:${y}px;left:${x + w}px;right:0;height:${h}px;`,
      ring: `top:${y}px;left:${x}px;width:${w}px;height:${h}px;`,
    };
  });

  const bubbleStyle = $derived.by(() => {
    if (!rect) {
      // Centered fallback if the target can't be found.
      return `left:50%;top:50%;transform:translate(-50%,-50%);`;
    }
    if (place === 'right') {
      const top = clamp(rect.top - 8, 12, window.innerHeight - 200);
      return `left:${rect.left + rect.width + GAP}px;top:${top}px;`;
    }
    const center = rect.left + rect.width / 2;
    const left = clamp(center - BW / 2, 12, window.innerWidth - BW - 12);
    const bottom = window.innerHeight - rect.top + GAP;
    return `left:${left}px;bottom:${bottom}px;`;
  });

  const arrowStyle = $derived.by(() => {
    if (!rect) return 'display:none;';
    if (place === 'right') {
      const top = clamp(rect.top - 8, 12, window.innerHeight - 200);
      const y = rect.top + rect.height / 2 - top;
      return `left:-6px;top:${y - 6}px;`;
    }
    const center = rect.left + rect.width / 2;
    const left = clamp(center - BW / 2, 12, window.innerWidth - BW - 12);
    const x = center - left;
    return `bottom:-6px;left:${x - 6}px;`;
  });

  function next(): void {
    if (isLast) tour.finish();
    else stepIndex += 1;
  }
  function back(): void {
    if (stepIndex > 0) stepIndex -= 1;
  }
  function skip(): void {
    tour.finish();
  }
</script>

<div class="tour" role="dialog" aria-modal="true" aria-label="App tour">
  {#if mask}
    <div class="dim" style={mask.top}></div>
    <div class="dim" style={mask.bottom}></div>
    <div class="dim" style={mask.left}></div>
    <div class="dim" style={mask.right}></div>
    <div class="ring" style={mask.ring}></div>
  {:else}
    <div class="dim" style="inset:0;"></div>
  {/if}

  <div class="bubble" class:place-right={place === 'right'} class:place-top={place === 'top'} style={bubbleStyle}>
    <div class="arrow" style={arrowStyle}></div>
    <p class="count mono">{stepIndex + 1} / {steps.length}</p>
    <h2 class="title">{step.title}</h2>
    <p class="body">{step.body}</p>
    <div class="actions">
      <button type="button" class="skip mono" onclick={skip}>Skip</button>
      <div class="right">
        {#if stepIndex > 0}
          <button type="button" class="btn ghost mono" onclick={back}>Back</button>
        {/if}
        <button type="button" class="btn primary mono" onclick={next}>
          {isLast ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }
  /* Dim panels around the target, leaving the target area bright. pointer-events
   * are none (purely visual); the .tour container still blocks clicks. */
  .dim {
    position: fixed;
    background: oklch(0 0 0 / 0.6);
    pointer-events: none;
  }
  .ring {
    position: fixed;
    border-radius: 10px;
    border: 2px solid var(--accent);
    pointer-events: none;
    transition:
      top 0.25s ease,
      left 0.25s ease,
      width 0.25s ease,
      height 0.25s ease;
  }

  .bubble {
    position: fixed;
    width: min(260px, calc(100vw - 24px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card, 14px);
    padding: var(--space-4);
    box-shadow: 0 8px 30px oklch(0 0 0 / 0.25);
  }
  .arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    /* Show only the two edges facing the target. */
    transform: rotate(45deg);
  }
  .place-right .arrow {
    border-right: none;
    border-top: none;
  }
  .place-top .arrow {
    border-left: none;
    border-top: none;
  }

  .count {
    color: var(--text-dim);
    font-size: 12px;
    margin: 0 0 var(--space-1);
  }
  .title {
    font-size: 17px;
    font-weight: 800;
    margin: 0 0 var(--space-2);
    color: var(--text);
  }
  .body {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-dim);
    margin: 0 0 var(--space-4);
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .right {
    display: flex;
    gap: var(--space-2);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-button);
    border: 1px solid transparent;
    font-weight: 700;
    cursor: pointer;
  }
  .btn.primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .btn.ghost {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
  }
  .skip {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: var(--space-2);
  }
  .skip:hover {
    color: var(--text);
  }
</style>
