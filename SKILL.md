---
name: channeltalk-admin
description: アイカサ ChannelTalk (Front-ALF) を Claude 経由で操作する。chat の close/snooze、ALF rule の編集、workflow の切替、metrics 確認まで全部できる。全 mutation は自動バックアップされ、いつでも復元可能。
when_to_use: ユーザーが ChannelTalk・ALF・チャット close・rule 変更・workflow 切替・「これ使えるようにして」(URL含む) などを依頼した時
---

# ChannelTalk Admin Skill

このスキルは Aika (Mac mini) 経由で ChannelTalk を操作する。認証情報・バックアップ・audit log は全部 Aika に集約。

## 🚨 最重要ルール (必ず守る)

### A. 操作前に必ず `update` 実行

```bash
node ~/.claude/skills/channeltalk-admin/scripts/update.js
```

最新のスクリプトと endpoint で動かないと壊れる。最初のユーザー発話を処理する前に **必ず 1 回** 実行する。

### B. 危険操作は明示的な確認を取る

以下は **「これから〇〇に対して xxx を実行します。よろしいですか？」と必ず一文確認** してから実行:

- rule の削除・大幅編集 (50字以上 instruction 変更)
- workflow の trigger 変更
- 5 件以上の chat 一括 close / snooze
- snapshot 全 rule の上書き

「閉じて」「タグつけて」「snooze して」など軽微な単発操作は確認不要 (backup は取る)。

### C. 失敗時は restore コマンドを即提示

mutation 失敗 / 結果が想定外 → ユーザーに backup-id と `node scripts/restore.js <id>` を必ず案内。

## 🔧 初回セットアップ (メンバーが「これ使えるようにして」と URL 渡した時)

リポジトリ URL (https://github.com/ken-kurosu/claude-skill-channeltalk) を渡された時:

1. リポジトリ URL から `setup.sh` を直接実行:
   ```bash
   bash <(curl -sL https://raw.githubusercontent.com/ken-kurosu/claude-skill-channeltalk/main/setup.sh)
   ```
2. SSH key が無い場合は対話で生成する
3. Aika への接続が失敗したら、表示される公開鍵を **黒須さんに渡す** ようユーザーに伝える (黒須さんが `~/.ssh/authorized_keys` に追加)
4. 接続できれば「セットアップ完了です」と返事

## 操作カタログ (自然言語 → 実行スクリプト)

すべてのスクリプトは `node ~/.claude/skills/channeltalk-admin/scripts/<NAME>.js` で実行する。

### 1. Chat 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「chat XXX を閉じて」「XXX を終了して」 | `close-chat.js <chatId>` (state=closed) |
| 「XXX を snooze して N時間」 | `snooze-chat.js <chatId> <hours>` |
| 「XXX にタグ YYY つけて」「タグ ZZZ 外して」 | `tag-chat.js <chatId> add\|remove <tag>` |
| 「直近 ALF 対応 chat 確認」「opened な ALF chat」 | `list-chats.js --hours 24 --tag ALF_介入` |
| 「chat XXX の状態を見せて」「直近メッセージ確認」 | `inspect-chat.js <chatId> --messages 10` |

### 2. ALF Rules 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「rule 一覧」 | `list-rules.js` |
| 「rule NNNN を編集」「rule NNNN の instruction を更新」 | `edit-rule.js <ruleId> --file <path>` (自動 backup) |
| 「rule NNNN の最後に△△を追加」 | `edit-rule.js <ruleId> --append <path>` |
| 「rule NNNN を停止/再開」 | `toggle-rule.js <ruleId> pause\|live` |

### 3. Workflow 操作

| ユーザー発話例 | 実行 |
|---|---|
| 「workflow 一覧」 | `list-workflows.js` |
| 「workflow NNNN を起動/停止」 | `toggle-workflow.js <wfId> activate\|stop` |
| **「ALF を全員に展開」「営業時間外も ALF オン」** | `toggle-alf-workflow.js on` (filter を catch-all に) |
| **「ALF を黒須さん限定に」「ALF オフ」「営業時間外も ALF 止めて」** | `toggle-alf-workflow.js off` (filter を黒須さん memberId のみに、一般ユーザーは旧版 15229 へ) |
| 「営業時間外のみ稼働に切替」 | `update-workflow-trigger.js <wfId> notInOperation` (今後実装) |

**ALF版 (wf 832569) の運用**:
- runMode = `notInOperation` (営業時間外のみ稼働) は常に維持
- ON/OFF は **filter で制御**: catch-all (全員) ⇄ 黒須さん memberId 限定
- ON/OFF 切替時はバックアップ自動取得 (Aika 側 `/tmp/wf_832569_pre_*.json`)

### 4. バックアップ / 復元

| ユーザー発話例 | 実行 |
|---|---|
| 「全 rule バックアップ」 | `backup-all-rules.js` |
| 「全 workflow バックアップ」 | `backup-all-workflows.js` |
| 「バックアップ一覧」 | `restore.js --list` (ローカル) または Aika 側を含めて表示 |
| 「直近のバックアップから復元」「rule NNNN を元に戻して」 | `restore.js <backup-id>` |

## 動作の流れ (Claude が必ず守る)

1. **`update.js` 実行** (セッション最初の操作で1回)
2. ユーザーの自然言語を読み取り → 上記カタログの該当 script を特定
3. 引数の組み立て (chatId、ruleId など) — 不明なら必ず確認質問
4. **危険操作なら確認**: 「これから〇〇に対して xxx します。続けますか?」
5. 実行 (各 script は内部で `ssh aika` 経由で Aika に到達)
6. 結果報告 — 成功なら state 変化を確認、失敗なら restore コマンド提示
7. backup-id を必ずユーザーに伝える

## セキュリティ・運用

- 全 API call は Aika 側 (kurosu@100.84.67.39) に集約 — メンバーローカルに認証情報無し
- 全 mutation は **ローカル + Aika の両方にバックアップ** — メンバーマシン故障時も黒須さんが Aika から復旧可能
- 全操作は `logs/{YYYY-MM}.jsonl` (ローカル) + `/Users/kurosu/channeltalk-skill-audit.log` (Aika) に audit log として記録
- 危険操作の事前確認はこの SKILL.md のルールで担保 (強制力はないので、Claude が必ず従う)

## ファイル構造

```
~/.claude/skills/channeltalk-admin/
├── SKILL.md            ← このファイル
├── setup.sh            ← 初回セットアップ (自動)
├── lib/
│   ├── aika.js         ← ssh + API call ラッパー
│   ├── backup.js       ← backup 保存/復元 (Aika 二重保存)
│   └── audit.js        ← 操作 log (ローカル + Aika)
├── scripts/            ← 各操作スクリプト
│   ├── update.js       ← セッション最初に実行
│   ├── close-chat.js
│   ├── edit-rule.js
│   └── ...
├── backups/            ← {ts}_{target}_{id}.json (自動生成、Aika にも同時保存)
├── logs/               ← 月別 audit log
└── docs/
    ├── ENDPOINTS.md    ← 内部 API 一覧
    └── SETUP.md
```

## 復旧手順 (メンバーが何か壊した時)

1. **直近の backup から復元** — `node scripts/restore.js <backup-id>` (ローカル無ければ自動で Aika から fetch)
2. **backup-id がわからない** — `node scripts/restore.js --list` で一覧
3. **メンバーマシン全損** — 黒須さん が Aika `~/channeltalk-skill-backups/` から該当 backup を取り出して restore.js に渡せる
4. **どうしても駄目** — `backup-all-rules.js` / `backup-all-workflows.js` を定期実行している分から手動 PUT 復元
