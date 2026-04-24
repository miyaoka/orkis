/**
 * Bun.spawn / Bun.spawnSync のラッパー。
 *
 * Bun は env 省略時に起動時のネイティブ環境（C の environ）を子プロセスに渡す。
 * process.env への変更（Object.assign 含む）は JS Proxy 層にしか反映されず、
 * Zig 内部の transpiler.env.map は更新されない。
 * そのため Launch Services 経由の .app 起動では PATH が最小限のままになる。
 *
 * このモジュールは env: { ...process.env } を自動付与することで、
 * process.env の現在値を確実に子プロセスに渡す。
 */

type In = Bun.SpawnOptions.Writable;
type Out = Bun.SpawnOptions.Readable;

export function spawn<
  const I extends In = "ignore",
  const O extends Out = "pipe",
  const E extends Out = "inherit",
>(cmd: string[], opts?: Bun.SpawnOptions.SpawnOptions<I, O, E>): Bun.Subprocess<I, O, E>;
export function spawn<
  const I extends In = "ignore",
  const O extends Out = "pipe",
  const E extends Out = "inherit",
>(opts: Bun.SpawnOptions.SpawnOptions<I, O, E> & { cmd: string[] }): Bun.Subprocess<I, O, E>;
export function spawn(
  cmdOrOpts: string[] | (Bun.SpawnOptions.SpawnOptions<In, Out, Out> & { cmd: string[] }),
  maybeOpts?: Bun.SpawnOptions.SpawnOptions<In, Out, Out>,
): Bun.Subprocess {
  if (Array.isArray(cmdOrOpts)) {
    return Bun.spawn(cmdOrOpts, { ...maybeOpts, env: { ...process.env, ...maybeOpts?.env } });
  }
  const { cmd, ...opts } = cmdOrOpts;
  return Bun.spawn(cmd, { ...opts, env: { ...process.env, ...opts.env } });
}

export function spawnSync<
  const I extends In = "ignore",
  const O extends Out = "pipe",
  const E extends Out = "pipe",
>(cmd: string[], opts?: Bun.SpawnOptions.SpawnSyncOptions<I, O, E>): Bun.SyncSubprocess<O, E>;
export function spawnSync<
  const I extends In = "ignore",
  const O extends Out = "pipe",
  const E extends Out = "pipe",
>(
  opts: Bun.SpawnOptions.SpawnSyncOptions<I, O, E> & { cmd: string[]; onExit?: never },
): Bun.SyncSubprocess<O, E>;
export function spawnSync(
  cmdOrOpts: string[] | (Bun.SpawnOptions.SpawnSyncOptions<In, Out, Out> & { cmd: string[] }),
  maybeOpts?: Bun.SpawnOptions.SpawnSyncOptions<In, Out, Out>,
): Bun.SyncSubprocess {
  if (Array.isArray(cmdOrOpts)) {
    return Bun.spawnSync(cmdOrOpts, { ...maybeOpts, env: { ...process.env, ...maybeOpts?.env } });
  }
  const { cmd, ...opts } = cmdOrOpts;
  return Bun.spawnSync(cmd, { ...opts, env: { ...process.env, ...opts.env } });
}
