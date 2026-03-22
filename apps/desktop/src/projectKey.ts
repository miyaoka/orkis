/**
 * プロジェクトディレクトリから NAME_MAX 安全なディレクトリ名を生成する。
 * realpath で symlink を解決し、SHA-256 ハッシュで一意性を保証する。
 * 形式: `<repoName>-<hash>`（例: `gozd-a1b2c3d4e5f6`）
 * repoName は NAME_MAX（255）に収まるよう切り詰める。
 */
import crypto from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

const HASH_LENGTH = 12;
/** APFS / ext4 の NAME_MAX */
const NAME_MAX = 255;
/** ハイフン(1) + ハッシュ(12) */
const SUFFIX_LENGTH = 1 + HASH_LENGTH;
const MAX_NAME_LENGTH = NAME_MAX - SUFFIX_LENGTH;

export function projectKey(projectDir: string): string {
  const realPath = realpathSync(projectDir);
  const hash = crypto.createHash("sha256").update(realPath).digest("hex").slice(0, HASH_LENGTH);
  const name = path.basename(realPath).slice(0, MAX_NAME_LENGTH);
  return `${name}-${hash}`;
}
