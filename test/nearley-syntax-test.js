const test = require("ava")

const moo = require("moo")

const meta = require("../grammar/meta")
const grammar = require("../grammar/grammar")
const { Node, newGrammar } = require("../grammar")
const nearleyParser = require("../nearley")
const metaLexer = meta.lexer
const metaGrammarSource = meta.grammarSource
const parseTreeFromGrammarSource = meta.parse

let metaParser

function parseGrammarWithNearley(t, source) {
  metaParser.reset()
  metaLexer.reset(source)
  for (let tok of metaLexer) {
    try {
      metaParser.eat(tok)
    } catch (e) {
      console.log(p.table.map((column) => column.states.map((x) => x.toString())))
      throw e
    }
  }
  return metaParser.result()
}

function parseRuleWithNearley(t, source) {
  const grammar = parseGrammarWithNearley(t, source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  t.is(rule.type, "Rule")
  return rule
}

test.before((t) => {
  const metaGrammar = newGrammar(meta.grammarSource)
  metaParser = nearleyParser(metaGrammar)
})

test("empty rule", (t) => {
  const rule = parseRuleWithNearley(t, `foo -> `)
  t.is(rule.name, "foo")
  t.is(rule.nameType, undefined)
  t.deepEqual(rule.children, [])
})

test("name rule", (t) => {
  const rule = parseRuleWithNearley(t, `foo -> bar \n`)
  t.is(rule.name, "foo")
  t.is(rule.nameType, undefined)
  t.is(rule.children[0].type, "Name")
  t.is(rule.children[0].name, "bar")
})

test("parse meta-grammar with itself", (t) => {
  const nearleyTree = parseGrammarWithNearley(t, metaGrammarSource)
  const tree = parseTreeFromGrammarSource(metaGrammarSource)
  t.deepEqual(nearleyTree, tree.withoutRegions())
})

test("allow EBNF in first rule", (t) => {
  const l = moo.compile({
    " ": " ",
    word: /[a-z]+/,
  })
  const g = newGrammar(`
  program Program -> contents:words?
  words [] -> []:words " " :word
  words [] -> :word
  word -> :"word"
  `)
  const p = nearleyParser(g)
  p.reset()
  l.reset(`foo bar`)
  for (let tok of l) {
    p.eat(tok)
  }
  t.deepEqual(p.result().contents[("foo", "bar")])
})
