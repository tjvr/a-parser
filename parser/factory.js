
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

    if (child.key.type !== "Root") {
      semanticError(child, "Non-root child in rule without node type")
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

function buildType(rule) {
  assert.equal(rule.type, "Rule")
  if (!rule.nodeType) {
    return buildRootType(rule.children)
  }
}

module.exports = {buildType}
