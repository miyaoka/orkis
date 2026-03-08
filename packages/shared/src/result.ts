interface Ok<T> {
  ok: true;
  value: T;
}

interface Err<E = Error> {
  ok: false;
  error: E;
}

type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Promise を Result 型に変換する。
 * try-catch ブロックの代わりに使い、エラーを値として扱えるようにする。
 */
async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const value = await promise;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export { tryCatch };
export type { Err, Ok, Result };
