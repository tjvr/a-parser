const test = require("ava")

const nearley = require("nearley")

const meta = require("../grammar/meta")
const grammar = require("../grammar/grammar")
const { Node, newGrammar } = require("../grammar")
const nearleyFromGrammar = require("../nearley")
const compile = newGrammar
const metaLexer = meta.lexer
const metaGrammarSource = meta.grammarSource
const parseTreeFromGrammarSource = meta.parse

let metaGrammar

function parseGrammarWithNearley(t, source) {
  const p = new nearley.Parser(metaGrammar, {
    keepHistory: true,
  })
  try {
    p.feed(source)
  } catch (e) {
    console.log(p.table.map(column => column.states.map(x => x.toString())))
    throw e
  }
  const results = p.finish()
  t.is(results.length, 1)
  return results[0]
}

function parseRuleWithNearley(t, source) {
  const grammar = parseGrammarWithNearley(t, source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  t.is(rule.type, "Rule")
  return rule
}

test.before(t => {
  const grammar = compile(metaGrammarSource)
  metaGrammar = nearleyFromGrammar(grammar)
  metaGrammar.lexer = metaLexer
})

test("empty rule", t => {
  const rule = parseRuleWithNearley(t, `foo -> `)
  t.is(rule.name, "foo")
  t.is(rule.nameType, undefined)
  t.deepEqual(rule.children, [])
})

test("name rule", t => {
  const rule = parseRuleWithNearley(t, `foo -> bar \n`)
  t.is(rule.name, "foo")
  t.is(rule.nameType, undefined)
  t.is(rule.children[0].type, "Name")
  t.is(rule.children[0].name, "bar")
})

test("parse meta-grammar with itself", t => {
  const nearleyTree = parseGrammarWithNearley(t, metaGrammarSource)
  const tree = parseTreeFromGrammarSource(metaGrammarSource)
  t.deepEqual(nearleyTree, tree.withoutRegions())
})
