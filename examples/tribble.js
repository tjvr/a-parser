const moo = require("moo")

const newGrammar = require("../grammar").newGrammar

const lexer = moo.compile({
  "(": "(",
  ")": ")",
  "+": "+",
  num: /[0-9]+/,
  space: / +/,
})

const grammar = newGrammar(`

Expr -> "(" :Expr ")"
Expr -> :Factor

Factor Num  -> value:"num"
Factor Plus -> "+" right:Factor
Factor Plus -> left:Factor "+" right:"num"

`)

function process(node) {
  switch (node.type) {
    case "Num":
      return node.value
    case "Plus":
      return ["+", node.left, node.right]
  }
}

module.exports = {
  lexer,
  grammar,
  process,
}
