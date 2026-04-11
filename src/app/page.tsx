import { Phase1LP } from "@/components/top/Phase1LP";

/**
 * ISR（Incremental Static Regeneration）設定
 * ページを60秒間キャッシュし、バックグラウンドで再生成
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration
 */
export const revalidate = 60;

/**
 * ホームページ（トップページ）
 *
 * 新 Phase 1（リーダー募集 + リーダー機能）では、LP のみを表示する。
 * プロジェクト一覧ページなど Phase 2（一般公開）の画面は Phase 2 リリース PR で追加する。
 */
export default function Home() {
  return <Phase1LP />;
}
