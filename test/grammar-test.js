const test = require("ava")

const meta = require("../grammar/meta")
const grammar = require("../grammar/grammar")
const parseGrammar = meta.parse
const buildType = grammar._buildType
const expandRules = grammar.fromParseTree

function parseRule(t, source) {
  const grammar = parseGrammar(source)
  t.is(grammar.type, "Grammar")
  t.is(grammar.rules.length, 1)
  const rule = grammar.rules[0]
  t.is(rule.type, "Rule")
  return rule
}

function expandOneRule(t, rule) {
  const grammar = expandRules([rule])
  t.is(grammar.rules.length, 1)
  return grammar.rules[0]
}

test("null type", t => {
  const rule = parseRule(t, `foo -> "quxx"`)
  t.deepEqual(buildType(rule), { type: "null" })
})

test("root type", t => {
  const rule = parseRule(t, `foo -> "(" :bar ")"`)
  t.deepEqual(buildType(rule), { type: "root", rootIndex: 1 })
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
  t.deepEqual(buildType(rule), { type: "list" })
})

test("list with root", t => {
  const rule = parseRule(t, `xl [] -> :x`)
  t.deepEqual(buildType(rule), { type: "list", rootIndex: 0 })
})

test("list type", t => {
  const rule = parseRule(t, `xl [] -> []:xl "," :x`)
  t.deepEqual(buildType(rule), { type: "list", listIndex: 0, rootIndex: 2 })
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

test("object type", t => {
  const rule = parseRule(t, `expr Add -> left:expr "+" right:expr`)
  t.deepEqual(buildType(rule), {
    type: "object",
    object: "Add",
    keys: {
      left: 0,
      right: 2,
    },
  })
})

test("warns for duplicate keys", t => {
  const rule = parseRule(t, `foo Obj -> bar:x bar:x`)
  t.throws(t => buildType(rule), /^Duplicate name 'bar'/)
})

test("warns for root children in object rule", t => {
  const rule = parseRule(t, `foo Obj -> :x`)
  t.throws(t => buildType(rule), /^Root child in object rule/)
})

test("warns for list children in object rule", t => {
  const rule = parseRule(t, `foo Obj -> []:x`)
  t.throws(t => buildType(rule), /^List child in object rule/)
})

test("builds null rule", t => {
  const rule = parseRule(t, `foo -> "bar" "quxx"`)
  t.deepEqual(expandOneRule(t, rule), {
    name: "foo",
    type: "null",
    children: [{ type: "token", name: "bar" }, { type: "token", name: "quxx" }],
  })
})

test("builds root rule", t => {
  const rule = parseRule(t, `foo -> "(" :"bar" ")"`)
  t.deepEqual(expandOneRule(t, rule), {
    name: "foo",
    type: "root",
    rootIndex: 1,
    children: [
      { type: "token", name: "(" },
      { type: "token", name: "bar" },
      { type: "token", name: ")" },
    ],
  })
})

test("builds object rule", t => {
  const rule = parseRule(t, `expr Add -> left:expr "+" right:expr`)
  t.deepEqual(expandOneRule(t, rule), {
    name: "expr",
    type: "object",
    object: "Add",
    keys: {
      left: 0,
      right: 2,
    },
    children: [
      { type: "name", name: "expr" },
      { type: "token", name: "+" },
      { type: "name", name: "expr" },
    ],
  })
})

test("builds list rule", t => {
  const rule = parseRule(t, `xl [] -> []:xl "," :"x"`)
  t.deepEqual(expandOneRule(t, rule), {
    name: "xl",
    type: "list",
    rootIndex: 2,
    listIndex: 0,
    children: [
      { type: "name", name: "xl" },
      { type: "token", name: "," },
      { type: "token", name: "x" },
    ],
  })
})

test("optional name", t => {
  const tree = parseGrammar(`foo -> :bar?\nbar -> "b"`)
  const grammar = expandRules(tree.rules)
  t.deepEqual(grammar.rules, [
    {
      name: "foo",
      type: "root",
      rootIndex: 0,
      children: [{ type: "name", name: "bar?" }],
    },
    { name: "bar", type: "null", children: [{ type: "token", name: "b" }] },
    {
      name: "bar?",
      type: "root",
      rootIndex: 0,
      children: [{ type: "name", name: "bar" }],
    },
    {
      name: "bar?",
      type: "null",
      children: [],
    },
  ])
})

test("optional token", t => {
  const rule = parseRule(t, `foo -> :"quxx"?`)
  const grammar = expandRules([rule])
  t.deepEqual(grammar.rules, [
    {
      name: "foo",
      type: "root",
      rootIndex: 0,
      children: [{ type: "name", name: "%quxx?" }],
    },
    {
      name: "%quxx?",
      type: "root",
      rootIndex: 0,
      children: [{ type: "token", name: "quxx" }],
    },
    {
      name: "%quxx?",
      type: "null",
      children: [],
    },
  ])
})

test("generates optionals only once", t => {
  const tree = parseGrammar(`foo -> bar? bar?\nbar -> "b"`)
  const grammar = expandRules(tree.rules)
  t.deepEqual(grammar.rules, [
    {
      name: "foo",
      type: "null",
      children: [{ type: "name", name: "bar?" }, { type: "name", name: "bar?" }],
    },
    { name: "bar", type: "null", children: [{ type: "token", name: "b" }] },
    {
      name: "bar?",
      type: "root",
      rootIndex: 0,
      children: [{ type: "name", name: "bar" }],
    },
    {
      name: "bar?",
      type: "null",
      children: [],
    },
  ])
})

test("one or many name", t => {
  const tree = parseGrammar(`foo -> bar+\nbar -> "b"`)
  const grammar = expandRules(tree.rules)
  t.deepEqual(grammar.rules, [
    {
      name: "foo",
      type: "null",
      children: [{ type: "name", name: "bar+" }],
    },
    {
      name: "bar",
      type: "null",
      children: [{ type: "token", name: "b" }],
    },
    {
      name: "bar+",
      type: "list",
      rootIndex: 0,
      children: [{ type: "name", name: "bar" }],
    },
    {
      name: "bar+",
      type: "list",
      listIndex: 0,
      rootIndex: 1,
      children: [{ type: "name", name: "bar+" }, { type: "name", name: "bar" }],
    },
  ])
})

test("multiple modifiers", t => {
  const tree = parseGrammar(`foo -> bar+\nfoo -> bar?\nbar -> "b"`)
  const grammar = expandRules(tree.rules)
  t.snapshot(grammar.rules)
})

test("detects direct recursion", t => {
  const expectedError = /^Cycle detected/
  t.throws(t => grammar.newGrammar(`foo -> foo`), expectedError)
  t.throws(t => grammar.newGrammar(`foo -> :foo`), expectedError)
  t.throws(t => grammar.newGrammar(`foo Thing -> bar:foo`), expectedError)
  t.throws(t => grammar.newGrammar(`foo [] -> []:foo`), expectedError)
  t.throws(t => grammar.newGrammar(`foo -> foo+`), expectedError)
  t.throws(t => grammar.newGrammar(`foo [] -> []:foo+`), expectedError)
  t.notThrows(t => grammar.newGrammar(`foo -> "foo"`))
})

test("detects indirect recursion", t => {
  t.throws(t => grammar.newGrammar(`A -> B\nB -> A`), /^Cycle detected[^]*B -> A/)
  t.throws(t => grammar.newGrammar(`A -> B\nB -> C\nC -> A`), /^Cycle detected[^]*C -> A/)
  t.notThrows(t => grammar.newGrammar(`A -> B\nB -> "(" A ")"`))
})

test("detects conflicting types", t => {
  t.throws(
    t => grammar.newGrammar(`a Thing ->\na [] ->`),
    /^Rule has type list but another rule has type object/
  )
  t.throws(
    t => grammar.newGrammar(`a [] ->\na Thing ->`),
    /^Rule has type object but another rule has type list/
  )
  t.throws(
    t => grammar.newGrammar(`a [] ->\na -> :b\nb Thing ->`),
    /^Rule has type object but another rule has type list/
  )
  t.throws(
    t => grammar.newGrammar(`a Thing ->\na -> :"foo"`),
    /^Rule has type string but another rule has type object/
  )
  t.throws(
    t => grammar.newGrammar(`a -> :b\na -> :"foo"\nb [] ->`),
    /^Rule has type string but another rule has type list/
  )
})

test("allows EBNF in the first rule", t => {
  const g = grammar.newGrammar(`foo -> "bar"+`)
  t.deepEqual(g.rules.map(rule => rule.name), ["foo", "%bar+", "%bar+"])
})

test("sorts EBNF expansions to end", t => {
  const g = grammar.newGrammar(`foo -> "bar"+\nbar -> "quxx"*`)
  t.deepEqual(g.rules.map(rule => rule.name), ["foo", "bar", "%bar+", "%bar+", "%quxx*", "%quxx*"])
})
