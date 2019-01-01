const test = require("ava")

const meta = require("../grammar/meta")
const metaLexer = meta.lexer
const parseGrammar = meta.parse

function metaLex(source) {
  metaLexer.reset(source)
  const tokens = []
  for (let tok of metaLexer) {
    if (tok.type === "space") continue
    tokens.push(tok.type + " " + tok.value)
  }
  return tokens
}

test("lexes rule", t => {
  t.deepEqual(metaLex(`foo [] -> bar:"quxx"\n// hello\n`), [
    "identifier foo",
    "list []",
    "arrow ->",
    "identifier bar",
    ": :",
    "string quxx",
    "newline \n",
    "comment // hello",
    "newline \n",
  ])
})

function parseRule(t, source) {
  const grammar = parseGrammar(source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  t.is(rule.type, "Rule")
  return rule
}

test("allow empty grammar", t => {
  let tree = parseGrammar("\n \n")
  t.is(tree.type, "Grammar")
  t.deepEqual(tree.rules, [])

  tree = parseGrammar("")
  t.is(tree.type, "Grammar")
  t.deepEqual(tree.rules, [])
})

test("parses rule", t => {
  const tree = parseGrammar(`foo [] -> bar:"quxx"`)
  t.snapshot(tree)
  t.is(tree.type, "Grammar")

  const rule = tree.rules[0]
  t.is(rule.type, "Rule")
  t.is(rule.name, "foo")
  t.is(rule.nodeType.type, "List")

  const child = rule.children[0]
  t.is(child.type, "Key")
  t.is(child.key.type, "Name")
  t.is(child.key.name, "bar")
  t.is(child.match.type, "Token")
  t.is(child.match.name, "quxx")
})

test("parses plain name", t => {
  const rule = parseRule(t, `foo -> bar`)
  t.is(rule.children[0].type, "Name")
  t.is(rule.children[0].name, "bar")
})

test("parses plain token", t => {
  const rule = parseRule(t, `foo -> "quxx"`)
  t.is(rule.children[0].type, "Token")
  t.is(rule.children[0].name, "quxx")
})

test("parses key", t => {
  const rule = parseRule(t, `foo -> bar:"quxx"`)
  t.is(rule.children[0].type, "Key")
  t.is(rule.children[0].key.type, "Name")
  t.is(rule.children[0].key.name, "bar")
  t.is(rule.children[0].match.type, "Token")
  t.is(rule.children[0].match.name, "quxx")
})

test("parses name modifier", t => {
  const rule = parseRule(t, `foo -> bar?`)
  t.is(rule.children[0].type, "Optional")
  t.is(rule.children[0].atom.type, "Name")
  t.is(rule.children[0].atom.name, "bar")
})

test("parses token modifier", t => {
  const rule = parseRule(t, `foo -> "quxx"?`)
  t.is(rule.children[0].type, "Optional")
  t.is(rule.children[0].atom.type, "Token")
  t.is(rule.children[0].atom.name, "quxx")
})

test("parses key modifier", t => {
  const rule = parseRule(t, `foo -> bar:"quxx"?`)
  t.is(rule.children[0].type, "Key")
  t.is(rule.children[0].key.type, "Name")
  t.is(rule.children[0].key.name, "bar")
  t.is(rule.children[0].match.type, "Optional")
  t.is(rule.children[0].match.atom.type, "Token")
  t.is(rule.children[0].match.atom.name, "quxx")
})

test("handles EOF", t => {
  parseGrammar(`foo -> bar`)
  parseGrammar(`foo -> "quxx"`)
  parseGrammar(`foo ->`)
  t.throws(() => parseGrammar(`foo -> bar:`), null, "Expected value")
})

test("throws if key is a token", t => {
  t.throws(() => parseGrammar(`r -> "quxx":`), null, "Can't use token as key")
})

test("requires spaces around values", t => {
  t.throws(() => parseGrammar(`r -> foo"bar"`), null, "Expected space at")
  t.throws(() => parseGrammar(`r -> "bar"foo`), null, "Expected space at")
  t.throws(() => parseGrammar(`r -> foo[]`), null, "Expected space at")
})

test("requires no space around colon", t => {
  t.throws(() => parseGrammar(`r -> foo : "bar"`), null, "Expected value")
  t.throws(() => parseGrammar(`r -> foo: "bar"`), null, "Expected value")
})
