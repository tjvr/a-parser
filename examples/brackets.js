const moo = require("moo")

const newGrammar = require("../grammar").newGrammar

const lexer = moo.compile({
  "(": "(",
  ")": ")",
  ";": ";",
  x: "x",
  word: /[a-z]+/,
  space: / +/,
})

const grammar = newGrammar(`

S Id -> "(" a:L ")"
S Id -> a:"word"

L Id -> a:S
L Seq -> a:L ";" b:S

`)

function process(node) {
  if (typeof node !== "object") {
    return node
  }
  switch (node.type) {
    case "Seq":
      return [process(node.a), process(node.b)]
    case "Id":
      return process(node.a)
  }
}

module.exports = {
  lexer,
  grammar,
  process,
}
