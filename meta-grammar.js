
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

program -> expr+

expr Quote -> "'" list:List
expr List -> "(" items:expr+ ")"
expr Atom -> name:"identifier"
expr Literal -> value:"number"
expr Literal -> value:"string"

`

const bad = `
Test -> foo :root []:list key:value "token" key:"value"

bad Cheese -> foo:"bar" cheese:bar
bad [] -> foo
bad -> 
`

lexer.reset(bad)
for (let tok of lexer) {
  console.log(tok.type, JSON.stringify(tok.value))
}
console.log()

const tree = parse(bad)
console.log(tree.toString())
//console.log(JSON.stringify(tree, null, 2))

