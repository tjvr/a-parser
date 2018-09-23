const grammar = require("./grammar")
const node = require("./node")
const syntax = require("./syntax")
const factory = require("./factory")

function compile(source) {
  return factory.expandRules(syntax.parseGrammar(source).rules)
}

module.exports = {
  ...grammar,
  ...node,
  parseTreeFromGrammarSource: syntax.parseGrammar,
  metaLexer: syntax.metaLexer,
  metaGrammarSource: syntax.metaGrammarSource,
  grammarFromParseTree: factory.expandRules,
  compile,
}
