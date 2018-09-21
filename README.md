


# EBNF Operators

The regex-like operators for optional tokens and repetition are provided:


## Option `?`

`val?` matches zero or one occurences of `val`. It expands to the generated rule `val?`:

    val? -> :val
    val? ->

In the expression `key:val?`, if `val` is not present, then `key` will be `null`.


## One or many `+`

`val+` matches one or many occurences of `val`. It expands to the generated rule `val+`:

    val+ [] -> []:val+ :val
    val+ [] -> :val

In the expression `key:val+`, `key` will always contain a non-empty array.

## Zero or many `*`

`val*` matches zero or many occurences of `val`. It expands to the generated rule `val*`:

    val* [] -> []:val* :val
    val* [] ->

In the expression `key:val*`, `key` will always contain an array, but it may be empty.

