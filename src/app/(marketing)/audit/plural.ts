/** [one, other] for a count, with {count} filled in. Its own file: the browser components use it without the copy. */
export function plural(forms: readonly [string, string], count: number, shown: string = String(count)): string {
  return forms[count === 1 ? 0 : 1].replaceAll("{count}", shown);
}
