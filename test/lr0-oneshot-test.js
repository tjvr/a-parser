const fs = require("fs")

const test = require("ava")

const grammar = require("../grammar")
const compile = require("../lr0-oneshot")

test("json", t => {
  const { lexer, grammar, process } = require("../examples/json")

  const parser = compile(grammar)

  const source = `
  {
    "foo": [1, 2], "bar": {"twenty-four": null},
  "cows": true, "no": false, "cow": "cow\\n\\n"}`

  lexer.reset(source)

  let tree, tok
  try {
    tree = parser.parse(() => {
      while ((tok = lexer.next())) {
        if (tok.type === "space") {
          continue
        }
        return tok
      }
    })
  } catch (err) {
    t.fail(lexer.formatError(tok, err.message))
  }

  t.deepEqual(process(tree), JSON.parse(source))
})

test("json benchmark", t => {
  const { lexer, grammar, process } = require("../examples/json")
  const parser = compile(grammar)

  let jsonFile = fs.readFileSync("benchmark/json/sample1k.json", "utf-8")

  lexer.reset(jsonFile)

  let tree, tok
  try {
    tree = parser.parse(() => {
      while ((tok = lexer.next())) {
        if (tok.type === "space") {
          continue
        }
        return tok
      }
    })
  } catch (err) {
    t.fail(lexer.formatError(tok, err.message))
  }

  t.deepEqual(process(tree), JSON.parse(jsonFile))
})

test("brackets", t => {
  const { lexer, grammar, process } = require("../examples/brackets")
  const parser = compile(grammar)

  lexer.reset(`( a ; b ; c )`)

  let tree, tok
  try {
    tree = parser.parse(() => {
      while ((tok = lexer.next())) {
        if (tok.type === "space") {
          continue
        }
        return tok
      }
    })
  } catch (err) {
    t.fail(lexer.formatError(tok, err.message))
  }

  t.deepEqual(process(tree), [["a", "b"], "c"])
})
