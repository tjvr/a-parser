
const assert = require('assert')
const hasOwnProperty = Object.prototype.hasOwnProperty

const {Grammar} = require('./grammar')

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
  return {type: "root", rootIndex}
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

function expandOptional(child, grammar) {
  child = buildChild(child)

  let ruleName = child.name + "?"
  if (child.type === "token") {
    ruleName = "%" + ruleName
  } else {
    assert.equal(child.type, "name")
  }
  const result = {type: "name", name: ruleName}

  if (grammar.get(ruleName)) {
    return result
  }

  grammar.add({
    name: ruleName,
    type: "root",
    rootIndex: 0,
    children: [child],
  })
  grammar.add({
    name: ruleName,
    type: "null",
    children: [],
  })
  return result
}

function expandRepeat(child, baseCase, grammar) {
  child = buildChild(child)

  let ruleName = child.name + (baseCase ? "+" : "*")
  if (child.type === "token") {
    ruleName = "%" + ruleName
  } else {
    assert.equal(child.type, "name")
  }
  const result = {type: "name", name: ruleName}

  if (grammar.get(ruleName)) {
    return result
  }

  grammar.add({
    name: ruleName,
    type: "list",
    rootIndex: baseCase ? 0 : undefined,
    children: baseCase ? [child] : [],
  })
  grammar.add({
    name: ruleName,
    type: "list",
    listIndex: 0,
    rootIndex: 1,
    children: [
      {type: "name", name: ruleName},
      child,
    ],
  })
  return result
}


function expandChild(child, grammar) {
  switch (child.type) {
  case "OneOrMany":
    return expandRepeat(child.atom, 1, grammar)
  case "ZeroOrMany":
    return expandRepeat(child.atom, 0, grammar)
  case "Optional":
    return expandOptional(child.atom, grammar)
  default:
    return buildChild(child)
  }
}

function buildChild(child) {
  switch (child.type) {
  case "Token":
    return {
      type: "token",
      name: child.name,
    }
  case "Name":
    return {
      type: "name",
      name: child.name,
    }
  default:
    assert.fail("Unexpected child type")
  }
}

function expandRules(rules) {
  const grammar = new Grammar()

  for (let rule of rules) {
    const name = rule.name
    const nodeType = buildType(rule)
    const children = []

    for (let child of rule.children) {
      if (child.type === "Key") {
        child = child.match
      }

      child = expandChild(child, grammar)

      children.push(child)
    }

    const info = {
      name: rule.name,
      ...nodeType,
      children,
    }

    grammar.add(info)
  }

  return grammar
}

module.exports = {buildType, expandRules}
