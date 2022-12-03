import assert from "assert"

import * as meta from "./meta"

const hasOwnProperty = Object.prototype.hasOwnProperty

export class Grammar {
  private rulesByName: Map<string, any>
  private rules: any[]

  constructor() {
    this.rulesByName = new Map()
    this.rules = []
  }

  get start() {
    return this.rules[0].name
  }

  get(name) {
    return this.rulesByName.get(name) || []
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

  format() {
    const ruleGroups = []
    let group
    let lastName
    for (let rule of this.rules) {
      if (rule.name !== lastName) {
        group = []
        ruleGroups.push(group)
        lastName = rule.name
      }
      group.push(rule)
    }

    let s = ""
    for (let group of ruleGroups) {
      if (s.length) {
        s += "\n"
      }

      let arrowCol = 0
      for (let rule of group) {
        arrowCol = Math.max(arrowCol, formatRulePrefix(rule).length)
      }

      for (let rule of group) {
        s += formatRule(rule, arrowCol) + "\n"
      }
    }
    return s
  }
}

function formatRulePrefix(rule) {
  switch (rule.type) {
    case "object":
      return rule.name + " " + rule.object
    case "list":
      return rule.name + " []"
    case "root":
    case "null":
      return rule.name
    default:
      assert.fail("Unexpected rule type " + rule.type)
  }
}

function formatRule(rule, arrowCol) {
  let s = formatRulePrefix(rule)
  while (s.length < arrowCol) {
    s += " "
  }
  s += " ->"
  for (let index = 0; index < rule.children.length; index++) {
    const child = rule.children[index]
    s += " " + formatChildPrefix(child, index, rule) + formatAtom(child)
  }
  return s
}

function formatChildPrefix(child, childIndex, rule) {
  switch (rule.type) {
    case "object":
      for (let key of Object.keys(rule.keys)) {
        const keyIndex = rule.keys[key]
        if (keyIndex === childIndex) {
          return key + ":"
        }
      }
      return ""
    case "list":
      if (rule.listIndex === childIndex) {
        return "[]:"
      } else if (rule.rootIndex === childIndex) {
        return ":"
      }
      return ""
    case "root":
      if (rule.rootIndex === childIndex) {
        return ":"
      }
      return ""
    case "null":
      return ""
    default:
      assert.fail("Unexpected rule type " + rule.type)
  }
}

function formatAtom(child) {
  switch (child.type) {
    case "name":
      return child.name
    case "token":
      return JSON.stringify(child.name)
    default:
      assert.fail("Unexpected child type " + child.type)
  }
}

function semanticError(node, message, extra?: string): never {
  throw new Error(node.formatError(message) + (extra ? "\n" + extra : "") + "\n")
}

function formatRuleNode(rule) {
  let s = ""
  s += rule.name
  if (rule.nodeType && rule.nodeType.type === "Name") {
    s += " " + rule.nodeType.name
  } else if (rule.nodeType && rule.nodeType.type === "List") {
    s += " []"
  }
  s += " ->"
  for (let child of rule.children) {
    s += " " + formatChildNode(child)
  }
  return s
}

function formatChildNode(child) {
  let s = ""
  switch (child.type) {
    case "ZeroOrMany":
      return formatChildNode(child.atom) + "*"
    case "OneOrMany":
      return formatChildNode(child.atom) + "+"
    case "Optional":
      return formatChildNode(child.atom) + "?"
    case "Key":
      switch (child.key.type) {
        case "Root":
          return ":" + formatChildNode(child.match)
        case "List":
          return "[]:" + formatChildNode(child.match)
        case "Name":
          return child.key.name + ":" + formatChildNode(child.match)
        default:
          assert.fail("Unknown Key type")
      }
    case "Token":
      return JSON.stringify(child.name)
    case "Name":
      return child.name
    default:
      assert.fail("Unexpected child type " + child.type)
  }
}

function buildRootType(rule) {
  const children = rule.children

  let rootIndex = -1

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
      case "List":
        rule.nodeType = { type: "List" }
        semanticError(
          child,
          "List child in non-list rule",
          "Hint: add the list marker to the rule:\n\n  " + formatRuleNode(rule),
        )
      case "Root":
        break // continue
      default:
        rule.nodeType = { type: "Name", name: "[Object]" }
        semanticError(
          child.key,
          "Named child in rule without node type",
          "Hint: add an object name to the rule:\n\n  " + formatRuleNode(rule),
        )
    }

    if (rootIndex !== -1) {
      rule.nodeType = { type: "Name", name: "[Object]" }
      children[rootIndex].key = { type: "Name", name: "[foo]" }
      child.key = { type: "Name", name: "[bar]" }
      semanticError(
        child,
        "More than one root child",
        "Hint: make this an object rule:\n\n  " + formatRuleNode(rule),
      )
    }
    rootIndex = i
  }

  if (rootIndex === -1) {
    return { type: "null" }
  }
  return { type: "root", rootIndex }
}

function buildListType(rule) {
  const children = rule.children

  const nodeType: any = { type: "list" }

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
      case "Root":
        if (nodeType.rootIndex !== undefined) {
          if (nodeType.listIndex === undefined) {
            child.key = { type: "List" }
            semanticError(
              child,
              "More than one root child",
              "Hint: make this the list child?\n\n  " + formatRuleNode(rule),
            )
          }
          children[i] = child.match
          semanticError(
            child,
            "More than one root child",
            "Hint: list rules have up to one list child and one root child.\n\n  " +
              formatRuleNode(rule),
          )
        }
        nodeType.rootIndex = i
        break

      case "List":
        if (nodeType.listIndex !== undefined) {
          if (nodeType.rootIndex === undefined) {
            child.key = { type: "Root" }
            semanticError(
              child,
              "More than one list child",
              "Hint: make this the root child?\n\n  " + formatRuleNode(rule),
            )
          }
          children[i] = child.match
          semanticError(
            child,
            "More than one list child",
            "Hint: list rules have up to one list child and one root child.\n\n  " +
              formatRuleNode(rule),
          )
        }
        nodeType.listIndex = i
        break

      default:
        child.key = { type: "List" }
        semanticError(
          child,
          "Named child in list rule",
          "Hint: make this the list child?\n\n  " + formatRuleNode(rule),
        )
    }
  }

  return nodeType
}

function buildObjectType(rule) {
  const name = rule.nodeType.name
  const children = rule.children
  const keys = {}

  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== "Key") {
      continue
    }

    switch (child.key.type) {
      case "Root":
        child.key = { type: "Name", name: "[name]" }
        semanticError(
          child,
          "Root child in object rule",
          "Hint: add an attribute name to the child:\n\n  " + formatRuleNode(rule),
        )
      case "List":
        rule.nodeType = { type: "List" }
        semanticError(
          child,
          "List child in object rule",
          "Hint: list children are only allowed in list rules:\n\n  " + formatRuleNode(rule),
        )
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

export function buildType(rule) {
  assert.equal(rule.type, "Rule")
  const type = rule.nodeType ? rule.nodeType.type : "Default"
  switch (type) {
    case "Default":
      return buildRootType(rule)
    case "List":
      return buildListType(rule)
    case "Name":
      return buildObjectType(rule)
  }
}

function resultName(child, modifier): any {
  const name = child.type === "name" ? child.name : "%" + child.name
  return { type: "name", name: name + modifier }
}

function expandOptional(childNode, after) {
  const child = buildChild(childNode.atom)

  const result = resultName(child, "?")
  result._node = childNode

  const ruleName = result.name

  after(grammar => {
    if (grammar.get(ruleName).length > 0) {
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

function expandRepeat(childNode, baseCase, after) {
  const child = buildChild(childNode.atom)

  const result = resultName(child, baseCase ? "+" : "*")
  result._node = childNode

  const ruleName = result.name

  after(grammar => {
    if (grammar.get(ruleName).length > 0) {
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
      return expandRepeat(child, 1, after)
    case "ZeroOrMany":
      return expandRepeat(child, 0, after)
    case "Optional":
      return expandOptional(child, after)
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
    delete rule._typeNode
    for (let child of rule.children) {
      delete child._node
    }
  }
}

function allChildren(singleChildMap, seen, name) {
  const ruleChildren = singleChildMap.get(name)
  if (!ruleChildren) {
    return seen
  }
  for (let childName of ruleChildren.keys()) {
    if (seen.has(childName)) {
      continue
    }
    seen.set(childName, ruleChildren.get(childName))
    allChildren(singleChildMap, seen, childName)
  }
  return seen
}

function nameType(typeMap, grammar, name) {
  if (typeMap.has(name)) {
    return typeMap.get(name)
  }

  const ruleSet = grammar.get(name)
  if (ruleSet.length === 0) {
    return "any"
  }

  let bestType = null
  for (let rule of ruleSet) {
    const type = ruleType(typeMap, grammar, rule)
    if (type === "any") {
      if (bestType === null) {
        bestType = "any"
      }
    } else if (type === "null") {
      bestType = "null"
    } else {
      bestType = type
      break
    }
  }
  typeMap.set(name, bestType)
  return bestType
}

function ruleType(typeMap, grammar, rule) {
  switch (rule.type) {
    case "null":
      return "null"
    case "root":
      const child = rule.children[rule.rootIndex]
      switch (child.type) {
        case "token":
          return "string"
        case "name":
          // Avoid infinite recursion!
          if (rule.name === child.name) {
            return "any"
          }
          return nameType(typeMap, grammar, child.name)
        default:
          assert.fail("Unexpected child type")
      }
    case "object":
      return "object"
    case "list":
      return "list"
    default:
      assert.fail("Unexpected rule type " + rule.type)
  }
}

function typeCheck(grammar) {
  const singleChildMap = new Map()

  for (let rule of grammar.rules) {
    const children = rule.children
    const firstChild = children[0]

    // Build recursion map
    if (children.length === 1 && firstChild.type === "name") {
      if (!singleChildMap.has(rule.name)) {
        singleChildMap.set(rule.name, new Map())
      }
      const nameMap = singleChildMap.get(rule.name)
      if (!nameMap.has(firstChild.name)) {
        nameMap.set(firstChild.name, firstChild._node)
      }
    }

    // Check names are defined
    for (let child of children) {
      if (child.type !== "name") {
        continue
      }
      const matchingRules = grammar.get(child.name)
      if (matchingRules.length === 0) {
        semanticError(
          child._node,
          "Unknown name '" + child.name + "'",
          "Hint: add a rule like:\n\n  " + child.name + " -> ...\n",
        )
      }
    }
  }

  // Check recursion map for cycles
  for (let name of singleChildMap.keys()) {
    let children = allChildren(singleChildMap, new Map(), name)
    if (children.has(name)) {
      const node = children.get(name)
      semanticError(node, "Cycle detected")
    }
  }

  // Build type map
  const typeMap = new Map()
  for (let name of grammar.rulesByName.keys()) {
    nameType(typeMap, grammar, name)
  }

  // Check list and non-list types are not mixed
  for (let [name, ruleSet] of grammar.rulesByName) {
    const expected = typeMap.get(name)

    for (let rule of ruleSet) {
      const actual = ruleType(typeMap, grammar, rule)
      if (actual === "any" || actual === "null") {
        continue
      }

      if (actual === expected) {
        continue
      }

      const node = rule._typeNode || rule._node
      semanticError(node, "Rule has type " + actual + " but another rule has type " + expected)
    }
  }
}

export function fromParseTree(rules) {
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
      _typeNode: rule.nodeType,
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

export function newGrammar(source) {
  const parseTree: any = meta.parse(source)
  const rules = parseTree.rules
  const grammar = fromParseTree(rules)
  return grammar
}
