# Structural Web CAD

構造設計向けの静的 Web CAD アプリケーション。ブラウザのみで動作し、サーバー不要。

## 機能

- **2D 作図**: SVG ベースの平面図表示・編集（柱、梁、壁、スラブ、寸法線、注記）
- **3D ビュー**: Three.js による確認用 3D 表示（Orbit 操作、投影切替、ワイヤーフレーム）
- **JSON 正本**: すべてのデータを JSON で管理、JSON Schema 2020-12 によるバリデーション
- **エクスポート**: SVG / PDF / DXF 出力
- **インポート**: JSON 読み込み、DXF サブセット取り込み
- **Undo/Redo**: 全編集操作を履歴管理
- **スナップ**: グリッド、端点、中点スナップ
- **AI 連携**: プロンプトテンプレートのコピー、JSON 貼り付け読み込み

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Vite + React + TypeScript |
| 状態管理 | Zustand + Immer + zundo |
| 2D 描画 | SVG (React JSX) |
| 3D ビュー | Three.js + @react-three/fiber + @react-three/drei |
| バリデーション | Ajv (JSON Schema 2020-12) |
| PDF 出力 | jsPDF + svg2pdf.js |
| DXF 出力 | 手動 DXF ASCII 生成 |
| テスト | Vitest |

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く。

## ビルド方法

```bash
npm run build
```

`dist/` ディレクトリに静的ファイルが生成される。

## デプロイ方法

`dist/` を以下のいずれかにデプロイ:

- **GitHub Pages**: `vite.config.ts` で `base` を設定してビルド
- **Cloudflare Pages**: `dist` をデプロイディレクトリに指定
- **Vercel**: フレームワーク「Vite」を選択して自動デプロイ

## テスト

```bash
npm run test          # 一回実行
npm run test:watch    # ウォッチモード
```

## 使い方

1. アプリ起動後、ツールバーの **Sample** をクリックしてサンプルプロジェクトを読み込む
2. **2D/3D** ボタンで表示を切り替える
3. ツールバーの **Column / Beam / Wall / Slab / Dim / Text** で部材を追加
4. **Select** ツールでオブジェクトを選択し、右パネルでプロパティを編集
5. **Export** ボタンで SVG / PDF / DXF を出力
6. **AI** ボタンで JSON 生成用プロンプトのコピーや JSON の貼り付け読み込み

### キーボードショートカット

| キー | 機能 |
|------|------|
| V | Select ツール |
| H | Pan ツール |
| C | Column ツール |
| B | Beam ツール |
| W | Wall ツール |
| S | Slab ツール |
| D | Dimension ツール |
| T | Annotation ツール |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+D | 複製 |
| Delete | 削除 |
| Escape | キャンセル / 選択解除 |

## JSON データ形式

内部正本は JSON。`src/schemas/project.schema.json` に JSON Schema 定義あり。
サンプルデータは `src/samples/sample-project.json` を参照。

### ルート構造

```json
{
  "schemaVersion": "1.0.0",
  "project": { "id": "...", "name": "...", "unit": "mm" },
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

### 部材タイプ

- `column`: 柱（start/end で定義）
- `beam`: 梁（start/end で定義）
- `wall`: 壁（start/end + height + thickness）
- `slab`: スラブ（polygon + level）

## 設計原則

1. **内部モデル → 表示/出力** の一方向パイプラインを厳守（JSON が唯一の正本）
2. UI 上の編集はすべて内部 JSON に反映し、その JSON から再描画する
3. DXF / PDF / SVG へ直接編集しない
4. 単位系は原則 **mm**
5. 座標系は 2D と 3D で明確に定義し、変換規則を固定
6. Undo / Redo を最初から設計に含める
7. JSON は必ず Schema で検証する
8. 幾何処理と React コンポーネントを密結合させない

## 今後の拡張ロードマップ

### Phase 2: 実務寄り拡張

- DXF 取込強化（SPLINE、HATCH 等の対応拡大）
- クリップ平面（3D 断面表示）
- 複数シート出力（PDF 複数ページ化）
- タイトルブロックテンプレート
- story 複製
- section / material マスタ編集 UI

### Phase 3: 高度化（任意）

- IFC 連携
- より高度な 3D 断面表示
- 自動配筋や構造計算連携のための外部 JSON アダプタ
- OpenCascade.js を用いた高度な形状生成（別モジュール）

## AI による JSON 生成

アプリ内の **AI** ボタンからプロンプトテンプレートをコピーできますが、以下に詳細な指示例を示します。

### LLM への入力例

```
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
- 座標は数値、不明点は `issues` 配列に warning を出力
- 部材タイプ: `column`, `beam`, `wall`, `slab`
- 断面タイプ: `rc_column_rect`, `rc_beam_rect`, `rc_slab`, `rc_wall`
- 省略名を避ける（例: `sec` ではなく `sectionId`）
- 参照整合性を崩さないこと（`story`, `sectionId`, `materialId` は既存定義を参照）

## 設計上の仮定

- 単位系は mm 固定
- 座標系: 2D は X 右方向、Y 上方向（構造図面慣例）
- 3D 座標変換: CAD(X,Y,Z) → Three.js(X,Z,-Y)
- DXF インポートは LINE / LWPOLYLINE / CIRCLE / ARC / TEXT のサブセット対応
- PDF の日本語テキストはシステムフォント依存（フォント埋め込みは未実装）
- File System Access API 対応ブラウザでは上書き保存、非対応では Blob ダウンロード

## ディレクトリ構成

```
src/
  app/           アプリ統合（App.tsx, store, keyboard shortcuts）
  domain/        純粋ロジック（geometry, structural, drawing, export, import, validation）
  features/      React UI（editor2d, viewer3d, project, aiAssist）
  components/    共用コンポーネント（toolbars, panels, common）
  libs/          外部ライブラリラッパー（fileSystem）
  schemas/       JSON Schema 定義
  samples/       サンプルデータ
  styles/        CSS
```
