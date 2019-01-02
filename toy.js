const readline = require("readline")

const moo = require("moo")
const nearley = require("nearley")

const lib = require("./grammar")
const compileNearley = require("./nearley")

const lexer = moo.compile({
  NL: { match: "\n", lineBreaks: true },
  $ignore: " ",
  "{": "{",
  "}": "}",
  ";": ";",
  _keyword: {
    match: ["if", "then", "else"],
    type: x => x,
  },
  number: /[0-9]+/,
})

const grammar = lib.newGrammar(`

program Program -> lines:statements

expr IfElse -> "if" _ cond:expr _ "then" _ tval:expr _ "else" _ fval:expr
//expr IfElse -> "if" _ cond:expr _ "then" _ tval:expr
expr Number -> value:"number"
expr Block -> "{" _ statements:statements? _ "}"

//statements [] -> []:statements ";"
statements [] -> []:statements ";" :stmt
statements [] -> :stmt
//statements [] -> 

stmt -> :expr

_ -> _ "NL"
_ ->


`)
const parser = compileNearley(grammar)

function hint() {
  let tokenTypes = parser.expectedTypes()

  const l = lexer.clone()
  tokenTypes = tokenTypes.filter(type => {
    l.reset(type)
    try {
      if (l.next().type === type) {
        return true
      }
    } catch (err) {}
    return false
  })

  if (tokenTypes.length === 1) {
    return "Expected " + tokenTypes[0]
  } else if (tokenTypes.length > 1) {
    return "Expected one of " + tokenTypes.join(", ")
  }
  return ""
}

function parse(source) {
  parser.reset()
  lexer.reset(source)
  //let tok
  //while (tok = lexer.next()) {
  for (let tok of lexer) {
    if (tok.type === "$ignore") {
      continue
    }

    try {
      parser.eat(tok)
    } catch (err) {
      let msg = lexer.formatError(tok, "Parse error") + "\n" + hint()
      throw new Error(msg)
    }
  }

  let program
  try {
    program = parser.result()
  } catch (err) {
    throw new Error(lexer.formatError(lexer.makeEOF(), "Unexpected EOF") + "\n" + hint())
  }
  return program
}

// if if 1 then 2 else 3 then 4 else 5

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
rl.prompt("? ")
rl.on("line", line => {
  let program
  try {
    program = parse(line)
  } catch (err) {
    console.error(err.message)
    rl.prompt("? ")
    return
  }
  for (let line of program.lines) {
    console.log(line + "")
  }
  rl.prompt("? ")
})
