
const moo = require('moo')

const {Node, Pos, Region} = require('./node')

const metaLexer = moo.compile({
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

rule -> name:"identifier" type:nodeType "->" children:symbols

nodeType ->
nodeType Name -> name:"identifier"
nodeType List -> "list"

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

`

function parseGrammar(buffer) {
  metaLexer.reset(buffer)

  var tok
  function next() {
    do {
      tok = metaLexer.next()
    } while (tok && (tok.type === "comment"))
  }
  next()

  function syntaxError(message) {
    if (tok && tok.type === "error") {
      message = "Invalid syntax"
    }
    if (!tok) {
      throw new Error(message + " at EOF")
    }
    throw new Error(metaLexer.formatError(tok, message))
  }

  function expect(expectedType, message) {
    if (tok && tok.type === expectedType) {
      const found = tok
      next()
      return found
    }

    if (!message) {
      message = "Expected " + expectedType
      if (tok) message += " (found " + tok.type + ")"
    }
    syntaxError(message)
  }

  function node(type, start, attrs) {
    const end = tok ? Pos.before(tok) : new Pos(metaLexer.line, metaLexer.col, metaLexer.index)
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

    if (tok && tok.type === ":") {
      const key = node("Name", start, {name: value})
      return parseKey(start, key)
    }
    return node("Name", start, {value})
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
    switch (tok && tok.type) {
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
    switch (tok && tok.type) {
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

      if (!tok || tok.type === "newline") {
        continue
      }
      if (tok.type === ":" && symbol.type === "Token") {
        syntaxError("Can't use token as key")
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

module.exports = {parseGrammar, metaLexer, metaGrammar}
