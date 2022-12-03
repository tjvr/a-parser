import * as fs from "fs"

import { lexer, grammar, process } from "../examples/json"
import compileNearley from "../nearley"
import compileLR0 from "../lr0"
import compileLR0Oneshot from "../lr0-oneshot"

// @ts-ignore `suite` is defined by the benchr runner.
suite("json", () => {

  const nearleyParser = compileNearley(grammar)
  const lr0Parser = compileLR0(grammar)
  const lr0OneshotParser = compileLR0Oneshot(grammar)

  let jsonFile = fs.readFileSync("benchmark/json/sample1k.json", "utf-8")

  // @ts-ignore `benchmark` is defined by the benchr runner.
  benchmark("nearley", () => {
    lexer.reset(jsonFile)
    nearleyParser.reset()
    let tok
    while ((tok = lexer.next())) {
      if (tok.type === "space") continue
      nearleyParser.eat(tok)
    }
    const tree = nearleyParser.result()
    // process(tree)
  })

  // @ts-ignore `benchmark` is defined by the benchr runner.
  benchmark("lr0", () => {
    lexer.reset(jsonFile)
    lr0Parser.reset()
    let tok
    while ((tok = lexer.next())) {
      if (tok.type === "space") continue
      lr0Parser.eat(tok)
    }
    const tree = lr0Parser.result()
    // process(tree)
  })

  // @ts-ignore `benchmark` is defined by the benchr runner.
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
  // benchmark("JSON.parse", () => {
  //   JSON.parse(jsonFile)
  // })
})
