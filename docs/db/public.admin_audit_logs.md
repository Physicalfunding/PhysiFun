# public.admin_audit_logs

## 説明

運営の操作ログ（誰が・いつ・何に対して・何をしたか）。運営画面の操作ログ一覧で見る

## カラム

| 名前           | 型                             | 既定値            | NULL 可 | 参照先                                            | 説明                                                                                                                 |
| -------------- | ------------------------------ | ----------------- | ------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| id             | text                           |                   | false   |                                                   | ログ ID（UUID v4。アプリ側で生成）                                                                                   |
| adminAccountId | text                           |                   | false   | [public.admin_accounts](public.admin_accounts.md) | 操作した運営アカウント                                                                                               |
| adminSessionId | text                           |                   | true    | [public.admin_sessions](public.admin_sessions.md) | 操作したときのセッション。セッションが削除されると NULL になる                                                       |
| action         | text                           |                   | false   |                                                   | 操作の種類（対象.操作 の形。例: project.approve / leader_application.reject / admin_account.disable / outbox.retry） |
| targetType     | text                           |                   | false   |                                                   | 操作した対象の種類（AdminAccount / LeaderApplication / Project / OutboxMessage）                                     |
| targetId       | text                           |                   | true    |                                                   | 操作した対象の ID。特定のレコードが対象でない操作は NULL                                                             |
| metadata       | jsonb                          |                   | true    |                                                   | 操作ごとの補足情報（却下理由など。JSON）                                                                             |
| createdAt      | timestamp(3) without time zone | CURRENT_TIMESTAMP | false   |                                                   | 操作した日時                                                                                                         |

## 領域別のビュー

| 名前                                   | 定義                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| [運営の認証と監査](viewpoint-admin.md) | 運営アカウントの Magic Link 認証・セッション・操作ログ |

## 制約

| 名前                                 | 型          | 定義                                                                                              |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| admin_audit_logs_adminAccountId_fkey | FOREIGN KEY | FOREIGN KEY ("adminAccountId") REFERENCES admin_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT |
| admin_audit_logs_adminSessionId_fkey | FOREIGN KEY | FOREIGN KEY ("adminSessionId") REFERENCES admin_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL |
| admin_audit_logs_pkey                | PRIMARY KEY | PRIMARY KEY (id)                                                                                  |

## インデックス

| 名前                                          | 定義                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| admin_audit_logs_pkey                         | CREATE UNIQUE INDEX admin_audit_logs_pkey ON public.admin_audit_logs USING btree (id)                                               |
| admin_audit_logs_action_createdAt_idx         | CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON public.admin_audit_logs USING btree (action, "createdAt")                   |
| admin_audit_logs_adminAccountId_createdAt_idx | CREATE INDEX "admin_audit_logs_adminAccountId_createdAt_idx" ON public.admin_audit_logs USING btree ("adminAccountId", "createdAt") |
| admin_audit_logs_adminSessionId_idx           | CREATE INDEX "admin_audit_logs_adminSessionId_idx" ON public.admin_audit_logs USING btree ("adminSessionId")                        |
| admin_audit_logs_createdAt_idx                | CREATE INDEX "admin_audit_logs_createdAt_idx" ON public.admin_audit_logs USING btree ("createdAt")                                  |
| admin_audit_logs_targetType_createdAt_idx     | CREATE INDEX "admin_audit_logs_targetType_createdAt_idx" ON public.admin_audit_logs USING btree ("targetType", "createdAt")         |
| admin_audit_logs_targetType_targetId_idx      | CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON public.admin_audit_logs USING btree ("targetType", "targetId")           |

## ER 図

```mermaid
erDiagram

"public.admin_audit_logs" }o--|| "public.admin_accounts" : ""
"public.admin_audit_logs" }o--o| "public.admin_sessions" : ""

"public.admin_audit_logs" {
  text adminAccountId FK "操作した運営アカウント"
  text adminSessionId FK "操作したときのセッション。セッションが削除されると NULL になる"
}
"public.admin_accounts" {
  text id "運営アカウント ID（UUID v4。アプリ側で生成）"
}
"public.admin_sessions" {
  text id "セッション ID"
  text adminAccountId FK "ログインしている運営アカウント"
}
```

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
