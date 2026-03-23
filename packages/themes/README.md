# @gozd/themes

ターミナルカラーテーマ。[mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)（MIT ライセンス）の Windows Terminal 形式 JSON を vendor データとして格納し、xterm.js の ITheme 互換オブジェクトに変換する。

## 構成

```text
packages/themes/
├── vendor/                          # iTerm2-Color-Schemes の Windows Terminal 形式 JSON（484テーマ）
│   ├── LICENSE                      # 元リポジトリの MIT ライセンス
│   └── *.json
├── dist/                            # 生成物（.gitignore 対象）
│   └── themeLoaders.ts              # テーマ遅延ローダーマップ + dark/light 分類済み名前一覧
├── scripts/
│   └── generateThemeLoaders.ts      # dist/themeLoaders.ts を生成するスクリプト
└── src/
    ├── convertTheme.ts              # WindowsTerminalTheme → XtermTheme 変換
    ├── loadTheme.ts                 # テーマ名から遅延ロード + 変換（公開 API）
    └── index.ts                     # バレルファイル
```

## 公開 API

- `loadTheme(name)` — テーマ名から JSON を遅延ロードし `XtermTheme` に変換して返す
- `darkThemeNames` / `lightThemeNames` / `themeNames` — ソート済みテーマ名一覧
- `XtermTheme` — xterm.js ITheme 互換の型

## 生成

`dist/themeLoaders.ts` は `pnpm install` 時に `prepare` スクリプトで自動生成される。各テーマの背景色から sRGB 相対輝度を算出し、dark（luminance < 0.5）/ light に分類する。

## vendor の更新

[mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes) の `windowsterminal/` ディレクトリから JSON をコピーする。

```bash
cp /path/to/iTerm2-Color-Schemes/windowsterminal/*.json packages/themes/vendor/
pnpm install  # prepare で dist/ が再生成される
```
