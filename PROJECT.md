# PROJECT.md — プロジェクト定義

> **技術スタックやコマンドなど、プロダクト固有の情報は、このファイルに集約します。**
> `.github/instructions/` 配下の規約や `CONTRIBUTING.md` は、技術スタックに依存する部分をこのファイルに委ねています。
> `<!-- 確定後に記入 -->` が付いた項目は、技術スタックが確定した時点で、このファイルを更新してください。

## プロダクト概要

| 項目 | 値 |
|------|----|
| プロダクト名 | markharness-gui |
| 概要 | markharness(Git-nativeなテスト知識管理CLI)のGUI。関係(Requirement・Feature・Behavior・Scenario・TestCase)、Change Impact、Release Coverageを画面で見て、テスト知識を編集できるようにする。markharnessとは独立したプロジェクトで、コアとの接点はCLIのJSON出力だけである。 |
| 位置づけ | `markharness gui` が起動する、別の実行ファイル(`markharness-gui`)。markharnessの配布物には、テスト知識の編集ができる安定版から同梱される。 |
| 経緯と契約 | [docs/core-handoff.md](./docs/core-handoff.md)(引き継ぎ文書)。決定の記録は、markharness本体のADR 0038にある。 |

## 技術スタック <!-- 確定後に記入 -->

最初の試作(spike)で、実行形態(ネイティブウィンドウ、小型サーバーとブラウザ、Electronなど)を比較して決める。評価軸は、OSごとの自己完結した成果物であること、サイズ、開発のしやすさである(ADR 0038の未決事項)。

| 項目 | 値 |
|------|----|
| 言語・実行形態 | 未決定 |
| テスト | 未決定 |
| Lint / Format | 未決定 |
| ビルド | 未決定 |

### 標準コマンド <!-- 確定後に記入 -->

| 用途 | コマンド |
|------|---------|
| ビルド | 未決定 |
| テスト(全件) | 未決定 |
| テスト(単体) | 未決定 |
| Lint | 未決定 |
| フォーマット | 未決定 |
| フォーマットチェック | 未決定 |
| 依存の脆弱性スキャン | 未決定 |
| 依存のライセンス確認 | 未決定 |

## 外部との接点

| 対象 | 用途 | 備考 |
|------|------|------|
| `markharness` CLI | 関係・Change Impact・Release Coverageの取得(JSON)、編集(`knowledge reconcile`) | `markharness gui` が環境変数 `MARKHARNESS_BIN` で、起動した `markharness` のパスを渡す。GUIを単独で起動したときだけ、`PATH` 上の `markharness` を使う |
| `strictdoc` CLI | StrictDocの要求の見出し・階層(`strictdoc export --formats=json`) | 任意の連携。無い環境では、markharnessのデータだけを表示する |

GUIは、markharnessのJSON出力だけを読み、`.markharness/` 配下のファイルを直接読み書きしない(StrictDocのエクスポートを除く)。詳細は引き継ぎ文書を参照する。

## 認証情報・シークレット

| 項目 | 値 |
|------|----|
| 認証情報ディレクトリ | 該当なし |
| 格納ファイル | 該当なし |

外部サービスの認証は使わない。将来、必要になった場合は、このセクションと [security](./.github/instructions/security.instructions.md) の方針(ワークスペース外に保存)に従って追記する。

## ディレクトリ構成

```text
docs/
├── core-handoff.md   # markharness本体からの引き継ぎ文書(契約と方針)
├── review-policy.md  # レビューの方針
├── decisions/        # ADR(番号付き決定記録、日本語のみ)
└── design/           # 実装設計
```

ソースコードの構成は、技術スタックの確定後に追記する。

## Pre-PR チェックリスト

PR を作成する前に、以下をすべて満たすこと。技術スタックに依存する項目は、確定後に具体的なコマンドを記入する。

- [ ] 全テストがパスする <!-- 確定後に記入 -->
- [ ] Lintのエラーがゼロ <!-- 確定後に記入 -->
- [ ] フォーマット済み <!-- 確定後に記入 -->
- [ ] 依存に既知の脆弱性がない <!-- 確定後に記入 -->
- [ ] 依存のライセンスが許可リスト内([release-and-license](./.github/instructions/release-and-license.instructions.md)参照) <!-- 確定後に記入 -->
- [ ] `src/` 相当のコードの変更を、テスト先行(Red-Green-Refactor)で開発した
- [ ] コード・ログ・コミットメッセージ・PR本文にシークレットが含まれない

## GitHub Flow

AI・人間を問わず、リポジトリを変更する作業はGitHub Flowを使用する。AIはファイル変更の前に、必ず現在のブランチと作業ツリーを確認し、`main` 上なら、未コミットの変更を保持したまま、目的別の短命なブランチへ切り替える。コミットは作業ブランチ上で行い、`main` への統合はプルリクエストを経由する。

AIが従う具体的な開始条件・完了条件・権限の境界は、[github-flow.instructions.md](./.github/instructions/github-flow.instructions.md) を正とする。特に、push、プルリクエストの作成、マージは、ユーザーがその外部操作を明示的に依頼した場合だけ実行する。
