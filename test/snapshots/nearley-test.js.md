# Snapshot report for `test/nearley-test.js`

The actual snapshot is saved in `nearley-test.js.snap`.

Generated by [AVA](https://ava.li).

## compile meta-grammar

> Snapshot 1

    [
      {
        name: 'grammar',
        process: `return {␊
        type: "Grammar",␊
        "rules": d[1],␊
        }`,
        symbols: [
          'blankLines',
          'rules',
          'blankLines',
        ],
      },
      {
        name: 'blankLines',
        process: 'return null',
        symbols: [],
      },
      {
        name: 'blankLines',
        process: 'return null',
        symbols: [
          'blankLines',
          {
            type: 'newline',
          },
        ],
      },
      {
        name: 'rules',
        process: `var list = d[0].slice()␊
        list.push(d[3])␊
        return list`,
        symbols: [
          'rules',
          {
            type: 'newline',
          },
          'blankLines',
          'rule',
        ],
      },
      {
        name: 'rules',
        process: 'return []',
        symbols: [],
      },
      {
        name: 'rule',
        process: `return {␊
        type: "Rule",␊
        "name": d[0],␊
        "type": d[1],␊
        "children": d[3],␊
        }`,
        symbols: [
          {
            type: 'identifier',
          },
          'nodeType',
          {
            type: '->',
          },
          'children',
        ],
      },
      {
        name: 'nodeType',
        process: 'return null',
        symbols: [],
      },
      {
        name: 'nodeType',
        process: `return {␊
        type: "Name",␊
        "name": d[0],␊
        }`,
        symbols: [
          {
            type: 'identifier',
          },
        ],
      },
      {
        name: 'nodeType',
        process: `return {␊
        type: "List",␊
        }`,
        symbols: [
          {
            type: 'list',
          },
        ],
      },
      {
        name: 'children',
        process: `var list = d[0].slice()␊
        list.push(d[2])␊
        return list`,
        symbols: [
          'children',
          {
            type: 'space',
          },
          'child',
        ],
      },
      {
        name: 'children',
        process: 'return []',
        symbols: [],
      },
      {
        name: 'child',
        process: 'return d[0]',
        symbols: [
          'symbol',
        ],
      },
      {
        name: 'child',
        process: `return {␊
        type: "Key",␊
        "key": d[0],␊
        "match": d[2],␊
        }`,
        symbols: [
          'key',
          {
            type: ':',
          },
          'symbol',
        ],
      },
      {
        name: 'key',
        process: `return {␊
        type: "Root",␊
        }`,
        symbols: [],
      },
      {
        name: 'key',
        process: `return {␊
        type: "List",␊
        }`,
        symbols: [
          {
            type: 'list',
          },
        ],
      },
      {
        name: 'key',
        process: `return {␊
        type: "Name",␊
        "name": d[0],␊
        }`,
        symbols: [
          {
            type: 'identifier',
          },
        ],
      },
      {
        name: 'symbol',
        process: `return {␊
        type: "Optional",␊
        "atom": d[0],␊
        }`,
        symbols: [
          'match',
          {
            type: '?',
          },
        ],
      },
      {
        name: 'symbol',
        process: `return {␊
        type: "OneOrMany",␊
        "atom": d[0],␊
        }`,
        symbols: [
          'match',
          {
            type: '+',
          },
        ],
      },
      {
        name: 'symbol',
        process: `return {␊
        type: "ZeroOrMany",␊
        "atom": d[0],␊
        }`,
        symbols: [
          'match',
          {
            type: '*',
          },
        ],
      },
      {
        name: 'match',
        process: `return {␊
        type: "Token",␊
        "name": d[0],␊
        }`,
        symbols: [
          {
            type: 'string',
          },
        ],
      },
      {
        name: 'match',
        process: `return {␊
        type: "Name",␊
        "name": d[0],␊
        }`,
        symbols: [
          {
            type: 'identifier',
          },
        ],
      },
    ]