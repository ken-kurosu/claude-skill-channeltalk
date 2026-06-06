---
name: channeltalk-admin
description: アイカサ ChannelTalk (Front-ALF) を Claude 経由で操作する。chat の close/snooze、ALF rule の編集、workflow の切替、metrics 確認まで全部できる。全 mutation は自動バックアップされ、いつでも復元可能。
when_to_use: ユーザーが ChannelTalk・ALF・チャット close・rule 変更・workflow 切替などを依頼した時
---

# ChannelTalk Admin Skill

このスキルは Aika (Mac mini) 経由で ChannelTalk を操作する。メンバー側のローカルマシンは ssh で Aika に繋げるだけで OK (認証情報や Playwright session は全部 Aika に集約)。

## 重要原則

1. **mutation 前は必ず backup** — `scripts/backup-{target}.js` で対象の現状を `backups/` に保存してから書き込み
2. **`restore.js <backup-id>` でいつでも巻き戻し可能** — 失敗したら即復元案内する
3. **影響範囲が広い操作は事前に確認** (rule 編集、workflow 全停止など)
4. **何も指定がなければ TEST_MODE で動作確認** → 本番反映は明示確認後

## 操作カタログ (自然言語 → 実行スクリプト)

### 1. Chat 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「chat XXX を閉じて」「XXX を終了して」 | `node scripts/close-chat.js <chatId>` (state=closed) |
| 「XXX を snooze して N時間」 | `node scripts/snooze-chat.js <chatId> <hours>` |
| 「XXX にタグ YYY つけて」「タグ ZZZ 外して」 | `node scripts/tag-chat.js <chatId> add|remove <tag>` |
| 「直近 ALF 対応 chat 確認」 | `node scripts/list-chats.js --hours 24 --tag ALF_介入` |
| 「chat XXX の状態を見せて」 | `node scripts/inspect-chat.js <chatId>` |

### 2. ALF Rules 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「rule 一覧」 | `node scripts/list-rules.js` |
| 「rule NNNN の内容見せて」 | `node scripts/inspect-rule.js <ruleId>` |
| 「rule NNNN を編集」「rule NNNN の instruction を更新」 | `node scripts/edit-rule.js <ruleId> <newFile>` (自動 backup) |
| 「rule NNNN を停止/再開」 | `node scripts/toggle-rule.js <ruleId> pause|live` |
| 「新 rule を追加」 | `node scripts/create-rule.js <title> <file>` |

### 3. Workflow 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「workflow 一覧」 | `node scripts/list-workflows.js` |
| 「workflow NNNN を起動/停止」 | `node scripts/toggle-workflow.js <wfId> activate|stop` |
| 「workflow NNNN の trigger 変更」「営業時間外のみ稼働に切替」 | `node scripts/update-workflow-trigger.js <wfId> <preset>` (preset: notInOperation, inOperation, always) |

### 4. Metrics / モニタ

| ユーザー発話例 | 実行 |
|---|---|
| 「T01 metrics 今すぐ確認」 | `ssh aika 'launchctl start com.aikasa.t01-metrics'` |
| 「ALF サマリー評価 直近 24h」 | `ssh aika 'launchctl start com.aikasa.wf15229-evaluate'` |
| 「異常検知の現状」 | `ssh aika 'tail -30 /tmp/wf15229_alerts/monitor.log'` |

### 5. バックアップ / 復元

| ユーザー発話例 | 実行 |
|---|---|
| 「全 rule バックアップ」 | `node scripts/backup-all-rules.js` |
| 「全 workflow バックアップ」 | `node scripts/backup-all-workflows.js` |
| 「直近のバックアップから復元」「rule NNNN を元に戻して」 | `node scripts/restore.js <backup-id>` |
| 「バックアップ一覧」 | `ls -lt backups/ \| head -20` |

## 動作の流れ (Claude の役割)

1. ユーザーの自然言語を読み取り → 上記カタログの該当 script を特定
2. 引数の組み立て (chatId、ruleId など) — 不明なら確認質問
3. **mutation 系なら**: 「これから〇〇に対して xxx します。バックアップ取った後実行します。続けますか?」と必ず事前確認
4. 実行 (各 script は内部で `ssh kurosu@100.84.67.39` 経由で Aika に到達)
5. 結果報告 — 成功なら state 変化を確認、失敗なら restore コマンド提示

## 認証 / セキュリティ

- 全 API call は Aika 側 (kurosu@100.84.67.39) に集約
- メンバーローカルには認証情報 (Open API key、ChannelTalk session JWT) は **置かない**
- メンバーは `~/.ssh/config` に `Host aika` を設定するだけ
- ssh key を黒須さんが authorized_keys に追加することで権限付与

## 危険操作の前置き (必ず確認する)

- ❗ rule 削除 (`delete-rule.js`) — 復元できないので **強い確認** を求める
- ❗ workflow trigger 全変更 — 営業時間に直結するので backup 取得 + 影響説明
- ❗ 全 chat 一括 close — 数件以上の close は1件1件確認

## ファイル構造

```
~/.claude/skills/channeltalk-admin/
├── SKILL.md            ← このファイル
├── lib/
│   ├── aika.js         ← ssh wrapper
│   └── backup.js       ← backup 保存/復元
├── scripts/            ← 各操作スクリプト
├── backups/            ← {timestamp}_{target}_{id}.json (自動生成)
└── docs/
    ├── SETUP.md
    └── ENDPOINTS.md    ← 内部 API 一覧
```

## 拡張時の注意

- 新スクリプト追加時は **必ず backup を取ってから書き込む** パターンを踏襲する
- Aika 側に新依存パッケージが必要な場合は `automation/package.json` を更新
- 新 endpoint 発見時は `docs/ENDPOINTS.md` に追記
