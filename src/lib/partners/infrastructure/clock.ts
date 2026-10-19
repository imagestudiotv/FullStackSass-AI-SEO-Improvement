import type { Clock } from "../application/ports/clock";

export const systemClock: Clock = { now: () => new Date() };

/** A clock that only moves when told to - for tests and replays. */
export function fixedClock(start: Date): Clock & { set(at: Date): void; advance(ms: number): void } {
  let current = new Date(start.getTime());
  return {
    now: () => new Date(current.getTime()),
    set(at) {
      current = new Date(at.getTime());
    },
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
  };
}
