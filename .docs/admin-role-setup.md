# ADMIN ロール付与の運用手順

## 概要

Phase 1 では ADMIN ロール付与 UI は存在しない。
運営メンバーのアカウント作成・ADMIN ロール付与は、Supabase Studio（DB 直編集）で行う。

対象: 運営メンバー 2 名分のアカウント

## 前提条件

- Supabase プロジェクトにアクセスできること
- Supabase Studio の URL を把握していること（本番・ステージング）
- 運営メンバーのメールアドレスが決まっていること
- bcrypt ハッシュを生成できる環境があること（Node.js / bun）

## テーブル構造（参考）

対象テーブル: `accounts`（Prisma モデル名: `Account`）

| カラム | 型 | 備考 |
|---|---|---|
| `id` | UUID | `gen_random_uuid()` で自動生成 |
| `email` | TEXT (UNIQUE) | メールアドレス |
| `displayName` | TEXT | 表示名 |
| `status` | enum `AccountStatus` | `PENDING_EMAIL_CONFIRMATION` / `ACTIVE` |
| `passwordHash` | TEXT (nullable) | bcrypt ハッシュ |
| `roles` | enum `Role[]` | `{SUPPORTER}`, `{SUPPORTER,ADMIN}` など |
| `activationToken` | TEXT (nullable, UNIQUE) | アクティベーション用 |
| `activationTokenExp` | TIMESTAMP (nullable) | トークン有効期限 |
| `iconUrl` | TEXT (nullable) | アイコン URL |
| `bio` | TEXT (nullable) | 自己紹介 |
| `snsLinks` | JSONB (nullable) | SNS リンク |
| `contributedHours` | INT | デフォルト 0 |
| `receivedHours` | INT | デフォルト 0 |
| `createdAt` | TIMESTAMP | 自動 |
| `updatedAt` | TIMESTAMP | 自動 |

### ロール一覧

| ロール | 用途 |
|---|---|
| `SUPPORTER` | 全アカウント共通（デフォルト） |
| `LEADER` | リーダー応募承認後に付与 |
| `ADMIN` | 運営メンバー |

---

## 手順 1: 運営メンバーのアカウント作成

2 つの方法がある。状況に応じて選択する。

### 方法 A: 通常フロー経由（推奨）

通常の応募フローでアカウントを作成し、その後 Supabase Studio でロールを変更する。

1. `/apply` フォームからメールアドレス・パスワードを入力して応募する
2. アクティベーションメールのリンクをクリックしてアカウントを有効化する
3. アカウントの `status` が `ACTIVE` になったことを確認する
4. **手順 2** に進み、ADMIN ロールを付与する

> 方法 A のメリット: パスワードハッシュやアクティベーションの処理をアプリケーションに任せられるため、手動ミスが少ない。

### 方法 B: Supabase Studio の SQL エディタで直接 INSERT

アプリケーションがまだデプロイされていない場合や、初期セットアップ時に使用する。

#### B-1. パスワードハッシュの生成

```bash
# bun の場合
echo -n 'ここに強固なパスワード' | npx bcryptjs hash

# または Node.js スクリプト
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('ここに強固なパスワード', 10, (err, hash) => console.log(hash));"
```

> パスワードは最低 12 文字以上、英大小文字・数字・記号を含む強固なものを使用すること。

#### B-2. SQL で INSERT

Supabase Studio の SQL Editor で以下を実行する。

```sql
-- 運営メンバー 1
INSERT INTO accounts (
  id,
  email,
  "displayName",
  status,
  roles,
  "passwordHash",
  "contributedHours",
  "receivedHours",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin1@example.com',          -- 実際のメールアドレスに置き換え
  '管理者1',                       -- 表示名
  'ACTIVE',
  ARRAY['SUPPORTER', 'ADMIN']::"Role"[],
  '$2b$10$...ここにbcryptハッシュ...', -- B-1 で生成したハッシュ
  0,
  0,
  NOW(),
  NOW()
);

-- 運営メンバー 2
INSERT INTO accounts (
  id,
  email,
  "displayName",
  status,
  roles,
  "passwordHash",
  "contributedHours",
  "receivedHours",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin2@example.com',          -- 実際のメールアドレスに置き換え
  '管理者2',                       -- 表示名
  'ACTIVE',
  ARRAY['SUPPORTER', 'ADMIN']::"Role"[],
  '$2b$10$...ここにbcryptハッシュ...', -- B-1 で生成したハッシュ
  0,
  0,
  NOW(),
  NOW()
);
```

---

## 手順 2: 既存アカウントに ADMIN ロールを追加

方法 A で作成したアカウント、または既に存在するアカウントに ADMIN ロールを追加する場合。

```sql
-- 既存アカウントに ADMIN ロールを追加（重複付与を防止）
UPDATE accounts
SET roles = array_append(roles, 'ADMIN'::"Role"),
    "updatedAt" = NOW()
WHERE email = 'admin@example.com'
  AND NOT ('ADMIN' = ANY(roles));
```

---

## 手順 3: 確認

ADMIN ロールが正しく付与されたことを確認する。

```sql
-- ADMIN ロール保持者の一覧
SELECT id, email, "displayName", roles, status
FROM accounts
WHERE 'ADMIN' = ANY(roles);
```

期待される結果:
- 2 名分のレコードが表示される
- `roles` に `ADMIN` が含まれている
- `status` が `ACTIVE` になっている

---

## 手順 4: ロール削除（緊急時）

ADMIN ロールを剥奪する必要がある場合（アカウント侵害時など）。

```sql
-- ADMIN ロールを削除
UPDATE accounts
SET roles = array_remove(roles, 'ADMIN'::"Role"),
    "updatedAt" = NOW()
WHERE email = 'admin@example.com';
```

削除後、手順 3 の確認クエリで対象アカウントが表示されないことを確認する。

---

## 注意事項

- **最小権限の原則**: ADMIN ロール付与は最小限のメンバーに限定する
- **パスワード強度**: 最低 12 文字以上、英大小文字・数字・記号を含む
- **アクセス制限**: 本番環境の Supabase Studio へのアクセスは限定メンバーのみに許可する
- **動作確認**: ロール変更後は `apps/admin`（管理画面）にログインして動作確認する
- **本番操作時の注意**: SQL 実行前に必ず `WHERE` 句の対象を確認する。`BEGIN` / `COMMIT` でトランザクションを使うことを推奨する

```sql
-- トランザクション例
BEGIN;

UPDATE accounts
SET roles = array_append(roles, 'ADMIN'::"Role"),
    "updatedAt" = NOW()
WHERE email = 'admin@example.com'
  AND NOT ('ADMIN' = ANY(roles));

-- 結果を確認
SELECT id, email, "displayName", roles, status
FROM accounts
WHERE email = 'admin@example.com';

-- 問題なければ
COMMIT;
-- 問題があれば
-- ROLLBACK;
```

---

## 将来の改善

- ADMIN ロール付与 UI の追加（既存 ADMIN による昇格機能）
- 監査ログの導入（誰がいつロールを変更したか記録）
- 2FA（二要素認証）の必須化
- ADMIN ロール付与時の承認フロー導入
