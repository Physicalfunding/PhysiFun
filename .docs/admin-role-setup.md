# 運営アカウント (AdminAccount) のセットアップ・運用手順

## 概要

`apps/admin` の認証は **`AdminAccount` ベース + Magic Link (NextAuth EmailProvider) + Database セッション戦略**。Phase 2 準備（Issue #140 系）で `Account.roles = ADMIN` 方式は廃止済み。

本ドキュメントは:

- 初期 `AdminAccount` を作成する手順
- 運用中に運営メンバーを追加・無効化・再有効化する手順
- 必要な環境変数 / Cron / 監査ログ
- 緊急時の強制 revoke 手順

を扱う。設計の詳細は `docs-repository/docs/202604_初回リリースに向けた計画/運営アプリ.md` および `アカウント.md` の「運営アカウント (AdminAccount)」セクション参照。

---

## 集約（参考）

```
AdminAccount (運営アカウント)
  ├─ AdminSession                 (Database セッション、TTL 1h)
  ├─ AdminVerificationToken       (Magic Link ワンタイムトークン)
  └─ AdminAuditLog                (運営操作の監査証跡)
```

| テーブル | 主用途 | 備考 |
|---|---|---|
| `admin_accounts` | 運営アカウント本体 | `email` (UNIQUE) + `status` (ACTIVE / DISABLED) |
| `admin_sessions` | NextAuth セッション | DELETE で即時 revoke |
| `admin_verification_tokens` | Magic Link トークン | 1 回消費で削除。`/api/cron/gc-admin-auth` で期限切れも回収 |
| `admin_audit_logs` | 監査ログ | `adminSessionId` は SetNull で履歴を残す |

---

## 環境変数（Vercel `apps/admin` プロジェクト）

| 変数 | 用途 | 注意点 |
|---|---|---|
| `NEXTAUTH_SECRET` | NextAuth セッション / Magic Link トークン署名 | `apps/web` と **別値**。本番未設定なら起動拒否 (#147 M-3) |
| `NEXTAUTH_URL` | Magic Link URL の origin | `https://admin.<本番ドメイン>` を設定。誤って web 側に向くとリンクが死ぬ |
| `ADMIN_MAGIC_LINK_HMAC_SECRET` | Magic Link URL の HMAC 署名鍵 | `NEXTAUTH_SECRET` と **別値**。未設定なら起動時に明示エラー (fail closed, #146) |
| `RESEND_API_KEY` | Magic Link メール送信 (Resend) | `apps/web` と分離するなら別キーを推奨 |
| `MAIL_FROM` | 送信元アドレス | 例: `"PhysiFun 運営" <admin-noreply@<本番ドメイン>>` |
| `CRON_SECRET` | `/api/cron/gc-admin-auth` の Authorization 検証 | `Bearer <CRON_SECRET>`。timingSafeEqual で比較 |
| `ADMIN_SEED_EMAIL` | seed スクリプトが作成する初期 AdminAccount の email | seed 後に Vercel から削除可 |
| `DATABASE_URL` | 共通 Supabase Postgres | `apps/web` と同値で OK |

> `NEXTAUTH_SECRET` と `ADMIN_MAGIC_LINK_HMAC_SECRET` は **必ず別値**にする。同一値で運用すると HMAC 検証層を回避された場合に署名と Cookie の独立性が崩れる。

---

## Vercel Cron（期限切れ GC）

`apps/admin/vercel.json` で `/api/cron/gc-admin-auth` を毎時実行する設定済み。

- スケジュール: `0 * * * *`
- 認証: `Authorization: Bearer <CRON_SECRET>`
- 処理: `AdminVerificationToken` / `AdminSession` のうち `expires < now()` の行を物理削除
- 監査: `AdminAuditLog.adminSessionId` は SetNull なので、セッションが GC された後も履歴は残る

ローカル / E2E では cron は走らないため、テスト側から `fetch('/api/cron/gc-admin-auth', { headers: { authorization: 'Bearer <CRON_SECRET>' } })` を直接叩いて検証する。

---

## 初期セットアップ

### 推奨: seed スクリプト経由

```bash
# 環境変数 (.env.local など)
DATABASE_URL=postgres://...
ADMIN_SEED_EMAIL=admin@your-domain.example

bun --filter @physifun/infrastructure prisma db seed
```

`packages/infrastructure/prisma/seed.ts` が `ADMIN_SEED_EMAIL` の `AdminAccount` を `ACTIVE` で upsert する。完了後は `ADMIN_SEED_EMAIL` を Vercel から削除して構わない。

### 代替: Supabase Studio から SQL 直接実行

```sql
INSERT INTO admin_accounts (id, email, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@your-domain.example',
  'ACTIVE',
  NOW(),
  NOW()
);
```

> パスワードハッシュは不要（Magic Link 方式のため）。

---

## 運用中の運営メンバー追加（推奨）

`/admin/members` UI から実行する（#148）:

1. ACTIVE な運営として `apps/admin` にログイン
2. `/admin/members` を開き、追加フォームに新規運営の email を入力
3. `AdminAccount` が `ACTIVE` で作成される
4. 追加された運営は `/admin/login` で email を入力 → Magic Link を受信 → リンククリックでログイン可能

操作は `AdminAuditLog` に `admin_account.create` として記録される。

---

## 運営メンバー無効化 (`disable`)

`/admin/members` の各行アクション「無効化」を実行する:

- `AdminAccount.status` が `DISABLED` に変更される
- 当該 AdminAccount の `AdminSession` が **すべて削除される**（強制 revoke）
- 以降は `/admin/login` で email を入力しても `signIn` callback で弾かれて Magic Link は送信されない
- `AdminAuditLog` に `admin_account.disable` + `admin_session.revoke` が記録される

> 自分自身の `AdminAccount` は無効化できない（UI / API ともにガード）。最後の運営が抜けるリスクを構造的に排除している。

### 緊急時に手作業で revoke する場合

UI からアクセスできない場合は SQL で直接行う:

```sql
-- 1. AdminAccount を DISABLED に
UPDATE admin_accounts
SET status = 'DISABLED', "updatedAt" = NOW()
WHERE email = 'compromised@example.com';

-- 2. 該当 AdminAccount の AdminSession を全削除（強制 revoke）
DELETE FROM admin_sessions
WHERE "adminAccountId" IN (
  SELECT id FROM admin_accounts WHERE email = 'compromised@example.com'
);

-- 3. 念のため未消費の Magic Link トークンも無効化
DELETE FROM admin_verification_tokens
WHERE identifier = 'compromised@example.com';
```

監査履歴を残すため、操作後に `AdminAuditLog` へ手動 INSERT も検討する（運用裁量）。

---

## 再有効化 (`enable`)

`/admin/members` の各行アクション「再有効化」で `DISABLED → ACTIVE` に戻す。`AdminAuditLog` に `admin_account.enable` が記録される。

---

## 確認クエリ

```sql
-- ACTIVE な運営アカウント一覧
SELECT id, email, status, "lastLoginAt", "createdAt"
FROM admin_accounts
WHERE status = 'ACTIVE'
ORDER BY "createdAt";

-- 直近 24 時間の運営操作履歴
SELECT
  l."createdAt",
  a.email AS admin_email,
  l.action,
  l."targetType",
  l."targetId"
FROM admin_audit_logs l
JOIN admin_accounts a ON a.id = l."adminAccountId"
WHERE l."createdAt" >= NOW() - INTERVAL '24 hours'
ORDER BY l."createdAt" DESC;
```

---

## 注意事項

- **最小権限の原則**: `AdminAccount` は最小限のメンバーに限定する
- **アクセス制限**: 本番 Supabase Studio へのアクセスは限定メンバーのみ
- **動作確認**: 追加・無効化後は `/admin/login` で実際にログインできる/できないを確認
- **パスワードは不要**: Magic Link 方式のため共有すべき資格情報は無い。アクセスは email 受信箱の所有 + Magic Link クリックで完結する
- **`AdminAccount` は物理削除しない**: 監査履歴を保つため `status = DISABLED` で論理削除する。FK は `onDelete: Restrict`

---

## 関連 Issue / 実装

- #140: 親 Issue（AdminAccount 完全分離）
- #144: ドメイン + Prisma migration
- #145: `apps/admin` NextAuth を AdminAccount + Magic Link に差し替え
- #146: Magic Link URL の HMAC 検証強化
- #147: `apps/admin` を別 Vercel プロジェクト化 + サブドメイン公開
- #148: 運営メンバー追加 UI + 強制 revoke
- #149: AdminAuditLog 操作履歴 UI
- #150: ドキュメント更新 + E2E 検証（本ドキュメントの整備を含む）
