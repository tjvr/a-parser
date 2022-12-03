import moo from "moo"

import { newGrammar } from "../grammar"

function literals(list) {
  var rules = {}
  for (let lit of list) {
    rules[lit] = { match: lit, next: "main" }
  }
  return rules
}

export const lexer = moo.states({
  main: {
    include: "_rules",
    charclass: {
      match: /\.|\[(?:\\.|[^\\\n])+?\]/,
      value: x => new RegExp(x),
    },
  },
  // Both macro arguments and charclasses are both enclosed in [ ].
  // We disambiguate based on whether the previous token was a `word`.
  afterWord: {
    "[": { match: "[", next: "main" },
    include: "_rules",
  },
  _rules: {
    ...literals([",", "|", "$", "%", "(", ")", "]", ":?", ":*", ":+", "@", "@include", "@builtin"]),
    ws: { match: /\s+/, lineBreaks: true, next: "main" },
    comment: /\#.*/,
    arrow: { match: /[=-]+\>/, next: "main" },
    js: {
      match: /\{\%(?:[^%]|\%[^}])*\%\}/,
      value: x => x.slice(2, -2),
    },
    word: { match: /[\w\?\+]+/, next: "afterWord" },
    string: {
      match: /"(?:[^\\"\n]|\\["\\/bfnrt]|\\u[a-fA-F0-9]{4})*"/,
      value: x => JSON.parse(x),
      next: "main",
    },
    btstring: {
      match: /`[^`]*`/,
      value: x => x.slice(1, -1),
      next: "main",
    },
  },
})

export const grammar = newGrammar(`

final -> _ :program _ //"ws"?

// prog
program [] -> :stmt
program [] -> []:program ws :stmt

// prod
stmt Rule    -> name:"word" _ "arrow" _ rules:alt
stmt Macro   -> macro:"word" "[" args:args "]" _ "arrow" _ exprs:alt
stmt Script  -> "@" _ body:"js"
stmt Option  -> "@" config:"word" ws value:"word"
stmt Include -> "@include" _ include:string
stmt Builtin -> "@builtin" _ include:string

// expression+
alt [] -> []:alt _ "|" _ :pexpr
alt [] -> :pexpr

// completeexpression
pexpr Expr -> tokens:expr
pexpr Expr -> tokens:expr _ postprocess:"js"

expr [] -> :item
expr [] -> []:expr ws :item

// expr_member
item Word     -> word:"word"
item Mixin    -> "$" mixin:"word"
item Call     -> macrocall:"word" "[" args:args "]"
item Literal  -> literal:string
item LiteralI -> literal:string "i"
item Token    -> "%" token:"word"
item Class    -> "charclass"
item Group    -> "(" _ subexpression:alt _ ")"
item EBNF     -> ebnf:item _ modifier:modifier

modifier -> :":+"
modifier -> :":*"
modifier -> :":?"

// expressionlist
args [] -> []:args _ "," _ :pexpr
args [] -> :pexpr

string -> :"string"
string -> :"btstring"

// TODO ignore comments
_ -> ws?
ws -> "ws"
ws -> "ws"? "comment" _

`)
