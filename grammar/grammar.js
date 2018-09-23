class Grammar {
  constructor() {
    this.rulesByName = new Map()
    this.rules = []
  }

  get(name) {
    return this.rulesByName.get(name)
  }

  add(rule) {
    const name = rule.name
    let ruleSet = this.rulesByName.get(name)
    if (!ruleSet) {
      ruleSet = []
      this.rulesByName.set(name, ruleSet)
    }
    ruleSet.push(rule)
    this.rules.push(rule)
  }
}

module.exports = { Grammar }
