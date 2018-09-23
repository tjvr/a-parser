const test = require("ava")

const nearley = require("nearley")

const { compile } = require("../grammar")
const { nearleyFromGrammar } = require("../nearley")

function nearleyRules(grammar) {
  return nearleyFromGrammar(grammar).rules.map(rule => {
    let source = "" + rule.postprocess
    source = source.replace(/^function[^{]+\{/, "")
    source = source.replace(/\}$/, "")
    return {
      name: rule.name,
      symbols: rule.symbols,
      process: source.trim(),
    }
  })
}

test("null processor", t => {
  const grammar = compile(`foo -> bar "quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    { name: "foo", symbols: ["bar", { type: "quxx" }], process: "return null" },
  ])
})

test("root processor", t => {
  const grammar = compile(`foo -> "(" :bar ")"`)
  t.deepEqual(nearleyRules(grammar), [
    { name: "foo", symbols: [{ type: "(" }, "bar", { type: ")" }], process: "return d[1]" },
  ])
})

test("object processor", t => {
  const grammar = compile(`foo Obj -> one:bar two:"quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return {\ntype: "Obj",\n"one": d[0],\n"two": d[1],\n}`,
    },
  ])
})

test("object with no keys", t => {
  const grammar = compile(`foo Obj -> bar "quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return {\ntype: "Obj",\n}`,
    },
  ])
})

test("list processor", t => {
  const grammar = compile(`statements [] -> []:statements ";" :stmt`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: ["statements", { type: ";" }, "stmt"],
      process: `var list = d[0].slice()\nlist.push(d[2])\nreturn list`,
    },
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
  const grammar = compile(`statements [] -> "~" :stmt`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: [{ type: "~" }, "stmt"],
      process: `return [d[1]]`,
    },
  ])
})
