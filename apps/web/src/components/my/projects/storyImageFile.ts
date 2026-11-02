import { PROJECT_STORY_LIMITS, type Result, err, ok } from "@physifun/domain";

/**
 * ストーリーに入れる画像を、ブラウザで送れる大きさにする（#320、設計書 §5.3）。
 *
 * スマホで撮った写真は数 MB〜10 MB を超えることがあり、そのままではアップロード API（#319）の上限
 * （`PROJECT_STORY_LIMITS.imageBytes`）に収まらない。そこで長い辺を `imageLongEdge` 以下に縮め、
 * JPEG（PNG は透過を残すため PNG のまま）に書き直してから送る。
 *
 * - 縮小も書き直しも要らないファイル（辺・大きさ・形式がすべて範囲内）は、画質を落とさないようそのまま送る
 * - ブラウザが読めない形式（Chrome の HEIC など）は、分かる言葉でエラーにする（`UNREADABLE`）
 * - 書き直しても上限を超えるときは、JPEG の画質を下げて 1 回だけやり直す。それでも超えたら `TOO_LARGE`
 * - 判断（`planStoryImageEncoding`）とブラウザの処理（`prepareStoryImage`）を分け、判断はユニットテストで確かめる
 */

/** 判断に使う、元の画像の情報 */
export interface StoryImageSource {
  readonly width: number;
  readonly height: number;
  /** ブラウザが申告する形式（`File.type`）。分からないときは空 */
  readonly type: string;
  readonly size: number;
}

export type StoryImageEncoding =
  /** そのまま送る */
  | { readonly kind: "original" }
  /** 縮めて（または形式を変えて）書き直す */
  | {
      readonly kind: "encode";
      readonly width: number;
      readonly height: number;
      readonly type: "image/jpeg" | "image/png";
      /** JPEG の画質（0〜1）。PNG では使われない */
      readonly quality: number;
    };

/** 最初に書き直すときの JPEG の画質。写真が見た目で分からない程度に軽くなる */
export const STORY_IMAGE_JPEG_QUALITY = 0.85;
/** 上限を超えたときにやり直す JPEG の画質 */
export const STORY_IMAGE_JPEG_QUALITY_RETRY = 0.7;

const SENDABLE_TYPES: readonly string[] = PROJECT_STORY_LIMITS.imageTypes;

/**
 * 元の画像をどう送るかを決める。
 * 長い辺が上限を超えていれば縦横比を保って縮める。形式が送れないもの（GIF・ブラウザが申告しないものなど）か、
 * 大きさが上限を超えていれば、辺が範囲内でも書き直す
 */
export function planStoryImageEncoding(source: StoryImageSource): StoryImageEncoding {
  const longEdge = Math.max(source.width, source.height);
  const scale =
    longEdge > PROJECT_STORY_LIMITS.imageLongEdge
      ? PROJECT_STORY_LIMITS.imageLongEdge / longEdge
      : 1;
  if (
    scale === 1 &&
    SENDABLE_TYPES.includes(source.type) &&
    source.size <= PROJECT_STORY_LIMITS.imageBytes
  ) {
    return { kind: "original" };
  }
  return {
    kind: "encode",
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
    // PNG は透過を残すため PNG のまま。それ以外（JPEG・WebP・ブラウザが読めた他の形式）は JPEG にする
    type: source.type === "image/png" ? "image/png" : "image/jpeg",
    quality: STORY_IMAGE_JPEG_QUALITY,
  };
}

export type PrepareStoryImageError =
  /** ブラウザが画像として読めない */
  | { readonly type: "UNREADABLE" }
  /** 縮めて書き直しても上限を超える */
  | { readonly type: "TOO_LARGE"; readonly maxBytes: number }
  /** ブラウザが書き直せなかった（canvas が使えないなど） */
  | { readonly type: "ENCODE_FAILED" };

/**
 * 選んだファイルを、送れる大きさの画像にする。ブラウザでだけ動く（`Image`・canvas を使う）
 */
export async function prepareStoryImage(file: File): Promise<Result<Blob, PrepareStoryImageError>> {
  const image = await loadImage(file);
  if (!image) return err({ type: "UNREADABLE" });
  try {
    const plan = planStoryImageEncoding({
      width: image.naturalWidth,
      height: image.naturalHeight,
      type: file.type,
      size: file.size,
    });
    if (plan.kind === "original") return ok(file);

    let blob = await encode(image, plan);
    if (!blob) return err({ type: "ENCODE_FAILED" });
    if (blob.size > PROJECT_STORY_LIMITS.imageBytes) {
      // PNG のままでは縮まないことがある（写真を PNG で保存したものなど）ので、やり直しは形式も JPEG にする
      blob = await encode(image, {
        ...plan,
        type: "image/jpeg",
        quality: STORY_IMAGE_JPEG_QUALITY_RETRY,
      });
      if (!blob) return err({ type: "ENCODE_FAILED" });
      if (blob.size > PROJECT_STORY_LIMITS.imageBytes) {
        return err({ type: "TOO_LARGE", maxBytes: PROJECT_STORY_LIMITS.imageBytes });
      }
    }
    return ok(blob);
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

/**
 * ファイルを `<img>` に読み込む。読めない形式なら null。
 * `decode()` を待つので、描くときには向き（EXIF）もブラウザが直した状態になっている
 */
async function loadImage(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * canvas で縮めて書き直す。ブラウザが指定の形式で書けないとき（戻りが null か別の形式）は null
 */
async function encode(
  image: HTMLImageElement,
  plan: Extract<StoryImageEncoding, { kind: "encode" }>
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, plan.width, plan.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, plan.type, plan.quality)
  );
  return blob && blob.type === plan.type ? blob : null;
}

/**
 * 縮小のエラーを、利用者に見せる文言にする（受け入れ要件「読めない画像を選ぶと分かる言葉のエラー」）
 */
export function storyImageErrorMessage(error: PrepareStoryImageError): string {
  switch (error.type) {
    case "UNREADABLE":
      return "この画像はブラウザで読めない形式です。JPEG か PNG の画像を選んでください";
    case "TOO_LARGE":
      return `画像が大きすぎます。縮小しても ${error.maxBytes / (1024 * 1024)} MB を超えるので、別の画像を選んでください`;
    case "ENCODE_FAILED":
      return "画像を縮小できませんでした。別の画像を選ぶか、ブラウザを変えてお試しください";
  }
}
