
const test = require('ava')

const { parseGrammar } = require('../parser/syntax')
const { buildType } = require('../parser/factory')

function parseRule(t, source) {
  const grammar = parseGrammar(source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  t.is(rule.type, "Rule")
  return rule
}

test("null type", t => {
  const rule = parseRule(t, `foo -> "quxx"`)
  t.deepEqual(buildType(rule), {type: "null"})
})

test("root type", t => {
  const rule = parseRule(t, `foo -> "(" :bar ")"`)
  t.deepEqual(buildType(rule), {type: "root", index: 1})
})

test("warns for multiple root children", t => {
  const rule = parseRule(t, `foo -> "(" :bar ")" :quxx`)
  t.throws(t => buildType(rule), null, "Multiple root children")
})

test("warns for named children", t => {
  const rule = parseRule(t, `foo -> "(" item:bar ")"`)
  t.throws(t => buildType(rule), null, "Multiple root children")
})

