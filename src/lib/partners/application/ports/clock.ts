/** Time, injected so every time-sensitive rule can be tested with a controlled clock. */
export interface Clock {
  now(): Date;
}
