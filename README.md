# ChannelTalk Admin Skill for Claude Code

アイカサ ChannelTalk (Front-ALF) を Claude Code 経由で操作するスキル。
全 mutation は自動バックアップされ、`restore.js` でいつでも巻き戻し可能。

## セットアップ (初回 1 回)

### 1. リポジトリを取得して skill ディレクトリに配置

```bash
cd ~
git clone git@github.com:aikasa/claude-skill-channeltalk.git
mkdir -p ~/.claude/skills
ln -s ~/claude-skill-channeltalk ~/.claude/skills/channeltalk-admin
```

### 2. Aika (Mac mini) への SSH 設定

このスキルは Aika 経由で ChannelTalk API を叩く設計 (認証情報を集中管理するため)。
`~/.ssh/config` に以下を追加:

```
Host aika
    HostName 100.84.67.39
    User kurosu
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 30
```

ssh key を Aika に登録: 黒須さんに `~/.ssh/id_ed25519.pub` を渡して `~/.ssh/authorized_keys` に追加してもらう。

### 3. 動作確認

```bash
ssh aika 'echo ok'   # → "ok" が返ればOK
cd ~/claude-skill-channeltalk
node scripts/list-rules.js   # ALF rule 一覧が出ればOK
```

## 使い方

Claude Code で自然言語で依頼するだけ。スキルが自動で適切なスクリプトを実行する。

```
> chat 6a16fd23... の状態を見せて
> 6a16fd23... を閉じて
> rule 974094 の内容見せて
> rule 06b の最後に「○○」を追加して
> workflow 832569 を停止
> 直近のバックアップ一覧
> backup-id 2026-06-06T15-20-XXX_rule_974094.json を復元
```

危険な操作 (rule 削除、全 chat close 等) は実行前に必ず確認される。

## 操作カタログ

詳細は [`SKILL.md`](./SKILL.md) を参照。

| カテゴリ | 主要スクリプト |
|---|---|
| Chat | close-chat, snooze-chat, tag-chat, inspect-chat, list-chats |
| ALF Rule | list-rules, inspect-rule, edit-rule, toggle-rule, create-rule |
| Workflow | list-workflows, toggle-workflow, update-workflow-trigger |
| Backup | backup-all-rules, backup-all-workflows, restore |

## バックアップ

`backups/` 配下に `{ISO timestamp}_{target}_{id}.json` 形式で保存される。
全 mutation 操作の前に自動取得 (skip オプションなし)。

復元:
```bash
node scripts/restore.js                              # 一覧表示
node scripts/restore.js <filename>                   # 復元実行
```

## ファイル

```
.
├── SKILL.md                ← Claude が読む操作ガイド
├── README.md               ← このファイル
├── lib/
│   ├── aika.js             ← ssh + API call ラッパー
│   └── backup.js           ← バックアップ管理
├── scripts/                ← 各操作スクリプト
├── backups/                ← {timestamp}_{target}_{id}.json
└── docs/                   ← 追加ドキュメント
```

## 注意

- すべての操作は黒須さんの ChannelTalk 権限で実行される (認証情報は Aika に集約)
- 操作ログは Aika 側の console / Slack に流れる
- ChannelTalk API は ChannelTalk 内部 endpoint を含むため、UI 仕様変更で動かなくなる可能性あり

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `ssh aika` 接続不可 | ssh key の登録を黒須さんに依頼 |
| `no session` エラー | Aika 側の `storage_state.json` の expire 切れ → 黒須さんに再ログイン依頼 |
| API call 403 / 422 | 内部 endpoint が変わった可能性 → docs/ENDPOINTS.md と GitHub Issue で連絡 |
| 復元したいが backup-id がわからない | `node scripts/restore.js` で一覧表示 |

## 連絡

問題があれば黒須さん or `#aikasa-channeltalk` Slack チャンネルへ。
