import moo from "moo"

import { newGrammar } from "../grammar"

export const lexer = moo.compile({
  "(": "(",
  ")": ")",
  "+": "+",
  num: /[0-9]+/,
  space: / +/,
})

export const grammar = newGrammar(`

Expr -> "(" :Expr ")"
Expr -> :Factor

Factor Num  -> value:"num"
Factor Plus -> "+" right:Factor
Factor Plus -> left:Factor "+" right:"num"

`)

export function process(node) {
  switch (node.type) {
    case "Num":
      return node.value
    case "Plus":
      return ["+", node.left, node.right]
  }
}
