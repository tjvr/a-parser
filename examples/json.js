const moo = require("moo")

const newGrammar = require("../grammar").newGrammar

const lexer = moo.compile({
  space: { match: /\s+/, lineBreaks: true },
  NUMBER: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  STRING: {
    match: /"(?:\\["bfnrt\/\\]|\\u[a-fA-F0-9]{4}|[^"\\])*"/,
    value: x => JSON.parse(x),
  },
  "{": "{",
  "}": "}",
  "[": "[",
  "]": "]",
  ",": ",",
  ":": ":",
  TRUE: /true\b/,
  FALSE: /false\b/,
  NULL: /null\b/,
})

// This JSON grammar has been slightly modified to remove nullable rules, so
// that the naive LR0 parser works properly.
const grammar = newGrammar(`

json Object -> "{" items:items "}"
json Object -> "{" "}"
json Array -> "[" items:array "]"
json Array -> "[" "]"
json String -> value:"STRING"
json Number -> value:"NUMBER"
json Bool   -> value:"TRUE"
json Bool   -> value:"FALSE"
json Null   -> "NULL"

items [] -> []:items "," :item
items [] -> :item
//items [] ->

array [] -> []:array "," :json
array [] -> :json
//array [] ->

item Item -> key:"STRING" ":" value:json

`)

function process(node) {
  switch (node.type) {
    case "Object":
      const d = {}
      for (let item of node.items) {
        d[item.key] = process(item.value)
      }
      return d
    case "Array":
      const a = []
      for (let item of node.items) {
        a.push(process(item))
      }
      return a
    case "Number":
      return +node.value
    case "String":
      return node.value
    case "Bool":
      return node.value === "true"
    case "Null":
      return null
  }
}

module.exports = {
  lexer,
  grammar,
  process,
}
