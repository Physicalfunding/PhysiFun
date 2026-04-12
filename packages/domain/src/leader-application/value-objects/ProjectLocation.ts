import { type Result, err, ok } from "../../shared/result";

/**
 * 都道府県コード（JIS X 0401 準拠）
 *
 * "01"（北海道）〜 "47"（沖縄県）の 2 桁文字列。
 */
export type PrefectureCode =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "30"
  | "31"
  | "32"
  | "33"
  | "34"
  | "35"
  | "36"
  | "37"
  | "38"
  | "39"
  | "40"
  | "41"
  | "42"
  | "43"
  | "44"
  | "45"
  | "46"
  | "47";

const PREFECTURE_CODE_REGEX = /^(?:0[1-9]|[1-3][0-9]|4[0-7])$/;

/**
 * 市区町村の文字数上限（`アカウント.md` B-3 仮値: 50 文字）
 */
const MAX_MUNICIPALITY_LENGTH = 50;

/**
 * ProjectLocation 値オブジェクト
 *
 * `prefectureCode`（必須, JIS X 0401）+ `municipality`（任意, 〜50 文字）の組。
 * 値は不変で `equals()` で比較する。
 */
export class ProjectLocation {
  private constructor(
    readonly prefectureCode: PrefectureCode,
    readonly municipality: string | null
  ) {}

  /**
   * ProjectLocation を生成する。
   *
   * - `prefectureCode` が JIS X 0401 の "01"〜"47" でないとエラー
   * - `municipality` は前後の空白をトリム後に判定
   * - トリム後が空文字の場合は null として扱う
   * - トリム後 50 文字超はエラー
   */
  static create(input: {
    prefectureCode: string;
    municipality?: string | null;
  }): Result<ProjectLocation, ProjectLocationError> {
    if (!PREFECTURE_CODE_REGEX.test(input.prefectureCode)) {
      return err({
        type: "INVALID_PREFECTURE_CODE",
        value: input.prefectureCode,
      });
    }

    const rawMunicipality = input.municipality ?? null;
    let normalizedMunicipality: string | null = null;
    if (rawMunicipality !== null) {
      const trimmed = rawMunicipality.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > MAX_MUNICIPALITY_LENGTH) {
          return err({
            type: "MUNICIPALITY_TOO_LONG",
            maxLength: MAX_MUNICIPALITY_LENGTH,
            actualLength: trimmed.length,
          });
        }
        normalizedMunicipality = trimmed;
      }
    }

    return ok(new ProjectLocation(input.prefectureCode as PrefectureCode, normalizedMunicipality));
  }

  equals(other: ProjectLocation): boolean {
    return this.prefectureCode === other.prefectureCode && this.municipality === other.municipality;
  }
}

export type ProjectLocationError =
  | { readonly type: "INVALID_PREFECTURE_CODE"; readonly value: string }
  | {
      readonly type: "MUNICIPALITY_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    };
