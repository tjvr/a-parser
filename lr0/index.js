const assert = require("assert")

const grammar = require("../grammar")
const { Node } = require("../grammar")

class LR0Parser {
  constructor(grammar) {
    this.grammar = grammar
    const rawStates = generateStates(grammar)
    this.states = compileStates(rawStates)
    this.reset()
  }

  reset() {
    this.state = this.states[0]
    this.stack = []
  }

  eat(tok) {
    // Shift the token.
    let state = this.state
    const nextState = state.shift(tok.type)
    if (nextState === null) {
      throw new Error("Unexpected token '" + tok.type + "'")
    }
    this.stack.push({ value: tok.value, state: state })
    state = nextState

    // Apply any reductions.
    while (state.reduce != null) {
      state = state.reduce(this.stack)
      if (nextState === null) {
        // This should be impossible given a well-formed LR0 automaton.
        throw new Error("Internal error: failed to reduce")
      }
    }
    this.state = state
  }

  result() {
    if (this.state.index !== 1) {
      throw new Error("Unexpected EOF")
    }
    return this.stack[0].value
  }

  expectedTypes() {
    return [] // TODO
  }

  allResults() {
    return [this.result()]
  }
}

/*
 * An LR0 item represents a particular point in the parsing of a rule
 */
class LR0 {
  constructor(rule, dot) {
    this.id = ++LR0.highestId
    this.rule = rule
    this.dot = dot
    this.wants = rule.children[dot]
    this.advance = null // set by caller
    this.isAccepting = false
  }

  static get(rule, dot) {
    if (!rule._lr0) {
      rule._lr0 = []
      for (let index = 0; index <= rule.children.length; index++) {
        rule._lr0.push(new LR0(rule, index))
        if (index > 0) {
          rule._lr0[index - 1].advance = rule._lr0[index]
        }
      }
    }
    return rule._lr0[dot]
  }

  toString() {
    let children = this.rule.children.slice()
    children.splice(this.dot, 0, { type: "dot" })
    return (
      this.rule.name +
      " → " +
      children
        .map(child => {
          switch (child.type) {
            case "name":
              return child.name
            case "token":
              return JSON.stringify(child.name)
            case "dot":
              return "•"
            default:
              assert.fail("Unexpected child type " + child.type)
          }
        })
        .join(" ")
    )
  }
}
LR0.highestId = 0

/*
 * A node in the LR0 graph. It has one or more LR0 items.

 * States are indexed in the final pass so that we can refer to them using an
 * integer.
 */
class State {
  constructor(index, items) {
    this.items = items
    this.index = index

    /* A map of token names -> States */
    this.transitions = new Map()

    this.reductions = []
    for (let item of items) {
      if (item.advance === null) {
        this.reductions.push(item)
      }
    }
  }
}

function predict(seedItems, grammar) {
  let items = seedItems.slice()
  const predicted = new Set()
  // nb. grows during iteration
  for (let item of items) {
    if (item.advance === null) {
      continue
    }

    if (item.wants.type !== "name") {
      continue
    }
    const name = item.wants.name

    if (predicted.has(name)) {
      continue
    }
    predicted.add(name)

    for (let rule of grammar.get(name)) {
      items.push(LR0.get(rule, 0))
    }
  }
  return items
}

function transitions(items) {
  let wants = new Map()
  for (let item of items) {
    if (item.advance === null) {
      continue
    }

    const key = childKey(item.wants)
    if (!wants.has(key)) {
      wants.set(key, [])
    }
    wants.get(key).push(item.advance)
  }
  return wants
}

function childKey(child) {
  switch (child.type) {
    case "name":
      if (child.name[0] === "%") {
        assert.fail("Name may not start with %: " + child.name)
      }
      return child.name
    case "token":
      return "%" + child.name
    default:
      assert.fail("Unknown child type " + child.type)
  }
}

function seedKey(seedItems) {
  return seedItems.map(item => item.id).join(":")
}

function dotStr(x) {
  x = x.toString()
  if (/^[0-9]+$/.test(x)) return x
  if (/^[a-zA-Zε]+$/.test(x)) return x
  x = x.replace(/"/g, '\\"')
  x = x.replace(/\n/g, "\\l") + "\\l"
  return '"' + x + '"'
}

function graphviz(states) {
  const lines = []
  lines.push("digraph G {")
  lines.push("rankdir=LR;")
  lines.push('node [fontname="Helvetica"];')
  lines.push('edge [fontname="Times"];')
  lines.push("")
  for (let s of states) {
    const label = []
    label.push(s.index)
    for (let item of s.items) {
      label.push(item.toString())
    }
    lines.push(`${s.index} [shape=box align=left label=${dotStr(label.join("\n"))}];`)

    for (let [token, t] of s.transitions) {
      if (token[0] === "%") {
        token = `\\"${token.slice(1)}\\"`
      }
      lines.push(`${s.index} -> ${t.index} [label="${token}"];`)
    }
    lines.push("")
  }
  lines.push("}")
  return lines.join("\n")
}

/*
 * Each state is generated in three steps:
 *
 *   - start with a "seed" or "kernel" of LR0 items.
 *   - add any LR0 items which expect a non-terminal.
 *   - create a transition to a new state for each token or non-terminal that
 *     each item expects.
 *
 * States with the same seed are collapsed into one, since they are identical.
 */
function generateStates(grammar) {
  const acceptRule = {
    accept: true,
    name: "$",
    children: [{ type: "name", name: grammar.start }],
    type: "root",
    rootIndex: 0,
  }
  const startItem = LR0.get(acceptRule, 0)
  const endItem = LR0.get(acceptRule, 1)

  const startState = new State(0, predict([startItem], grammar))
  const states = [startState]

  const statesBySeed = new Map()

  // nb. grows during iteration
  for (let state of states) {
    const wants = transitions(state.items)

    for (let [key, seedItems] of wants) {
      const seed = seedKey(seedItems)
      if (statesBySeed.has(seed)) {
        const t = statesBySeed.get(seed)
        state.transitions.set(key, t)
        continue
      }

      const items = predict(seedItems, grammar)

      const index = states.length
      const t = new State(index, items)
      states.push(t)
      statesBySeed.set(seed, t)

      state.transitions.set(key, t)
    }
  }

  // acceptingState will usually have index 1, but this depends on Map
  // iteration order so it's not guaranteed.
  const acceptingState = startState.transitions.get(grammar.start)
  states[1].index = acceptingState.index
  acceptingState.index = 1

  for (let state of states) {
    if (state.index === 1) {
      continue
    }

    if (state.reductions.length > 0) {
      if (state.reductions.length > 1) {
        throw new Error("reduce/reduce conflict")
      }
      state.reduction = state.reductions[0].rule
    }

    // TODO
    // if (state.reductions.length > 0 && state.transitions.length > 0) {
    //   throw new Error("shift/reduce conflict")
    // }
  }

  // const fs = require("fs")
  // fs.writeFileSync("foo.dot", graphviz(states))

  return states
}

function compileTokenSwitch(transitions) {
  let source = ""
  source += "switch (type) {\n"
  for (let [name, t] of transitions) {
    if (name[0] !== "%") continue
    source += "case " + JSON.stringify(name.slice(1)) + ": "
    source += "return s" + t.index + "\n"
  }
  source += "default: return null\n"
  source += "}\n"
  return source
}

function compileNameSwitch(transitions) {
  let source = ""
  source += "switch (name) {\n"
  for (let [name, t] of transitions) {
    if (name[0] === "%") continue
    source += "case " + JSON.stringify(name) + ": "
    source += "return s" + t.index + "\n"
  }
  source += "default: return null\n"
  source += "}\n"
  return source
}

function compileReducer(rule) {
  const children = rule.children
  let source = ""

  // We deliberately skip bounds checks here. The `pop()` will fail if there
  // are less than `children.length` items on the stack.
  for (let index = children.length - 1; index >= 0; index--) {
    source += "var c" + index + " = stack.pop()\n"
  }
  const childAt = index => `c${index}.value`

  switch (rule.type) {
    case "null":
      source += "var result = null\n"
      break
    case "root":
      source += "var result = " + childAt(rule.rootIndex) + "\n"
      break
    case "object":
      const keyIndexes = rule.keys
      source += "var result = new Node(" + JSON.stringify(rule.object) + ", null, {\n"
      const keyNames = Object.getOwnPropertyNames(keyIndexes)
      for (const key of keyNames) {
        const index = keyIndexes[key]
        source += JSON.stringify(key) + ": " + childAt(index) + ",\n"
      }
      source += "})\n"
      break
    case "list":
      if (rule.rootIndex !== undefined && rule.listIndex !== undefined) {
        source += "var list = " + childAt(rule.listIndex) + "\n"
        source += "list.push(" + childAt(rule.rootIndex) + ")\n"
        source += "var result = list\n"
      } else if (rule.rootIndex !== undefined) {
        // Wrap the item in a list
        source += "var result = [" + childAt(rule.rootIndex) + "]\n"
      } else if (rule.listIndex !== undefined) {
        source += "var result = " + childAt(rule.listIndex) + "\n"
      } else {
        source += "var result = []\n"
      }
      break
    default:
      throw new Error("Unknown rule type " + rule.type)
  }
  // We've popped N items off the stack, to arrive at `previousState`.
  // We've reduced `rule`.
  // We now push that non-terminal onto `previousState`.
  source += `var previousState = c0.state\n`
  source += `stack.push({ value: result, state: previousState })\n`
  source += `return previousState.eatName(${JSON.stringify(rule.name)})\n`
  return source
}

function compileState(state) {
  if (state.reduction) {
    const rule = state.reduction
    return {
      eat: null,
      name: rule.name,
      reduce: compileReducer(rule),
      items: state.items.slice(),
      index: state.index,
    }
  }

  return {
    shift: compileTokenSwitch(state.transitions),
    eatName: compileNameSwitch(state.transitions),
    reduce: null,
    items: state.items.slice(),
    index: state.index,
  }
}

function compileStates(states) {
  let source = ""

  for (let state of states) {
    source += "var s" + state.index + " = {\n"
    source += "index: " + state.index + ",\n"
    if (state.reduction) {
      const rule = state.reduction
      source += "name: " + JSON.stringify(rule.name) + ",\n"
      source += "reduce: function(stack) {\n" + compileReducer(rule) + "},\n"
    } else {
      source += "shift: function(type) {\n" + compileTokenSwitch(state.transitions) + "},\n"
      source += "eatName: function(name) {\n" + compileNameSwitch(state.transitions) + "},\n"
    }
    source += "}\n"
    source += "\n"
  }

  source += "return[\n"
  for (let state of states) {
    source += "s" + state.index + ",\n"
  }
  source += "]\n"

  // const fs = require("fs")
  // fs.writeFileSync("/tmp/_compiled.js", source)

  return evalWithNode(source)
}

function evalWithNode(source) {
  // import the Node class into the scope of eval()
  const { Node } = require("../grammar")

  // IIFE
  return eval("(function() {\n" + source + "\n}())")
}

function compile(grammar) {
  return new LR0Parser(grammar)
}

module.exports = compile
