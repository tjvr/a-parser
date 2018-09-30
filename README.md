
# What is this?

This is a work-in-progress parser generator: a framework for generating parsers from a grammar definition. It takes inspiration from [Nearley](https://github.com/kach/nearley) and other projects.

A _parser_ is used to turn text (such as the source code for a programming language) into a _parse tree_. This tree-like structure contains all of the hierarchy of the source code, and is classically the input to a _compiler_ which traverses the tree to emit machine code (at a rough simplification. Most production compilers use several different intermediate tree formats.)

A parser is usually used with a _tokenizer_ (or "lexer"). The tokenizer does the "dumb" job of splitting the text into "words", called "tokens"; the parser does the "smart" job of recognising sequences of such tokens. We recommend [Moo](https://github.com/no-context/moo) as a very fast and friendly tokenizer.


# Grammar definitions

Grammars are defined using a custom syntax, from which a parser can be generated.

(You might wonder how this syntax is defined itself: in fact, it has its own grammar, and can parse itself! We call this "bootstrapping".)

The `grammar` module contains code to interpret this syntax.


## Post-processing

By default, rules will match input, but won't return anything. Annotations are used to describe how to construct a parse tree from what was matched. Rules without annotations always produce the value `null`.
    
    if_stmt -> "if" expr "then" block
    // null

Rules can be annotated with a **node type**. Any number of children may then be annotated with an **attribute name**. For example, this rule will produce a node of type `IfStatement`, with attributes `cond` and `body`.

    if_stmt IfStatement -> "if" cond:expr "then" body:block
    // {type: "IfStatement", cond: ..., body: ...}

You cannot annotate children if the rule is not annotated first. Otherwise, there is no node to attach the attributes to.

    if_stmt -> "if" cond:expr "then" body:block
    // Not allowed


### Root Annotation

It's often useful to pass through a node unchanged, without wrapping it in another object. For example, you might have a `number` rule that can match a `float`. We can use the **root annotation** (which can be thought of as an empty attribute name). Use this to pass through the child unchanged.

    float_literal Literal -> value:"float"
    // {type: "Literal", value: 3.14}

    number -> float_literal
    // null

    number -> :float_literal
    // {type: "Literal", value: 3.14}

Parentheses are another good example. You must define a _syntax_ rule for brackets -- otherwise they couldn't be parsed! -- but usually you don't want them to appear in the final parse tree.

    x -> "(" :x ")"

The root annotation can only be applied to a **single** child of a rule.

    foo -> :bar :quxx
    // Not allowed

The root annotation cannot be combined with other annotations.

    foo Object -> :bar
    // Not allowed

    num Object -> :expr "+" other:expr
    // Not allowed


### List Annotations

It's often useful to parse lists (e.g. statements in a program; comma-separated arguments to a function call).

You could define lists yourself, by inventing a node type for linked lists.

    // A program must have at least one statement.
    program StatementList -> head:statement

    // A program is a statement followed by the rest of the program.
    program StatementList -> head:statement tail:program

Each node in the linked list will have the type `StatementList`.

The rule above is right-recursive; we prefer **left-recursive** rules. In addition, there is a special built-in list type `[]`, to avoid you working with linked lists yourself.

The last item in the list is annotated as the root attribute. The special list attribute `[]` is used for the rest of the list.

    // A program must have at least one statement.
    program [] -> :statement

    // A program ends with a statement.
    program [] -> []:program :statement

The rule must be annotated with the special list type `[]`. One of the children may then be annotated as the root attribute; another child may then additionally be annotated with the list attribute.

You cannot have a list just contain itself; and as above, the root annotation can only be applied to a **single** child of a rule.

    program [] -> []:program
    // Not allowed

    program [] -> []:program :statement :statement
    // Not allowed

Apart from these restrictions, you can use these annotations anywhere in the rule.

    // Body is one or more lines separated by semicolons
    body [] -> :statement
    body [] -> []:body ";" :statement

    // Arguments are zero or more expressions separated by commas
    args [] -> 
    args [] -> []:args ";" :expr


## EBNF Operators

The regex-like operators for optional tokens and repetition are provided:


### Option `?`

`val?` matches zero or one occurences of `val`. It expands to the generated rule `val?`:

    val? -> :val
    val? ->

In the expression `key:val?`, if `val` is not present, then `key` will be `null`.


### One or many `+`

`val+` matches one or many occurences of `val`. It expands to the generated rule `val+`:

    val+ [] -> []:val+ :val
    val+ [] -> :val

In the expression `key:val+`, `key` will always contain a non-empty array.

### Zero or many `*`

`val*` matches zero or many occurences of `val`. It expands to the generated rule `val*`:

    val* [] -> []:val* :val
    val* [] ->

In the expression `key:val*`, `key` will always contain an array, but it may be empty.

