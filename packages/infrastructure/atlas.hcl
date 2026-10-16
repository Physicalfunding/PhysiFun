// Atlas 設定（スキーマ / マイグレーション管理。#228 / #229 で Prisma migrate から移行）
//
// 運用手順の全体像は `docs/guides/db-migration.md` を参照。
// 使い方の要点:
//   - 望ましいスキーマは `atlas/schema.sql`（宣言的ソース。これが正本）。
//   - `bun run db:migrate:diff <name>` で schema.sql との差分から versioned migration を生成。
//   - `bun run db:migrate:deploy` で実 DB に適用。
//   - コマンドは `scripts/atlas.ts` 経由で実行され、apps/web/.env.local の DATABASE_URL を読み込む。
//
// 必要な環境変数:
//   DATABASE_URL   適用先の PostgreSQL。マイグレーションでは Supabase の Direct 接続（または Session Pooler）を使う
//   ATLAS_DEV_URL  差分計算用の使い捨て dev DB（未設定なら Docker で 16 を自動起動）

variable "url" {
  type    = string
  default = getenv("DATABASE_URL")
}

variable "dev_url" {
  type    = string
  default = getenv("ATLAS_DEV_URL")
}

env "local" {
  // 適用先（マイグレーションを流す実 DB）。
  // public スキーマに限定し、Supabase の auth / storage などの内部スキーマには触れない。
  url = urlqueryset(var.url, "search_path", "public")

  // Atlas が内部差分計算に使う一時 DB。
  // ローカルに Docker があれば docker:// ドライバが最も手軽（自動起動・破棄）。
  dev = var.dev_url != "" ? urlqueryset(var.dev_url, "search_path", "public") : "docker://postgres/16/dev?search_path=public"

  // 望ましいスキーマ（宣言的ソース）。
  src = "file://atlas/schema.sql"

  migration {
    // 生成される versioned migration の格納先。
    dir = "file://atlas/migrations"
    // 適用履歴テーブルは public の外に置く（アプリのテーブルと混ざらないようにするため）。
    revisions_schema = "atlas_schema_revisions"
  }

  // 生成 SQL の整形（インデント 2 スペース）。
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }

  // Prisma 時代の適用履歴テーブル（既存 DB に残る）は管理対象外にする。
  exclude = ["_prisma_migrations"]
}
