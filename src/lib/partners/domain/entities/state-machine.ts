import { InvalidTransitionError } from "../errors";

/**
 * A finite state machine as a table of allowed moves. Staying in the same
 * state is always allowed (an idempotent repeat), any other move must be
 * listed.
 */
export type TransitionTable<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(table: TransitionTable<S>, from: S, to: S): boolean {
  return from === to || table[from].includes(to);
}

export function assertTransition<S extends string>(
  machine: string,
  table: TransitionTable<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(table, from, to)) throw new InvalidTransitionError(machine, from, to);
}

/** States from which `to` can be reached in one move - for conditional SQL updates. */
export function sourcesOf<S extends string>(table: TransitionTable<S>, to: S): S[] {
  return (Object.keys(table) as S[]).filter((from) => from === to || table[from].includes(to));
}
