import type { Ref } from "vue";

/**
 * Claude Code の状態。
 * - idle: セッション開始済みだがプロンプト待ち（通知不要）
 * - working: エージェントが作業中（UserPromptSubmit / PostToolUse）
 * - asking: 承認待ち（PermissionRequest）— ユーザー操作が必要
 * - done: 応答完了（Stop）— 人間の確認・入力待ち（通知が必要）
 *
 * undefined（エントリなし）= Claude 未起動
 */
export type ClaudeState = "idle" | "working" | "asking" | "done";

/** Claude Code の状態エントリ。状態と付随データを一体管理する */
export type ClaudeStatus =
  | { state: "idle" }
  | { state: "working"; startedAt: number }
  | { state: "asking"; toolName?: string; toolInput?: Record<string, unknown> }
  | { state: "done"; message?: string };

/**
 * hooks イベント種別。
 * - session-start: SessionStart（セッション開始）
 * - session-end: SessionEnd（セッション終了）
 * - running: UserPromptSubmit（プロンプト送信）
 * - needs-input: PermissionRequest（承認ダイアログ表示）
 * - done: Stop（応答完了）
 * - tool-done: PostToolUse（ツール実行完了）
 * - tool-failure: PostToolUseFailure（ツール実行失敗。is_interrupt で中断判定）
 * - stop-failure: StopFailure（API エラーによる停止）
 */
type HookEvent =
  | "session-start"
  | "session-end"
  | "running"
  | "needs-input"
  | "done"
  | "tool-done"
  | "tool-failure"
  | "stop-failure";

const HOOK_EVENTS: readonly HookEvent[] = [
  "session-start",
  "session-end",
  "running",
  "needs-input",
  "done",
  "tool-done",
  "tool-failure",
  "stop-failure",
];

export function isHookEvent(value: string): value is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(value);
}

/** PermissionRequest の debounce 時間（ms）。この間に tool-done が来たら asking にしない */
const ASK_DEBOUNCE_MS = 150;

/** interrupt パターンマッチ用の定数 */
const INTERRUPT_MARKER = "⎿ \u00A0Interrupted";
const PTY_TAIL_BUFFER_SIZE = 50;

interface PaneEntry {
  dir: string;
  session?: { ptyId: number };
}

interface ClaudeStatusManagerDeps {
  claudeStatusByPtyId: Ref<Record<number, ClaudeStatus>>;
  paneRegistry: Ref<Record<string, PaneEntry>>;
  /** ptyId → leafId 逆引き。PTY 生存判定に使う */
  isPtyAlive: (ptyId: number) => boolean;
}

export function createClaudeStatusManager(deps: ClaudeStatusManagerDeps) {
  const { claudeStatusByPtyId, paneRegistry, isPtyAlive } = deps;

  /** ptyId → PermissionRequest の debounce タイマー */
  const askTimers = new Map<number, ReturnType<typeof setTimeout>>();
  /** PTY ごとの直近 tail バッファ。チャンク分割でマーカーが跨いだ場合に備える */
  const ptyTailBuffers = new Map<number, string>();

  /** pending ask タイマーをキャンセルする */
  function cancelAskTimer(ptyId: number) {
    const timer = askTimers.get(ptyId);
    if (timer !== undefined) {
      clearTimeout(timer);
      askTimers.delete(ptyId);
    }
  }

  /**
   * hooks イベントを受けて Claude 状態を更新する。
   * PermissionRequest は debounce し、一瞬で通過するケース（自動承認）を除外する。
   * done 後の遅延 tool-done（イベント順序逆転）は無視する。
   */
  function handleHookEvent(ptyId: number, event: HookEvent, payload: Record<string, unknown>) {
    // kill/exit 済みの PTY への遅延イベントを無視
    if (!isPtyAlive(ptyId)) return;

    const current = claudeStatusByPtyId.value[ptyId];

    switch (event) {
      case "session-start": {
        cancelAskTimer(ptyId);
        claudeStatusByPtyId.value[ptyId] = { state: "idle" };
        break;
      }
      case "session-end": {
        cancelAskTimer(ptyId);
        delete claudeStatusByPtyId.value[ptyId];
        break;
      }
      case "running": {
        cancelAskTimer(ptyId);
        // 初回 working 遷移時のみ開始時刻を記録（tool-done → working の再遷移では維持）
        const startedAt = current?.state === "working" ? current.startedAt : Date.now();
        claudeStatusByPtyId.value[ptyId] = { state: "working", startedAt };
        break;
      }
      case "needs-input": {
        const toolName = typeof payload.tool_name === "string" ? payload.tool_name : undefined;
        const toolInput =
          typeof payload.tool_input === "object" && payload.tool_input !== null
            ? (payload.tool_input as Record<string, unknown>)
            : undefined;
        // debounce: タイマー満了まで asking にしない
        cancelAskTimer(ptyId);
        askTimers.set(
          ptyId,
          setTimeout(() => {
            askTimers.delete(ptyId);
            claudeStatusByPtyId.value[ptyId] = { state: "asking", toolName, toolInput };
          }, ASK_DEBOUNCE_MS),
        );
        break;
      }
      case "tool-failure": {
        cancelAskTimer(ptyId);
        if (payload.is_interrupt === true) {
          // ユーザーが Ctrl+C でツール実行を中断 → プロンプト待ちに戻る
          claudeStatusByPtyId.value[ptyId] = { state: "idle" };
          break;
        }
        // interrupt でないツール失敗は tool-done と同じ扱い（working 継続）
        if (current?.state === "done") break;
        const sf = current?.state === "working" ? current.startedAt : Date.now();
        claudeStatusByPtyId.value[ptyId] = { state: "working", startedAt: sf };
        break;
      }
      case "tool-done": {
        cancelAskTimer(ptyId);
        // done 後の遅延 tool-done を無視（イベント順序逆転対策）
        if (current?.state === "done") break;
        const startedAt = current?.state === "working" ? current.startedAt : Date.now();
        claudeStatusByPtyId.value[ptyId] = { state: "working", startedAt };
        break;
      }
      case "done": {
        cancelAskTimer(ptyId);
        const message =
          typeof payload.last_assistant_message === "string"
            ? payload.last_assistant_message
            : undefined;
        claudeStatusByPtyId.value[ptyId] = { state: "done", message };
        break;
      }
      case "stop-failure": {
        // API エラーによる停止。done と同様に人間への通知が必要
        cancelAskTimer(ptyId);
        const message =
          typeof payload.last_assistant_message === "string"
            ? payload.last_assistant_message
            : undefined;
        claudeStatusByPtyId.value[ptyId] = { state: "done", message };
        break;
      }
    }
  }

  /**
   * PTY データから interrupt パターンを検知して状態を更新する。
   * Claude Code は Ctrl+C/Escape で中断されると以下を PTY に出力する:
   *   "⎿ \u00A0Interrupted · What should Claude do instead?"
   * しかし interrupt 時にフックは発火しない（Stop も PostToolUseFailure も来ない）。
   * Claude Code にはユーザー中断を通知するフック（UserInterrupt 等）が存在しないため
   * （anthropics/claude-code#9516 で要望中）、PTY 出力のパターンマッチで代替している。
   * Claude Code の UI 変更でこの文字列が変わると壊れるので注意。
   * "⎿"(U+23BF) は Claude Code のツール出力プレフィックス、空白は SP(U+0020) + NBSP(U+00A0)。
   * PTY の data は任意境界で分割されるため、tail バッファと結合してマッチする。
   */
  function detectInterrupt(ptyId: number, data: string) {
    if (claudeStatusByPtyId.value[ptyId]?.state !== "working") return;

    const tail = ptyTailBuffers.get(ptyId) ?? "";
    if ((tail + data).includes(INTERRUPT_MARKER)) {
      cancelAskTimer(ptyId);
      claudeStatusByPtyId.value[ptyId] = { state: "idle" };
    }
    // 直近 PTY_TAIL_BUFFER_SIZE 文字を保持
    ptyTailBuffers.set(ptyId, data.slice(-PTY_TAIL_BUFFER_SIZE));
  }

  /** leafId に対応する Claude Code の状態を返す。未起動（エントリなし）の場合は undefined */
  function getClaudeState(leafId: string): ClaudeState | undefined {
    const entry = paneRegistry.value[leafId];
    if (entry?.session === undefined) return undefined;
    return claudeStatusByPtyId.value[entry.session.ptyId]?.state;
  }

  /** Claude セッションが存在する（idle / working / asking / done）leafId 一覧 */
  function getClaudeActiveLeafIds(): string[] {
    const ids: string[] = [];
    for (const [leafId, entry] of Object.entries(paneRegistry.value)) {
      if (entry.session === undefined) continue;
      if (claudeStatusByPtyId.value[entry.session.ptyId] !== undefined) {
        ids.push(leafId);
      }
    }
    return ids;
  }

  /** worktree dir に属する全ターミナルの Claude 状態を返す（未起動は除外） */
  function getClaudeStatusesByDir(dir: string): ClaudeStatus[] {
    const statuses: ClaudeStatus[] = [];
    for (const paneEntry of Object.values(paneRegistry.value)) {
      if (paneEntry.dir !== dir) continue;
      if (paneEntry.session === undefined) continue;
      const status = claudeStatusByPtyId.value[paneEntry.session.ptyId];
      if (status !== undefined) {
        statuses.push(status);
      }
    }
    return statuses;
  }

  /**
   * worktree dir に属する done 状態を idle に遷移する。
   * フォーカス時の既読消化に使う。Claude セッションは生きているため idle へ。
   */
  function clearDoneStates(dir: string) {
    for (const entry of Object.values(paneRegistry.value)) {
      if (entry.dir !== dir) continue;
      if (entry.session === undefined) continue;
      if (claudeStatusByPtyId.value[entry.session.ptyId]?.state === "done") {
        claudeStatusByPtyId.value[entry.session.ptyId] = { state: "idle" };
      }
    }
  }

  /** PTY 終了時のクリーンアップ */
  function cleanupPty(ptyId: number) {
    cancelAskTimer(ptyId);
    ptyTailBuffers.delete(ptyId);
    delete claudeStatusByPtyId.value[ptyId];
  }

  return {
    handleHookEvent,
    detectInterrupt,
    getClaudeState,
    getClaudeActiveLeafIds,
    getClaudeStatusesByDir,
    clearDoneStates,
    cleanupPty,
  };
}
