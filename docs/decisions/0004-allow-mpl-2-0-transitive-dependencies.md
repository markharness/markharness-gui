# 0004: 改変しない推移的な依存としてのMPL-2.0と、BSD-3-Clauseを許可する

## ステータス

Accepted(2026-10-03決定)。

## 背景

markharness-guiの依存は、同梱先のmarkharness(MIT)と両立するライセンスに限っていた。許可リストの出発点は、markharness本体の許可リスト(MIT、MIT-0、Apache-2.0、Apache-2.0 WITH LLVM-exception、BSD-2-Clause、BSL-1.0、Unicode-3.0、Unlicense、Zlib)で、コピーレフトは、推移的な依存でも許さない、としていた。

実行形態をTauri 2とする([0001](0001-runtime-shell-tauri.md))と、`cargo deny` で、許可リストの外のライセンスが見つかった(2026-10-03、WindowsとmacOSのどちらの対象でも)。

- MPL-2.0: `cssparser`、`cssparser-macros`、`selectors`、`dtoa-short`(いずれも、Tauriの中核の `tauri-utils` が使う `dom_query` 経由)と、`option-ext`(`dirs` 経由)。
- BSD-3-Clause: `brotli`、`alloc-no-stdlib`、`alloc-stdlib`、`matchit`(`matchit` は、MIT AND BSD-3-Clause)。

MPL-2.0は、ファイル単位の弱いコピーレフトである。改変せずに依存として同梱する限り、自分のコードを同じライセンスにする義務は生じない。実行ファイルの形で配布するときは、受け取る人に、MPL-2.0のコードのソースの入手方法を知らせる必要がある。これらのクレートは、改変せず、crates.ioで入手できる。

## 決定

次の2つを、許可リストに加える。

- **BSD-3-Clause**: BSD-2-Clauseと同じ寛容なライセンスとして許可する。
- **MPL-2.0**: 次の条件をすべて満たす依存に限り許可する。
  - GUIが、そのクレートのソースを改変しない。
  - 推移的な依存である(GUIの直接の依存には、加えない)。
  - GUIの配布物に、第三者のライセンス表示のファイルを同梱し、MPL-2.0のクレートの名前、版、ソースの入手先(crates.io)を載せる。

GPL・LGPL・AGPL・SSPLなどの強いコピーレフトと、OSIの承認がないライセンスは、これまでどおり、許可しない。

第三者のライセンス表示のファイルは、ビルドの手順で、依存の一覧から生成する。markharness本体のGUI入りアーカイブには、このファイルを同梱するよう、本体へ依頼した。

## 代替案

- **規約を変えず、実行形態を、ブラウザ方式(Rustの小型サーバー)に切り替える**: BSD-3-Clauseの許可だけで通る。ただし、終了の検出と、ローカルのポートの防御が、恒常的な保守になる([0001](0001-runtime-shell-tauri.md))。
- **Tauriを使わず、`wry` と `tao` だけを使う**: Windowsでは、BSD-3-Clauseの許可だけで通る。しかし、macOSでは、`wry` が `dirs` を経由して、MPL-2.0の `option-ext` を引き込む。MPL-2.0を避けられない。
- **MPL-2.0のクレートを、自前の実装に置き換える**: `tauri-utils` の中核の依存で、置き換えは、Tauriの改変になる。

## 影響

- 依存のライセンス確認は、`cargo deny check licenses` で行い、許可リストは、この決定の内容にする。
- 依存を追加するたびに、MPL-2.0の条件を満たすかを確認する。GUIの直接の依存に、MPL-2.0が現れたときは、この決定の範囲外として、改めて判断する。
- 第三者のライセンス表示のファイルを生成する手順が、ビルドに加わる。
