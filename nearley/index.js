const assert = require("assert")

const nearley = require("nearley")

function nearleyFromGrammar(grammar) {
  const rules = []
  for (let rule of grammar.rules) {
    rules.push(nearleyRule(rule))
  }
  return new nearley.Grammar(rules)
}

function nearleyRule(rule) {
  const symbols = []
  for (let child of rule.children) {
    switch (child.type) {
      case "token":
        symbols.push({ type: child.name })
        break
      case "name":
        symbols.push(child.name)
        break
    }
  }

  const postprocess = nearleyProcess(rule)
  return new nearley.Rule(rule.name, symbols, postprocess)
}

function nearleyProcess(rule) {
  switch (rule.type) {
    case "null":
      return nuller
    case "root":
      return compileRootProcessor(rule.rootIndex, rule.children)
    case "object":
      return compileObjectProcessor(rule.object, rule.keys, rule.children)
    case "list":
      return compileListProcessor(rule.listIndex, rule.rootIndex, rule.children)
  }
}

function childAt(index, children) {
  let source = "d[" + index + "]"
  if (children[index].type === "token") {
    return source + ".value"
  }
  return source
}

// compileRootProcessor returns a function that selects the nth member of its
// array argument
function compileRootProcessor(index, children) {
  return evalProcessor("return " + childAt(index, children))
}

function compileObjectProcessor(type, keyIndexes, children) {
  let source = ""
  source += "return new Node(" + JSON.stringify(type) + ", null, {\n"
  const keyNames = Object.getOwnPropertyNames(keyIndexes)
  for (const key of keyNames) {
    const index = keyIndexes[key]
    source += JSON.stringify(key) + ": " + childAt(index, children) + ",\n"
  }
  source += "})"
  return evalProcessor(source)
}

function compileListProcessor(listIndex, rootIndex, children) {
  if (rootIndex !== undefined && listIndex !== undefined) {
    let source = ""
    source += "var list = " + childAt(listIndex, children) + ".slice()\n"
    source += "list.push(" + childAt(rootIndex, children) + ")\n"
    source += "return list"
    return evalProcessor(source)
  } else if (rootIndex !== undefined) {
    // Wrap the item in a list
    return evalProcessor("return [" + childAt(rootIndex, children) + "]")
  } else if (listIndex !== undefined) {
    // TODO we should probably forbid this in grammar/factory.js
    return compileRootProcessor(listIndex, children)
  } else {
    return evalProcessor("return []")
  }
}

function evalProcessor(source) {
  const { Node } = require("../grammar")

  // NB we might consider caching these functions, to reduce the amount of work
  // that the JIT has to do
  return eval("(function (d) {\n" + source + "\n})") //Function("d", source)
}

function emptyList() {}

function nuller() {
  return null
}

module.exports = { nearleyFromGrammar }
