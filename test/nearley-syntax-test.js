const test = require("ava")

const nearley = require("nearley")

const { Node, compile, metaLexer, metaGrammarSource } = require("../grammar")
const { nearleyFromGrammar } = require("../nearley")

let metaGrammar

function parseGrammar(t, source) {
  const p = new nearley.Parser(metaGrammar)
  p.feed(source)
  const results = p.finish()
  t.is(results.length, 1)
  return results[0]
}

function parseRule(t, source) {
  const grammar = parseGrammar(t, source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  //t.is(rule.type, "Rule")
  return rule
}

test.before(t => {
  const grammar = compile(metaGrammarSource)
  metaGrammar = nearleyFromGrammar(grammar)
  metaGrammar.lexer = metaLexer
})

test("empty rule", t => {
  const rule = parseRule(t, `\nfoo -> `)
  t.is(rule.children.length, 0)
  t.deepEqual(
    rule,
    new Node("Rule", null, {
      name: "foo",
      children: [],
    })
  )
})

test.skip("parse meta-grammar with itself", t => {
  const tree = parseGrammar(t, metaGrammarSource)
  console.log(tree)
})
