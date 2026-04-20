import { isSafeHttpsUrl } from "./isSafeHttpsUrl";

/**
 * SNS リンクの安全表示コンポーネント。
 *
 * `SnsLinks` ドメイン VO の URL スキーム検証を通過した値のみ DB に到達する前提だが、
 * データ不整合や将来のマイグレーション漏れに備えて表示層でも再チェックする。
 * 不正スキームの場合はリンクではなくプレーンテキストで警告表示する。
 *
 * variant で 2 つの表示形式を切り替える:
 * - `paragraph` (default): `<p>label: <a>url</a></p>` 形式。admin 詳細画面で使用。
 * - `listItem`: `<a>label</a>` のみ (ラベル文字列がリンクテキスト)。
 *   呼び出し側で `<li>` などでラップして使う、公開プロジェクトページ向け。
 */
export function SafeSnsLink({
  label,
  url,
  variant = "paragraph",
}: {
  label: string;
  url: string | null;
  variant?: "paragraph" | "listItem";
}) {
  if (!url) return null;

  if (!isSafeHttpsUrl(url)) {
    // 生の URL を画面に出力すると javascript:/data: など悪意のある URL や
    // 機密を含む URL がそのまま画面に露出するため、固定文言のみ表示する
    // (PR #142 Major-1 対応)
    if (variant === "listItem") {
      return <span className="text-sm text-red-600">{label}: 表示できない URL 形式です</span>;
    }
    return <p className="text-sm text-red-600">{label}: 表示できない URL 形式です</p>;
  }

  if (variant === "listItem") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
      >
        {label}
      </a>
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
