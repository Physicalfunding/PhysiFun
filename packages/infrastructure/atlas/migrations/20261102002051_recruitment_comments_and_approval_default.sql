-- Modify "recruitment_schedules" table
ALTER TABLE "recruitment_schedules" ALTER COLUMN "approvalMode" SET DEFAULT 'MANUAL';
-- Set comment to table: "recruitment_schedules"
COMMENT ON TABLE "recruitment_schedules" IS 'サポート募集の日程。1 募集につき 1 日 1 行で、その日の受付時間帯と、1 時間ごとの定員を持つ';
-- Set comment to column: "approvalMode" on table: "recruitment_schedules"
COMMENT ON COLUMN "recruitment_schedules"."approvalMode" IS '承認モード（AUTO=申し込んだ時点で確定 / MANUAL=リーダーの承認で確定）。既定値は、リーダーの画面の初期値と同じ MANUAL';
-- Set comment to table: "support_recruitments"
COMMENT ON TABLE "support_recruitments" IS 'サポート募集。プロジェクトに紐づく募集の単位';
-- Set comment to table: "support_tickets"
COMMENT ON TABLE "support_tickets" IS '【未実装】サポートチケット。サポーターが日程の中の時間帯に参加を申し込んだ記録（一般公開で実装する）。チケットは提供する時間の単位を表す言葉で、購入や在庫は無い';
