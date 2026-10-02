# markharness-gui

markharnessのデータ(関係・Change Impact・Release Coverage)を人が画面で見て、テスト知識を編集するための、独立したプロジェクト。Requirement・Feature・Behavior・Scenario・TestCaseなど、markharnessの用語は、本体の [CONTEXT.md](https://github.com/markharness/markharness/blob/main/CONTEXT.md) に従い、ここへはコピーしない。呼び名は「GUI」に統一する。

## Language

### StrictDocの連携

**StrictDocキャッシュ**:
`source: external` のRequirementの見出しと階層を得るために実行した、StrictDocのエクスポートの結果を、GUIが保存したもの。
_Avoid_: 基準のJSON

**更新中**:
StrictDocキャッシュが古いため、裏で再エクスポートしている状態。画面では、StrictDoc由来の部分にだけ示す。markharness由来のデータは、この間も先に表示する。

**強制再エクスポート**:
利用者が、StrictDocキャッシュを使わずに、StrictDocのエクスポートをやり直させる操作。利用者が、必ず使える形で用意する。
_Avoid_: キャッシュクリア
