
function stringify(value, indent) {
  if (value && value.stringify) {
    return value.stringify(indent)
  }

  if (!Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (value.length === 0) {
    return "[]"
  }

  const nextIndent = indent + "  "
  let s = "[\n"
  for (let item of value) {
    s += nextIndent + stringify(item, nextIndent) + ",\n"
  }
  return s + indent + "]"
}

class Node {
  constructor(type, region, attrs) {
    if (attrs.type) {
      throw new Error("Cannot set 'type' property on a Node")
    }
    this.type = type // String
    this.region = region // Region
    Object.assign(this, attrs)
  }

  toString() {
    return this.stringify()
  }

  stringify(indent) {
    indent = indent || ""
    const nextIndent = indent + "  "

    //let s = "{\n"
    //s += nextIndent + "type: " + JSON.stringify(this.type) + ",\n"
    //let s = this.type + " {\n"
    let s = "{ type: " + JSON.stringify(this.type)
    //s += nextIndent + "_text: " + JSON.stringify(this.region.text) + ",\n"

    const keys = Object.getOwnPropertyNames(this)

    let hadKeys = false
    for (let key of keys) {
      const value = this[key]
      if (key === "type" || key === "region") continue
      s += ",\n" + nextIndent + key + ": "
      s += stringify(value, nextIndent)
      hadKeys = true
    }

    if (!hadKeys) {
      return s + " }"
    }
    return s + ",\n" + indent + "}"
  }
}

class Region {
  constructor(start, end, buffer) {
    this.start = start // Pos
    this.end = end // Pos
    this.buffer = buffer // String
  }

  from(token, buffer) {
    return new Region(Pos.before(token), Pos.after(token), buffer)
  }

  get text() {
    return this.buffer.slice(this.start.offset, this.end.offset)
  }
}

class Pos {
  constructor(line, col, offset) {
    this.line = line|0 // 1-based
    this.col = col|0 // 1-based
    this.offset = offset|0
  }

  static before(token) {
    return new Pos(token.line, token.col, token.offset)
  }

  static after(token) {
    const line = token.line + token.lineBreaks
    const offset = token.offset + token.size
    if (token.lineBreaks === 0) {
      return new Pos(line, token.col, offset)
    }
    const nl = token.text.lastIndexOf("\n")
    const col = token.size - nl + 1
    return new Pos(line, col, offset)
  }
}

module.exports = {Node, Pos, Region}

