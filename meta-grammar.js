
const { parseGrammar } = require('./parser/syntax')
const { buildRule } = require('./parser/factory')

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

const grammar = parseGrammar(lisp)
console.log(grammar.toString())
for (let rule of grammar.rules) {
  console.log(buildRule(rule))
}
//console.log(JSON.stringify(tree, null, 2))

