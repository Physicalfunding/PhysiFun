#!/bin/bash
# Arch Guard — PhysiFun アーキテクチャ境界違反検知
# 参照: CLAUDE.md「禁止事項」/ .docs/structure.md「レイヤー別責務」

FILE="$1"
[[ -z "$FILE" || ! -f "$FILE" ]] && exit 0

FOUND=""

# ファイルの相対位置を判定
REL=$(echo "$FILE" | sed 's|.*/PhysiFun/||')

# 1. infrastructure/ 以外での Supabase SDK / Kysely / Prisma の直接 import
#    infrastructure/ 配下と .test. / __tests__ / *.config.* は除外
if [[ "$REL" != packages/infrastructure/* ]] && \
   [[ "$REL" != *".test."* ]] && \
   [[ "$REL" != *"__tests__"* ]] && \
   [[ "$REL" != *".config."* ]] && \
   [[ "$REL" != *"prisma/"* ]]; then

  DB_IMPORT=$(grep -nE "from ['\"](@supabase|@prisma|kysely|pg)[/'\"]|require\(['\"](@supabase|@prisma|kysely|pg)" "$FILE" 2>/dev/null)
  [[ -n "$DB_IMPORT" ]] && FOUND="${FOUND}[境界違反: infrastructure 外での DB/外部 SDK 直接 import]\n${DB_IMPORT}\n\n"
fi

# 2. domain/ での外部ライブラリ import（domain は純粋であるべき）
if [[ "$REL" == packages/domain/* ]]; then
  EXT_IMPORT=$(grep -nE "from ['\"](@supabase|@prisma|kysely|next|react|zod|bcrypt|jose|resend|pg)[/'\"]" "$FILE" 2>/dev/null)
  [[ -n "$EXT_IMPORT" ]] && FOUND="${FOUND}[境界違反: domain/ での外部ライブラリ import]\n${EXT_IMPORT}\n\n"
fi

# 3. API Route Handler でのビジネスロジック疑い
#    route.ts 内で UseCase 以外の複雑なロジックを書いていないかヒューリスティック検査
if [[ "$REL" == apps/*/src/app/api/*/route.ts ]]; then
  # for/while ループや複雑な条件分岐はビジネスロジックの兆候
  BIZ_LOGIC=$(grep -nE '^\s*(for|while)\s*\(|\.reduce\(|\.filter\(.*\.map\(' "$FILE" 2>/dev/null | grep -ivE '^\s*//')
  [[ -n "$BIZ_LOGIC" ]] && FOUND="${FOUND}[注意: API Route Handler にビジネスロジックの疑い]\n${BIZ_LOGIC}\n→ ロジックは UseCase に移動してください\n\n"
fi

# 4. 環境変数の直接参照（infrastructure/ 以外）
if [[ "$REL" != packages/infrastructure/* ]] && \
   [[ "$REL" != apps/*/src/app/api/* ]] && \
   [[ "$REL" != *".config."* ]] && \
   [[ "$REL" != *"env"* ]] && \
   [[ "$REL" != *"auth"* ]] && \
   [[ "$REL" != *"lib/"* ]]; then
  ENV_REF=$(grep -nE 'process\.env\.' "$FILE" 2>/dev/null | grep -ivE '^\s*//')
  [[ -n "$ENV_REF" ]] && FOUND="${FOUND}[注意: infrastructure/ 外での process.env 直接参照]\n${ENV_REF}\n\n"
fi

if [[ -n "$FOUND" ]]; then
  echo "--- arch-guard: $(basename "$FILE")"
  echo ""
  echo "PhysiFun のアーキテクチャルール:"
  echo "  - infrastructure/ 以外で Supabase SDK・Kysely・Prisma を直接呼ばない"
  echo "  - domain/ に外部ライブラリの依存を持ち込まない"
  echo "  - API Route Handler にビジネスロジックを書かない"
  echo ""
  echo -e "$FOUND"
  echo "→ 参照: CLAUDE.md / .docs/structure.md"
fi

exit 0
