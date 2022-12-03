import moo from "moo"

import { newGrammar } from "../grammar"

export const lexer = moo.compile({
  "(": "(",
  ")": ")",
  ";": ";",
  x: "x",
  word: /[a-z]+/,
  space: / +/,
})

export const grammar = newGrammar(`

S Id -> "(" a:L ")"
S Id -> a:"word"

L Id -> a:S
L Seq -> a:L ";" b:S

`)

export function process(node) {
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
