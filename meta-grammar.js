const meta = require("./grammar/meta")
const lib = require("./grammar")
const grammar = require("./grammar/grammar")

const example = `

// Numbers
N -> :"number"
N -> name:"function" "(" args:args ")"

args -> 
args -> List{ rest:args last:N }

// Parentheses
P -> "(" :AS ")"
P -> :N

// Exponents
E BinOp -> left:P op:"^" right:E
E -> :P

// Mul / div
MD BinOp -> left:MD op:"*" right:E
MD BinOp -> left:MD op:"/" right:E
MD -> :E

// Addition and subtraction
AS BinOp -> left:AS "+" right:MD
AS BinOp -> left:AS "-" right:MD
AS -> :MD

`

const program = lib.newGrammar(`

stmt -> :expr

expr Let -> "let" name:"iden" "=" value:expr "in" body:expr

stmt If    -> "if" cond:expr iftrue:expr
stmt If    -> "if" cond:expr iftrue:expr "else" iffalse:expr
stmt While -> "while" cond:expr body:expr
stmt Block -> "{" ";"* body:statements ";"* "}"

statements [] -> []:statements ";"+ :stmt
statements [] -> :stmt

expr -> "foo"?
expr -> "foo"+

stmt Def -> "fun" name:"iden" args:"iden"* "=" body:expr

expr -> "foo"*

args [] -> []:args :expr
args [] ->

expr Call        -> func:expr arg:expr
expr Literal     -> value:"number"
expr Literal     -> value:"string"
expr BoolLiteral -> value:"boolean"

`)
console.log(program.format())

const lisp = `

program -> :expr+

expr Quote -> "'" list:List
expr List -> "(" items:expr+ ")"
expr Atom -> name:"identifier"
expr Literal -> value:"number"
expr Literal -> value:"string"

`

const tree = meta.parse(program)
//console.log(tree.toString())
//console.log()
const g = grammar.fromParseTree(tree.rules)
for (let rule of g.rules) {
  console.log(rule.name + " -> " + rule.children.map((x) => x.name).join(" "))
  if (rule.type === "object") {
    console.log(rule.object + " { " + Object.keys(rule.keys).join(", ") + " }")
  } else if (rule.type === "root") {
    console.log("select " + rule.rootIndex)
  }
  console.log()
}
