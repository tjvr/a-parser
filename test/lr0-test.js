const fs = require("fs")

const test = require("ava")

const grammar = require("../grammar")
const compile = require("../lr0")

test("json", (t) => {
  const { lexer, grammar, process } = require("../examples/json")

  const parser = compile(grammar)

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

test("json benchmark", (t) => {
  const { lexer, grammar, process } = require("../examples/json")
  const parser = compile(grammar)

  let jsonFile = fs.readFileSync("benchmark/json/sample1k.json", "utf-8")

  lexer.reset(jsonFile)
  parser.reset()
  while ((tok = lexer.next())) {
    if (tok.type === "space") continue
    parser.eat(tok)
  }
  const tree = parser.result()

  t.deepEqual(process(tree), JSON.parse(jsonFile))
})

test("brackets", (t) => {
  const { lexer, grammar, process } = require("../examples/brackets")
  const parser = compile(grammar)

  lexer.reset(`( a ; b ; c )`)
  let tok
  while ((tok = lexer.next())) {
    if (tok.type === "space") continue
    parser.eat(tok)
  }
  t.deepEqual(process(parser.result()), [["a", "b"], "c"])
})
