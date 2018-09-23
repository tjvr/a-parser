const grammar = require("./grammar")
const node = require("./node")
const syntax = require("./syntax")
const factory = require("./factory")

module.exports = {
  ...grammar,
  ...node,
  parseTreeFromGrammarSource: syntax.parseGrammar,
  metaLexer: syntax.metaLexer,
  metaGrammar: syntax.metaGrammar,
  grammarFromParseTree: factory.expandRules,
}
