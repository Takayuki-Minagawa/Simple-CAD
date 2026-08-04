# CLI分離作業計画 — 図面描画コアの分離と Python CLI 化

作成日: 2026-08-04
対象リポジトリ: Simple-CAD (structural-web-cad v1.0.0)

## 1. 背景と目的

- 利用者は Python 製の構造計算ツール(構造計算書生成)を運用しており、本 Web CAD の図面描画機能を以下の用途で使いたい:
  1. 構造計算書に挿入する「リアルな図面」の挿絵生成
  2. 計算書とは独立した図面ファイル(SVG / DXF / PDF)の出力
- そのために、Web UI から描画コアを分離し、**Python の CLI / ライブラリとして利用できる構成**にする。

## 2. 事前調査の結論(CLI分離の有効性判断)

**判断:有効。** 根拠:

| 観点 | 調査結果 |
|---|---|
| ブラウザ依存 | `src/domain/`(約15,700行)にブラウザAPI依存ゼロ。唯一の例外は `pdfExport.ts`(jspdf + DOMParser、48行)のみ |
| 描画の実体 | `exportSvg(projectData, sheetId) → SVG文字列`、`exportDxf(projectData, storyId) → DXF文字列` の**純粋関数** |
| データ契約 | `src/schemas/project.schema.json`(JSON Schema)が既に存在し、Web版とCLI版の共通言語として使える |
| 移植規模 | 描画に必要なコードは依存を辿って約1,700行(うち型定義620行)と小規模 |

方式は「**B. Python移植**」を採用(Python計算書パイプラインとの直接統合が目的のため)。
ただし TypeScript 側にも Node CLI を追加し、**同一JSONから同一出力が得られることを機械検証**する(二重管理リスクの対策)。

## 3. 全体アーキテクチャ

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Web版 (React UI)            │      │  Python構造計算ツール(既存)   │
│    └─ src/domain/ (描画コア)  │      │    └─ simple_cad (本計画で新設) │
└──────────┬──────────────────┘      └──────────┬───────────────────┘
           │ 読み書き                            │ 読み書き
           ▼                                    ▼
     ┌───────────────────────────────────────────────┐
     │   プロジェクトJSON (project.schema.json が契約)   │
     └───────────────────────────────────────────────┘
           ▲                                    ▲
           │ Node CLI (検証用リファレンス)          │ Python CLI (本命)
      simple-cad export ...              python -m simple_cad export ...
```

- **契約(source of truth)**: `project.schema.json` とサンプルプロジェクトJSON
- **正の実装(reference)**: TypeScript `src/domain/`(Web版と共通)
- **利用実装**: Python `simple_cad` パッケージ(TS版とゴールデンテストで同一性を担保)

## 4. 作業フェーズ

### フェーズ1: TypeScript側の整理(CLI利用部分の分離)

- [x] `src/cli/index.ts` を新設 — Node から `domain/` を直接呼ぶ CLI
  - `export --format svg|dxf --sheet <id> / --story <id>` : 図面出力
  - `list` : シート / 階(story)の一覧表示
  - `validate` : プロジェクトJSONの検証(既存 `domain/validation` を利用)
  - PDF はブラウザ依存(jspdf)のため CLI 対象外とし、SVG→PDF 変換は Python 側で担う
- [x] `package.json` に `build:cli` スクリプト追加(esbuild + tsconfig paths でバンドル)
- [x] コマンド実装を `src/cli/run.ts`(`process.exit` を持たない純関数 `runCli`)に分離し、
  `src/cli/index.ts` はプロセスへの配線のみとする(単体テスト可能にするため)
- [x] 存在しない `--sheet` / `--story` の指定を非ゼロ終了で拒否
  (DXF は storyId で部材を絞り込むだけのため、未知IDでもグリッド・表題欄を含む
  「一見正常な」ファイルが生成されてしまう。計算書パイプラインへの静かな混入を防ぐ)
- [x] CLI の単体テスト(`src/cli/__tests__/run.test.ts`)とバンドル済み成果物の
  スモークテスト(`npm run smoke:cli`)を追加し、CI(quality ジョブ)に組み込み
- [x] 浮動小数点の移植性対応: `Math.hypot` → `Math.sqrt(dx*dx + dy*dy)` に置換
  (`memberShape.ts` / `eccentricity.ts`。JSとPythonで最終ビット単位の出力一致を保証するため。
  実用上の数値差は最終桁ulpレベルで図面には影響なし)
- [x] 既存テスト・型チェック(`npm run check` 相当)が通ることを確認

### フェーズ2: Python パッケージの新設(独立フォルダ `simple-cad-py/`)

Web CAD リポジトリとは**別フォルダ**(`/Users/mina25/simple-cad-py/`)に自己完結パッケージとして出力する。
将来そのまま `git init` して独立リポジトリ化できる構成とする。

```
simple-cad-py/
  pyproject.toml          # パッケージ定義(Python 3.9+、標準ライブラリのみで動作)
  README.md               # 使い方・計算書ツールへの組込み例
  simple_cad/
    __init__.py           # 公開API: export_svg / export_dxf / load_project
    __main__.py           # python -m simple_cad
    cli.py                # argparse CLI(export / list / validate)
    jsnum.py              # ★ JS互換の数値→文字列変換(出力一致の要)
    geometry.py           # point.ts の移植
    paper.py              # paper.ts の移植(用紙サイズ・縮尺・表題欄)
    line_style.py         # lineStyle.ts の移植(線種→破線パターン)
    eccentricity.py       # eccentricity.ts の移植(軸偏心)
    member_shape.py       # memberShape.ts の移植(部材平面形状)
    svg_export.py         # svgExport.ts の移植(371行)
    dxf_export.py         # dxfExport.ts の移植(388行)
    pdf_export.py         # SVG→PDF 変換(cairosvg があれば利用、任意依存)
    schema/project.schema.json  # スキーマ同梱(TS側からコピー、真実はTS側)
  tests/
    data/                 # サンプルプロジェクトJSON(TS側からコピー)
    golden/               # TS版CLIが生成したゴールデン出力(svg/dxf)
    test_golden.py        # Python出力とのバイト一致検証(pytest)
    test_units.py         # 単体テスト(数値フォーマット・形状計算など)
```

移植対象(合計 約1,000行 + 型):

| TSソース | 行数 | 備考 |
|---|---|---|
| svgExport.ts | 371 | 文字列生成のみ。表題欄3種・ビューポート・寸法・注釈含む |
| dxfExport.ts | 388 | DXF ASCII生成。検証warning部分はスキーマ検証で代替 |
| memberShape.ts | 142 | 柱・梁・壁・スラブの平面ポリゴン |
| eccentricity.ts | 102 | 軸偏心の解決 |
| point.ts / paper.ts / lineStyle.ts | 106 | 幾何・用紙・線種ユーティリティ |

### フェーズ3: 出力同一性の担保(ゴールデンテスト)

- [x] Node CLI で `src/samples/sample-project.json` から SVG / DXF を生成 → `python/tests/golden/` に保存
- [x] pytest で Python 版の出力と**バイト単位で比較**
- [x] 技術的な要点(JS↔Python差異の吸収):
  - 数値→文字列: ECMAScript `Number::toString`(最短往復表現)を `jsnum.py` で再現
  - `toFixed(n)`: `decimal` モジュールで同等の丸めを実装
  - `encodeURIComponent` / `JSON.stringify`: `urllib.parse.quote`(safeセット調整)+ 自前JSONシリアライザ(キー順・数値表現をJS互換に)
  - 浮動小数点演算: 演算順序を完全に一致させる(IEEE754 doubleは両言語共通)

### フェーズ4: ドキュメント整備

- [x] リポジトリ README にアーキテクチャ(層構造と契約)を追記
- [x] `python/README.md` に計算書ツールからの利用例を記載:
  - ライブラリとして: `svg = export_svg(project, sheet_id)` → 計算書に埋め込み
  - CLIとして: `python -m simple_cad export plan.json --format svg -o fig1.svg`
- [x] スキーマ更新時の運用ルール(TS側が真実、Python側へコピー+ゴールデン再生成)を明記

## 5. 完了条件

1. `npm run build:cli` で Node CLI がビルドでき、`export` / `list` / `validate` が動作する
2. `python -m simple_cad export` が SVG / DXF を出力できる(Python 3.9+、外部依存なし)
3. サンプルプロジェクトで TS版とPython版の SVG / DXF 出力がバイト一致(pytest green)
4. 既存 Web 版のテスト(`npm run test` ほか)がすべて通る

## 6. リスクと対応

| リスク | 対応 |
|---|---|
| 描画ロジックの二重管理(TS/Python乖離) | ゴールデンテストをCI化できる構成にし、TS側変更時に検知 |
| CLI の退行がCIで検知されない | quality ジョブに `npm run smoke:cli`(ビルド + 正常系/異常系スモーク)を追加済み |
| JS/Python の数値文字列化の差 | `jsnum.py` に集約し単体テストで網羅。最終的にバイト一致で検証 |
| PDF出力のブラウザ依存 | Python側は SVG→PDF 変換(cairosvg等の任意依存)で代替。未導入環境ではSVG/DXFのみ |
| スキーマ進化への追従 | スキーマ変更をトリガーにゴールデン再生成+Python側更新の運用ルールを文書化 |

## 7. スコープ外(今回はやらないこと)

- 3Dビュー・IFC入出力・構造解析関連ロジックのPython移植(描画に不要)
- DXF**読み込み**(import)のPython移植(必要になった時点で別途)
- Web版UIの機能変更(`Math.hypot`置換以外、挙動に影響する変更はしない)
