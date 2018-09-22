
const assert = require('assert')

const hasOwnProperty = Object.prototype.hasOwnProperty

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

function buildObjectType(name, children) {
  const keys = {}

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
    case "Root":
      semanticError(child, "Root child in object rule")
    case "List":
      semanticError(child, "List child in object rule")
    case "Name":
      break // continue
    default:
      assert.fail("Unknown Key type")
    }

    const key = child.key.name

    if (hasOwnProperty.call(keys, key)) {
      semanticError(child.key, "Duplicate name '" + key + "'")
    }
    keys[key] = i
  }

  return {type: "object", object: name, keys}
}

function buildType(rule) {
  assert.equal(rule.type, "Rule")
  const type = rule.nodeType ? rule.nodeType.type : "Default"
  switch (type) {
  case "Default":
    return buildRootType(rule.children)
  case "List":
    return buildListType(rule.children)
  case "Name":
    return buildObjectType(rule.nodeType.value, rule.children)
  }
}

module.exports = {buildType}
