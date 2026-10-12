# PROJECT.md — プロジェクト定義

> **技術スタックやコマンドなど、プロダクト固有の情報は、このファイルに集約します。**
> `.github/instructions/` 配下の規約や `CONTRIBUTING.md` は、技術スタックに依存する部分をこのファイルに委ねています。

## プロダクト概要

| 項目 | 値 |
|------|----|
| プロダクト名 | markharness-gui |
| 概要 | markharness(Git-nativeなテスト知識管理CLI)のGUI。関係(Requirement・Feature・Behavior・Scenario・TestCase)、Change Impact、Release Coverageを画面で見て、テスト知識を編集できるようにする。markharnessとは独立したプロジェクトで、コアとの接点はCLIのJSON出力だけである。 |
| 位置づけ | `markharness gui` が起動する、別の実行ファイル(`markharness-gui`)。markharnessの配布物には、テスト知識の編集ができる安定版から同梱される。 |
| 経緯と契約 | 決定の記録は、markharness本体のADR 0038にある。契約の要点は、下の「markharnessとの契約」にある。 |

## 技術スタック

実行形態は、Tauri 2のネイティブウィンドウである([ADR 0001](./docs/adr/0001-runtime-shell-tauri.md))。

| 項目 | 値 |
|------|----|
| 言語・実行形態 | バックエンドはRust、フロントエンドはTypeScriptとReact([ADR 0002](./docs/adr/0002-ui-framework-react.md))。Tauri 2のネイティブウィンドウ。実行時にNodeは要らない |
| テスト | Rustは `cargo test`(`markharness` の呼び出しは、境界の背後で、固定のJSONを返す偽の実装に差し替える)。フロントエンドは、ロジックにVitest、画面の部品にReact Testing Library。実物の `markharness` を呼ぶ結合テストを、`cargo test` に少数置く。ブラウザを駆動するE2Eは、安定後に実施し、ツールはその時点で決める |
| Lint / Format | Rustはclippyとrustfmt。フロントエンドはBiome |
| ビルド | Vite(フロントエンド)とTauri(成果物) |

### 対象OSと検証

- 最初の安定版の対象は、Windows(x64)とmacOS(arm64)である。
- 開発の検証は、Windowsを基準にする。開発中にmacOS関連のエラーが出たときは、Windowsを優先して対処する。
- macOSの最初の検証は、macOS Ventura 13.7.8のIntel Macで行う。関係の画面(最初の機能)は実装済みで、検証は未実施である。実施するまで、macOSは未検証として扱う。arm64の実行確認は、安定版のリリースのCIで、最小の起動テストとして行う([ADR 0001](./docs/adr/0001-runtime-shell-tauri.md))。

### 標準コマンド

すべて、リポジトリのルートで実行する。

| 用途 | コマンド |
|------|---------|
| ビルド | `npm run tauri build` |
| テスト(全件) | `cargo test --manifest-path src-tauri/Cargo.toml` と `npm test` |
| テスト(単体) | `cargo test --manifest-path src-tauri/Cargo.toml <テスト名>`、`npm test -- <パターン>` |
| Lint | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` と `npm run lint` |
| フォーマット | `cargo fmt --manifest-path src-tauri/Cargo.toml` と `npm run format` |
| フォーマットチェック | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` と `npm run format:check` |
| 依存の脆弱性スキャン | `cargo audit --file src-tauri/Cargo.lock` と `npm audit` |
| 第三者ライセンス表示の生成 | `npm run notices`(`THIRD-PARTY-NOTICES.md` を更新する。`cargo-about` が必要)。最新かの確認は `npm run notices:check` |
| 対応する `markharness` のビルド | `cargo install --git https://github.com/markharness/markharness --rev <.github/markharness-rev の値> --locked --root <出力先> markharness`。結合テストは、環境変数 `MARKHARNESS_BIN` に、できた実行ファイルを指定して動かす([ADR 0007](./docs/adr/0007-pin-core-main-commit.md)) |
| 依存のライセンス確認 | `cargo deny --manifest-path src-tauri/Cargo.toml check licenses`(許可リストは [release-and-license](./.github/instructions/release-and-license.instructions.md) と [ADR 0004](./docs/adr/0004-dependency-license-policy.md)) |

## 外部との接点

| 対象 | 用途 | 備考 |
|------|------|------|
| `markharness` CLI | 関係・Change Impact・Release Coverageの取得(JSON)、編集(`knowledge reconcile`、削除は `knowledge remove`、成功後に `generate`。種類は限らない、[ADR 0013](./docs/adr/0013-call-any-markharness-command.md)) | `markharness gui` が環境変数 `MARKHARNESS_BIN` で、起動した `markharness` のパスを渡す。GUIを単独で起動したときだけ、`PATH` 上の `markharness` を使う。対応する版は、`.github/markharness-rev` のコミット([ADR 0007](./docs/adr/0007-pin-core-main-commit.md)) |
| `strictdoc` CLI | StrictDocの要求の見出し・階層(`strictdoc export --formats=json`) | 任意の連携。無い環境では、markharnessのデータだけを表示する |

GUIは、markharnessのJSON出力だけを読み、`.markharness/` 配下のファイルを直接読み書きしない(StrictDocのエクスポートを除く)。契約の要点は、次の「markharnessとの契約」にまとめる。

## markharnessとの契約

契約の正本は、markharness本体のリポジトリにある。ここには、GUIが守る要点だけを書く。

### 起動

- 利用者が `markharness gui` を実行すると、本体が `markharness-gui` を、引数 `--dir <ルートの絶対パス>` 付きで実行し、環境変数 `MARKHARNESS_BIN` に、起動した `markharness` の絶対パスを渡す。本体は、GUIの終了を待ち、終了コードをそのまま返す。
- GUIは、`--dir` のプロジェクトを表示し、`markharness` を `MARKHARNESS_BIN` のパスで呼ぶ。単独で起動して `MARKHARNESS_BIN` が無いときだけ、`PATH` 上の `markharness` を使う。
- 起動に失敗したときは、非ゼロの終了コードで終了し、理由を標準エラーに出す。

### 読み取り

- 画面の内容は、`markharness` のJSON出力だけから作る。`.markharness/` 配下のファイルは、直接読み書きしない(StrictDocのエクスポートを除く)。すべて `--dir <プロジェクトのルート>` を付けて呼ぶ。
- 関係は `traceability`(作業ツリー)、検証手段は `binding list --json`、リリースの判断は `coverage --requirements all --at HEAD` と `impact` で読む。`coverage` と、`--base`・`--head` を使う `impact` は、コミット済みの内容だけを読む。`impact --worktree` は、`HEAD` と作業ツリーを比べる。
- 要素の同一性は `*_uid` で判断する。`*_id` は、名前の変更で変わりうる。要求とケースの紐づけは、本体が決める(`case_uids`)。GUIは、`relations` から、自分で計算しない。
- 画面に出す値は、読み取った出力が持つものだけにする。足りない読み取り出力は、本体への依頼(issue)にする。

### 版の互換

- 受け取ったJSONの `record_kind` が期待した種別で、`schema_version` が対応する版であることを確認する。そうでなければ、表示を止め、「対応する版」と「受け取った版」を示す。部分的な表示はしない。
- 必要な項目だけを読み、未知のキーと未知の配列は無視する。意味を解釈する値の集合(関係の `kind`、Requirementの `source`、`binding` の `mode`、ケースの `status` など)に未知の値が現れたとき、または必要な項目が欠けているときも、止まる。
- 0.xの間は、`schema_version` が `1` に固定され、出力の形の変化を検出できない。同じ配布物の組み合わせを信頼する。開発中に対応する `markharness` は、`.github/markharness-rev` のコミットである([ADR 0007](./docs/adr/0007-pin-core-main-commit.md))。`markharness --version` による確認は、行わない。

### エラー

- 終了コードが0以外なら失敗とみなし、標準エラーの文面を、そのまま利用者に見せる。コマンドによって、エラーがJSONのことと平文のことがあるため、文面は解析しない。
- 作業ツリーを読むので、編集の途中の、整合の取れていない状態を読むことがある。エラーは、握りつぶさずに表示する。

### StrictDoc

- `source: external` のRequirementの見出しと階層は、GUIが `strictdoc export --formats=json` を実行して読む。これは、GUIだけに許される例外である。要求の対応は、`traceability` の `source_key` とStrictDocのMIDを突き合わせる。
- 任意の連携である。`strictdoc.toml` か `strictdoc_config.py` が無いプロジェクト、または `strictdoc` が無い環境では、エクスポートを実行せず、markharnessのデータだけを表示する(エラー画面にしない)。
- エクスポートは遅く、プロジェクトによっては1回に20秒かかる。結果を保存し([ADR 0003](./docs/adr/0003-strictdoc-cache-inside-project.md))、文書か設定の更新時刻が新しいときだけ、裏で再エクスポートする。再エクスポートの間は、markharnessのデータを先に表示し、StrictDoc由来の部分を「更新中」と示す。古い内容を見せ続けないため、キャッシュを使わない再エクスポートの操作を、利用者が必ず使える形で用意する。

### 実装上の注意

- `markharness` と `strictdoc` の呼び出しは、非同期にする。同期呼び出しは、画面を固める。
- Windowsでは、`pip` や `npm` が作るコマンドが `.cmd` のラッパーになり、拡張子なしでは起動できないことがある(`strictdoc`)。`markharness` 自身は `.exe` である。
- `traceability` の `relative_path` は、`/` 区切りで出力される。

### 参照

| 文書 | URL |
|---|---|
| ADR 0038: GUIを独立したプロジェクトとする決定 | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0038-gui-as-independent-project.md |
| ADR 0032: CLIのJSONを外部契約とする方針 | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0032-cli-read-model-seam.md |
| 設計書: 各JSONのフィールドの詳細 | https://github.com/markharness/markharness/blob/main/docs/ja/design/cli-read-model-design.md |
| CLIマニュアル | https://github.com/markharness/markharness/blob/main/docs/ja/cli-manual.md |
| 用語集 | https://github.com/markharness/markharness/blob/main/CONTEXT.md |

## 認証情報・シークレット

| 項目 | 値 |
|------|----|
| 認証情報ディレクトリ | 該当なし |
| 格納ファイル | 該当なし |

外部サービスの認証は使わない。将来、必要になった場合は、このセクションと [security](./.github/instructions/security.instructions.md) の方針(ワークスペース外に保存)に従って追記する。

## ディレクトリ構成

```text
docs/
├── review-policy.md  # レビューの方針
├── adr/              # ADR(番号付き決定記録、日本語のみ)
└── design/           # 実装設計
```

ソースコードは、Tauriの標準の構成にする。

```text
package.json, vite.config.ts, biome.json   # フロントエンドの設定
src/                                       # フロントエンド(TypeScriptとReact)
src-tauri/                                 # Rust(Tauri)。deny.toml はここ
```

## Pre-PR チェックリスト

PR を作成する前に、以下をすべて満たすこと。具体的なコマンドは、「標準コマンド」の表を参照する。

- [ ] 全テストがパスする
- [ ] Lintのエラーがゼロ
- [ ] フォーマット済み
- [ ] 依存に既知の脆弱性がない
- [ ] 依存のライセンスが許可リスト内([release-and-license](./.github/instructions/release-and-license.instructions.md)参照)
- [ ] 第三者ライセンス表示が最新(`npm run notices:check`)
- [ ] `src/` と `src-tauri/` のコードの変更を、テスト先行(Red-Green-Refactor)で開発した
- [ ] コード・ログ・コミットメッセージ・PR本文にシークレットが含まれない

## GitHub Flow

AI・人間を問わず、リポジトリを変更する作業はGitHub Flowを使用する。AIはファイル変更の前に、必ず現在のブランチと作業ツリーを確認し、`main` 上なら、未コミットの変更を保持したまま、目的別の短命なブランチへ切り替える。コミットは作業ブランチ上で行い、`main` への統合はプルリクエストを経由する。

AIが従う具体的な開始条件・完了条件・権限の境界は、[github-flow.instructions.md](./.github/instructions/github-flow.instructions.md) を正とする。特に、push、プルリクエストの作成、マージは、ユーザーがその外部操作を明示的に依頼した場合だけ実行する。
