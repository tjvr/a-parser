
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
    for (let key of keys) {
      const value = this[key]
      if (key === "type" || key === "region") continue
      s += ",\n" + nextIndent + key + ": "
      s += stringify(value, nextIndent)
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

const lexer = moo.states({
  $all: {
    error: moo.error,
  },
  main: {
    newline: {match: '\n', lineBreaks: true},
    include: 'shared',
    arrow: {match: '->', next: 'rule'},
  },
  rule: {
    _op: {match: [":", "?", "*", "+", "(", ")"], type: x => x},
    newline: {match: '\n', lineBreaks: true, next: 'main'},
    string: {match: /"(?:\\["\\]|[^\n"\\])*"/, value: s => s.slice(1, -1)},
    include: 'shared',
  },
  shared: {
    list: "[]",
    space: /[ \t\f\r]+/,
    identifier: /[A-Za-z][A-Za-z0-9_-]*/,
    comment: /\/\/.*$/,
  },
})

const metaGrammar = `

grammar -> "newline"* rules:rules "newline"*

rules [] -> []:rules "newline"+ :rule
rules [] ->

rule -> name:"identifier" type:"identifier"? "->" children:Symbols[]

def -> :Name
def -> :List

symbols [] -> []:symbols "space" :symbol
symbols [] ->

symbol Optional   -> atom:Atom "?"
symbol OneOrMany  -> atom:Atom "+"
symbol ZeroOrMany -> atom:Atom "*"

atom Group -> "(" children:Symbols[] ")"
atom Atom -> ((key:"identifier")? ":")? match:match

match Name -> name:"identifier"
match Token -> type:"string"

`

function parse(buffer) {
  lexer.reset(buffer)

  var tok
  function next() {
    do {
      tok = lexer.next()
    } while (tok && tok.type === "comment")
  }
  next()

  function syntaxError(message) {
      throw new Error(lexer.formatError(tok, message))
  }

  function expect(expectedType, message) {
    if (tok.type !== expectedType) {
      if (!message) {
        if (tok.type === "error") {
          message = "Invalid syntax (expected " + expectedType + ")"
        } else {
          message = "Expected " + expectedType + " but found " + tok.type
        }
      }
      syntaxError(message)
    }
    const found = tok
    next()
    return found
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
    const value = tok.value

    if (tok.type === "string") {
      next()
      return node("Token", start, {value})
    }

    if (tok.type !== "identifier") {
      syntaxError("Expected value but found " + tok.type)
    }
    next()

    if (tok.type === "list") {
      next()
      return node("List", start, {name: value})
    }

    return node("Name", start, {name: value})
  }

  function parseAtom() {
    if (tok.type === "(") {
      return parseParens()
    }

    const start = Pos.before(tok)

    if (tok.type === "string") {
      const value = tok.value
      next()
      return node("Token", start, {value})
    }

    if (tok.type === ":") {
      next()

      switch (tok.type) {
      case "space":
      case "newline":
        syntaxError("No key or value")
      }

      const match = parseValue()
      return node("Key", start, {root: true, match})
    }

    // identifier: either key or value
    const first = expect("identifier").value

    // ...depending on the next token
    if (tok.type === ":") {
      next()

      switch (tok.type) {
      case "space":
      case "newline":
        syntaxError("Found key without value")
      }

      const key = first
      const match = parseValue()
      return node("Key", start, {key, match})
    }

    const name = first

    if (tok.type === "list") {
      next()
      return node("List", start, {name})
    }
    return node("Name", start, {name})
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

  function parseParens() {
    const start = Pos.before(tok)
    expect("(")
    const children = []
    while (tok && tok.type !== ")") {
      const symbol = parseSymbol()
      children.push(symbol)
      if (tok.type !== ")") {
        expect("space", "Items must be separated with spaces")
      }
    }
    expect(")")
    return node("Group", start, {children})
  }

  function parseRule() {
    const start = Pos.before(tok)
    let name = expect("identifier").value
    if (tok.type === "list") {
      next()
      name = node("List", start, {name})
    } else {
      name = node("Name", start, {name})
    }
    expect("space")
    expect("arrow")
    if (tok.type !== "newline") {
      expect("space")
    }
    const children = []
    while (tok && tok.type !== "newline") {
      const symbol = parseSymbol()
      children.push(symbol)
      if (tok.type !== "newline") {
        expect("space", "Items must be separated with spaces")
      }
    }
    return new node("Rule", start, {name, children})
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

program = expr+

expr Quote = "'" list:List
expr List = "(" items:expr+ ")"
expr Atom = name:"identifier"
expr Literal = value:"number"
expr Literal = value:"string"

`

/*
lexer.reset(example)
for (let tok of lexer) {
  console.log(tok.type, JSON.stringify(tok.value))
}
*/

const tree = parse(metaGrammar)
console.log(tree.toString())
//console.log(JSON.stringify(tree, null, 2))

