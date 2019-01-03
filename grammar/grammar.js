const assert = require("assert")
const hasOwnProperty = Object.prototype.hasOwnProperty
const meta = require("./meta")

class Grammar {
  constructor() {
    this.rulesByName = new Map()
    this.rules = []
  }

  get(name) {
    return this.rulesByName.get(name)
  }

  add(rule) {
    const name = rule.name
    let ruleSet = this.rulesByName.get(name)
    if (!ruleSet) {
      ruleSet = []
      this.rulesByName.set(name, ruleSet)
    }
    ruleSet.push(rule)
    this.rules.push(rule)
  }
}

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
    return { type: "null" }
  }
  return { type: "root", rootIndex }
}

function buildListType(children) {
  const nodeType = { type: "list" }

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

  return { type: "object", object: name, keys }
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
      return buildObjectType(rule.nodeType.name, rule.children)
  }
}

function resultName(child, modifier) {
  const name = child.type === "name" ? child.name : "%" + child.name
  return { type: "name", name: name + modifier }
}

function expandOptional(child, after) {
  child = buildChild(child)

  const result = resultName(child, "?")
  const ruleName = result.name

  after(grammar => {
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
  })
  return result
}

function expandRepeat(child, baseCase, after) {
  child = buildChild(child)

  const result = resultName(child, baseCase ? "+" : "*")
  result._node = child

  const ruleName = result.name

  after(grammar => {
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
      children: [{ type: "name", name: ruleName }, child],
    })
  })
  return result
}

function expandChild(child, after) {
  switch (child.type) {
    case "OneOrMany":
      return expandRepeat(child.atom, 1, after)
    case "ZeroOrMany":
      return expandRepeat(child.atom, 0, after)
    case "Optional":
      return expandOptional(child.atom, after)
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
        _node: child,
      }
    case "Name":
      return {
        type: "name",
        name: child.name,
        _node: child,
      }
    default:
      assert.fail("Unexpected child type")
  }
}

function stripNodes(grammar) {
  for (let rule of grammar.rules) {
    delete rule._node
    for (let child of rule.children) {
      delete child._node
    }
  }
}

function allChildren(name, singleChildMap, seen) {
  const ruleChildren = singleChildMap.get(name)
  if (!ruleChildren) {
    return seen
  }
  for (let childName of ruleChildren.keys()) {
    if (seen.has(childName)) {
      continue
    }
    seen.set(childName, ruleChildren.get(childName))
    allChildren(childName, singleChildMap, seen)
  }
  return seen
}

function typeCheck(grammar) {
  const singleChildMap = new Map()

  for (let rule of grammar.rules) {
    const children = rule.children
    const firstChild = children[0]

    // Recursion check
    if (children.length === 1 && firstChild.type === "name") {
      if (!singleChildMap.has(rule.name)) {
        singleChildMap.set(rule.name, new Map())
      }
      const nameMap = singleChildMap.get(rule.name)
      if (!nameMap.has(firstChild.name)) {
        nameMap.set(firstChild.name, firstChild._node)
      }
    }
  }

  for (let name of singleChildMap.keys()) {
    let children = allChildren(name, singleChildMap, new Map())
    if (children.has(name)) {
      const node = children.get(name)
      semanticError(node, "Cycle detected")
    }
  }
}

function fromParseTree(rules) {
  const grammar = new Grammar()
  const runAfter = []

  if (!Array.isArray(rules)) {
    assert.fail("Expected array of Nodes")
  }

  for (let rule of rules) {
    if (rule.type !== "Rule") {
      assert.fail("Expected array of Rule Nodes, got " + rule.type)
    }
    const name = rule.name
    const nodeType = buildType(rule)
    const children = []

    for (let child of rule.children) {
      if (child.type === "Key") {
        child = child.match
      }

      const result = expandChild(child, cb => {
        runAfter.push(cb)
      })

      children.push(result)
    }

    const info = {
      name: rule.name,
      ...nodeType,
      children,
      _node: rule,
    }

    grammar.add(info)
  }

  // Now we've added all the rules, add any EBNF expansions
  for (let cb of runAfter) {
    cb(grammar)
  }

  typeCheck(grammar)

  stripNodes(grammar)
  return grammar
}

function newGrammar(source) {
  const parseTree = meta.parse(source)
  const rules = parseTree.rules
  const grammar = fromParseTree(rules)
  return grammar
}

module.exports = {
  newGrammar,
  Grammar,
  fromParseTree,
  _buildType: buildType,
}
