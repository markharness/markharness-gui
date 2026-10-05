# 0009: 表示する情報は、出所を区別し、人間の注意は、事実とは別に扱う

## ステータス

Proposed(2026-10-05。7つの原則は、利用者が定めた。定義の足りない点と、既存の決定との整合を確認している)。

## 背景

このGUIの目的は、Knowledgeの関係を可視化することではなく、人間が、短時間で、どの要求のVerificationに注意が必要か、その理由は何かを判断できるようにすることである。

画面に出す情報には、出所の違うものが混ざる。本体(markharness)の出力、連携元(StrictDoc)の情報、GUIが作る集計がある。本体は、StrictDocの親子関係を知らないので、本体の事実と、GUIが親子の上で作った集計を、1つの行に区別なく並べると、矛盾に見える表示になる。

## 用語

- **Atomic Fact**: 出所が1つで、対象が1つの、それ以上分けない事実(本体の出力の項目、StrictDocの要求の本文など)。
- **Aggregate**: 配下のAtomic Factを、親の行で、まとめて示したもの。
- **Derived Evidence**: 複数のFact、出所、関係から、GUIが導いた情報。
- **Human Attention**: GUIが、人間に、どこを見るべきかを示すための優先づけ。事実ではない。

## 原則

1. Atomic Factには一意の出所があり、対象と出所を追跡できること。
2. Atomic Factは、それが語る対象自身にのみ付与する。親への意味的な伝播はしない。
3. 配下のAtomic Factを親で表示するときはAggregateとして扱い、「親自身のFact」と混同しない。
4. 複数のFact・Source・Relationから導出した情報はDerived Evidenceとして扱い、何から導出したか説明可能にする。
5. GUIはFact/Aggregate/Derived EvidenceからHuman Attentionを決定してよい。ただしAttentionは対象が「危険」「不正」「未検証」であるという事実を意味しない。
6. 「自身に指摘なし」と「人間が確認する必要なし」を区別する。配下にAttention対象があれば、親自身にFactがなくても親を入口として提示してよい。
7. デフォルト画面ではEvidenceの完全性より、人間が「どこを見るべきか」を短時間で判断できることを優先する。完全なFact/Relation/Sourceはdrill-downで確認できること。
