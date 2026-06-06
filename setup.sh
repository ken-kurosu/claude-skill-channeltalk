#!/usr/bin/env bash
# ChannelTalk Admin Skill - ワンライナーセットアップ
# 使い方:
#   bash <(curl -sL https://raw.githubusercontent.com/ken-kurosu/claude-skill-channeltalk/main/setup.sh)
# または Claude Code に「これ使えるようにして: https://github.com/ken-kurosu/claude-skill-channeltalk」

set -euo pipefail

REPO_URL="git@github.com:ken-kurosu/claude-skill-channeltalk.git"
INSTALL_DIR="${HOME}/claude-skill-channeltalk"
SKILL_LINK="${HOME}/.claude/skills/channeltalk-admin"
AIKA_HOST_IP="100.84.67.39"
AIKA_USER="kurosu"

echo "=== ChannelTalk Admin Skill セットアップ ==="

# 1. clone or pull
if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "→ 既存リポジトリを最新化: ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" pull --rebase
else
  echo "→ clone: ${REPO_URL} -> ${INSTALL_DIR}"
  git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

# 2. symlink to ~/.claude/skills/
mkdir -p "$(dirname "${SKILL_LINK}")"
if [ ! -e "${SKILL_LINK}" ]; then
  ln -s "${INSTALL_DIR}" "${SKILL_LINK}"
  echo "→ symlink: ${SKILL_LINK} -> ${INSTALL_DIR}"
else
  echo "→ symlink 既存: ${SKILL_LINK}"
fi

# 3. ssh config に Host aika を追加 (なければ)
SSH_CONFIG="${HOME}/.ssh/config"
mkdir -p "${HOME}/.ssh"
touch "${SSH_CONFIG}"
chmod 600 "${SSH_CONFIG}"
if ! grep -q "^Host aika$" "${SSH_CONFIG}"; then
  cat >> "${SSH_CONFIG}" <<EOF

# ChannelTalk Admin Skill - Aika (Mac mini)
Host aika
    HostName ${AIKA_HOST_IP}
    User ${AIKA_USER}
    ServerAliveInterval 30
    ServerAliveCountMax 10
EOF
  echo "→ ${SSH_CONFIG} に Host aika を追加"
else
  echo "→ ssh config に Host aika 既存"
fi

# 4. SSH key の確認 + 公開鍵表示
KEY_PATH="${HOME}/.ssh/id_ed25519"
if [ ! -f "${KEY_PATH}" ]; then
  echo "⚠️  SSH key (${KEY_PATH}) がありません。新規作成しますか? (y/N)"
  read -r ANS
  if [ "${ANS}" = "y" ]; then
    ssh-keygen -t ed25519 -f "${KEY_PATH}" -N ""
  else
    echo "→ 既存の SSH key を使う場合は ~/.ssh/config に IdentityFile を追記してください"
  fi
fi

# 5. 動作確認
echo ""
echo "→ Aika への接続確認..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes aika 'echo ok' >/dev/null 2>&1; then
  echo "✅ Aika への SSH 接続 OK"
  echo ""
  echo "=== セットアップ完了 ==="
  echo "Claude Code を再起動すれば 'channeltalk-admin' スキルが使えます"
  echo "試しに: 'rule 一覧見せて' と Claude に言ってみてください"
else
  echo ""
  echo "⚠️  Aika への SSH 接続に失敗しました"
  echo ""
  echo "黒須さんに以下の公開鍵を渡して、Aika の ~/.ssh/authorized_keys に追加してもらってください:"
  echo ""
  if [ -f "${KEY_PATH}.pub" ]; then
    cat "${KEY_PATH}.pub"
  else
    echo "(SSH key が無いため、まず ssh-keygen -t ed25519 でキー作成してください)"
  fi
  echo ""
  echo "登録後にもう一度 setup.sh を実行してください"
fi
