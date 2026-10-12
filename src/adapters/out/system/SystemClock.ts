import type { Clock } from '../../../application/ports/out/Clock.ts';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
