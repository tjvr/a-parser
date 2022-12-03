const test = require("ava")

const { Node, Pos, Region } = require("../grammar")

test("warns if type is in attrs", t => {
  t.throws(() => new Node("foo", null, { type: "bar" }), {
    message: /^Cannot set 'type' property on a Node/,
  })
})

test("formats region", t => {
  const region = new Region(new Pos(2, 8, 15), new Pos(2, 11, 18), "foo -> \nfoo -> bar quxx")

  // prettier-ignore
  t.is(region.formatFirstLine(),
    "foo -> bar quxx\n" +
    "       ^^^"
  )
})

test("formats region at end", t => {
  const region = new Region(new Pos(1, 21, 20), new Pos(1, 26, 25), 'foo -> "(" :bar ")" :quxx')

  // prettier-ignore
  t.is(region.formatFirstLine(),
    'foo -> "(" :bar ")" :quxx\n' +
    "                    ^^^^^"
  )
})

test("formats region error", t => {
  const region = new Region(new Pos(2, 8, 15), new Pos(2, 11, 18), "foo -> \nfoo -> bar quxx")

  // prettier-ignore
  t.is(region.formatError("Problem"),
    "Problem at line 2 col 8:\n" +
    "\n" +
    "  foo -> bar quxx\n" +
    "         ^^^"
  )
})
