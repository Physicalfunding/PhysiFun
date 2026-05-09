# 05. 主要フロー（シーケンス図）

PhysiFun の主要なユースケースをシーケンス図で表現したドキュメント群。

## このディレクトリの位置づけ

- **目的**: AI / 人間が「ある操作が実行されたとき何が起きるか」を時系列で把握する
- **正本**: コード（`apps/`、`packages/application/`、`packages/infrastructure/`）。本書はその挙動意図の図解
- **揮発度**: 中（フロー変更時に同 PR で更新）
- **形式**: Mermaid `sequenceDiagram` を中心に、状態遷移は `stateDiagram-v2`

## 4 つのフロー

| ファイル | フロー | カバー範囲 |
|---|---|---|
| [`leader-application.md`](./leader-application.md) | リーダー応募 → アクティベート | `/apply` 送信 → CAPTCHA + IP rate limit → Account 作成 → アクティベーションメール → パスワード設定 → `ACTIVE` |
| [`project-publish.md`](./project-publish.md) | プロジェクト公開審査 | `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` の往復、運営承認・差戻・強制非公開・自主取下げ・自主非公開 |
| [`admin-magic-link.md`](./admin-magic-link.md) | 運営 Magic Link 認証 | NextAuth EmailProvider + HMAC 署名 + AdminVerificationToken + AdminSession (1h TTL) |
| [`outbox-mail.md`](./outbox-mail.md) | Outbox メール送信 | Vercel Cron + `after()` 即時トリガー / claim_lock / リトライ・dead_letter / 7 メッセージタイプ → プロセッサ対応表 |

## 関連

- ドメイン層の状態遷移: `02_domain-model.md`
- DB レベルの整合性: `03_data-model.md`
- 認証アーキ全般: `04_security-design.md`
