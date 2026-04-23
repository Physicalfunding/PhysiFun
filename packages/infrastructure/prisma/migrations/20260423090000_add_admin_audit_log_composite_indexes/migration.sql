-- ================================================================
-- AdminAuditLog: 複合 index 追加 (#169)
--
-- 背景:
--   既存 index は (adminAccountId) / (adminSessionId) / (createdAt) /
--   (targetType, targetId) のみで、以下のクエリが seq scan に落ちるリスクがあった:
--     - `findMany({ where: { action }, orderBy: { createdAt: 'desc' } })`
--     - `findMany({ where: { targetType }, orderBy: { createdAt: 'desc' } })`
--     - 操作者単位の履歴参照 (adminAccountId + createdAt desc)
--     - `groupBy({ by: ['action'] })` 相当の distinct 一覧 (listDistinctActions)
--
-- 変更内容:
--   - 複合 index 3 本を新設し、フィルタ + 時系列ソートを index only scan に乗せる。
--   - 既存単独 index (adminAccountId) は先頭カラム (adminAccountId, createdAt)
--     の leftmost prefix で完全に包含されるため削除して冗長性を排除。
--   - (targetType, targetId) は targetId 完全一致ルックアップ用として残す
--     ((targetType, createdAt) とは用途が異なる)。
--   - (createdAt) 単独 index は全件時系列ソート用として残す。
--
-- 冪等性 (#158 M5):
--   - CREATE INDEX / DROP INDEX はいずれも IF (NOT) EXISTS 付き。
--   - CONCURRENTLY はトランザクション内で実行できないため Prisma migrate では使わない。
--     本番データが成長してから適用する場合は手動で CONCURRENTLY 版に差し替え可。
-- ================================================================

-- 既存の単独 index を削除 (新設する複合 index の leftmost prefix で代替)
DROP INDEX IF EXISTS "admin_audit_logs_adminAccountId_idx";

-- 複合 index を追加
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_createdAt_idx"
  ON "admin_audit_logs" ("action", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_createdAt_idx"
  ON "admin_audit_logs" ("targetType", "createdAt");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminAccountId_createdAt_idx"
  ON "admin_audit_logs" ("adminAccountId", "createdAt");
