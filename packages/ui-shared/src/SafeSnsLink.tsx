import { isSafeHttpsUrl } from "./isSafeHttpsUrl";

/**
 * SNS リンクの安全表示コンポーネント。
 *
 * `SnsLinks` ドメイン VO の URL スキーム検証を通過した値のみ DB に到達する前提だが、
 * データ不整合や将来のマイグレーション漏れに備えて表示層でも再チェックする。
 * 不正スキームの場合はリンクではなくプレーンテキストで警告表示する。
 */
export function SafeSnsLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  if (!isSafeHttpsUrl(url)) {
    return (
      // 生の URL を画面に出力すると javascript:/data: など悪意のある URL や
      // 機密を含む URL がそのまま管理画面に露出するため、固定文言のみ表示する
      // (PR #142 Major-1 対応)
      <p className="text-sm text-red-600">{label}: 表示できない URL 形式です</p>
    );
  }
  return (
    <p className="text-sm">
      {label}:{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {url}
      </a>
    </p>
  );
}
