// Atlas 設定（PoC: Prisma migrate からの段階移行）
//
// 運用手順の全体像は `.docs/db-migration-kysely-atlas.md` を参照。
// 使い方の要点:
//   - 望ましいスキーマは `atlas/schema.sql`（宣言的ソース）。
//   - `bun run db:atlas:diff <name>` で現マイグレーションとの差分から versioned migration を生成。
//   - `bun run db:atlas:apply` で実 DB に適用。
//
// 必要な環境変数:
//   DATABASE_URL   適用先の PostgreSQL（Supabase Transaction Pooler 等）
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
  // 適用先（マイグレーションを流す実 DB）
  url = var.url

  // Atlas が内部差分計算に使う一時 DB。
  // ローカルに Docker があれば docker:// ドライバが最も手軽（自動起動・破棄）。
  dev = var.dev_url != "" ? var.dev_url : "docker://postgres/17/dev?search_path=public"

  // 望ましいスキーマ（宣言的ソース）。`atlas schema inspect` で生成・更新する。
  src = "file://atlas/schema.sql"

  // 生成される versioned migration の格納先。
  migration {
    dir = "file://atlas/migrations"
  }

  // 生成 SQL の整形（インデント 2 スペース）。
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
