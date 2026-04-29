export { AdminAccount } from "./entities/AdminAccount";
export type { AdminAccountStateError } from "./errors/AdminAccountError";
export type { AdminAccountRepository } from "./repositories/AdminAccountRepository";
export {
  ADMIN_ACCOUNT_EMAIL_MAX_LENGTH,
  AdminAccountEmail,
  type AdminAccountEmailError,
} from "./value-objects/AdminAccountEmail";
export { AdminAccountId, type InvalidAdminAccountIdError } from "./value-objects/AdminAccountId";
export { AdminAccountStatus, isAdminAccountStatus } from "./value-objects/AdminAccountStatus";
