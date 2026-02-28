# Campfire Experience — プロジェクトメモリ

## プロジェクト概要

体験ホスト（オーナー）と体験ゲストをつなぐプラットフォーム。
古民家再生・米作り・DIY などの体験プロジェクトを通じて、ホストとゲストが共に価値を得る場を作る。

**現在のフェーズ: Phase 1 準備中**（オーナー募集 LP + 応募フォーム）

---

## Spec-Driven Development (Kiro スタイル)

### パス
- Steering: `.kiro/steering/` — プロジェクト全体のルール・文脈
- Specs: `.kiro/specs/` — 個別機能の開発プロセス

### Steering ファイル（必ず読み込む）
| ファイル | 内容 |
|---|---|
| `product.md` | プロダクトビジョン・フェーズ計画 |
| `tech.md` | 技術スタック・アーキテクチャ方針 |
| `structure.md` | ディレクトリ構成・レイヤー責務 |
| `dev-rule.md` | 開発フロー・PR ルール |

### ワークフロー早見表

```
Phase 0 (任意):   /kiro:steering, /kiro:steering-custom
Phase 1 (仕様):   /kiro:spec-init "説明"
                  /kiro:spec-requirements {feature}
                  /kiro:validate-gap {feature}       ← 既存コードとのギャップ確認
                  /kiro:spec-design {feature} [-y]
                  /kiro:validate-design {feature}
                  /kiro:spec-tasks {feature} [-y]
Phase 2 (実装):   /kiro:spec-impl {feature} [tasks]
                  /kiro:validate-impl {feature}
進捗確認:         /kiro:spec-status {feature}
```

---

## 開発ガイドライン

- 思考は英語、出力（会話・ファイル）は **日本語**
- Markdown をプロジェクトファイルに書く際は spec.json の `language` に従う
- 3 段階承認フロー（要件 → 設計 → タスク → 実装）を厳守
- 各フェーズで人間のレビューを必須とする（`-y` は意図的な高速化のときのみ）
- Steering を最新に保ち、実装との乖離を `/kiro:spec-status` で定期確認する
- ユーザーの指示に従い、不明点のみ質問して、それ以外は自律的に完遂する
