/** Cast node:sqlite row results to typed records (SQLOutputValue → T). */
export function asRow<T>(value: unknown): T {
  return value as T;
}

export function asRows<T>(value: unknown): T[] {
  return value as T[];
}
