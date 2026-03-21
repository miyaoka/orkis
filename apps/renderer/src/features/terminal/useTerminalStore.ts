import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref } from "vue";
import { useContextKeys } from "../../shared/command";
import { useRpc } from "../../shared/rpc";
import type { ClaudeStatus } from "./claudeStatus";
import { isHookEvent, createClaudeStatusManager } from "./claudeStatus";
import { createPtySessionManager } from "./ptySession";
import type { PaneEntry } from "./ptySession";
import { createTerminalLayout } from "./terminalLayout";
import type { TerminalLayoutState } from "./terminalLayout";

/**
 * ターミナル分割レイアウトと PTY の状態を管理する。
 * leaf の追加・削除は store の action のみが行う（単一所有者）。
 * PTY のライフサイクル（spawn/kill/data）も store が一元管理する。
 * コンポーネントは xterm の attach/detach のみ担当する。
 */
export const useTerminalStore = defineStore("terminal", () => {
  const { request, send, onPtyData, onPtyExit, onGozdHook } = useRpc();
  const contextKeys = useContextKeys();

  // --- 共有 state ---

  /** 訪問済みの worktree ディレクトリ一覧（初回訪問順） */
  const visitedDirs = ref<string[]>([]);

  /** worktree dir → 分割レイアウト状態 */
  const layoutsByDir = ref<Record<string, TerminalLayoutState>>({});

  /** leafId → PTY 対応 + 所属 dir */
  const paneRegistry = ref<Record<string, PaneEntry>>({});

  /** split ドラッグ中の fit 抑制カウンター */
  const dragSuspendCount = ref(0);

  /** ターミナル表示モード: wt=アクティブworktreeのみ, all=全leaf, claude=Claude起動中のみ */
  type ViewMode = "wt" | "all" | "claude";
  const viewMode = ref<ViewMode>("wt");

  /** ptyId → Claude Code の状態（idle は undefined = エントリなし） */
  const claudeStatusByPtyId = ref<Record<number, ClaudeStatus>>({});

  /** leafId → PTY の現在の CWD（OSC 7 で更新される） */
  const cwdByLeafId = ref<Record<string, string>>({});

  // --- モジュール初期化 ---

  const ptySession = createPtySessionManager({
    paneRegistry,
    requestPtySpawn: request.ptySpawn,
    sendPtyKill: send.ptyKill,
    onDataReceived: (ptyId, data) => claude.detectInterrupt(ptyId, data),
    onPtyCleanup: (ptyId) => claude.cleanupPty(ptyId),
  });

  const claude = createClaudeStatusManager({
    claudeStatusByPtyId,
    paneRegistry,
    isPtyAlive: ptySession.isPtyAlive,
  });

  const layout = createTerminalLayout({
    layoutsByDir,
    visitedDirs,
    paneRegistry,
    resetTerminalFocus: () => contextKeys.set("terminalFocus", false),
    onPaneRemoved: (leafId) => {
      ptySession.killPty(leafId);
      delete cwdByLeafId.value[leafId];
    },
  });

  // --- computed ---

  /** Claude セッションが存在する（idle / working / asking / done）leafId 一覧 */
  const claudeActiveLeafIds = computed(() => claude.getClaudeActiveLeafIds());

  // --- RPC 購読 ---

  /** HMR 再実行時に前回のリスナーを解除するための disposer */
  let disposeDataListener: (() => void) | undefined;
  let disposeExitListener: (() => void) | undefined;
  let disposeHookListener: (() => void) | undefined;

  function initSubscriptions() {
    disposeDataListener?.();
    disposeExitListener?.();
    disposeHookListener?.();

    // HMR で Map が再初期化されるため、paneRegistry から逆引きを復元
    ptySession.rebuildPtyIdMap();

    disposeDataListener = onPtyData(({ id, data }) => {
      ptySession.handlePtyData(id, data);
    });

    disposeExitListener = onPtyExit(({ id }) => {
      ptySession.handlePtyExit(id);
    });

    disposeHookListener = onGozdHook(({ event, payload }) => {
      const ptyId = typeof payload.ptyId === "number" ? payload.ptyId : undefined;
      if (ptyId === undefined) return;
      if (!isHookEvent(event)) return;
      claude.handleHookEvent(ptyId, event, payload);
    });
  }

  initSubscriptions();

  // --- CWD ---

  /** OSC 7 で通知された CWD を保存する */
  function setCwd(leafId: string, cwd: string) {
    cwdByLeafId.value[leafId] = cwd;
  }

  // --- drag suspend ---

  function incrementDragSuspend() {
    dragSuspendCount.value++;
  }

  function decrementDragSuspend() {
    dragSuspendCount.value = Math.max(0, dragSuspendCount.value - 1);
  }

  return {
    // state
    visitedDirs,
    layoutsByDir,
    paneRegistry,
    dragSuspendCount,
    viewMode,
    cwdByLeafId,
    // computed
    claudeActiveLeafIds,
    // layout
    ensureLayout: layout.ensureLayout,
    visit: layout.visit,
    splitPane: layout.splitPane,
    closePane: layout.closePane,
    resetLayout: layout.resetLayout,
    resizeBranch: layout.resizeBranch,
    focusPane: layout.focusPane,
    remove: layout.remove,
    // pty
    spawnPty: ptySession.spawnPty,
    killPty: ptySession.killPty,
    attachTerminal: ptySession.attachTerminal,
    // claude
    getClaudeState: claude.getClaudeState,
    getClaudeStatusesByDir: claude.getClaudeStatusesByDir,
    clearDoneStates: claude.clearDoneStates,
    // cwd
    setCwd,
    // drag
    incrementDragSuspend,
    decrementDragSuspend,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTerminalStore, import.meta.hot));
}
