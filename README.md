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
| **解析モデル / 結果** | 支持条件、節点・部材・面荷重、荷重組合せ、質量、剛床、材端リリースを編集。解析結果の変形図・検定比マップを 3D 表示 |
| **構造マスタ** | concrete / steel / wood の種別別物性、材料プリセット、JIS H形鋼ライブラリ、RC配筋・かぶり、荷重ケースを編集 |
| **JSON 正本** | すべてのデータを JSON で管理。JSON Schema 2020-12 による自動バリデーション |
| **エクスポート** | SVG / PDF（複数シート一括） / DXF / IFC / 構造計算 JSON へ出力 |
| **インポート** | JSON / IFC / 構造計算 JSON 読み込み / DXF 取込（注記 + 形状→部材変換） |
| **安全な取込** | Web Worker で解析し、件数・警告・推定単位を確認してから反映。取込全体を1回の Undo で取消可能 |
| **変形ツール** | 移動・複写・縮尺・オフセット・ミラー・配列複写・パラメトリック変形 |
| **編集ツール** | トリム・延長・フィレット・頂点編集・グループ化 |
| **Undo / Redo** | 全編集操作の履歴管理 |
| **自動保存 / 復元** | IndexedDB に未保存作業、最近のプロジェクト、表示設定を保存。異常終了後の復元に対応 |
| **スナップ** | グリッド・端点・中点・垂直・最近点スナップ |
| **選択** | クリック / Shift 複数選択 / 矩形選択（窓/交差） |
| **座標入力** | 絶対 (`x,y`) / 相対 (`@dx,dy`) / 極座標 (`@dist<angle`) |
| **計測** | 面積(m2)・周長・部材長さの自動表示 |
| **印刷プレビュー** | シートレイアウトの WYSIWYG プレビュー |
| **ズーム** | 全体表示 (`Z`) / 選択範囲 (`Shift+Z`) |
| **AI 連携** | 外部 LLM（ChatGPT / Claude 等）と連携。プロンプトテンプレートのコピー → AI で JSON 生成 → 貼り付け読み込みの 3 ステップで構造データを自動生成 |
| **ダーク / ライトモード** | ワンクリックでテーマ切替。OS 設定に応じた初期値を自動検出 |
| **多言語対応 (i18n)** | 日本語（デフォルト）/ 英語をツールバーから即時切替 |
| **簡易マニュアル** | アプリ内蔵のヘルプダイアログ。多言語対応 |
| **レイヤー** | 表示切替・ロック（9レイヤー）。ロック中はオブジェクトツリー・3D ビューからも選択不可 |
| **テキスト** | 日本語対応・回転・配置（左/中/右）・複数行テキスト・太字/斜体/下線/フォント選択 |
| **補助線** | 無限長参照線（xline/ray）。constructionレイヤーで管理 |
| **スプライン** | 制御点指定のスムーズ曲線（Catmull-Rom → Bezier 変換）。SVG/DXF出力対応 |
| **外部参照** | 他の JSON プロジェクトを読取専用グレー表示で参照配置（Xref） |
| **ビューポート** | シート内に複数ビューを独立配置。各ビューポートに独自の縮尺・表示範囲 |
| **図面テンプレート** | A1構造 / A3詳細 / 空白A1 プリセットから新規プロジェクト作成 |
| **PWA / オフライン** | インストール可能な PWA。初回起動時に遅延読込ビュー・Workerを含む生成アセットをキャッシュ |

---

## クイックスタート

### 必要環境

- Node.js 20.19 以上、または 22.12 以上
- npm 9 以上

### ローカル起動

```bash
git clone https://github.com/Takayuki-Minagawa/Simple-CAD.git
cd Simple-CAD
npm install
npm run dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開き、メニューバーの **ファイル → サンプル** をクリックするとサンプルプロジェクトが読み込まれます。

### ビルド

```bash
npm run build
```

`dist/` に静的ファイルが生成されます。任意の Web サーバーや CDN から配信可能です。

### ヘッドレス CLI(図面のコマンドライン出力)

描画コア(`src/domain/`)はブラウザ非依存の純粋 TypeScript であり、Node CLI から直接利用できます:

```bash
npm run build:cli   # dist-cli/index.js を生成
node dist-cli/index.js list src/samples/sample-project.json
node dist-cli/index.js validate src/samples/sample-project.json
node dist-cli/index.js export src/samples/sample-project.json --format svg --sheet S-001 -o out.svg
node dist-cli/index.js export src/samples/sample-project.json --format dxf --story 1F -o out.dxf
```

CLI エントリは [src/cli/index.ts](src/cli/index.ts)、実装は [src/cli/run.ts](src/cli/run.ts)。
`@/domain/**` と Node 標準モジュールのみに依存し、ブラウザ専用アダプタ(`pdfExport`、React UI、ストア)には依存しません。

終了コードは 0(成功)/ 1(実行時エラー)/ 2(引数エラー)。存在しない `--sheet` / `--story` を
指定した場合は**出力ファイルを作らずに非ゼロ終了**します(タイプミスで一見正常な図面が
下流パイプラインに流れ込むのを防ぐため)。

```bash
npm run smoke:cli   # ビルド + dist-cli の動作確認(正常系・異常系)
```

#### Python 移植(simple-cad-py)

構造計算書ツール等の Python パイプラインから図面出力するための移植パッケージが
別フォルダ `simple-cad-py/` にあります(将来の独立リポジトリ化を想定)。
同一のプロジェクト JSON(契約: [src/schemas/project.schema.json](src/schemas/project.schema.json))から
**バイト単位で同一**の SVG / DXF を出力することをゴールデンテストで担保しています。

- 正の実装(source of truth)は本リポジトリの `src/domain/`
- 描画仕様を変更したら `npm run build:cli && node scripts/generate-golden.mjs <path-to-simple-cad-py>`
  でゴールデンを再生成し、Python 側を追従させて `pytest` を通すこと
- 計画・経緯は [docs/CLI分離作業計画.md](docs/CLI分離作業計画.md) を参照

### テスト

```bash
npm run test          # 一回実行
npm run test:watch    # ウォッチモード
npm run test:coverage # カバレッジ付きユニットテスト
npm run test:e2e      # Playwright スモーク + axe アクセシビリティ検査
npm run check         # lint / typecheck / coverage / build / bundle budget
```

---

## 使い方

### 基本操作

1. **ファイル → サンプル** でサンプルデータを読み込む（または **ファイル → 開く** で自作 JSON を開く）
2. 左パネルの **Story** でフロアを切り替え、**複製** ボタンで上階を作成
3. **描画** メニューから描画ツール（柱 / 梁 / 壁 / スラブ / 寸法 / 注記）を選んで部材を追加
4. **選択** ツールでオブジェクトを選択 → 右パネルでプロパティ（色・線種・線太さ・テキスト配置・回転等）を編集
5. **編集 → 変形** で選択要素に移動 / 複写 / 縮尺 / パラメトリック変形を数値指定で適用
6. **ツール → マスタ** で階・シートの追加/削除/並替、materials / sections / タイトルブロック、構造解析条件を編集
7. **ファイル → IFC取込 / DXF取込** で外部ファイルを取り込み（JSON Open は構造計算 JSON も自動判別）
8. **表示 → 2D / 3D** で表示モードを切り替え（3D では clip / slice / section box で断面表示）
9. **ファイル → 出力** で SVG / PDF / DXF / IFC / 構造計算 JSON に出力
10. **ツール → AI** で LLM 連携（プロンプトコピー・JSON 貼り付け読み込み）
11. 🌙 / ☀️ ボタンでダーク / ライトモードを切替
12. **EN / JA** ボタンで表示言語を切替
13. **ツール → ヘルプ** で簡易マニュアルを表示

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
| `Ctrl+G` | グループ化 |
| `Ctrl+Shift+G` | グループ解除 |
| `Z` | ズーム全体表示 |
| `Shift+Z` | 選択範囲にズーム |
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
| DXF 取込 | 自作パーサー (LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT / SPLINE / HATCH / ELLIPSE / DIMENSION)。形状→構造部材変換対応 |
| IFC 連携 | 自作 IFC4 基本サブセットパーサー / ライター（STEP Part 21 形式） |
| 構造計算 JSON | 独自スキーマ (`simple-cad.structural-analysis/v1`) による節点・境界条件・荷重・結果の双方向入出力 |
| テスト | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + axe-core |
| CI/CD | GitHub Actions（lint / typecheck / coverage / audit / E2E / bundle budget）→ GitHub Pages |

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
  "issues": [],
  "loadCases": [],
  "supports": [],
  "nodalLoads": [],
  "memberLoads": [],
  "areaLoads": [],
  "loadCombinations": [],
  "masses": [],
  "diaphragms": []
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
| `s_column_h` | 鉄骨 H 形柱 | `width`, `depth`, `tw`, `tf` |
| `s_beam_h` | 鉄骨 H 形梁 | `width`, `depth`, `tw`, `tf` |
| `s_pipe` | 鉄骨鋼管 | `diameter`, `thickness` |

H形鋼はマスタ画面の JIS H形鋼ライブラリから代表寸法を選択して、梁用または柱用の断面として追加できます。ライブラリは形状寸法を提供し、強度・許容値は選択した材料または外部解析システムで管理します。

### 材料タイプ（materials）

材料は `type` による判別形式で、異なる材料種別の強度値は混在できません。共通物性は `elasticModulus`, `shearModulus`, `poissonRatio`, `unitWeight`、種別固有値は concrete の `Fc`、steel の `F` / `Fy`、wood の基準強度・含水率・曲げ/圧縮/せん断許容応力度です。

サンプルデータ: [`src/samples/sample-project.json`](src/samples/sample-project.json)

### 構造解析データ

マスタ画面で支持条件、節点/部材/面荷重、荷重組合せ、集中質量、剛床を編集できます。部材には材端リリース、剛域長、ローカル軸定義を設定でき、すべて構造計算 JSON へ出力されます。

`analysisResults` を含む構造計算 JSON を読み込むと、3D ビューで変形倍率を調整した変形図、検定比カラー、部材応力プローブを確認できます。本アプリ自体は解析ソルバーを内蔵していません。

---

## AI アシスト（AI 連携）

### 概要

ChatGPT や Claude 等の外部 LLM（大規模言語モデル）と連携して、構造設計データの JSON を自動生成・インポートできる機能です。  
**アプリ内に AI エンジンは搭載していません。** 外部 AI サービスとのコピー＆ペーストで連携する仕組みです。

### 使い方（ステップバイステップ）

#### ステップ 1: AI アシストパネルを開く

ツールバーの **ツール → AI** をクリックして AI アシストパネルを開きます。

#### ステップ 2: プロンプトをコピーする

パネル上部に表示されるプロンプトテンプレートの **「プロンプトをコピー」** ボタンをクリックします。  
クリップボードに、JSON 出力ルール（単位 mm・部材タイプ・断面タイプ等）を含むプロンプトがコピーされます。

#### ステップ 3: 外部 AI に指示を出す

コピーしたプロンプトを ChatGPT や Claude 等の LLM に貼り付け、続けて作りたい建物の仕様を自然言語で指示します。

**入力例:**

```text
1階が 8m x 6m の鉄筋コンクリート造
通り芯は X1-X3, Y1-Y2
柱は各交点に 600x600
梁は各通りに 300x600
スラブ厚 180
1階平面図と 3D 確認用ビューを作る
用紙は A1、縮尺 1:100
```

#### ステップ 4: 生成された JSON を貼り付けて読み込む

1. LLM が返した JSON をコピーします
2. AI アシストパネルの **「JSON 貼り付け読み込み」** テキストエリアに貼り付けます
3. **「読み込み」** ボタンをクリックすると、プロジェクトとして読み込まれます
4. エラーがある場合はパネル内に赤字で表示されるので、修正して再度貼り付けてください

#### 補助機能: 現在のプロジェクト JSON をコピー

**「現在の JSON をコピー」** ボタンで、今開いているプロジェクトの JSON データをクリップボードにコピーできます。  
これを LLM に渡して「部材を追加して」「この建物を 2 階建てにして」等の修正指示に利用できます。

### LLM への出力ルール

AI が生成する JSON は以下のルールに従う必要があります:

- ルートに `schemaVersion`, `project`, `stories`, `grids`, `materials`, `sections`, `members`, `openings`, `annotations`, `dimensions`, `sheets`, `views` を含める
- 単位は mm、すべての要素に一意の `id` を付与
- 座標は数値で出力し、不明点は `issues` 配列に warning を出力
- `story`, `sectionId`, `materialId` の参照整合性を崩さないこと

### 活用のヒント

| シーン | AI への指示例 |
|--------|-------------|
| 新規建物作成 | 「3 階建て RC 造、X 方向 4 スパン × Y 方向 2 スパン、柱 700×700、梁 400×800」 |
| 既存プロジェクト修正 | 現在の JSON をコピーして「2 階を追加して」「X3 通りに壁を追加して」 |
| テンプレート作成 | 「A1 用紙に 1:100 の平面図と 3D ビューをレイアウトして」 |
| データ確認 | 現在の JSON をコピーして「この建物の部材リストを表にまとめて」 |

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

## リリース履歴

### v1.0.0（現在）

**Phase 1: MVP**
- JSON Schema 定義 + バリデーション / JSON 読み込み・保存
- 2D 平面図（柱・梁・壁・スラブ・寸法・注記）/ SVG / PDF / DXF 出力 / Three.js 3D ビュー / Undo・Redo / スナップ

**Phase 2: 実務寄り拡張**
- DXF 取込強化 / 3D 断面表示 / 複数シート PDF / タイトルブロック / story 複製 / マスタ編集 UI

**Phase 3: 高度化**
- IFC4 基本サブセット入出力 / slice・section box / 構造計算 JSON アダプタ / OpenCascade 連携基盤

**Phase 4: CAD 基本機能**
- 線種・線太さ・色（エンティティ単位）/ テキスト回転・配置・複数行・書式 / レイヤーロック / 寸法線編集・矢印

**Phase 5: 生産性向上**
- 矩形選択（窓/交差）/ 座標入力 / 変形ツール（移動・複写・オフセット・ミラー・配列・縮尺・パラメトリック）
- トリム・延長・フィレット / 頂点編集 / 面積・周長計測 / グループ / 印刷プレビュー / 垂直・最近点スナップ

**Phase 6: 高度な作図・連携**
- 補助線(xline/ray) / 外部参照(Xref) / ビューポート / スプライン曲線 / テキスト書式 / 図面テンプレート
- DXF 形状→構造部材変換（LINE→壁, 矩形→柱/梁, CIRCLE→柱, 多角形→スラブ, DIMENSION→寸法線）

---

## ディレクトリ構成

```
src/
  app/           アプリ統合（App.tsx, store, keyboard shortcuts）
  domain/        純粋ロジック層 ※React 非依存
    geometry/      座標演算、スナップ、交差判定、座標変換
    integration/   IFC / 構造計算 JSON など外部連携アダプタ
    rendering/     線種変換、レイヤーロック判定ユーティリティ
    structural/    部材型定義、ドメインモデル、変形・トリム操作
    templates/     図面テンプレート（A1構造、A3詳細、空白A1）
    drawing/       2D 描画データ生成
    export/        SVG / PDF / DXF / IFC 変換
    import/        JSON / DXF 読込（形状→部材変換含む）
    validation/    スキーマ検証 + 参照整合性 + 幾何チェック
  features/      React UI 層
    editor2d/      2D SVG エディタ
    viewer3d/      3D ビューワー
    project/       プロジェクト管理（エクスポート、マスタ編集等）
    aiAssist/      AI 連携パネル（外部 LLM とのコピー＆ペーストで JSON 生成・インポート）
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
