/*
 * First-run coach-mark tour state. Tracks whether the guided walkthrough of the
 * main sections has been seen, persisted in localStorage (like the audience /
 * theme stores) so it shows once and never again. `restart()` lets Settings
 * replay it on demand.
 */

import { STORAGE_KEYS } from '../config/constants';

function createTour() {
  let done = $state<boolean>(localStorage.getItem(STORAGE_KEYS.tourDone) === 'true');

  return {
    get done(): boolean {
      return done;
    },
    /** Mark the tour finished (or skipped) for good. */
    finish(): void {
      done = true;
      localStorage.setItem(STORAGE_KEYS.tourDone, 'true');
    },
    /** Replay the tour from the start (e.g. from Settings). */
    restart(): void {
      done = false;
      localStorage.removeItem(STORAGE_KEYS.tourDone);
    },
  };
}

export const tour = createTour();
