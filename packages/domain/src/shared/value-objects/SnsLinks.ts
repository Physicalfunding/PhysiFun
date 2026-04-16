import { type Result, err, ok } from "../../shared/result";

/**
 * SNS リンクの文字数上限（`アカウント.md` B-3 仮値: 各 500 文字）
 */
const MAX_SNS_URL_LENGTH = 500;

/**
 * 許可する URL スキーム一覧。
 *
 * セキュリティ上、`javascript:` / `data:` / `vbscript:` などの XSS 誘発可能な
 * スキームを弾くためのホワイトリスト。相対 URL (`/foo`, `foo.com`) も外部リンク
 * としては不正な入力とみなすため拒否する (表示層で必ず `<a href>` / `<img src>`
 * に渡るという前提での defense-in-depth 方針)。
 */
const ALLOWED_URL_SCHEMES = ["https://", "http://"] as const;

/**
 * SnsLinks 値オブジェクト
 *
 * プロジェクトに紐づく SNS / ウェブサイトのリンク集。すべての項目は任意。
 * URL は `https://` / `http://` スキームのみ許可し、長さは 500 文字以内に制限する。
 */
export class SnsLinks {
  private constructor(
    readonly x: string | null,
    readonly instagram: string | null,
    readonly facebook: string | null,
    readonly website: string | null
  ) {}

  /**
   * SnsLinks を生成する。
   *
   * - 各フィールドは任意
   * - 前後の空白をトリム
   * - トリム後が空文字なら null として扱う
   * - トリム後 500 文字超はエラー
   */
  static create(input: {
    x?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    website?: string | null;
  }): Result<SnsLinks, SnsLinksError> {
    const xResult = normalizeLink("x", input.x ?? null);
    if (!xResult.ok) return xResult;

    const instagramResult = normalizeLink("instagram", input.instagram ?? null);
    if (!instagramResult.ok) return instagramResult;

    const facebookResult = normalizeLink("facebook", input.facebook ?? null);
    if (!facebookResult.ok) return facebookResult;

    const websiteResult = normalizeLink("website", input.website ?? null);
    if (!websiteResult.ok) return websiteResult;

    return ok(
      new SnsLinks(xResult.value, instagramResult.value, facebookResult.value, websiteResult.value)
    );
  }

  /**
   * 全項目が空（null）かどうか
   */
  isEmpty(): boolean {
    return (
      this.x === null && this.instagram === null && this.facebook === null && this.website === null
    );
  }

  equals(other: SnsLinks): boolean {
    return (
      this.x === other.x &&
      this.instagram === other.instagram &&
      this.facebook === other.facebook &&
      this.website === other.website
    );
  }
}

export type SnsLinksField = "x" | "instagram" | "facebook" | "website";

export type SnsLinksError =
  | {
      readonly type: "SNS_URL_TOO_LONG";
      readonly field: SnsLinksField;
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "INVALID_URL_SCHEME";
      readonly field: SnsLinksField;
      readonly allowedSchemes: readonly string[];
    };

function normalizeLink(
  field: SnsLinksField,
  raw: string | null
): Result<string | null, SnsLinksError> {
  if (raw === null) return ok(null);
  const trimmed = raw.trim();
  if (trimmed.length === 0) return ok(null);
  if (trimmed.length > MAX_SNS_URL_LENGTH) {
    return err({
      type: "SNS_URL_TOO_LONG",
      field,
      maxLength: MAX_SNS_URL_LENGTH,
      actualLength: trimmed.length,
    });
  }
  // スキーム検証は小文字化した文字列で判定し、`JAVASCRIPT:` や `HTTPS://` の
  // ような大小混在ケースも同一視する
  const lower = trimmed.toLowerCase();
  if (!ALLOWED_URL_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return err({
      type: "INVALID_URL_SCHEME",
      field,
      allowedSchemes: ALLOWED_URL_SCHEMES,
    });
  }
  return ok(trimmed);
}
