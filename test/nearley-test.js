const fs = require("fs")

const test = require("ava")

const meta = require("../grammar/meta")
const grammar = require("../grammar/grammar")
import nearleyParser from "../nearley"
const compile = grammar.newGrammar
const metaGrammarSource = meta.grammarSource

function stripFunction(func) {
  return ("" + func)
    .replace(/^function[^{]+\{/, "")
    .replace(/\}$/, "")
    .trim()
}

function nearleyGrammarFrom(grammar) {
  return nearleyParser(grammar).nearleyGrammar
}

function nearleyRulesToJSON(rules) {
  return rules.map(rule => {
    return {
      name: rule.name,
      symbols: rule.symbols,
      process: stripFunction(rule.postprocess),
    }
  })
}

function nearleyRulesToString(rules) {
  return rules.map(rule => {
    return rule.toString() //+ "  {% d => { " + stripFunction(rule.postprocess) + "} %}"
  })
}

function nearleyRules(grammar) {
  return nearleyRulesToJSON(nearleyGrammarFrom(grammar).rules)
}

test("null processor", t => {
  const grammar = compile(`foo -> bar "quxx"\nbar -> "b"`)
  t.deepEqual(nearleyRules(grammar), [
    { name: "foo", symbols: ["bar", { type: "quxx" }], process: "return null;" },
    { name: "bar", symbols: [{ type: "b" }], process: "return null;" },
  ])
})

test("root processor", t => {
  const grammar = compile(`foo -> "(" :bar ")"\nbar -> "b"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: [{ type: "(" }, "bar", { type: ")" }],
      process: "return d[1]",
    },
    { name: "bar", symbols: [{ type: "b" }], process: "return null;" },
  ])
})

test("root token", t => {
  const grammar = compile(`foo -> "(" :"quxx" ")"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: [{ type: "(" }, { type: "quxx" }, { type: ")" }],
      process: "return d[1].value",
    },
  ])
})

test("object processor", t => {
  const grammar = compile(`foo Obj -> one:bar two:"quxx"\nbar -> "b"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return new Node("Obj", null, {\n"one": d[0],\n"two": d[1].value,\n})`,
    },
    { name: "bar", symbols: [{ type: "b" }], process: "return null;" },
  ])
})

test("object with no keys", t => {
  const grammar = compile(`foo Obj -> bar "quxx"\nbar -> "b"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return new Node("Obj", null, {\n})`,
    },
    { name: "bar", symbols: [{ type: "b" }], process: "return null;" },
  ])
})

test("list processor", t => {
  const grammar = compile(`statements [] -> []:statements ";" :stmt\nstmt -> "x"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: ["statements", { type: ";" }, "stmt"],
      process: `var list = d[0].slice()\nlist.push(d[2])\nreturn list`,
    },
    { name: "stmt", symbols: [{ type: "x" }], process: "return null;" },
  ])
})

test("empty list", t => {
  const grammar = compile(`statements [] ->`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: [],
      process: `return []`,
    },
  ])
})

test("one-item list", t => {
  const grammar = compile(`statements [] -> "~" :stmt\nstmt -> "x"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: [{ type: "~" }, "stmt"],
      process: `return [d[1]]`,
    },
    { name: "stmt", symbols: [{ type: "x" }], process: "return null;" },
  ])
})

test("compile nullable rule", t => {
  const grammar = compile(`foo ->`)
  const nearleyGrammar = nearleyGrammarFrom(grammar)
  t.deepEqual(nearleyGrammar.rules[0].symbols, [])
})

test("compile meta-grammar", t => {
  const grammar = compile(metaGrammarSource)
  const nearleyGrammar = nearleyGrammarFrom(grammar)
  t.deepEqual(nearleyRulesToString(nearleyGrammar.rules), [
    "grammar → blankLines rules blankLines",

    "blankLines → ",
    "blankLines → blankLines %newline",

    "rules → rules %newline blankLines rule",
    "rules → rule",

    "rule → %identifier nodeType %-> children optionalSpace",

    "optionalSpace → %space",
    "optionalSpace → ",

    "nodeType → %space",
    "nodeType → %space %identifier %space",
    "nodeType → %space %list %space",

    "children → children %space child",
    "children → ",

    "child → symbol",
    "child → key %: symbol",

    "key → ",
    "key → %list",
    "key → %identifier",

    "symbol → match %?",
    "symbol → match %+",
    "symbol → match %*",
    "symbol → match",

    "match → %string",
    "match → %identifier",
  ])
})

test("json", t => {
  const { lexer, grammar, process } = require("../examples/json")

  const parser = nearleyParser(grammar)

  const source = `
  {
    "foo": [1, 2], "bar": {"twenty-four": null},
  "cows": true, "no": false, "cow": "cow\\n\\n"}`

  parser.reset()
  lexer.reset(source)
  let tok
  while ((tok = lexer.next())) {
    if (tok.type === "space") {
      continue
    }
    try {
      parser.eat(tok)
    } catch (err) {
      console.error(lexer.formatError(tok, err.message))
      return
    }
  }

  let tree
  try {
    tree = parser.result()
  } catch (err) {
    console.error(lexer.formatError(lexer.makeEOF(), err.message))
    return
  }
  t.deepEqual(process(tree), JSON.parse(source))
})

test("json benchmark", t => {
  const { lexer, grammar, process } = require("../examples/json")
  const parser = nearleyParser(grammar)

  let jsonFile = fs.readFileSync("benchmark/json/sample1k.json", "utf-8")

  lexer.reset(jsonFile)
  parser.reset()
  let tok
  while ((tok = lexer.next())) {
    if (tok.type === "space") continue
    parser.eat(tok)
  }
  const tree = parser.result()

  t.deepEqual(process(tree), JSON.parse(jsonFile))
})
