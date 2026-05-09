# 01. システムアーキテクチャ

PhysiFun のシステム全体構成を、インフラ・monorepo・レイヤード設計の視点で俯瞰するドキュメント。

## このドキュメントの位置づけ

- **目的**: AI / 人間が「PhysiFun の全体像」を最初に把握するエントリポイント
- **正本**: `package.json` 群 / `vercel.json` 群 / `.docs/tech.md` / `.docs/structure.md`。本書はその視覚化・統合
- **揮発度**: 低（インフラ構成・パッケージ構造の変更時のみ更新）
- **関連**:
  - `.docs/tech.md` — 技術スタック詳細・環境変数・将来の AWS 移行方針
  - `.docs/structure.md` — ディレクトリ構成・レイヤー責務・命名規則
  - `02_domain-model.md` — ドメイン層の詳細
  - `03_data-model.md` — データモデルの詳細
  - `04_security-design.md` — 認証・認可・データ保護
  - `05_key-flows/` — 主要フローのシーケンス

> 💡 **本書を最初に読むと、他の設計仕様の位置づけが分かる**よう構成している。

---

## 1. システム全体の俯瞰

```mermaid
flowchart TB
    User[一般ユーザ<br/>リーダー・サポーター] -.-> WebDomain["&lt;domain&gt;<br/>Phase 1: web 中心"]
    Admin[運営] -.-> AdminDomain["admin.&lt;domain&gt;<br/>Magic Link 認証のみ"]

    subgraph Vercel["Vercel"]
        WebProj[web プロジェクト<br/>apps/web<br/>port 3000]
        AdminProj[admin プロジェクト<br/>apps/admin<br/>port 3001<br/>noindex/nofollow]
    end

    WebDomain --> WebProj
    AdminDomain --> AdminProj

    subgraph Supabase["Supabase（共有インスタンス）"]
        DB[(PostgreSQL)]
        Storage[Storage<br/>project-images バケット]
    end

    WebProj --> DB
    AdminProj --> DB
    WebProj --> Storage

    subgraph External["外部サービス"]
        Resend[Resend<br/>メール送信]
        Turnstile[Cloudflare Turnstile<br/>CAPTCHA]
    end

    WebProj -->|Outbox 経由| Resend
    AdminProj -->|Outbox 経由| Resend
    WebProj -->|siteverify| Turnstile

    classDef vercel fill:#000,color:#fff
    classDef supa fill:#3ecf8e,color:#fff
    classDef ext fill:#fa6,color:#000
    class WebProj,AdminProj vercel
    class DB,Storage supa
    class Resend,Turnstile ext
```

### 1.1 主要コンポーネント

| コンポーネント | 役割 |
|---|---|
| **apps/web (Vercel)** | 一般ユーザ向け Next.js アプリ（LP / 応募 / マイページ / 公開プロジェクトページ） |
| **apps/admin (Vercel)** | 運営管理 Next.js アプリ（応募審査 / プロジェクト審査 / 監査ログ） |
| **Supabase PostgreSQL** | メイン DB。**両アプリで同一インスタンスを共有**（テーブルは Phase 別分離なし） |
| **Supabase Storage** | プロジェクトカバー画像など（`project-images` バケット） |
| **Resend** | 全メール送信（アクティベーション・通知・Magic Link） |
| **Cloudflare Turnstile** | リーダー応募フォームの CAPTCHA |

> 💡 **Supabase は同一インスタンスを共有**するが、**Cookie・セッション・環境変数は完全分離**。詳細は §3 / `04_security-design.md` 参照。

---

## 2. ホスティング・サブドメイン分離

```mermaid
flowchart LR
    subgraph DNS["DNS"]
        Root["&lt;domain&gt;<br/>(apex)"]
        AdminSub["admin.&lt;domain&gt;<br/>(subdomain)"]
    end

    Root -->|別 Vercel プロジェクト| WebVercel[Vercel: web]
    AdminSub -->|別 Vercel プロジェクト| AdminVercel[Vercel: admin]

    WebVercel -->|Cookie: __Secure-next-auth| WebCookie["domain=&lt;domain&gt; host-only"]
    AdminVercel -->|Cookie: __Secure-next-auth| AdminCookie["domain=admin.&lt;domain&gt; host-only"]

    WebVercel -.->|NEXTAUTH_SECRET A| EnvA["環境変数 A"]
    AdminVercel -.->|NEXTAUTH_SECRET B<br/>+ ADMIN_MAGIC_LINK_HMAC_SECRET| EnvB["環境変数 B"]
```

### 2.1 完全分離の効果

- **Cookie の漏洩範囲を限定**: 一方のドメインで XSS が起きても、もう一方の Cookie は触れない（host-only Cookie）
- **環境変数の分離**: 一方のシークレット漏洩がもう一方に波及しない
- **デプロイの独立性**: web のデプロイ失敗で admin が止まらない / admin の更新でリーダーが影響を受けない
- **可観測性の独立**: それぞれの Vercel ダッシュボードで独立に監視

### 2.2 admin 側の追加防御

`apps/admin/vercel.json`:

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
  }]
}
```

→ **検索エンジンインデックス禁止**。誤って admin URL がリークしても検索流入は防げる。

---

## 3. Monorepo 構成

`bun workspaces` で管理。

```mermaid
flowchart TB
    subgraph Apps["apps/"]
        Web["apps/web<br/>@physifun/web<br/>(Next.js, port 3000)"]
        Admin["apps/admin<br/>@physifun/admin<br/>(Next.js, port 3001)"]
    end

    subgraph Packages["packages/"]
        UIShared["packages/ui-shared<br/>@physifun/ui-shared"]
        Application["packages/application<br/>@physifun/application"]
        Infrastructure["packages/infrastructure<br/>@physifun/infrastructure"]
        Domain["packages/domain<br/>@physifun/domain"]
    end

    Web -->|workspace:*| UIShared
    Web -->|workspace:*| Application
    Web -->|workspace:*| Infrastructure
    Web -->|workspace:*| Domain
    Admin -->|workspace:*| UIShared
    Admin -->|workspace:*| Application
    Admin -->|workspace:*| Infrastructure
    Admin -->|workspace:*| Domain
    Application --> Domain
    Infrastructure --> Domain
```

### 3.1 ワークスペースのルール

- 全ワークスペースは `@physifun/*` 名前空間
- `workspace:*` プロトコルで内部依存（バージョン管理不要）
- ルートで `bun install` するとシンボリックリンクが張られ、コード変更が即時反映

### 3.2 共有パッケージの責務（要点）

| パッケージ | 役割 | 詳細参照 |
|---|---|---|
| `domain` | エンティティ / 値オブジェクト / リポジトリ IF / `Result` 型 | `02_domain-model.md` |
| `application` | ユースケース（ビジネスロジック）+ ports | — |
| `infrastructure` | Prisma 実装 / Outbox / メール / Storage / Bcrypt / HMAC 等 | `03_data-model.md` |
| `ui-shared` | 両アプリ共通の UI コンポーネント・設定 | — |

詳細なディレクトリ構造とレイヤー責務は `.docs/structure.md` 参照。

---

## 4. レイヤード構成（依存方向）

```mermaid
flowchart TB
    UI["UI / API Route Handler<br/>(apps/{web,admin})"]
    UC["UseCase + ports<br/>(packages/application)"]
    Domain["Domain (Entity / VO / Repo IF / Result)<br/>(packages/domain)"]
    Infra["Infrastructure (Prisma / Mail / Storage / HMAC)<br/>(packages/infrastructure)"]
    External[(External Services)]

    UI --> UC
    UC --> Domain
    UI -.DI コンテナ経由.-> Infra
    Infra --> Domain
    Infra --> External
```

**依存ルール:**

- **`domain` は何にも依存しない**（pure TypeScript）
- **`application` は `domain` のみに依存**（外部ライブラリ無し）
- **`infrastructure` は `domain` のみに依存**（実装詳細）
- **`apps/*` は全層に依存可**（DI で組み合わせる）
- API Route Handler は **薄く**保ち、UseCase に処理を委ねる
- ビジネスロジックは **`application/use-cases/` に集約**
- DB / Storage / 外部 API は **`infrastructure/` 内のみ**

詳細は `.docs/structure.md` §レイヤー別責務参照。

### 4.1 リクエスト → DB / メールの流れ（CRUD パターン）

```mermaid
sequenceDiagram
    actor Client as Browser
    participant Route as API Route
    participant DI as DI Container
    participant UC as UseCase
    participant Repo as Repository IF
    participant Adapter as Prisma Adapter
    participant DB as PostgreSQL
    participant Outbox as Outbox Worker
    participant Mail as Resend

    Client->>Route: HTTP request
    Route->>DI: factory(request)
    DI-->>Route: UseCase instance
    Route->>UC: execute(input)
    UC->>UC: Zod / 値オブジェクト検証
    UC->>Repo: findById / save (IF)
    Repo->>Adapter: 実装呼び出し
    Adapter->>DB: SQL (Prisma)
    DB-->>Adapter: rows
    Adapter-->>Repo: Domain Entity
    Repo-->>UC: Entity
    UC-->>Route: Result<T, E>
    Route-->>Client: HTTP response
    Note over Route,Outbox: after() で Outbox tick
    Outbox->>Mail: send
```

詳細フロー（応募・公開審査・Magic Link・Outbox）は `05_key-flows/` 参照。

---

## 5. ランタイム実行環境

### 5.1 Vercel Functions

| 種別 | 用途 |
|---|---|
| **Server Component** | 認証チェック・DB 読み取りを伴うページ（`/my/...`、admin 配下） |
| **API Route Handler** | クライアント・運営からの状態変更（`/api/...`） |
| **Cron** | 定期処理（後述） |

> 💡 admin の Server Component は `export const dynamic = "force-dynamic"` を必須とする規約あり（`.docs/structure.md` 参照）。

### 5.2 Cron スケジュール

| アプリ | Path | スケジュール | 役割 |
|---|---|---|---|
| web | `/api/cron/cleanup-expired-accounts` | `0 0 * * *` (daily) | 72h 経過の `PENDING_EMAIL_CONFIRMATION` Account を物理削除 |
| web | `/api/cron/process-outbox` | `0 0 * * *` (daily) | LeaderApplication / Project Outbox の処理（A 経路） |
| admin | `/api/cron/gc-admin-auth` | `0 0 * * *` (daily) | 期限切れ `AdminVerificationToken` / `AdminSession` を削除 |

> ⚠️ **すべて daily** は Vercel Hobby プラン制約。**Pro プラン化後は `* * * * *`（毎分）に切り替える**ことが必要（`process-outbox` のメール送信 SLA 30s〜1min を満たすため、Issue #187）。

### 5.3 即時トリガー（Outbox の B 経路）

UseCase 完了後に Next.js `after()` でワーカーを呼ぶ。Hobby プランでも数秒以内のメール送信を実現する仕組み。詳細は `05_key-flows/outbox-mail.md` 参照。

---

## 6. 環境変数の二系統分離

```mermaid
flowchart LR
    subgraph WebEnv["apps/web の環境変数"]
        W1[NEXTAUTH_SECRET 値A]
        W2[NEXTAUTH_URL https://&lt;domain&gt;]
        W3[DATABASE_URL]
        W4[SUPABASE_SERVICE_ROLE_KEY]
        W5[RESEND_API_KEY]
        W6[TURNSTILE_SECRET_KEY]
        W7[CRON_SECRET]
    end

    subgraph AdminEnv["apps/admin の環境変数"]
        A1[NEXTAUTH_SECRET 値B<br/>※ web と必ず別値]
        A2[NEXTAUTH_URL https://admin.&lt;domain&gt;]
        A3[DATABASE_URL ※ web と同値 OK]
        A4[ADMIN_MAGIC_LINK_HMAC_SECRET<br/>※ NEXTAUTH_SECRET と必ず別値]
        A5[RESEND_API_KEY]
        A6[CRON_SECRET]
        A7[MAIL_FROM]
    end
```

**分離原則:**

- `NEXTAUTH_SECRET` は **必ず別値**
- `ADMIN_MAGIC_LINK_HMAC_SECRET` は admin 側のみ。**`NEXTAUTH_SECRET` と必ず別値**（同値だと起動拒否）
- `DATABASE_URL` は同じインスタンスを指すので同値で OK
- 各 Vercel プロジェクトの環境変数 UI で独立に管理

詳細は `04_security-design.md` §10 参照。

---

## 7. ローカル開発環境

```mermaid
flowchart LR
    subgraph LocalSupabase["ローカル Supabase (Docker)"]
        LDB[(PostgreSQL<br/>:54322)]
        LStorage[Storage<br/>:54321]
        LStudio[Studio<br/>:54323]
    end

    subgraph LocalNext["ローカル Next.js"]
        LWeb[apps/web<br/>:3000]
        LAdmin[apps/admin<br/>:3001]
    end

    LWeb --> LDB
    LWeb --> LStorage
    LAdmin --> LDB
    LAdmin --> LStorage

    Tools[bun / supabase CLI / Docker Desktop]
```

| ツール | 用途 |
|---|---|
| Bun | パッケージマネージャ + ランタイム |
| Supabase CLI | ローカル PostgreSQL + Storage + Studio の起動 |
| Docker Desktop | Supabase のコンテナ実行基盤 |

セットアップ手順は `README.md` および `.docs/tech.md` 参照。

---

## 8. SEO / レンダリング戦略

| ページ種別 | レンダリング | 理由 |
|---|---|---|
| LP（トップページ） | SSG | SEO 対象はここのみ |
| 公開プロジェクト詳細 | SSR or ISR | Phase 2 で本格活用 |
| マイページ系 | CSR | 認証後のため SEO 不要 |
| admin 全画面 | Server Component (`force-dynamic`) | 常に最新表示。SEO 対象外（noindex） |

> 💡 Phase 1 では `/projects/[slug]` に `robots: { index: false, follow: false }` を付与中。Phase 2 で外す予定。

---

## 9. Phase 別のスコープ俯瞰

```mermaid
flowchart TB
    subgraph Phase1["Phase 1（実装中）"]
        P1A[リーダー募集 LP]
        P1B[応募フォーム + アクティベート]
        P1C[プロジェクト作成・編集・公開申請]
        P1D[公開プロジェクトページ<br/>4タブ中ホームのみ]
        P1E[運営審査 admin]
    end

    subgraph Phase2["Phase 2（未着手）"]
        P2A[サポーター自由登録]
        P2B[プロジェクト一覧・検索]
        P2C[サポート申請<br/>SupportRecruitment 起動]
        P2D[サポート募集の公開ページ統合]
    end

    Phase1 -->|コード変更リリース| Phase2
```

**Phase 1 → Phase 2 の移行**は**ランタイムフィーチャーフラグではなくコード変更リリース**で行う方針（`.docs/product.md` 参照）。

> 💡 `SupportRecruitment` / `RecruitmentSchedule` / `SupportTicket` は **Prisma schema のみ存在**し、ドメイン層・UI 実装は無い（Phase 2 候補）。詳細は `02_domain-model.md` §8、`03_data-model.md` §3 参照。

---

## 10. 将来の AWS 移行方針

`.docs/tech.md` に詳細な移行候補が記載されている。要点だけ：

| 現在 | 将来（AWS） |
|---|---|
| Vercel 静的配信 | CloudFront + S3 |
| Vercel API Routes | API Gateway + Lambda（または Amplify Hosting / OpenNext / SST） |
| Supabase PostgreSQL | RDS PostgreSQL |
| NextAuth.js | Cognito（または継続） |
| Supabase Storage | S3 |

**移行に備えた現在の設計指針:**

- **Supabase SDK の直接呼び出しは `infrastructure/` 層のみ**
- **ビジネスロジックに Supabase 依存を持ち込まない**
- **環境変数で接続先を切り替えられる構造を維持**
- **`packages/{domain, application}` は Vercel/AWS 両方で動く想定で書く**

レイヤー分離が AWS 移行時のコード変更量を最小化する設計上の保険になっている。

---

## 11. 改訂履歴

| 日付 | 改訂内容 | 担当 |
|---|---|---|
| 2026-05-09 | 初稿作成（Phase 1 実装時点のシステム俯瞰、インフラ図・monorepo・レイヤー・Cron・環境変数分離・将来展望） | 設計チーム |
