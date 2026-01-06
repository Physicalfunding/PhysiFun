# Campfire Experience - 開発用Makefile
# 使用方法: make [コマンド名]

# 設定
DOCKER_CONTAINER_NAME := crowfun-db
POSTGRES_USER := postgres
POSTGRES_PASSWORD := password
POSTGRES_DB := crowfun_experience
POSTGRES_PORT := 5432

.PHONY: help db-start db-stop db-restart db-logs db-status db-migrate db-push db-studio db-reset dev build test test-watch lint format clean setup

# ヘルプ表示
help:
	@echo "Campfire Experience - 開発コマンド一覧"
	@echo ""
	@echo "=== データベース ==="
	@echo "  make db-start    : PostgreSQLコンテナを起動"
	@echo "  make db-stop     : PostgreSQLコンテナを停止"
	@echo "  make db-restart  : PostgreSQLコンテナを再起動"
	@echo "  make db-logs     : PostgreSQLのログを表示"
	@echo "  make db-status   : コンテナの状態を確認"
	@echo "  make db-migrate  : Prismaマイグレーションを実行"
	@echo "  make db-push     : スキーマをDBに反映（開発用）"
	@echo "  make db-studio   : Prisma Studioを起動"
	@echo "  make db-reset    : DBをリセット（データ全削除）"
	@echo ""
	@echo "=== 開発 ==="
	@echo "  make dev         : 開発サーバーを起動"
	@echo "  make build       : プロダクションビルド"
	@echo "  make test        : テストを実行"
	@echo "  make test-watch  : テストをウォッチモードで実行"
	@echo "  make lint        : ESLintを実行"
	@echo "  make format      : Prettierでフォーマット"
	@echo ""
	@echo "=== セットアップ ==="
	@echo "  make setup       : 初期セットアップ（DB起動+マイグレーション）"
	@echo "  make clean       : Dockerコンテナとボリュームを削除"

# ==================== データベース ====================

# PostgreSQLコンテナを起動
db-start:
	@echo "PostgreSQLコンテナを起動中..."
	@docker start $(DOCKER_CONTAINER_NAME) 2>/dev/null || \
	docker run --name $(DOCKER_CONTAINER_NAME) \
		-e POSTGRES_USER=$(POSTGRES_USER) \
		-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
		-e POSTGRES_DB=$(POSTGRES_DB) \
		-p $(POSTGRES_PORT):5432 \
		-d postgres:14
	@echo "PostgreSQLが起動しました (localhost:$(POSTGRES_PORT))"
	@echo "接続待機中..."
	@sleep 3

# PostgreSQLコンテナを停止
db-stop:
	@echo "PostgreSQLコンテナを停止中..."
	@docker stop $(DOCKER_CONTAINER_NAME) 2>/dev/null || echo "コンテナは既に停止しています"

# PostgreSQLコンテナを再起動
db-restart: db-stop db-start

# PostgreSQLのログを表示
db-logs:
	@docker logs -f $(DOCKER_CONTAINER_NAME)

# コンテナの状態を確認
db-status:
	@docker ps -a --filter name=$(DOCKER_CONTAINER_NAME) --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Prismaマイグレーションを実行
db-migrate:
	@echo "Prismaマイグレーションを実行中..."
	bun run db:generate
	bun run db:migrate

# スキーマをDBに反映（開発用、マイグレーション履歴なし）
db-push:
	@echo "スキーマをDBに反映中..."
	bun run db:generate
	bun run db:push

# Prisma Studioを起動
db-studio:
	@echo "Prisma Studioを起動中..."
	bun run db:studio

# DBをリセット（データ全削除）
db-reset:
	@echo "警告: データベースをリセットします。全てのデータが削除されます。"
	@read -p "続行しますか？ (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker stop $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	@docker volume rm $(DOCKER_CONTAINER_NAME)_data 2>/dev/null || true
	@$(MAKE) db-start
	@$(MAKE) db-migrate
	@echo "データベースをリセットしました"

# ==================== 開発 ====================

# 開発サーバーを起動
dev:
	bun run dev

# プロダクションビルド
build:
	bun run build

# テストを実行
test:
	bun test

# テストをウォッチモードで実行
test-watch:
	bun run test:watch

# ESLintを実行
lint:
	bun run lint

# Prettierでフォーマット
format:
	bun run format

# ==================== セットアップ ====================

# 初期セットアップ
setup: db-start
	@echo "依存パッケージをインストール中..."
	bun install
	@echo "Prismaクライアントを生成中..."
	bun run db:generate
	@echo "マイグレーションを実行中..."
	bun run db:migrate
	@echo ""
	@echo "セットアップが完了しました！"
	@echo "開発サーバーを起動するには: make dev"

# Dockerコンテナとボリュームを削除
clean:
	@echo "Dockerコンテナとボリュームを削除中..."
	@docker stop $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	@docker rm $(DOCKER_CONTAINER_NAME) 2>/dev/null || true
	@echo "クリーンアップが完了しました"
