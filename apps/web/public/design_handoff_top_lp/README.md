# Handoff: Physifun トップ LP（v1 ドラフト適用）

## 概要

Physifun（フィジファン）のトップ LP を **7 セクション構成**で実装するための、Claude Code 向けハンドオフ一式です。

各セクション 2〜3 案ずつ作成した HTML プロトタイプの中から、ユーザーが**現時点のドラフト**として 1 案ずつ選定したものをまとめています。**最終確定デザインではなく、一度実環境に当てて感触を見るための適用版**です。

---

## このバンドルのファイルについて（重要）

このフォルダの HTML / JSX / CSS は **デザインリファレンス**です。意図したルックと挙動を示すプロトタイプであり、本番コードとしてそのままコピーするものではありません。

タスクは、これらの HTML デザインを**既存コードベース（Next.js + React + Tailwind 等の想定）の流儀に合わせて再現すること**。CSS は Tailwind / CSS Modules / styled-components など、リポジトリで採用済みのパターンに変換してください。プロトタイプの値（色・余白・タイポ）はピクセル一致を目指してください。

リポジトリにフロントエンド環境が未整備の場合は、最も適切なフレームワーク（Next.js App Router 推奨）を選定して構築してください。

## Fidelity

**High-fidelity (hifi)**：色・タイポ・余白・インタラクションは確定値です。コードベースの既存ライブラリ・パターンを使ってピクセル一致で再現してください。

⚠️ ただし以下は**仮実装**：
- 動画 (`hero.mp4`) は仮素材。本番素材に差し替え予定
- 統計値（`LEADERS 012 / PROJECTS 034 / SUPPORT HOURS 1,280h` など）は全て仮の数字
- ユーザーボイス（数字・氏名・引用）は全て仮データ
- カテゴリ事例の写真・動画はプレースホルダ

---

## 構成（7 セクション）

| # | セクション | 採用案 | 配色 | ソースファイル |
|---|---|---|---|---|
| 01 | **Hero** | **案 B — 縦分割アシメ型** | テラコッタ × クリーム（基本配色） | `source/hero/hero-variants.jsx` の `HeroB` |
| 02 | **Cycle**（仕組み図） | **案 A — 矢印フロー型** | テラコッタ × クリーム（**色変更要**） | `source/cycle/cycle-variants.jsx` の `CycleA` + `selected-overrides.css` |
| 03 | **Category**（カテゴリ別事例） | **案 A — タブ切替型** | クリーム基調 | `source/category/category-variants.jsx` の `CategoryA` |
| 04 | **Process**（はじめ方フロー） | **案 A — 横スパインステップ型** | physifun-red ベース | `source/process/process-variants.jsx` の `ProcessA` |
| 05 | **Voice**（利用者の声） | **案 C — 数字 + カード型** | 砂 × 藍 × 柿 | `source/voice/voice-variants.jsx` の `VoiceC` |
| 06 | **Support**（運営サポート） | **案 A — 6 グリッド型** | 白ベース | `source/support/support-variants.jsx` の `SupportA` |
| 07 | **CTA / Footer** | **案 A — 大問いかけ非対称** | テラコッタ × クリーム（**色変更要**） | `source/cta/cta-variants.jsx` の `CTA_A` + `selected-overrides.css` |

> ⚠️ 各 `*-variants.jsx` には A / B / C 全案が定義されています。**実装するのは上記の採用案のみ**で OK。他案は将来差し替え用の参考として残しています。

---

## 配色（Hero B 由来 = 全体ベース）

```css
--hb-terra:        #b8552d;  /* メイン: テラコッタ */
--hb-terra-dark:   #934220;  /* hover / 強調 */
--hb-terra-deep:   #6b2f17;  /* もっと暗い影 */
--hb-cream:        #faf7f2;  /* 背景クリーム */
--hb-cream-100:    #f3eee5;
--hb-cream-200:    #e8e0d3;
--hb-ink:          #2a221e;  /* 本文 */
--hb-ink-soft:     #4a3e38;
--hb-line:         #ddd5c7;
--hb-muted:        #847868;
```

セクション固有色（採用案で使用）：

```css
--pf-red:          #c62828;  /* Process A の背景 */
--pf-red-dark:     #a31d1d;
--moss:            #4d5a3a;  /* Cycle B (今回未採用) */
--kaki:            #d4663d;  /* Voice C のアクセント */
--kaki-dark:       #aa4f2c;
--indigo:          #2a4a5e;  /* Voice C のメイン */
--indigo-dark:     #1c3544;
--sand:            #f5ede0;  /* Voice C / Cycle C 背景 */
```

タイポ：

```css
--font-jp:        "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
--font-serif-jp:  "Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif;
--font-mono:      "Geist Mono", "JetBrains Mono", monospace;  /* 数値・ラベル */
```

---

## 色変更（Cycle A / CTA A → テラコッタ化）

オリジナルの Cycle A と CTA A は `--pf-red` (#c62828) ベースですが、Hero B のテラコッタに揃えます。

`source/selected-overrides.css` に**差分のみ**まとめてあります。`cycle-styles.css` / `cta-styles.css` を読み込んだ**後**にこのファイルを読み込めば、色だけ上書きされます。

Tailwind / CSS-in-JS で実装する場合は、`selected-overrides.css` の中身を参考にして**該当クラスのトークンを直接 terracotta 系に書き換え**てください（オーバーライド方式は CSS をそのまま流用する場合の便宜的な方法）。

---

## セクション別 詳細仕様

### 01 Hero（案 B — 縦分割アシメ型）

**目的**：起案者（リーダー）に「自分が主役」と感じてもらい、最初のアクション（プロジェクトをつくる）に進ませる。

**レイアウト**：
- 全画面 (100vh 目標、min-height: 760px)
- 上部に固定トップバー（左：ロゴ、中央：ナビ 4 項目、右：CTA「プロジェクトをつくる」）
- メインを左右 1.1fr / 0.9fr の 2 カラムグリッド
- 左カラム上部：チップ「FOR LEADERS」+「起案者を募集しています」、H1（48〜64px、`em` でテラコッタ強調 + 半透明アンダーライン）、説明文（15px / 行間 1.95）、メイン CTA（テラコッタ塗りつぶし + 矢印 SVG）
- 左カラム下部：カテゴリピル（建築・古民家 / カフェ・飲食 / キャンプ場 / 農業 / イベント / スポーツ）+ 統計 3 列（LEADERS / PROJECTS / SUPPORT HOURS）
- 右カラム：動画フレーム（`hero.mp4` を `autoplay muted loop playsinline`）+ 上に薄い veil + 「REC ／ 現場の風景」バッジ（左上）+ 引用カード（右下、Shippori Mincho 14px、白カード on テラコッタ）

**モバイル**：
- 縦 1 カラム、トップバーの中央ナビは hide、右の CTA は省略形（アイコンのみ）
- カテゴリピルは先頭 4 つだけ表示
- 統計は横スクロール or 折り返し

**コピー**：`source/copy/01_hero.md` 参照（H1, サブコピー, CTA 文言）

---

### 02 Cycle（案 A — 矢印フロー型 / テラコッタ化）

**目的**：「スキル × 時間 × プロジェクト × リターン」の四者循環を 1 枚の図で説明する。

**レイアウト**：
- セクション全体：`background: #b8552d` (terracotta)、padding 80px 40px、白文字
- 上部：見出し「あなたの『得意』が、誰かの『現場』に届く仕組み。」+ リード文
- ステージ：1100 × 540 の SVG ステージ。4 ノードを上下左右に配置
  - 左：「スキル・時間（フィジカル）」
  - 中央：Physifun ロゴ（破線リングが 60s で 1 回転）
  - 右：「プロジェクト（リーダーの目的）」
  - 下：「モノ・コト・体験（リターン）」
- 各ノード：直径 168px の白背景円リング、中に直径 116px の白円（コア）、周囲に 3〜4 個の衛星アイコン（44px 白円 + ラベル）
- ノード間を矢印 SVG で接続。各矢印に番号バッジ（① 公開 / ② 共感 / ③ 形にする / ④ 贈る）
- 下部：脚注「＊金銭は動かない。動くのは『時間』と『ありがとう』だけ。」

**モバイル**：
- ステージは縦に 4 ノードを並べる、矢印 SVG は非表示、各ノード間に番号バッジを縦並び
- 衛星アイコンは非表示（ノードのコアのみ）

**コピー**：`source/copy/02_concept-cycle.md`

---

### 03 Category（案 A — タブ切替型）

**目的**：「どんな現場でフィジファンが使えるか」をカテゴリ別に見せる。

**レイアウト**：
- クリーム背景 (`--hb-cream`)、padding 96px 40px
- 見出し：左寄せ、「想いはひとつではない。現場の数だけ、形がある。」
- タブバー：6 カテゴリ（建築・古民家 / カフェ・飲食 / キャンプ場 / 農業 / イベント / スポーツ）。アクティブタブは下線 + テキスト濃色、非アクティブはミュート色
- 下にコンテンツエリア：左 2/3 にカテゴリ説明 + 事例カード 3 件、右 1/3 に大きな縦長プレースホルダ画像
- タブ切替時は 200ms のフェード（`opacity 0 → 1`）

**state**：
- `selectedCategory: string`（デフォルト「建築・古民家」）
- カテゴリデータは static な配列で OK（後で CMS 連携する想定）

**コピー**：`source/copy/03_category-cases.md`

---

### 04 Process（案 A — 横スパインステップ型）

**目的**：「リーダーがプロジェクトを公開してから、サポーターと現場で動くまで」のプロセスを 5 ステップで示す。

**レイアウト**：
- 背景：`--pf-red` (#c62828)、白文字、padding 96px 40px
- 上部見出し：「はじめてみよう。」+ サブコピー
- 横方向の 5 ステップフロー（中央に背骨ライン）：
  1. プロジェクトを公開
  2. 仲間が手を挙げる
  3. すり合わせ（DM）
  4. 現場で動く
  5. リターンを贈る
- 各ステップ：番号 (Geist Mono)、タイトル、説明、所要日数の目安バッジ
- 中央のスパインは白の dashed ライン + 各ノードに白塗りの丸

**モバイル**：縦並び、スパインは縦の dashed ラインに

**コピー**：`source/copy/04_pricing-flow.md`

---

### 05 Voice（案 C — 数字 + カード型）

**目的**：「実際に使った人の声」と「定量的な実績」をセットで信頼性を担保する。

**レイアウト**：
- 背景：`--sand` (#f5ede0)、padding 96px 40px
- 上部：3 つの数字を大きく並べる（横並び、Geist Mono / 60〜80px）
  - `182人` リーダーが起案
  - `94%` プロジェクト成立率
  - `2,840h` のべ参加時間
  - 各数字の下にラベル（11px、letter-spacing 0.14em、ミュート色）
  - 数字色は `--indigo` (#2a4a5e)、3 つ目だけ `--kaki-dark` でアクセント
- 下部：3 つのボイスカード（白背景、border-radius 22px）
  - 各カード：上部にアバター丸プレースホルダ（48px）+ 氏名・属性、本文（14px、行間 1.85）、引用部分は Shippori Mincho で `--indigo` 色
- カード間 gap: 24px

**モバイル**：数字 3 列 → 1 列縦積み、カードも 1 列

**コピー**：`source/copy/05_user-voice.md`

---

### 06 Support（案 A — 6 グリッド型）

**目的**：運営側が提供する 6 つのサポートを、対等な並びで見せる。

**レイアウト**：
- 背景：白、padding 96px 40px、上下に細い線
- 上部見出し（中央寄せ）+ リード文
- 6 グリッド（3 × 2）：
  1. 起案ガイド
  2. プロジェクト診断
  3. サポーター集めアドバイス
  4. 現場ロジサポート
  5. リターン設計相談
  6. トラブル時の窓口
- 各セル：左上にアイコン（28px、stroke 1.6、`--hb-terra` 色）、タイトル（17px / 800）、説明（13px / 行間 1.85 / `--hb-ink-soft`）
- セル間に細いボーダー（`--hb-line`）

**モバイル**：3×2 → 2×3 → 1 カラム（ブレイクポイント次第）

**コピー**：`source/copy/06_philosophy.md`（運営姿勢として記載）

---

### 07 CTA / Footer（案 A — 大問いかけ非対称 / テラコッタ化）

**目的**：最後に「あなたの『現場』を、はじめませんか？」と問いかけ、一気にコンバージョンへ導く。

**レイアウト**：
- 上部 CTA ブロック：背景 `--hb-terra`、白文字、padding 120px 80px
- 1.4fr / 1fr の 2 カラム
  - 左：H2「あなたの『現場』を、はじめませんか？」（48〜56px / 800）+ サブコピー
  - 右：メイン CTA ボタン（クリーム塗り + テラコッタ深色文字 + 矢印）+ サブ CTA（透明 + 白枠「まずは事例を見る」）+ ヘルパーテキスト「公開は無料 ／ 成立まで手数料 0 円」
- 背景に巨大な「？」マーク（Shippori Mincho、420px、不透明度 10%、右下に半分はみ出し）
- 下部 Footer：背景 `#0e0e0e`、白文字、padding 80px 80px 32px
  - 4 カラム：① ロゴ + マニフェスト 1 文、② サービスリンク、③ 会社情報、④ SNS / Contact
  - 最下行：コピーライト + プライバシー / 利用規約

**モバイル**：CTA は 1 カラム、ボタンは縦積みでフル幅

**コピー**：`source/copy/08_footer.md`

---

## アセット

`source/references/` に以下のロゴ素材を同梱しています。

- `フィジファン_ロゴ_黒.png` — Hero / トップバー用（テラコッタ背景以外で使用）
- `フィジファン_ロゴ_白.png` — テラコッタ / 赤 / 黒背景上で使用
- `フィジファン_シンボル_黒.png` — Cycle A 中央リング / アイコン用途
- `フィジファン_シンボル_白.png` — 暗背景でのアイコン用途

⚠️ Hero の動画 `references/hero.mp4` は容量の都合でこのバンドルには**含めていません**。実装時はユーザーから本番動画素材を別途受領してください（プロジェクト内には `uploads/HPトップ動画.mp4` という仮素材があります）。

アイコンは [Lucide](https://lucide.dev/) 互換の SVG を使用しています。実装時は `lucide-react` パッケージで置き換え可：
- Cycle A: `Sparkle / Hammer / Sprout / ChefHat / Brush / Flag / Home / Wheat / PartyPopper / Tent / Gift / Box / Heart / Star`
- 他セクションも同様にプロトタイプ JSX を参照

---

## インタラクション・状態

| 箇所 | 挙動 |
|---|---|
| Hero 動画 | autoplay / muted / loop / playsinline。preload="metadata" 推奨 |
| Hero CTA hover | 背景 `--hb-terra` → `--hb-terra-dark`、translateY(-1px)、150ms ease |
| Hero カテゴリピル | hover で薄く影、クリックで該当 Category タブへスクロール (`scrollTo` で smooth) |
| Cycle A 中央リング | `animation: spin 60s linear infinite`（破線リングのみ回転、コアは静止） |
| Category タブ | クリックで `selectedCategory` 更新、コンテンツエリアを 200ms フェード切替 |
| Process 各ステップ | hover でステップ番号がほんの少し拡大 (scale 1.05) |
| Voice 数字 | 初回ビューポート進入時に 0 → 目標値までカウントアップ（800ms / cubic-bezier(0.22, 0.61, 0.36, 1)） |
| Support 各セル | hover でアイコン色 `--hb-terra` → `--hb-terra-dark`、背景 `--hb-cream` うっすら |
| Footer SNS | hover で 100ms フェード透明度 0.7 |

レスポンシブブレイクポイント：
- `mobile`: <= 768px（プロトタイプの `.mobile` クラス相当）
- `tablet`: 769px – 1024px（基本デスクトップ寄りで OK）
- `desktop`: >= 1025px

---

## ファイル一覧

```
design_handoff_top_lp/
├── README.md                          ← このファイル
└── source/
    ├── selected-overrides.css         ← Cycle A / CTA A の色を terracotta に変更
    ├── Hero Section.html              ← Hero 全 3 案のプレビュー
    ├── Cycle Section.html             ← Cycle 全 3 案のプレビュー
    ├── Category Section.html
    ├── Process Section.html
    ├── Voice Section.html
    ├── Support Section.html
    ├── CTA Footer Section.html
    ├── hero/
    │   ├── hero-variants.jsx          ← HeroA / HeroB / HeroC 定義
    │   └── hero-styles.css
    ├── cycle/
    │   ├── cycle-variants.jsx         ← CycleA / CycleB / CycleC 定義
    │   └── cycle-styles.css
    ├── category/
    │   ├── category-variants.jsx
    │   └── category-styles.css
    ├── process/
    │   ├── process-variants.jsx
    │   └── process-styles.css
    ├── voice/
    │   ├── voice-variants.jsx
    │   └── voice-styles.css
    ├── support/
    │   ├── support-variants.jsx
    │   └── support-styles.css
    ├── cta/
    │   ├── cta-variants.jsx
    │   └── cta-styles.css
    ├── references/                    ← Physifun ロゴ・シンボル
    └── copy/                          ← 全セクションの本文・要件定義
        ├── 00_master-context.md
        ├── 01_brief.md
        ├── 01_hero.md
        ├── 02_concept-cycle.md
        ├── 02_lp-sections.md
        ├── 03_category-cases.md
        ├── 04_pricing-flow.md
        ├── 05_user-voice.md
        ├── 06_philosophy.md
        ├── 07_faq.md
        └── 08_footer.md
```

---

## 実装の進め方（推奨）

1. **配色トークンと共通フォント定義**を Tailwind config / CSS variables に登録（上記「配色」セクション参照）
2. **共通 UI**（トップバー / Footer / 矢印付きボタン / カテゴリピル）を先に実装
3. **セクション 01 → 07 の順**で実装。各セクションの `*-variants.jsx` から採用案 (`HeroB` など) のマークアップを移植し、`*-styles.css` の該当クラスを Tailwind / CSS Module に変換
4. Cycle A と CTA A は実装後に `selected-overrides.css` の差分を当てる（または最初から terracotta トークンで実装）
5. モバイル対応：プロトタイプの `.mobile` クラス用 CSS をそのままブレイクポイントメディアクエリに変換

---

## 既知の課題・次のアクション（依頼者へ）

このバンドルは v1 ドラフトのため、以下は実装後に確認してから次イテレーションを行います：

- [ ] Hero B のテラコッタが、Process A の `--pf-red` と隣接した時に色がぶつからないか
- [ ] Category タブのデフォルト選択カテゴリ
- [ ] Voice C の数字（182 / 94 / 2,840）が確定値かどうか
- [ ] Process A のステップ数（5 で確定 or 増減あり）
- [ ] Footer のリンク構成（プライバシーポリシー / 特商法表記の必要可否）
- [ ] 各セクションのアニメーションを scroll-trigger するか（GSAP / Framer Motion）

実装後、ユーザーに見せて反応を取り、確定デザインに向けて再調整してください。
