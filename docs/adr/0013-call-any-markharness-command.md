# 0013: GUIは `markharness` のどのコマンドも呼んでよく、編集の成功後に `generate` を呼ぶ

## ステータス

Accepted(2026-10-07決定)。引き継ぎ文書の「編集は、`knowledge reconcile` と `knowledge remove` だけを通す」を改める。

## 背景

GUIに、テスト知識の編集を加える。`knowledge reconcile` と `knowledge remove` は、`knowledge/` だけを書き換える。`.markharness/generated/testcases/` は、`knowledge/` から導かれる、Gitで管理される成果物で、`markharness generate` が書き直す。`markharness verify`(通常はCIが実行する)は、この成果物が `knowledge/` と食い違っていないかを調べる。GUIで編集した人には、編集のあとに `generate` を実行するCIが付いていないため、`generate` を呼ばないと、`verify` が食い違いを報告する状態が残る。

「書き込みは、`reconcile` と `remove` だけ」という制限は、`.markharness/` 配下のファイルを、GUIが直接書き換えないことを守るためのものだった。この目的は、`markharness` のコマンドを通す限り、コマンドの種類を制限しなくても守れる。

## 決定

- GUIは、`markharness` のコマンドを、種類を限らずに呼んでよい。`.markharness/` 配下のファイルを、直接読み書きしないこと(StrictDocのエクスポートを除く)は、変えない。
- 画面の内容は、これまでどおり、`markharness` のJSON出力だけから作る。
- Knowledgeの作成・更新は `knowledge reconcile` で、削除は `knowledge remove` で行う。編集が成功したあとは、GUIが、`markharness generate` を毎回呼び、`generated/testcases/` を、`knowledge/` に追従させる。
- `generate` が失敗したときは、編集自体は完了しているので、編集の失敗とは区別して、本体のエラーメッセージを、そのまま示す。

## 代替案

- **`generate` を、GUIから呼ばない**: 採用しなかった。`generate` を、編集のたびに、GUIが呼ぶ。
- **`reconcile` が `generate` まで行うよう、本体に依頼する**: 採用しなかった。GUIが `generate` を呼ぶ。
- **`reconcile` と `remove` だけを許す制限を、維持する**: 採用しなかった。`.markharness/` の直接の読み書きの禁止だけを維持し、コマンドの種類は限らない。

## 影響

- [AGENTS.md](../../AGENTS.md)、[PROJECT.md](../../PROJECT.md)、[core-handoff.md](../core-handoff.md)、[review-policy.md](../review-policy.md) の、書き込みを2つのコマンドに限る記述を、この決定に合わせて改める。
- `generate` は、毎回 `generated/testcases/` を空にして書き直すため、編集のたびに、Gitの差分が出る。
- 編集の成功のあとに `generate` が失敗すると、`knowledge/` と `generated/testcases/` が、食い違ったまま残る。
