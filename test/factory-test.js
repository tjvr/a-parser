
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
  const rule = parseRule(t, `foo -> :bar "-" :quxx`)
  t.throws(t => buildType(rule), /^Multiple root children/)
})

test("warns for named children in root rule", t => {
  const rule = parseRule(t, `foo -> "(" item:bar ")"`)
  t.throws(t => buildType(rule), /^Named child in rule without node type/)
})

test("warns for list children in root rule", t => {
  const rule = parseRule(t, `foo -> []:bar`)
  t.throws(t => buildType(rule), /^List child in non-list rule/)
})

test("empty list type", t => {
  const rule = parseRule(t, `xl [] ->`)
  t.deepEqual(buildType(rule), {type: "list"})
})

test("list with root", t => {
  const rule = parseRule(t, `xl [] -> :x`)
  t.deepEqual(buildType(rule), {type: "list", rootIndex: 0})
})

test("list type", t => {
  const rule = parseRule(t, `xl [] -> []:xl "," :x`)
  t.deepEqual(buildType(rule), {type: "list", listIndex: 0, rootIndex: 2})
})

test("warns for named children in list rule", t => {
  const rule = parseRule(t, `xl [] -> item:x`)
  t.throws(t => buildType(rule), /^Named child in list rule/)
})

test("warns for multiple list children", t => {
  const rule = parseRule(t, `xl [] -> []:xl []:xl`)
  t.throws(t => buildType(rule), /^Multiple list children/)
})

test("warns for multiple root children in list rule", t => {
  const rule = parseRule(t, `xl [] -> :x :x`)
  t.throws(t => buildType(rule), /^Multiple root children/)
})



