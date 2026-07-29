<script lang="ts">
  /*
   * Mobile primary navigation — a bottom tab bar shown in place of the sidebar
   * on narrow (phone) viewports. Mirrors the sidebar's nav logic; hidden on
   * desktop via the media query below. Rendered as a flex sibling under the
   * content so it never overlaps scrolling content.
   */
  import { navItems } from './routes';
  import type { IconName } from './Icon.svelte';
  import Icon from './Icon.svelte';
  import { router, navigate } from './router.svelte';

  const iconFor = (label: string): IconName => label.toLowerCase() as IconName;

  function isActive(path: string, current: string): boolean {
    if (path === '/') return current === '/';
    return current === path || current.startsWith(`${path}/`);
  }

  function go(event: MouseEvent, path: string): void {
    event.preventDefault();
    navigate(path);
  }
</script>

<nav class="bottom-nav" aria-label="Primary">
  {#each navItems as item (item.path)}
    {@const active = isActive(item.path, router.path)}
    <a
      href={`#${item.path}`}
      class="tab"
      class:active
      aria-current={active ? 'page' : undefined}
      onclick={(e) => go(e, item.path)}
    >
      <span class="tab-icon"><Icon name={iconFor(item.label)} /></span>
      <span class="tab-label">{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  /* Desktop: the sidebar handles nav, so this is hidden. */
  .bottom-nav {
    display: none;
  }
  @media (max-width: 640px) {
    .bottom-nav {
      display: flex;
      flex: 0 0 auto;
      background: var(--sidebar-bg);
      border-top: 1px solid var(--border);
      /* Clear the phone's home-indicator / gesture bar. */
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
  .tab {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 2px;
    min-height: 52px; /* comfortable tap target */
    color: var(--text-dim);
    transition: color var(--transition-fast);
  }
  .tab.active {
    color: var(--accent-text);
  }
  .tab-icon {
    display: inline-flex;
  }
  .tab-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
