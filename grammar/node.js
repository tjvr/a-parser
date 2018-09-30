const hasOwnProperty = Object.prototype.hasOwnProperty

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
    if (hasOwnProperty.call(attrs, "type")) {
      throw new Error("Cannot set 'type' property on a Node")
    }
    if (typeof type !== "string") {
      throw new Error("Node type must be a string")
    }
    this.type = type // String
    this.region = region // Region
    Object.assign(this, attrs)
  }

  toString() {
    return this.stringify()
  }

  eachAttribute(cb) {
    const keys = Object.getOwnPropertyNames(this)
    for (let key of keys) {
      const value = this[key]
      if (key === "type" || key === "region") continue
      cb(key, this[key])
    }
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
    this.eachAttribute((key, value) => {
      s += ",\n" + nextIndent + key + ": "
      s += stringify(value, nextIndent)
      hadKeys = true
    })

    if (!hadKeys) {
      return s + " }"
    }
    return s + ",\n" + indent + "}"
  }

  formatError(message) {
    return this.region.formatError(message)
  }

  withoutRegions() {
    const newAttrs = {}
    this.eachAttribute((key, value) => {
      newAttrs[key] = Array.isArray(value)
        ? value.map(item => (item.withoutRegions ? item.withoutRegions() : item))
        : value && value.withoutRegions
          ? value.withoutRegions()
          : value
    })
    return new Node(this.type, null, newAttrs)
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

  get firstLine() {
    const buffer = this.buffer
    const offset = this.start.offset
    let sol = offset === 0 ? 0 : buffer.lastIndexOf("\n", offset) + 1
    let eol = buffer.indexOf("\n", offset + 1)
    if (eol === -1) eol = buffer.length
    return buffer.slice(sol, eol)
  }

  formatFirstLine(indent) {
    indent = indent || ""
    const line = this.firstLine
    const endCol = this.end.line === this.start.line ? this.end.col : line.length
    let message = indent + line + "\n"
    message +=
      indent + Array(this.start.col).join(" ") + Array(endCol - this.start.col + 1).join("^")
    return message
  }

  formatError(message) {
    message += " at line " + this.start.line + " col " + this.start.col + ":\n\n"
    message += this.formatFirstLine("  ")
    return message
  }
}

class Pos {
  constructor(line, col, offset) {
    this.line = line | 0 // 1-based
    this.col = col | 0 // 1-based
    this.offset = offset | 0
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

module.exports = { Node, Pos, Region }
