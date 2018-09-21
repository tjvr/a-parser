
const test = require('ava')

const { metaLexer, parseGrammar } = require('../parser/syntax')

function metaLex(source) {
  metaLexer.reset(source)
  const tokens = []
  for (let tok of metaLexer) {
    if (tok.type === "space") continue
    tokens.push(tok.type + " " + tok.value)
  }
  return tokens
}

test('lexes rule', t => {
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

test('parses rule', t => {
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

test('throws if key is a token', t => {
  t.throws(() => parseGrammar(`r -> "quxx":`), /Can't use token as key/)
})

test('requires spaces around values', t => {
  t.throws(() => parseGrammar(`r -> foo"bar"`), null, "Expected space at")
  t.throws(() => parseGrammar(`r -> "bar"foo`), null, "Expected space at")
  t.throws(() => parseGrammar(`r -> foo[]`), null, "Expected space at")
})

test('requires no space around colon', t => {
  t.throws(() => parseGrammar(`r -> foo : "bar"`), null, "Expected value")
  t.throws(() => parseGrammar(`r -> foo: "bar"`), null, "Expected value")
})

