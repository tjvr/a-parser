const fs = require("fs")
const path = require("path")

suite("json", () => {
  const { lexer, grammar, process } = require("../examples/json")

  const compileNearley = require("../nearley")
  const nearleyParser = compileNearley(grammar)

  const compileLR0 = require("../lr0")
  const lr0Parser = compileLR0(grammar)

  const compileLR0Oneshot = require("../lr0-oneshot")
  const lr0OneshotParser = compileLR0Oneshot(grammar)

  let jsonFile = fs.readFileSync("benchmark/json/sample1k.json", "utf-8")

  benchmark("nearley", () => {
    lexer.reset(jsonFile)
    nearleyParser.reset()
    while ((tok = lexer.next())) {
      if (tok.type === "space") continue
      nearleyParser.eat(tok)
    }
    const tree = nearleyParser.result()
    // process(tree)
  })

  benchmark("lr0", () => {
    lexer.reset(jsonFile)
    lr0Parser.reset()
    while ((tok = lexer.next())) {
      if (tok.type === "space") continue
      lr0Parser.eat(tok)
    }
    const tree = lr0Parser.result()
    // process(tree)
  })

  benchmark("lr0-oneshot", () => {
    lexer.reset(jsonFile)
    const tree = lr0OneshotParser.parse(() => {
      let tok
      while ((tok = lexer.next())) {
        if (tok.type === "space") continue
        return tok
      }
    })
    // process(tree)
  })

  // to show the futility of it all
  benchmark("JSON.parse", () => {
    JSON.parse(jsonFile)
  })
})
