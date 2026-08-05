<script lang="ts">
  import { navigate } from '../ui/router.svelte';
  import { APP_NAME } from '../config/constants';

  // Bump this whenever the wording below changes so users can see it's current.
  const LAST_UPDATED = '4 August 2026';
</script>

<section class="view">
  <button type="button" class="back" onclick={() => navigate('/settings')}>← Settings</button>
  <h1>Privacy & Terms</h1>
  <p class="sub">Last updated {LAST_UPDATED}</p>

  <!-- Privacy Policy -->
  <div class="card">
    <h2>Privacy Policy</h2>
    <p>
      {APP_NAME} is an offline app. It does <strong>not</strong> collect, store, or transmit any
      personal information.
    </p>
    <ul>
      <li><strong>No accounts.</strong> You never sign up or sign in. There is no login.</li>
      <li>
        <strong>Offline learning.</strong> {APP_NAME}'s course works fully offline. It has no
        accounts, analytics, or tracking, and it does not send your learning data to us or to anyone
        else.
      </li>
      <li>
        <strong>Ads.</strong> This version of {APP_NAME} shows no ads. If a future update adds ads,
        they will be non-personalized and appropriate for all ages, shown only while online — and
        this policy and the app's Play Data Safety details will be updated before any ad appears.
      </li>
      <li>
        <strong>Your data stays on your device.</strong> Your learning progress, streak, and settings
        are saved only in {APP_NAME}'s local storage on your device. We never see them.
      </li>
      <li>
        <strong>You are in control.</strong> You can erase your progress at any time from
        Settings → Data → Reset progress. Uninstalling the app removes all of its data from your
        device.
      </li>
      <li>
        <strong>Children's privacy.</strong> {APP_NAME} is built to be safe for all ages. It does not
        collect personal information, and any future ads will be limited to non-personalized,
        child-appropriate content.
      </li>
    </ul>
    <p class="fine">
      If a future version adds any feature that uses the internet, this policy will be updated and
      that feature will be clearly optional.
    </p>
  </div>

  <!-- Terms of Use -->
  <div class="card">
    <h2>Terms of Use</h2>
    <ul>
      <li>
        <strong>Personal use.</strong> {APP_NAME} is provided for your personal, non-commercial use
        to learn French.
      </li>
      <li>
        <strong>Content ownership.</strong> The course — lessons, vocabulary, example sentences, and
        audio — is created by Raiyan Mirza. Please don't copy, redistribute, or resell it.
      </li>
      <li>
        <strong>Provided "as is".</strong> {APP_NAME} is offered without warranty of any kind. While
        the course is prepared carefully, occasional errors are possible, and it is a learning aid
        rather than a guarantee of any result.
      </li>
      <li>
        <strong>Limitation of liability.</strong> To the extent permitted by law, the author is not
        liable for any loss arising from the use of the app.
      </li>
    </ul>
    <p class="fine">Made by Raiyan Mirza · {APP_NAME}</p>
  </div>
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .back {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 14px;
    cursor: pointer;
    padding: 0;
    margin-bottom: var(--space-4);
  }
  .back:hover {
    color: var(--text);
  }
  h1 {
    font-size: 28px;
    margin-bottom: var(--space-2);
  }
  .sub {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-6);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
    margin-bottom: var(--space-4);
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: var(--space-4);
  }
  p {
    color: var(--text);
    font-size: var(--reading-size);
    line-height: 1.6;
    margin-bottom: var(--space-3);
  }
  ul {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  li {
    color: var(--text);
    font-size: var(--reading-size);
    line-height: 1.6;
  }
  strong {
    font-weight: 600;
  }
  .fine {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: 0;
  }
</style>
