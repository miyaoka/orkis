import { tryCatch } from "@gozd/shared";
import { spawn } from "../spawn";

/** ブランチ名にシェルメタ文字が含まれていないことを検証する */
export function assertBranchName(branch: string): void {
  if (!/^[\w./-]+$/.test(branch) || branch.startsWith("-")) {
    throw new Error("Invalid branch name");
  }
}

export async function getBranchList(cwd: string): Promise<string[]> {
  const result = await tryCatch(
    new Response(spawn(["git", "branch", "--format=%(refname:short)"], { cwd }).stdout).text(),
  );
  if (!result.ok) return [];
  return result.value.trim().split("\n").filter(Boolean);
}

export async function deleteBranch(cwd: string, branch: string): Promise<void> {
  assertBranchName(branch);

  const proc = spawn(["git", "branch", "-D", "--", branch], { cwd, stderr: "pipe" });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`git branch delete failed: ${stderr.trim() || `exit code ${proc.exitCode}`}`);
  }
}
