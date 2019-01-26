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
    this.pastStates = []
    this.stack = []
  }

  eat(tok) {
    const index = this.state.eatToken.call(this, tok.type)
    if (index === -1) {
      throw new Error("Unexpected token '" + tok.type + "'")
    }
    this.pastStates.push(this.state)
    this.stack.push(tok.value)
    this.state = this.states[index]

    while (this.state.reduce) {
      const name = this.state.name
      const value = this.state.reduce.call(this)

      const index = this.state.eatName.call(this, name)
      if (index === -1) {
        throw new Error("Internal error")
      }

      this.pastStates.push(this.state)
      this.stack.push(value)
      this.state = this.states[index]
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
  // fs.writeFileSync(grammar.start + ".dot", graphviz(states))

  return states
}

function compileTokenSwitch(transitions) {
  let source = ""
  source += "switch (type) {\n"
  for (let [name, t] of transitions) {
    if (name[0] !== "%") continue
    source += "case " + JSON.stringify(name.slice(1)) + ": "
    source += "return " + t.index + "\n"
  }
  source += "default: return -1\n"
  source += "}\n"
  return Function("type", source)
}

function compileNameSwitch(transitions) {
  let source = ""
  source += "switch (name) {\n"
  for (let [name, t] of transitions) {
    if (name[0] === "%") continue
    source += "case " + JSON.stringify(name) + ": "
    source += "return " + t.index + "\n"
  }
  source += "default: return -1\n"
  source += "}\n"
  return Function("name", source)
}

function compileReducer(rule) {
  if (rule._lr0Reducer) {
    return rule._lr0Reducer
  }

  const children = rule.children
  let source = ""

  //source += "if (this.stack.length < " + children.length + ") { "
  //source += "throw new Error('Internal error') "
  //source += "}\n"

  for (let index = children.length; index > 1; index--) {
    source += "this.pastStates.pop()\n"
  }
  source += "this.state = this.pastStates.pop()\n"

  for (let index = children.length - 1; index >= 0; index--) {
    source += "var c" + index + " = this.stack.pop()\n"
  }
  const childAt = index => "c" + index

  switch (rule.type) {
    case "null":
      source += "return null\n"
      break
    case "root":
      source += "return " + childAt(rule.rootIndex) + "\n"
      break
    case "object":
      const keyIndexes = rule.keys
      source += "return new Node(" + JSON.stringify(rule.object) + ", null, {\n"
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
        source += "return list\n"
      } else if (rule.rootIndex !== undefined) {
        // Wrap the item in a list
        source += "return [" + childAt(rule.rootIndex) + "]\n"
      } else if (rule.listIndex !== undefined) {
        source += "return " + childAt(rule.listIndex) + "\n"
      } else {
        source += "return []\n"
      }
      break
    default:
      throw new Error("Unknown rule type " + rule.type)
  }

  const reducer = evalProcessor(source)
  rule._lr0Reducer = reducer
  return reducer
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
    eatToken: compileTokenSwitch(state.transitions),
    eatName: compileNameSwitch(state.transitions),
    reduce: null,
    items: state.items.slice(),
    index: state.index,
  }
}

function evalProcessor(source) {
  // import the Node class into the scope of eval()
  const { Node } = require("../grammar")

  // NB we could cache these functions, to reduce the amount of work that
  // the JIT has to do. Some processors (e.g. the root processor) may
  // occur multiple times
  return eval("(function () {\n" + source + "\n})")
}

function compileStates(states) {
  return states.map(s => compileState(s))
}

function compile(grammar) {
  return new LR0Parser(grammar)
}

module.exports = compile
