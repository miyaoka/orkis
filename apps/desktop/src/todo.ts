/**
 * Todo 管理モジュール
 *
 * worktree と 1:1 で紐づく Todo を JSON ファイルで永続化する。
 * 保存先: ~/.config/orkis/projects/<encodedPath>/todos.json
 */
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { tryCatch } from "@orkis/shared";
import type { Todo } from "@orkis/rpc";

const PROJECTS_DIR = path.join(homedir(), ".config", "orkis", "projects");
const TODOS_FILE = "todos.json";

/** リポジトリパスをディレクトリ名にエンコードする（/ → -） */
function encodeRepoPath(repoRoot: string): string {
  return repoRoot.replaceAll("/", "-");
}

/** プロジェクト固有のデータディレクトリパスを返す */
function getProjectDir(repoRoot: string): string {
  return path.join(PROJECTS_DIR, encodeRepoPath(repoRoot));
}

function getTodosPath(repoRoot: string): string {
  return path.join(getProjectDir(repoRoot), TODOS_FILE);
}

function ensureProjectDir(repoRoot: string): void {
  const dir = getProjectDir(repoRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Todo 一覧を読み込む */
export function loadTodos(repoRoot: string): Todo[] {
  const content = tryCatch(() => fs.readFileSync(getTodosPath(repoRoot), "utf-8"));
  if (!content.ok) return [];
  const parsed = tryCatch(() => JSON.parse(content.value) as unknown);
  if (!parsed.ok) return [];
  if (!Array.isArray(parsed.value)) return [];
  return parsed.value.filter(isValidTodo);
}

/** Todo 一覧を保存する */
function saveTodos(repoRoot: string, todos: Todo[]): void {
  ensureProjectDir(repoRoot);
  const result = tryCatch(() =>
    fs.writeFileSync(getTodosPath(repoRoot), JSON.stringify(todos, null, 2)),
  );
  if (!result.ok) {
    console.error(`[todo] save failed: ${result.error.message}`);
  }
}

function isValidTodo(v: unknown): v is Todo {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.body === "string" &&
    typeof t.createdAt === "string" &&
    (t.worktreeDir === undefined || typeof t.worktreeDir === "string")
  );
}

/** Todo を追加する */
export function addTodo(repoRoot: string, body: string, worktreeDir?: string): Todo {
  const todos = loadTodos(repoRoot);
  const todo: Todo = {
    id: crypto.randomUUID(),
    body,
    worktreeDir,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  saveTodos(repoRoot, todos);
  return todo;
}

/** Todo の body を更新する */
export function updateTodo(repoRoot: string, id: string, body: string): Todo {
  const todos = loadTodos(repoRoot);
  const todo = todos.find((t) => t.id === id);
  if (!todo) throw new Error(`Todo not found: ${id}`);
  todo.body = body;
  saveTodos(repoRoot, todos);
  return todo;
}

/** Todo を削除する */
export function removeTodo(repoRoot: string, id: string): void {
  const todos = loadTodos(repoRoot);
  const filtered = todos.filter((t) => t.id !== id);
  saveTodos(repoRoot, filtered);
}

/** worktreeDir で Todo を検索する */
export function findTodoByWorktreeDir(repoRoot: string, worktreeDir: string): Todo | undefined {
  const todos = loadTodos(repoRoot);
  return todos.find((t) => t.worktreeDir === worktreeDir);
}

/** worktree に Todo を紐づける */
export function linkTodoToWorktree(repoRoot: string, id: string, worktreeDir: string): Todo {
  const todos = loadTodos(repoRoot);
  const todo = todos.find((t) => t.id === id);
  if (!todo) throw new Error(`Todo not found: ${id}`);
  todo.worktreeDir = worktreeDir;
  saveTodos(repoRoot, todos);
  return todo;
}

/** worktreeDir が存在しない active Todo を削除する */
export function cleanupStaleTodos(repoRoot: string, validWorktreePaths: string[]): void {
  const todos = loadTodos(repoRoot);
  const validSet = new Set(validWorktreePaths);
  const cleaned = todos.filter((t) => {
    if (!t.worktreeDir) return true;
    return validSet.has(t.worktreeDir);
  });
  if (cleaned.length !== todos.length) {
    saveTodos(repoRoot, cleaned);
  }
}
