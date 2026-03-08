import type { RPCSchema } from "electrobun/bun";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isIgnored: boolean;
}

export interface FileReadResult {
  content: string;
  /** バイナリ等で読み取れなかった場合 true */
  isBinary: boolean;
  /** 画像ファイルの場合、data: URL（base64） */
  dataUrl?: string;
}

export type OrkisRPC = {
  bun: RPCSchema<{
    requests: {
      ptySpawn: {
        params: { cols: number; rows: number };
        response: number;
      };
      fsReadDir: {
        params: { relPath: string };
        response: FileEntry[];
      };
      fsReadFile: {
        params: { relPath: string };
        response: FileReadResult;
      };
      /** git show HEAD:<path> で変更前のファイル内容を取得 */
      gitShowFile: {
        params: { relPath: string };
        response: FileReadResult;
      };
      /** git diff <path> で unified diff を取得 */
      gitDiffFile: {
        params: { relPath: string };
        response: string;
      };
      gitStatus: {
        params: undefined;
        response: Record<string, string>;
      };
    };
    messages: {
      ptyWrite: { id: number; data: string };
      ptyResize: { id: number; cols: number; rows: number };
      ptyKill: { id: number };
      openExternal: { url: string };
      rendererReady: void;
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      ptyData: { id: number; data: string };
      ptyExit: { id: number; exitCode: number };
      fsChange: { relDir: string };
      gitStatusChange: { statuses: Record<string, string> };
      orkisOpen: { dir: string; file?: string };
      orkisHook: { event: string; payload: Record<string, unknown> };
    };
  }>;
};
