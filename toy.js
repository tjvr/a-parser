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

result Program -> lines:program

program [] -> []:program ";"
program [] -> []:program ";" :stmt
program [] -> :stmt
program [] ->

expr IfElse -> "if" _ cond:expr _ "then" _ tval:expr _ "else" _ fval:expr
//expr IfElse -> "if" _ cond:expr _ "then" _ tval:expr
expr Number -> value:"number"
expr Block -> "{" _ statements:statements _ "}"

//statements [] -> []:statements "NL"+ :stmt
statements [] -> []:statements ";" :stmt
statements [] -> []:statements ";"
statements [] -> :stmt
statements [] ->

stmt -> :expr

_ -> _ "NL"
_ ->


`)
const parser = compileNearley(grammar)
console.log("kk")

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
      throw new Error(lexer.formatError(tok, "Parse error"))
    }
  }

  let program
  try {
    program = parser.result()
  } catch (err) {
    //const eof = {text: '', line: lexer.line, col: lexer.col}
    throw new Error(lexer.formatError(lexer.makeEOF(), "Unexpected EOF"))
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
