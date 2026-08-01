<script lang="ts">
  /*
   * Renders French text that plays its pronunciation clip when tapped. Used
   * alongside the speaker button so the whole word/sentence is a tap target too
   * (brief feedback: "make the audio start when I tap the word/sentence"). Falls
   * back to a plain span when there's no clip, so it's always safe to use.
   */
  import type { Snippet } from 'svelte';
  import { playClip } from './audio';

  interface Props {
    /** DB audio_path (e.g. "audio/xxx.mp3"), or null when no clip exists. */
    src: string | null;
    label?: string;
    children: Snippet;
  }
  let { src, label = 'Tap to hear', children }: Props = $props();

  function play(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (src) void playClip(src);
  }
</script>

{#if src}
  <button type="button" class="audio-text" title={label} aria-label={label} onclick={play}>
    {@render children()}
  </button>
{:else}
  {@render children()}
{/if}

<style>
  /* A button that looks exactly like the surrounding text, so the tap target is
   * invisible; only the pointer cursor hints it's interactive. */
  .audio-text {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    text-align: inherit;
    cursor: pointer;
    display: inline;
    /* On tablet WebViews a tap on selectable text starts a text-selection
     * gesture instead of firing the click, so the word never plays. Treat the
     * word purely as a tap target: no selection, no long-press callout, and
     * fast-tap handling. */
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .audio-text:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 3px;
  }
</style>
