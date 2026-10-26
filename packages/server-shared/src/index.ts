// web / admin（Next.js）のサーバー側で共通に使うコード（#252）。
// proxy（旧 middleware）からも読み込む。proxy は Node ランタイムになったが、Edge でも動く軽量な層に
// 保つため、Node 専用 API（node:crypto など）に依存させない。

export { shouldCheckCsrf, getAllowedOrigins, verifyCsrf } from "./csrf";
export {
  type ApiErrorCode,
  type ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "./apiResponse";
export {
  type RateLimitExceededInfo,
  type RateLimitErrorBody,
  rateLimitExceededResponse,
} from "./rateLimitResponse";
export { verifyCronRequest } from "./cronAuth";
