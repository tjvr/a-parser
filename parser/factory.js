
const assert = require('assert')

function semanticError(node, message) {
  throw new Error(node.formatError(message))
}

function buildRootType(children) {
  let rootIndex = -1

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
    case "List":
      semanticError(child, "List child in non-list rule")
    case "Root":
      break // continue
    default:
      semanticError(child, "Named child in rule without node type")
    }

    if (rootIndex !== -1) {
      semanticError(child, "Multiple root children")
    }
    rootIndex = i
  }

  if (rootIndex === -1) {
    return {type: "null"}
  }
  return {type: "root", index: rootIndex}
}

function buildListType(children) {
  const nodeType = {type: "list"}

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
    case "Root":
      if (nodeType.rootIndex !== undefined) {
        semanticError(child, "Multiple root children")
      }
      nodeType.rootIndex = i
      break

    case "List":
      if (nodeType.listIndex !== undefined) {
        semanticError(child, "Multiple list children")
      }
      nodeType.listIndex = i
      break

    default:
      semanticError(child, "Named child in list rule")
    }
  }

  return nodeType
}

function buildType(rule) {
  assert.equal(rule.type, "Rule")
  const type = rule.nodeType ? rule.nodeType.type : "Object"
  switch (type) {
  case "Object":
    return buildRootType(rule.children)
  case "List":
    return buildListType(rule.children)
  }
}

module.exports = {buildType}
