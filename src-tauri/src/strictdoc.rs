use serde::{Deserialize, Serialize};

use crate::traceability::ReadError;

/// The requirements StrictDoc exports, in the order of its documents and sections.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct StrictDoc {
    pub documents: Vec<Document>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Document {
    pub title: String,
    pub nodes: Vec<Node>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Node {
    Section(Section),
    Requirement(StrictDocRequirement),
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Section {
    pub title: String,
    pub nodes: Vec<Node>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct StrictDocRequirement {
    /// What `traceability` reports as the requirement's `source_key`.
    pub mid: String,
    pub uid: Option<String>,
    pub title: String,
    pub statement: String,
    /// The uids this requirement points at with `Parent` relations.
    pub parents: Vec<String>,
}

#[derive(Deserialize)]
struct RawExport {
    #[serde(rename = "DOCUMENTS")]
    documents: Vec<RawDocument>,
}

#[derive(Deserialize)]
struct RawDocument {
    #[serde(rename = "TITLE")]
    title: String,
    #[serde(rename = "NODES", default)]
    nodes: Vec<RawNode>,
}

#[derive(Deserialize)]
struct RawNode {
    #[serde(rename = "_NODE_TYPE")]
    node_type: String,
    #[serde(rename = "MID")]
    mid: Option<String>,
    #[serde(rename = "UID")]
    uid: Option<String>,
    #[serde(rename = "TITLE")]
    title: Option<String>,
    #[serde(rename = "STATEMENT")]
    statement: Option<String>,
    #[serde(rename = "RELATIONS", default)]
    relations: Vec<RawRelation>,
    #[serde(rename = "NODES", default)]
    nodes: Vec<RawNode>,
}

#[derive(Deserialize)]
struct RawRelation {
    #[serde(rename = "TYPE")]
    kind: String,
    #[serde(rename = "VALUE")]
    value: Option<String>,
}

fn convert(nodes: Vec<RawNode>) -> Result<Vec<Node>, ReadError> {
    let mut out = Vec::new();
    for n in nodes {
        match n.node_type.as_str() {
            "SECTION" => out.push(Node::Section(Section {
                title: n.title.unwrap_or_default(),
                nodes: convert(n.nodes)?,
            })),
            "REQUIREMENT" => out.push(Node::Requirement(StrictDocRequirement {
                mid: n
                    .mid
                    .ok_or_else(|| ReadError::Malformed("a requirement has no MID".to_string()))?,
                uid: n.uid,
                title: n.title.unwrap_or_default(),
                statement: n.statement.unwrap_or_default(),
                parents: n
                    .relations
                    .into_iter()
                    .filter(|r| r.kind == "Parent")
                    .filter_map(|r| r.value)
                    .collect(),
            })),
            // Plain text and other node kinds are not requirements.
            _ => {}
        }
    }
    Ok(out)
}

/// Reads the JSON that `strictdoc export --formats=json` writes. What StrictDoc exports is
/// shown as it is; whether its structure is sound is StrictDoc's to judge.
pub fn parse_strictdoc(json: &str) -> Result<StrictDoc, ReadError> {
    let raw: RawExport = serde_json::from_str(json).map_err(|e| match e.classify() {
        serde_json::error::Category::Data => ReadError::Malformed(e.to_string()),
        _ => ReadError::NotJson(e.to_string()),
    })?;
    let documents = raw
        .documents
        .into_iter()
        .map(|d| {
            Ok(Document {
                title: d.title,
                nodes: convert(d.nodes)?,
            })
        })
        .collect::<Result<Vec<_>, ReadError>>()?;
    Ok(StrictDoc { documents })
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPORT: &str = include_str!("../tests/fixtures/strictdoc_export.json");

    fn requirement<'a>(nodes: &'a [Node], uid: &str) -> &'a StrictDocRequirement {
        nodes
            .iter()
            .find_map(|n| match n {
                Node::Requirement(r) if r.uid.as_deref() == Some(uid) => Some(r),
                Node::Section(s) => Some(requirement(&s.nodes, uid)),
                _ => None,
            })
            .unwrap_or_else(|| panic!("no requirement {uid}"))
    }

    #[test]
    fn keeps_the_documents_in_the_order_the_export_lists_them() {
        let export = parse_strictdoc(EXPORT).unwrap();

        let titles: Vec<&str> = export.documents.iter().map(|d| d.title.as_str()).collect();
        assert_eq!(
            titles,
            ["High-Level Requirements", "Low-Level Requirements"]
        );
    }

    #[test]
    fn reads_a_requirement_with_its_parents() {
        let export = parse_strictdoc(EXPORT).unwrap();

        let r = requirement(&export.documents[1].nodes, "TODO-MGMT-ADD-VALID");

        assert_eq!(r.mid, "d7f21c3463b24c54b30f9ff162f4cc3d");
        assert_eq!(r.parents, ["HLR-1"]);
        assert!(!r.title.is_empty());
    }

    #[test]
    fn gives_a_requirement_without_relations_no_parents() {
        let export = parse_strictdoc(EXPORT).unwrap();

        let r = requirement(&export.documents[0].nodes, "HLR-1");

        assert!(r.parents.is_empty());
        assert!(!r.statement.is_empty());
    }

    #[test]
    fn keeps_sections_as_headings_around_their_requirements_and_drops_plain_text() {
        let export = parse_strictdoc(EXPORT).unwrap();

        let nodes = &export.documents[1].nodes;

        assert!(nodes.iter().all(|n| !matches!(n, Node::Requirement(_))));
        let Node::Section(first) = &nodes[0] else {
            panic!("expected a section first");
        };
        assert!(first.title.contains("todo-management"));
        assert_eq!(first.nodes.len(), 3);
    }

    #[test]
    fn ignores_relations_that_are_not_parent() {
        let json = serde_json::json!({
            "DOCUMENTS": [{
                "TITLE": "Doc",
                "NODES": [{
                    "_NODE_TYPE": "REQUIREMENT",
                    "MID": "m1",
                    "UID": "R-1",
                    "TITLE": "t",
                    "STATEMENT": "s",
                    "RELATIONS": [
                        {"TYPE": "File", "VALUE": "src/a.rs"},
                        {"TYPE": "Parent", "VALUE": "R-0"}
                    ]
                }]
            }]
        })
        .to_string();

        let export = parse_strictdoc(&json).unwrap();

        assert_eq!(
            requirement(&export.documents[0].nodes, "R-1").parents,
            ["R-0"]
        );
    }

    #[test]
    fn rejects_output_that_is_not_json() {
        let err = parse_strictdoc("not json").unwrap_err();

        assert!(matches!(err, ReadError::NotJson(_)), "{err:?}");
    }

    #[test]
    fn rejects_output_without_documents() {
        let err = parse_strictdoc("{}").unwrap_err();

        assert!(matches!(err, ReadError::Malformed(_)), "{err:?}");
    }
}
