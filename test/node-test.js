
const test = require('ava')

const {Node, Pos, Region} = require('../parser/node')

test('formats regions', t => {
  const region = new Region(
    new Pos(2, 8, 15),
    new Pos(2, 11, 18),
    'foo -> \nfoo -> bar quxx',
  )

  t.is(region.formatFirstLine(),
    "foo -> bar quxx\n" +
    "       ^^^"
  )
})

test('formats errors', t => {
  const region = new Region(
    new Pos(2, 8, 15),
    new Pos(2, 11, 18),
    'foo -> \nfoo -> bar quxx',
  )

  t.is(region.formatError("Problem"),
    "Problem at line 2 col 8:\n" +
    "\n" +
    "  foo -> bar quxx\n" +
    "         ^^^"
  )
})

