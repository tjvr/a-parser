const assert = require("assert")

const grammar = require("../grammar")
const { Node } = require("../grammar")

class LL1Parser {
  constructor(grammar) {
    this.grammar = grammar
    const rawStates = generateStates(grammar)
    this.states = compileStates(rawStates)
    this.reset()
  }

  reset() {
    this.state = this.states[0]
    this.pastStates = []
    this.stack = []
  }

  eat(tok) {
    const nextState = this.state.eatToken.call(this, tok.type)
    if (nextState === null) {
      throw new Error("Unexpected token '" + tok.type + "'")
    }
    this.pastStates.push(this.state)
    this.stack.push(tok.value)
    this.state = nextState

    while (this.state.reduce) {
      const name = this.state.name
      const value = this.state.reduce.call(this)

      const nextState = this.state.eatName.call(this, name)
      if (nextState === null) {
        throw new Error("Internal error: no state")
      }
      this.pastStates.push(this.state)
      this.stack.push(value)
      this.state = nextState
    }
  }

  result() {
    if (this.state.index !== 1) {
      throw new Error("Unexpected EOF")
    }
    return this.stack[0]
  }

  expectedTypes() {
    return [] // TODO
  }

  allResults() {
    return [this.result()]
  }
}

function formatRule(rule) {
  let s = rule.name
  s += " ->"
  for (let index = 0; index < rule.children.length; index++) {
    const child = rule.children[index]
    switch (child.type) {
      case "name":
        s += " " + child.name
        continue
      case "token":
        s += " " + JSON.stringify(child.name)
        continue
    }
  }
  return s
}

function sanitize(name) {
  return name.replace(/[^A-Za-z0-9_]/, "_")
}

function compileRule(name, rules) {
  let source = ""

  function alt(rules) {
    let nullable = false
    source += "switch (tok.type) {\n"
    for (let rule of rules) {
      const first = rule.children[0]
      if (!first) {
        source += "default:\n"
      } else {
        source += "case " + JSON.stringify(first.name) + ": // " + formatRule(rule) + "\n"
      }
      seq(rule)
      source += "\n"
    }
    source += "}\n"
    source += 'syntaxError("Unexpected \'" + tok.type + "\'")\n'
  }

  function seq(rule) {
    for (let index = 0; index < rule.children.length; index++) {
      const child = rule.children[index]
      switch (child.type) {
        case "token":
          if (index > 0) {
            source += "expect(" + JSON.stringify(child.name) + ")\n"
          }
          source += "var c" + index + " = TOK.value\n"
          source += "TOK = next()\n"
          break
        case "name":
          source += "var c" + index + " = parse_" + sanitize(child.name) + "()\n"
          break
      }
    }
    source += "return ["
    for (let index = 0; index < rule.children.length; index++) {
      if (index > 0) source += ", "
      source += "c" + index
    }
    source += "]\n"
  }

  if (rules.length > 1) {
    alt(rules)
  } else {
    seq(rules[0])
  }

  return "(function parse_" + sanitize(name) + " () {\n" + source + "\n})"
}

function compile(grammar) {
  for (let [name, rules] of grammar.rulesByName) {
    const source = compileRule(name, rules)
    console.log(source)
    console.log()
  }
  return new LL1Parser(grammar)
}

module.exports = compile
