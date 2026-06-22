#!/bin/zsh

# 把正式版数据库快照一份到开发版数据库，让 `npm run tauri dev` 启动时有真实数据可看。
#
# 用法：
#   ./scripts/seed-dev-db.sh           把正式库快照到开发库（开发库已存在则提示确认覆盖）
#   ./scripts/seed-dev-db.sh --force   不询问，直接覆盖开发库
#   ./scripts/seed-dev-db.sh --fresh   清空开发库（不拷贝），用来测试空状态 / schema 迁移
#
# 说明：开发库与正式库是各自独立的文件，拷贝后互不影响——在开发库里随便改删都不会动到真实历史。

set -euo pipefail

PROD_DB="$HOME/.timing-lite/timing-lite.db"
DEV_DIR="$HOME/.timing-lite-dev"
DEV_DB="$DEV_DIR/timing-lite.db"

MODE="copy"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --fresh) MODE="fresh" ;;
    --force) FORCE=1 ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

mkdir -p "$DEV_DIR"

if [ "$MODE" = "fresh" ]; then
  rm -f "$DEV_DB" "$DEV_DB-wal" "$DEV_DB-shm"
  echo "✅ 已清空开发库: $DEV_DB（下次 npm run tauri dev 会自动建一个空库）"
  exit 0
fi

if [ ! -f "$PROD_DB" ]; then
  echo "❌ 找不到正式库: $PROD_DB" >&2
  echo "   先用正式版跑一段时间产生数据，或用 --fresh 起一个空开发库。" >&2
  exit 1
fi

if [ -f "$DEV_DB" ] && [ "$FORCE" -ne 1 ]; then
  printf "开发库已存在，覆盖? [y/N] "
  read -r reply
  case "$reply" in
    y|Y) ;;
    *) echo "已取消。"; exit 0 ;;
  esac
fi

# 用 sqlite 的 .backup 做一致性快照（即使正式版正在运行也安全），失败则回退到普通 cp。
if command -v sqlite3 >/dev/null 2>&1; then
  rm -f "$DEV_DB-wal" "$DEV_DB-shm"
  sqlite3 "$PROD_DB" ".backup '$DEV_DB'"
else
  cp "$PROD_DB" "$DEV_DB"
fi

echo "✅ 已把正式库快照到开发库:"
echo "   源: $PROD_DB"
echo "   目标: $DEV_DB"
echo "   现在运行 npm run tauri dev 即可看到真实数据（且与正式库隔离）。"
