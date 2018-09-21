
function stringify(value, indent) {
  if (value && value.stringify) {
    return value.stringify(indent)
  }

  if (!Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (value.length === 0) {
    return "[]"
  }

  const nextIndent = indent + "  "
  let s = "[\n"
  for (let item of value) {
    s += nextIndent + stringify(item, nextIndent) + ",\n"
  }
  return s + indent + "]"
}

class Node {
  constructor(type, region, attrs) {
    if (attrs.type) {
      throw new Error("Cannot set 'type' property on a Node")
    }
    this.type = type // String
    this.region = region // Region
    Object.assign(this, attrs)
  }

  toString() {
    return this.stringify()
  }

  stringify(indent) {
    indent = indent || ""
    const nextIndent = indent + "  "

    //let s = "{\n"
    //s += nextIndent + "type: " + JSON.stringify(this.type) + ",\n"
    //let s = this.type + " {\n"
    let s = "{ type: " + JSON.stringify(this.type)
    //s += nextIndent + "_text: " + JSON.stringify(this.region.text) + ",\n"

    const keys = Object.getOwnPropertyNames(this)

    let hadKeys = false
    for (let key of keys) {
      const value = this[key]
      if (key === "type" || key === "region") continue
      s += ",\n" + nextIndent + key + ": "
      s += stringify(value, nextIndent)
      hadKeys = true
    }

    if (!hadKeys) {
      return s + " }"
    }
    return s + ",\n" + indent + "}"
  }
}

class Region {
  constructor(start, end, buffer) {
    this.start = start // Pos
    this.end = end // Pos
    this.buffer = buffer // String
  }

  from(token, buffer) {
    return new Region(Pos.before(token), Pos.after(token), buffer)
  }

  get text() {
    return this.buffer.slice(this.start.offset, this.end.offset)
  }
}

class Pos {
  constructor(line, col, offset) {
    this.line = line|0 // 1-based
    this.col = col|0 // 1-based
    this.offset = offset|0
  }

  static before(token) {
    return new Pos(token.line, token.col, token.offset)
  }

  static after(token) {
    const line = token.line + token.lineBreaks
    const offset = token.offset + token.size
    if (token.lineBreaks === 0) {
      return new Pos(line, token.col, offset)
    }
    const nl = token.text.lastIndexOf("\n")
    const col = token.size - nl + 1
    return new Pos(line, col, offset)
  }
}


const moo = require('../moo/moo')

const lexer = moo.compile({
  newline: {match: '\n', lineBreaks: true},
  _op: {match: [":", "?", "*", "+", "(", ")"], type: x => x},
  arrow: '->',
  list: "[]",
  string: {match: /"(?:\\["\\]|[^\n"\\])*"/, value: s => s.slice(1, -1)},
  space: /[ \t\f\r]+/,
  identifier: /[A-Za-z][A-Za-z0-9_-]*/,
  comment: /\/\/.*$/,
  error: moo.error,
})

const metaGrammar = `

grammar -> "newline"* rules:rules "newline"*

rules [] -> []:rules "newline"+ :rule
rules [] ->

rule -> name:"identifier" type:idenOrList? "->" children:symbols

symbols [] -> []:symbols "space" :symbol
symbols [] ->

symbol Optional   -> atom:Atom "?"
symbol OneOrMany  -> atom:Atom "+"
symbol ZeroOrMany -> atom:Atom "*"

atom     ->             match:idenOrToken
atom Key -> key:key ":" match:idenOrToken

key Root ->
key List -> "list"
key Name -> name:"identifier"

idenOrList Name -> name:"identifier"
idenOrList List -> "list"

`

function parse(buffer) {
  lexer.reset(buffer)

  var tok
  function next() {
    do {
      tok = lexer.next()
    } while (tok && (tok.type === "comment"))
  }
  next()

  function syntaxError(message) {
    if (tok.type === "error") {
      message = "Invalid syntax"
    }
    throw new Error(lexer.formatError(tok, message))
  }

  function expect(expectedType, message) {
    if (tok.type === expectedType) {
      const found = tok
      next()
      return found
    }

    if (!message) {
      message = "Expected " + expectedType + " (found " + tok.type + ")"
    }
    syntaxError(message)
  }

  function node(type, start, attrs) {
    const end = Pos.before(tok)
    const region = new Region(start, end, buffer)
    return new Node(type, region, attrs)
  }

  function parseBlankLines() {
    while (tok && (tok.type === "space" || tok.type === "newline")) {
      next()
    }
  }

  function parseValue() {
    const start = Pos.before(tok)
    const name = tok.value

    switch (tok.type) {
    case "identifier":
      next()
      return node("Name", start, {name})
    case "string":
      next()
      return node("Token", start, {name})
    default:
      syntaxError("Expected value (found " + tok.type + ")")
    }
  }

  function parseSimpleToken() {
    const start = Pos.before(tok)
    const value = expect("string").value
    return node("Token", start, {value})
  }

  function parseKey(start, key) {
    expect(":")
    const match = parseValue()
    return node("Key", start, {key, match})
  }

  function parseIdentifierAtom() {
    const start = Pos.before(tok)
    const value = expect("identifier").value

    if (tok.type !== ":") {
      return node("Name", start, {value})
    }
    const key = node("Name", start, {name: value})
    return parseKey(start, key)
  }

  function parseAtom() {
    const start = Pos.before(tok)
    switch (tok.type) {
    case "(":
      return parseParens()
    case "string":
      return parseSimpleToken()
    case ":":
      return parseKey(start, node("Root", null, {}))
    case "list":
      next()
      return parseKey(start, node("List", null, {}))
    case "identifier":
      return parseIdentifierAtom()
    default:
      syntaxError("Expected value (found '" + tok.type + "')")
    }
  }

  function parseSymbol() {
    const start = Pos.before(tok)
    const atom = parseAtom()
    let type
    switch (tok.type) {
    case "+":
      type = "OneOrMany"
      break
    case "*":
      type = "ZeroOrMany"
      break
    case "?":
      type = "Optional"
      break
    default:
      return atom
    }
    next()
    return node(type, start, {atom})
  }

  function parseNodeType() {
    const start = Pos.before(tok)
    const value = tok.value
    switch (tok.type) {
    case "identifier":
      next()
      return node("Name", start, {value})
    case "list":
      next()
      return node("List", start, {value})
    default:
      syntaxError("Expected node type (found " + tok.type + ")")
    }
  }

  function parseRule() {
    const start = Pos.before(tok)
    const attrs = {}
    attrs.name = expect("identifier").value
    expect("space")
    if (tok.type !== "arrow") {
      attrs.nodeType = parseNodeType()
      expect("space")
    }
    expect("arrow")
    expect("space")
    attrs.children = []
    while (tok && tok.type !== "newline") {
      const symbol = parseSymbol()
      attrs.children.push(symbol)

      switch (tok.type) {
      case "newline":
        continue
      case ":":
        if (symbol.type === "Token" && tok.type === ":") {
          syntaxError("Can't use token as key")
        }
      }
      expect("space", "Expected space")
    }
    return new node("Rule", start, attrs)
  }

  function parseFile() {
    parseBlankLines()
    const start = Pos.before(tok)
    let end = Pos.before(tok)
    const rules = []
    while (tok) {
      const rule = parseRule()
      rules.push(rule)
      if (tok) { end = Pos.before(tok) }
      parseBlankLines()
    }
    return new Node("Grammar", new Region(start, end, buffer), {rules})
  }

  return parseFile()
}

const example = `

// Numbers
N -> ="number"
N -> Call{ name="function" "(" args=args ")" }

args -> 
args -> List{ rest=args last=N }

// Parentheses
P -> "(" =AS ")"
P -> =N

// Exponents
E -> BinOp{ left=P op="^" right=E }
E -> =P

// Mul / div
MD -> Mul{ left=MD "*" right=E  }
MD -> Div{ left=MD "/" right=E  }
MD -> =E

// Addition and subtraction
AS -> Add{ left:AS "+" right:MD }
AS -> Sub{ left:AS "-" right:MD }
AS -> =MD

`

const program = `

stmt -> :expr

expr Let   -> "let" name:"iden" "=" value:expr "in" body:expr

stmt If    -> "if" cond:expr iftrue:Block
stmt If    -> "if" cond:expr iftrue:Block "else" iffalse:Block
stmt While -> "while" cond:expr body:Block
stmt Block -> "{" ";"* body:statements ";"* "}"

statements [] -> []:statements ";"+ :stmt
statements [] -> :stmt

stmt Def -> "fun" name:"iden" args:"iden"* "=" body:expr

args [] -> []:args :expr
args [] ->

expr Call -> func:expr arg:expr

expr Literal -> value:"number"
expr Literal -> value:"string"
expr BoolLiteral -> value:"boolean"

`

const lisp = `

program -> expr+

expr Quote -> "'" list:List
expr List -> "(" items:expr+ ")"
expr Atom -> name:"identifier"
expr Literal -> value:"number"
expr Literal -> value:"string"

`

const bad = `
Test -> foo :root []:list key:value "token" key:"value"

bad Cheese -> foo:"bar" cheese:bar
bad [] -> foo
bad -> 
`

lexer.reset(bad)
for (let tok of lexer) {
  console.log(tok.type, JSON.stringify(tok.value))
}
console.log()

const tree = parse(bad)
console.log(tree.toString())
//console.log(JSON.stringify(tree, null, 2))

