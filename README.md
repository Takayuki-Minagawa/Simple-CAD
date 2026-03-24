# Structural Web CAD

[![Deploy to GitHub Pages](https://github.com/Takayuki-Minagawa/Simple-CAD/actions/workflows/deploy.yml/badge.svg)](https://github.com/Takayuki-Minagawa/Simple-CAD/actions/workflows/deploy.yml)

構造設計（建築構造）に特化した、ブラウザで完結する静的 Web CAD アプリケーションです。
サーバー不要で動作し、GitHub Pages 等の静的ホスティングにそのままデプロイできます。

**Live Demo**: [https://takayuki-minagawa.github.io/Simple-CAD/](https://takayuki-minagawa.github.io/Simple-CAD/)

---

## 特徴

| 機能 | 概要 |
|------|------|
| **2D 作図** | SVG ベースの平面図。柱・梁・壁・スラブ・寸法線・注記を作図・編集。線種（実線/破線/点線/一点鎖線/二点鎖線）・線太さ・色をエンティティ単位で設定可 |
| **3D ビュー** | Three.js による確認用 3D 表示。Orbit 操作 / 投影切替 / ワイヤーフレーム / 断面表示（clip / slice / section box） |
| **JSON 正本** | すべてのデータを JSON で管理。JSON Schema 2020-12 による自動バリデーション |
| **エクスポート** | SVG / PDF（複数シート一括） / DXF / IFC / 構造計算 JSON へ出力 |
| **インポート** | JSON / IFC / 構造計算 JSON 読み込み / DXF 注記取り込み |
| **Undo / Redo** | 全編集操作の履歴管理 |
| **スナップ** | グリッド・端点・中点スナップ |
| **AI 連携** | LLM 用プロンプトテンプレートのコピー、生成 JSON の貼り付け読み込み |
| **ダーク / ライトモード** | ワンクリックでテーマ切替。OS 設定に応じた初期値を自動検出 |
| **多言語対応 (i18n)** | 日本語（デフォルト）/ 英語をツールバーから即時切替 |
| **簡易マニュアル** | アプリ内蔵のヘルプダイアログ。多言語対応 |
| **レイヤー** | 表示切替・ロック（8レイヤー）。ロック中はオブジェクトツリー・3D ビューからも選択不可 |
| **テキスト** | 日本語対応・回転・配置（左/中/右）・複数行テキスト。フォントサイズ編集可 |
| **完全オフライン** | サーバー・データベース不要。ブラウザだけで動作 |

---

## クイックスタート

### 必要環境

- Node.js 20 以上
- npm 9 以上

### ローカル起動

```bash
git clone https://github.com/Takayuki-Minagawa/Simple-CAD.git
cd Simple-CAD
npm install
npm run dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開き、ツールバーの **Sample** をクリックするとサンプルプロジェクトが読み込まれます。

### ビルド

```bash
npm run build
```

`dist/` に静的ファイルが生成されます。任意の Web サーバーや CDN から配信可能です。

### テスト

```bash
npm run test          # 一回実行
npm run test:watch    # ウォッチモード
```

---

## 使い方

### 基本操作

1. **Sample** ボタンでサンプルデータを読み込む（または **Open** で自作 JSON を開く）
2. 左パネルの **Story** でフロアを切り替え、**複製** ボタンで上階を作成
3. ツールバーの描画ツール（Column / Beam / Wall / Slab / Dim / Text）で部材を追加
4. **Select** ツールでオブジェクトを選択 → 右パネルでプロパティ（色・線種・線太さ・テキスト配置・回転等）を編集
5. **変形** ボタンで選択要素に移動 / 複写 / 縮尺 / パラメトリック変形を数値指定で適用
6. **マスタ** ボタンで materials / sections / sheets / タイトルブロックを編集
7. **IFC取込** / **DXF取込** ボタンで外部ファイルを取り込み（JSON Open は構造計算 JSON も自動判別）
8. **2D / 3D** ボタンで表示モードを切り替え（3D では clip / slice / section box で断面表示）
9. **Export** で SVG / PDF / DXF / IFC / 構造計算 JSON に出力
10. **AI** ボタンで LLM 連携（プロンプトコピー・JSON 貼り付け読み込み）
11. 🌙 / ☀️ ボタンでダーク / ライトモードを切替
12. **EN / JA** ボタンで表示言語を切替
13. **ヘルプ** ボタンで簡易マニュアルを表示

### キーボードショートカット

| キー | 機能 |
|------|------|
| `V` | Select |
| `H` | Pan |
| `C` | Column |
| `B` | Beam |
| `W` | Wall |
| `S` | Slab |
| `D` | Dimension |
| `T` | Text (Annotation) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+D` | 1000mm オフセット複写 |
| `Delete` | 削除 |
| `Escape` | キャンセル / 選択解除 |
| マウスホイール | ズーム |
| 中ボタンドラッグ | パン |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript |
| 状態管理 | [Zustand](https://zustand.docs.pmnd.rs/) + [Immer](https://immerjs.github.io/immer/) + [zundo](https://github.com/charkour/zundo) (Undo/Redo) |
| 2D 描画 | SVG (React JSX) |
| 3D ビュー | [Three.js](https://threejs.org/) + [@react-three/fiber](https://r3f.docs.pmnd.rs/) + [@react-three/drei](https://drei.docs.pmnd.rs/) |
| バリデーション | [Ajv](https://ajv.js.org/) (JSON Schema 2020-12) |
| PDF 出力 | [jsPDF](https://github.com/parallax/jsPDF) + [svg2pdf.js](https://github.com/yWorks/svg2pdf.js/) |
| DXF 出力 | DXF ASCII 直接生成 |
| DXF 取込 | 自作パーサー (LINE / LWPOLYLINE / CIRCLE / ARC / TEXT / MTEXT / SPLINE / HATCH / ELLIPSE) |
| IFC 連携 | 自作 IFC4 基本サブセットパーサー / ライター（STEP Part 21 形式） |
| 構造計算 JSON | 独自スキーマ (`simple-cad.structural-analysis/v1`) による節点モデル入出力 |
| テスト | [Vitest](https://vitest.dev/) |
| CI/CD | GitHub Actions → GitHub Pages |

---

## デプロイ

### GitHub Pages（自動）

このリポジトリは GitHub Actions ワークフロー（`.github/workflows/deploy.yml`）を同梱しており、`main` ブランチへの push で自動デプロイされます。

**初回セットアップ:**

1. リポジトリの **Settings → Pages** を開く
2. **Source** を **GitHub Actions** に変更
3. `main` ブランチに push すると自動でビルド → デプロイ

### その他のホスティング

```bash
npm run build
```

生成された `dist/` を任意のホスティングへアップロードしてください。

| ホスティング | 設定 |
|------------|------|
| Cloudflare Pages | ビルドコマンド: `npm run build`、出力: `dist` |
| Vercel | フレームワーク: Vite、出力: `dist` |
| Netlify | ビルドコマンド: `npm run build`、公開ディレクトリ: `dist` |

---

## JSON データ形式

本アプリはすべてのデータを JSON で管理します。`src/schemas/project.schema.json` に JSON Schema 2020-12 準拠のスキーマ定義があります。

### ルート構造

```json
{
  "schemaVersion": "1.0.0",
  "project": { "id": "proj-001", "name": "sample", "unit": "mm" },
  "stories": [],
  "grids": [],
  "materials": [],
  "sections": [],
  "members": [],
  "openings": [],
  "annotations": [],
  "dimensions": [],
  "sheets": [],
  "views": [],
  "issues": []
}
```

### 部材タイプ（members）

| type | 説明 | 形状定義 |
|------|------|----------|
| `column` | 柱 | `start` / `end` (Point3D) |
| `beam` | 梁 | `start` / `end` (Point3D) |
| `wall` | 壁 | `start` / `end` (Point3D) + `height` + `thickness` |
| `slab` | スラブ | `polygon` (Point2D[]) + `level` |

### 断面タイプ（sections）

| kind | 説明 | プロパティ |
|------|------|-----------|
| `rc_column_rect` | RC 矩形柱 | `width`, `depth` |
| `rc_beam_rect` | RC 矩形梁 | `width`, `depth` |
| `rc_slab` | RC スラブ | `thickness` |
| `rc_wall` | RC 壁 | `thickness` |

サンプルデータ: [`src/samples/sample-project.json`](src/samples/sample-project.json)

---

## AI による JSON 生成

ChatGPT や Claude 等の LLM を使って構造データの JSON を自動生成できます。
アプリ内の **AI** ボタンからプロンプトテンプレートのコピーや、生成された JSON の貼り付け読み込みが可能です。

### LLM への入力例

```text
1階が 8m x 6m の鉄筋コンクリート造
通り芯は X1-X3, Y1-Y2
柱は各交点に 600x600
梁は各通りに 300x600
スラブ厚 180
1階平面図と 3D 確認用ビューを作る
用紙は A1、縮尺 1:100
```

### LLM への出力ルール

- ルートに `schemaVersion`, `project`, `stories`, `grids`, `materials`, `sections`, `members`, `openings`, `annotations`, `dimensions`, `sheets`, `views` を含める
- 単位は mm、すべての要素に一意の `id` を付与
- 座標は数値で出力し、不明点は `issues` 配列に warning を出力
- `story`, `sectionId`, `materialId` の参照整合性を崩さないこと

---

## 設計原則

1. **JSON 正本パイプライン** — 内部モデル(JSON) → 表示/出力 の一方向フローを厳守
2. **UI 編集 → JSON 反映 → 再描画** — 表示レイヤー (SVG/3D/PDF/DXF) を直接編集しない
3. **単位系 mm 固定** — 混在させない
4. **座標系の明確な定義** — 2D: X右/Y上（構造図面慣例）、3D: CAD(X,Y,Z) → Three.js(X,Z,-Y)
5. **Undo/Redo を初期設計に組み込み** — Zustand + zundo で全操作を履歴管理
6. **Schema 検証必須** — JSON 読み込み時に 3 段階バリデーション（スキーマ → 参照整合性 → 幾何チェック）
7. **関心の分離** — `domain/` (純粋ロジック) は React に依存しない

---

## ロードマップ

### Phase 1: MVP (現在)

- [x] JSON Schema 定義 + バリデーション
- [x] JSON 読み込み / 保存
- [x] 2D 平面図表示 + 編集
- [x] 基本オブジェクト（柱・梁・壁・スラブ・寸法・注記）
- [x] SVG / PDF / DXF 出力
- [x] Three.js 3D ビュー
- [x] Undo / Redo
- [x] スナップ

### Phase 2: 実務寄り拡張

- [x] DXF 取込強化（SPLINE、HATCH 等）
- [x] 3D クリップ平面（断面表示）
- [x] 複数シート出力（PDF 複数ページ化）
- [x] タイトルブロックテンプレート
- [x] story 複製
- [x] section / material マスタ編集 UI

### Phase 3: 高度化

- [x] IFC 連携（基本 IFC4 サブセットの入出力）
- [x] 高度な 3D 断面表示（slice / section box）
- [x] 構造計算連携用 JSON アダプタ
- [x] OpenCascade.js による高度な形状生成基盤（ランタイム連携レイヤー）

---

## ディレクトリ構成

```
src/
  app/           アプリ統合（App.tsx, store, keyboard shortcuts）
  domain/        純粋ロジック層 ※React 非依存
    geometry/      座標演算、スナップ、交差判定、座標変換
    integration/   IFC / 構造計算 JSON など外部連携アダプタ
    rendering/     線種変換、レイヤーロック判定ユーティリティ
    structural/    部材型定義、ドメインモデル
    drawing/       2D 描画データ生成
    export/        SVG / PDF / DXF 変換
    import/        JSON / DXF 読込
    validation/    スキーマ検証 + 参照整合性 + 幾何チェック
  features/      React UI 層
    editor2d/      2D SVG エディタ
    viewer3d/      3D ビューワー
    project/       プロジェクト管理（エクスポート、マスタ編集等）
    aiAssist/      AI 連携パネル
  components/    共用コンポーネント
    toolbars/      メインツールバー
    panels/        オブジェクトツリー、レイヤー、プロパティ、バリデーション
    common/        ステータスバー等
  libs/          外部ライブラリラッパー
  schemas/       JSON Schema 定義
  samples/       サンプルデータ
  styles/        CSS
```

---

## コントリビューション

Issue や Pull Request を歓迎します。
コード変更時は以下をご確認ください:

```bash
npm run lint      # ESLint
npm run test      # Vitest
npm run build     # TypeScript + Vite ビルド
```

---

## ライセンス

MIT
