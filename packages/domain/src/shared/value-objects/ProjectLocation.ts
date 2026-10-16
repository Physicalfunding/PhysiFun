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

/**
 * 都道府県マスタ（コードと名称）。UI の選択肢・表示名はここから導出する（#252）。
 */
export const PREFECTURE_MASTER: readonly {
  readonly code: PrefectureCode;
  readonly name: string;
}[] = [
  { code: "01", name: "北海道" },
  { code: "02", name: "青森県" },
  { code: "03", name: "岩手県" },
  { code: "04", name: "宮城県" },
  { code: "05", name: "秋田県" },
  { code: "06", name: "山形県" },
  { code: "07", name: "福島県" },
  { code: "08", name: "茨城県" },
  { code: "09", name: "栃木県" },
  { code: "10", name: "群馬県" },
  { code: "11", name: "埼玉県" },
  { code: "12", name: "千葉県" },
  { code: "13", name: "東京都" },
  { code: "14", name: "神奈川県" },
  { code: "15", name: "新潟県" },
  { code: "16", name: "富山県" },
  { code: "17", name: "石川県" },
  { code: "18", name: "福井県" },
  { code: "19", name: "山梨県" },
  { code: "20", name: "長野県" },
  { code: "21", name: "岐阜県" },
  { code: "22", name: "静岡県" },
  { code: "23", name: "愛知県" },
  { code: "24", name: "三重県" },
  { code: "25", name: "滋賀県" },
  { code: "26", name: "京都府" },
  { code: "27", name: "大阪府" },
  { code: "28", name: "兵庫県" },
  { code: "29", name: "奈良県" },
  { code: "30", name: "和歌山県" },
  { code: "31", name: "鳥取県" },
  { code: "32", name: "島根県" },
  { code: "33", name: "岡山県" },
  { code: "34", name: "広島県" },
  { code: "35", name: "山口県" },
  { code: "36", name: "徳島県" },
  { code: "37", name: "香川県" },
  { code: "38", name: "愛媛県" },
  { code: "39", name: "高知県" },
  { code: "40", name: "福岡県" },
  { code: "41", name: "佐賀県" },
  { code: "42", name: "長崎県" },
  { code: "43", name: "熊本県" },
  { code: "44", name: "大分県" },
  { code: "45", name: "宮崎県" },
  { code: "46", name: "鹿児島県" },
  { code: "47", name: "沖縄県" },
];

const PREFECTURE_NAME_BY_CODE = new Map<string, string>(
  PREFECTURE_MASTER.map((p) => [p.code, p.name])
);

/** 都道府県コードから名称を返す（未知のコードはそのまま返す） */
export function getPrefectureName(code: string): string {
  return PREFECTURE_NAME_BY_CODE.get(code) ?? code;
}

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
