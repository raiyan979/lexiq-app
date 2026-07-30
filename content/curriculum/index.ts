/*
 * The full authored curriculum, in display order. Units get their order_index
 * (within a level) from their position here; the seed builder assigns ids.
 */

import type { UnitDef } from './types';
import { a1Units } from './a1';
import { a2Units } from './a2';
import { b1Units } from './b1';

export const curriculum: UnitDef[] = [...a1Units, ...a2Units, ...b1Units];
