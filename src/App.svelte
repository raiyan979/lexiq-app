<script lang="ts">
  // Importing the theme store runs its initializer, which stamps data-theme on
  // <html> before the shell paints (avoids a flash of the wrong theme).
  import './ui/theme.svelte';
  // Importing prefs stamps data-font on <html> before paint (font size + audio).
  import './ui/prefs.svelte';
  import { audience } from './ui/audience.svelte';
  import Onboarding from './ui/Onboarding.svelte';
  import Shell from './ui/Shell.svelte';
  import { preloadInterstitial } from './ads/ads';

  // Warm up an interstitial so the first session-complete boundary has one
  // ready. No-op unless ads are enabled + Android + online.
  void preloadInterstitial();
</script>

{#if audience.onboarded}
  <Shell />
{:else}
  <Onboarding />
{/if}
