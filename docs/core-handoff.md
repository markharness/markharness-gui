# markharness-gui 引き継ぎ文書(下書き)

読み手は、GUIを作るフロントエンドの開発者です。markharness本体はRust製のCLIですが、Rustを読む必要はありません。GUIが守る約束(契約)と、GUI側で決めてよいことを、この文書にまとめます。

この文書はGUIリポジトリの最初の文書として置き、以後はGUIリポジトリが所有します。契約の正本はmarkharness本体のリポジトリにあり、ここへはコピーせず、リンクで参照します。リンクは、本体のADR 0038がマージされた後、固定したコミットのURLに置き換えます(いまは未マージです)。

## 1. 何を作るか

markharnessが管理するテスト知識について、次の3つを人が画面で見られるGUIを作ります。

- **関係**: Requirement(要求)→ Feature → Behavior → Scenario → TestCase のつながり
- **Change Impact**: 2つのコミットの間で、どの要求が変わり、対応するTestCaseが追随したか
- **Release Coverage**: 指定した要求について、TestCaseと検証手段がそろっているか

利用者には非開発者が含まれます。ターミナルに不慣れな人を想定してください。GUIは、**閲覧と編集の両方**を担います。閲覧だけの版は、開発の途中段階として作ってかまいませんが、markharnessの配布物には同梱されません。**同梱されるのは、テスト知識の編集ができる安定版からです**。閲覧だけでは、閲覧のあとにYAMLの直接編集へ戻る負担が残るためです(本体のADR 0038 決定10)。編集は、本体の `markharness knowledge reconcile`(作成・更新)と `markharness knowledge remove`(削除、本体のADR 0034)を通し、成功後に `markharness generate` を呼びます(GUIがKnowledgeのファイルを直接書き換えることはしません)。`reconcile` の `mode: merge` では削除できないため、削除は `remove` を通します。GUIが呼んでよい `markharness` のコマンドは、種類を限りません([ADR 0013](adr/0013-call-any-markharness-command.md))。

用語は本体の用語集(`CONTEXT.md`)に従います。「GUI」と呼び、「viewer」「ビューア」は使いません。

## 2. 全体の考え方: `git gui` と同じ構造

| | git gui | markharness gui |
|---|---|---|
| 起動 | `git gui` が別の実行ファイル `git-gui` を実行する | `markharness gui` が別の実行ファイル `markharness-gui` を実行する |
| 情報の取得 | gitのCLIを子プロセスで呼ぶ | markharnessのCLIを子プロセスで呼び、JSONを読む |
| 保守 | gitとは独立したプロジェクト | markharnessとは独立したプロジェクト |
| 配布 | gitの配布物に同梱する | markharnessのGUI入りアーカイブに同梱する |

重要な約束が2つあります。

- **GUIは、markharnessのJSON出力だけを読みます。** `.markharness/` 配下のファイルを直接読んだり、書き換えたりしません。ファイルの形式は予告なく変わります。JSONの出力が約束された窓口です。
- **markharness本体には、GUIのコードを入れません。** 画面、サーバー、ブラウザの起動などはすべてGUI側の責任です。

## 3. 起動の約束

利用者は、プロジェクトのディレクトリで `markharness gui` を実行します。本体は次のことをします。

- 対象プロジェクトのルートを決める(未初期化なら、本体が `markharness init` を促して終了する)。
- `markharness-gui` を、本体と同じディレクトリ、なければ `PATH` の順に探して実行する。
- GUIに引数 `--dir <ルートの絶対パス>` を渡す。
- 環境変数 **`MARKHARNESS_BIN`** に、起動した `markharness` 自身の絶対パスを設定する。
- GUIが終了するまで待ち、GUIの終了コードをそのまま返す。

GUIがすること:

- 引数 `--dir` を受け取り、そのプロジェクトを表示する。
- `markharness` を呼ぶときは `MARKHARNESS_BIN` のパスを使う。GUIを単独で起動し、この環境変数が無いときだけ、`PATH` 上の `markharness` を使う。同じ配布物の `markharness` を呼ぶことで、版の食い違いを避けるためです。
- 起動に失敗したときは、非ゼロの終了コードで終了し、理由を標準エラーに出す。本体を通して、ターミナルに表示されます。
- 本体は終了を待つので、GUIを常駐させるか、別プロセスにして先に戻るかは、GUIが決めてよい。

## 4. 使うCLIコマンド(閲覧の途中段階)

すべて `--dir <プロジェクトのルート>` を付けて呼びます。出力はJSONです。下の例は、2026-10-02に本体(0.6.1のデバッグビルド)をサンプルプロジェクトで実行して得た出力の抜粋です。**最新の出力は、手元の本体で必ず実行して確かめてください。**

### 関係: `markharness traceability`

```
markharness traceability --dir <root>
```

常に作業ツリー(未コミットの編集を含む今の状態)を読みます。`--at` と `--format` はありません(本体のADR 0043)。コミット済みの特定時点は、`coverage --at` で読みます。

```json
{
  "schema_version": 1,
  "record_kind": "traceability",
  "requirements": [
    { "requirement_id": "req-1", "requirement_uid": "01M39R…", "source": "external",
      "label": null, "source_locator": "docs/requirements.sdoc", "source_key": "2222…",
      "case_uids": ["80d453ad-…"] }
  ],
  "features":  [ { "feature_id": "login", "feature_uid": "01M39R…", "label": "ログイン" } ],
  "behaviors": [ { "behavior_id": "submit-credentials", "behavior_uid": "01M39R…",
                   "feature_id": "login", "label": "認証情報の送信" } ],
  "scenarios": [ { "scenario_id": "valid-login", "scenario_uid": "01M39R…",
                   "behavior_id": "submit-credentials", "label": "正しい認証情報でのログイン成功" } ],
  "test_cases": [ { "case_id": "tc-login-…", "case_uid": "80d453ad-…", "case_revision": "9e68aade-…",
                    "relative_path": "login/submit-credentials/valid-login.yml",
                    "scenario_id": "valid-login" } ],
  "relations": [
    { "from_uid": "<Featureのuid>",  "to_uid": "<Requirementのuid>", "kind": "contributes_to" },
    { "from_uid": "<Scenarioのuid>", "to_uid": "<Requirementのuid>", "kind": "contributes_to" },
    { "from_uid": "<TestCaseのuid>", "to_uid": "<Scenarioのuid>",    "kind": "generated_from" }
  ]
}
```

読み方:

- 要素の同一性は `*_uid` で判断します。`*_id` は人が読む名前(slug)で、名前の変更で変わりえます。
- Requirementの `source` は `native`(markharnessが内容を持つ)か `external`(StrictDocなど外部の仕様書が内容を持つ)です。`external` では `label` が `null` で、見出しや本文は含まれません(5章)。
- Requirementの `case_uids` は、その要求に紐づくケースの `case_uid` の一覧です。紐づけの規則は `coverage` と同じで、本体が決めます(本体のADR 0042)。GUIは、`relations` から要求とケースの紐づきを、自分で計算しません。
- 親子関係は、`behaviors[].feature_id` や `scenarios[].behavior_id` のようなフィールドで表します。FeatureとScenarioからRequirementへの `contributes_to` は多対多で、`relations` が表します。

### 検証手段: `markharness binding list`

```
markharness binding list --json --dir <root>
```

```json
{ "bindings": [
    { "case_uid": "80d453ad-…", "mode": "automated", "reference": "tests/login.spec.js",
      "record_kind": "execution_binding", "schema_version": 1 } ],
  "outcome": "bindings_listed", "schema_version": 1 }
```

`mode` は `automated` か `manual` です。`reference` は、テストコードのパスやURLです。テストが実行済みであることは意味しません。

### リリース判断の補助: `markharness coverage` / `markharness impact`

```
markharness coverage --requirements all --at HEAD --dir <root>
markharness impact --base <git ref> --head <git ref> --dir <root>
```

どちらもコミット済みの内容だけを読みます。`traceability` と違い、未コミットの編集は反映されません。`coverage` の出力は `"record_kind": "release_coverage"`、`impact` は `"record_kind": "change_impact"` です。

詳細なフィールドは、本体の設計書(`docs/ja/design/cli-read-model-design.md` の `coverage` と `impact` の節)にあります。

### 閲覧の途中段階で使わないもの

- `markharness axes list --json`: 軸の定義(`id` と `label`)の一覧だけを返します。`traceability` は要素ごとの軸を返さないため、一覧を結びつける対象が画面にありません。また、出力が `record_kind` も `schema_version` も持たない裸の配列で、種別の確認ができません。
- 軸、説明文、Scenarioの手順(`phases`)、生成されたTestCaseの手順: 現在のJSONに含まれません。編集の画面に出すために必要です。先に本体へ読み取り出力の追加を依頼します(8章)。

## 5. StrictDocとの関係

要求の仕様書にStrictDocを使うプロジェクトがあります。`source: external` のRequirementについて、`traceability` が返すのは `source_key`(StrictDocのMID)までで、要求の見出し、本文、階層は含まれません。本体は、外部の内容を保持・複製しない方針だからです。

そこで、**GUIが `strictdoc export --formats=json` を実行し、そのJSONを読みます。** これはGUIだけに許される例外です。

- StrictDocは任意の連携です。`strictdoc_config.py` か `strictdoc.toml` が無いプロジェクト、または `strictdoc` が入っていない環境では、エクスポートを実行せず、markharnessのデータだけを表示してください(エラー画面にしない)。
- 要求の対応は、`traceability` の `source_key` とStrictDocのMIDを突き合わせます。

### エクスポートが遅い

2026-10-02、strictdoc 0.30.1、Windowsでの計測です。

| 対象 | 要求数 | 所要時間 |
|---|---|---|
| 合成データ(`.sdoc`8個) | 400 | 4.1秒(`--no-parallelization` で2.0秒) |
| StrictDoc自身のリポジトリ全体 | 358 | **20.6秒** |
| 同じ `docs/` と `spec/` だけを切り出したコピー | 358 | 6.3秒 |

遅さの主因は、要求の数ではなく、StrictDocの設定がソースコードまで走査していること(`include_source_paths`)です。GUIが必要とするのは要求の見出しと階層だけなので、この走査は不要ですが、設定を省く確実な方法は確認できていません(設定がPythonのコードのため)。

毎回実行すると、プロジェクトによっては1回20秒かかります。そこで次の方針にしてください。

- エクスポートのJSONを基準として保存する(保存場所はGUIが決めてよい。プロジェクトの中にファイルを増やさない場所を勧めます)。
- StrictDocのドキュメント(`.sdoc`・`.md`)と設定ファイルの更新時刻が、保存したJSONより新しいときだけ、**裏で**再エクスポートする。ソースコード(`.py`など)の変更では再実行しない。
- 再エクスポートの間も、markharness側のデータは先に表示する。StrictDoc由来の部分には「更新中」と表示する。
- ファイルの**削除**は更新時刻に現れません。ソースを含むディレクトリの更新時刻も見てください。
- **古い内容を見せ続けない**ことが必須の制約です。「キャッシュを使わず再エクスポート」する操作を、利用者が必ず使える形で用意してください。

## 6. 版の互換

- **互換の判断は、JSONの `record_kind` と `schema_version` で行います。** 受け取ったJSONの `record_kind` が期待した種別であること、`schema_version` がGUIの対応する版であることを確認し、そうでなければ**表示を止め**、「対応する版」と「受け取った版」を示して、更新を案内してください。部分的な表示はしないでください。誤った関係を表示するほうが、止まるより害が大きいためです。
- 必要な項目だけを読み、既存のオブジェクトに追加された未知のキーや、未知の新しい配列は無視してください。ただし、意味を解釈する値の集合(関係の `kind`、Requirementの `source`、`binding` の `mode` など)に知らない値が現れたときは、その要素を黙って除外せず、対応しない版として止まってください。必要な項目が欠けているときも、同じく止まってください。止まるときに、部分的な表示はしません。
- **ただし、0.xの間は、`schema_version` の確認は互換の変化を検出できません**(検出できるのは、必要な項目の欠落だけです)。本体は後方互換を考えない方針で、`schema_version` は `1` に固定され、出力の形が変わっても上がりません(本体のADR 0026・0039)。そこで0.xの間は、同梱された組み合わせを信頼します。GUIは同じ配布物の `markharness` を `MARKHARNESS_BIN` で受け取り、GUIの安定版は `markharness` のリリースに固定して同梱されます。
- 結果として、GUIを単独で起動して別の版の `markharness` を使った場合は、出力の形の違いを検出できません。`markharness --version` による確認は、行いません。
- `schema_version` を上げる基準は、本体が1.0の基準を満たす時点で決まります。`schema_version` が実際に上がるようになれば、上の確認が、GUIを変更しなくても互換の判断として働きます。
- 版の置き場所はコマンドで異なります。`traceability`・`coverage`・`impact` は最上位の `schema_version` です。`binding list` は最上位の `schema_version` に加えて、各要素にも `schema_version` があります。

## 7. エラーの扱い

- 終了コードが0以外なら失敗とみなします。標準エラーの文面をそのまま利用者に見せてください。コマンドによってエラーがJSONのことと平文のことがあるため、文面の解析はしないでください。
- 観測した終了コード: プロジェクトが未初期化なら1、存在しないgit refを指定すると3。意味を細かく分岐する前提にはしないでください。

## 8. GUI側で決めてよいこと・本体へ依頼すること

### GUI側で決めてよいこと

- GUIの実行形態(ネイティブウィンドウ、小型サーバーとブラウザ、など)と、使う技術。非開発者が追加のインストールなしで使える、OSごとに自己完結した成果物であること。
- 画面の設計、画面遷移、表現。
- 5章のキャッシュの詳細(保存場所、更新時刻の比較、更新中の表示)。
- Change Impactの `--base`・`--head` と、Release Coverageの `--at` に渡すrefの候補を、読み取り専用の `git`(`for-each-ref`、`log`)で出すこと。画面の内容は、markharnessのJSON出力だけから作る。`git` が使えないときは、候補を出さない(自由入力には切り替えない)。いま実装している候補は、タグだけである([ADR 0005](adr/0005-readonly-git-for-ref-candidates.md)、[ADR 0012](adr/0012-compare-with-a-tag.md))。書き込みを伴う `git` は呼ばない。
- 更新: 利用者の更新操作でJSONを再取得する。ファイル監視はしない。GUI自身が編集をした後は、自動で再取得する。

### 現時点で扱わないもの

- ターミナルを使わない起動(ダブルクリック、フォルダ選択画面)。必要になったら、別のデスクトップ版として別プロジェクトにします。
- コミット済みの特定の版を見るレビュー用スナップショット(CIが生成したStrictDocのエクスポートの受け取りを含む)。

### 編集は同梱の条件

編集は、スコープ外ではありません。GUIが本体の配布物に同梱されるための条件です。閲覧だけでは、閲覧のあとにYAMLの直接編集へ戻る負担が残るためです(本体のADR 0038 決定10)。閲覧だけの途中段階の後に、本体の `knowledge reconcile` と `knowledge remove` を通し、成功後に `generate` を呼んで作ってください。編集に必要な詳細項目の読み取り出力は、先に本体へ依頼します(下記)。

### 本体へ依頼すること

次のものは、現在のCLIでは取得できません。画面に出す前に、本体への依頼(issue)にしてください。GUIが内部ファイルを直接読んで補うことはしません。

- 軸、説明文、Scenarioの手順、生成されたTestCaseの手順を返す読み取り出力。
- (解消済み)Scenarioを持たないBehaviorが `traceability` に現れない問題は、本体で修正されました(main の PR #92)。`traceability` の `behaviors` は、Scenarioの有無によらず、Knowledgeにある全Behaviorを返します。`schema_version` は `1` のままです(ADR 0039)。
- `axes list` の `record_kind` と `schema_version` 付きの出力(他の読み取り出力と形をそろえる)。
- `binding list` の `reference` が指すファイルの実在判定。

## 9. 実装上の注意

- `markharness` の呼び出しは、非同期にしてください。同期呼び出しは、`strictdoc` の実行や大きな出力のときに画面を固めます。標準出力のバッファの上限にも注意してください。
- Windowsでは、`pip` や `npm` が作るコマンドが `.cmd` のラッパーになる場合があり、拡張子なしでは起動できないことがあります。`strictdoc` を呼ぶときは注意してください。`markharness` 自身は `.exe` です。
- `traceability` の `relative_path` は、`/` 区切りで出力されます。ファイルの存在確認などでOSのパスに変換してください。
- 作業ツリーを読むため、利用者が編集している最中の状態が見えます。更新のたびに、整合の取れていない途中の状態を読む可能性があります。エラーは握りつぶさず、表示してください。

## 10. 参照

契約の正本は、markharness本体のリポジトリ(https://github.com/markharness/markharness)にあります。ここへはコピーしていません。ADR 0038は、本書を作った時点では未マージで、PR #93のブランチ `feature/gui-launcher` にあります。マージ後は、固定したコミットのURLに置き換えてください。

| 文書 | URL(ADR 0038はマージ前のブランチ) |
|---|---|
| ADR 0038: この文書の決定の記録 | https://github.com/markharness/markharness/blob/feature/gui-launcher/docs/ja/decisions/0038-gui-as-independent-project.md |
| ADR 0032: CLIのJSONを外部契約とする方針 | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0032-cli-read-model-seam.md |
| ADR 0033: `traceability` が作業ツリーを読む理由 | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0033-traceability-defaults-to-working-tree.md |
| ADR 0023: `native` と `external` のRequirement | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0023-requirement-native-and-external-source.md |
| ADR 0026・0039: `schema_version` を上げない理由 | https://github.com/markharness/markharness/blob/main/docs/ja/decisions/0039-read-output-schema-version-frozen-in-prototype.md |
| 設計書: 各JSONのフィールドの詳細 | https://github.com/markharness/markharness/blob/main/docs/ja/design/cli-read-model-design.md |
| CLIマニュアル | https://github.com/markharness/markharness/blob/main/docs/ja/cli-manual.md |
| 用語集 | https://github.com/markharness/markharness/blob/main/CONTEXT.md |
