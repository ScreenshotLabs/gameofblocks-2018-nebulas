//     ___           ___           ___           ___                    ___           ___
//     /  /\         /  /\         /__/\         /  /\                  /  /\         /  /\
//    /  /:/_       /  /::\       |  |::\       /  /:/_                /  /::\       /  /:/_
//   /  /:/ /\     /  /:/\:\      |  |:|:\     /  /:/ /\              /  /:/\:\     /  /:/ /\
//  /  /:/_/::\   /  /:/~/::\   __|__|:|\:\   /  /:/ /:/_            /  /:/  \:\   /  /:/ /:/
// /__/:/__\/\:\ /__/:/ /:/\:\ /__/::::| \:\ /__/:/ /:/ /\          /__/:/ \__\:\ /__/:/ /:/
// \  \:\ /~~/:/ \  \:\/:/__\/ \  \:\~~\__\/ \  \:\/:/ /:/          \  \:\ /  /:/ \  \:\/:/
//  \  \:\  /:/   \  \::/       \  \:\        \  \::/ /:/            \  \:\  /:/   \  \::/
//   \  \:\/:/     \  \:\        \  \:\        \  \:\/:/              \  \:\/:/     \  \:\
//    \  \::/       \  \:\        \  \:\        \  \::/                \  \::/       \  \:\
//     \__\/         \__\/         \__\/         \__\/                  \__\/         \__\/
//   ___           ___           ___           ___
//   _____                       /  /\         /  /\         /__/|         /  /\
//  /  /::\                     /  /::\       /  /:/        |  |:|        /  /:/_
// /  /:/\:\    ___     ___    /  /:/\:\     /  /:/         |  |:|       /  /:/ /\
// /  /:/~/::\  /__/\   /  /\  /  /:/  \:\   /  /:/  ___   __|  |:|      /  /:/ /::\
// /__/:/ /:/\:| \  \:\ /  /:/ /__/:/ \__\:\ /__/:/  /  /\ /__/\_|:|____ /__/:/ /:/\:\
// \  \:\/:/~/:/  \  \:\  /:/  \  \:\ /  /:/ \  \:\ /  /:/ \  \:\/:::::/ \  \:\/:/~/:/
// \  \::/ /:/    \  \:\/:/    \  \:\  /:/   \  \:\  /:/   \  \::/~~~~   \  \::/ /:/
// \  \:\/:/      \  \::/      \  \:\/:/     \  \:\/:/     \  \:\        \__\/ /:/
//  \  \::/        \__\/        \  \::/       \  \::/       \  \:\         /__/:/
//   \__\/                       \__\/         \__\/         \__\/         \__\/

const DiceResult = function(data) {
  if (data) {
    const item = JSON.parse(data)
    this.sender = item.sender
    this.value = item.value
    this.kingdomKey = item.kingdomKey
  } else {
    this.sender = null
    this.value = 0
    this.kingdomKey = ''
  }
}

DiceResult.prototype = {
  toString: function() {
    return JSON.stringify(this)
  }
}

const Kingdom = function(data) {
  if (data) {
    const item = JSON.parse(data)
    this.title = item.title
    this.key = item.key
    this.tier = item.tier
    this.type = item.type
    this.minimumPrice = new BigNumber(item.minimumPrice)
    this.owner = item.owner
    this.locked = item.locked
  } else {
    this.title = ''
    this.key = ''
    this.tier = 0
    this.type = ''
    this.minimumPrice = new BigNumber(0)
    this.owner = ''
    this.locked = false
  }
}

Kingdom.prototype = {
  toString: function() {
    return JSON.stringify(this)
  }
}

const Game = function() {
  LocalContractStorage.defineProperty(this, 'kingdomsCount')
  LocalContractStorage.defineProperty(this, 'owner')
  LocalContractStorage.defineProperty(this, 'jackpotBalance')
  LocalContractStorage.defineProperty(this, 'gameIsLocked')
  LocalContractStorage.defineProperty(this, 'winner')
  LocalContractStorage.defineProperty(this, 'diceResultsCount')
  LocalContractStorage.defineProperty(this, 'round')
  LocalContractStorage.defineMapProperty(this, 'scores')
  LocalContractStorage.defineMapProperty(this, 'kingdomsIndexes')
  LocalContractStorage.defineMapProperty(this, 'diceResults', {
    parse: function(data) {
      return new DiceResult(data)
    },
    stringify: function(item) {
      return item.toString()
    }
  })

  LocalContractStorage.defineMapProperty(this, 'kingdoms', {
    parse: function(data) {
      return new Kingdom(data)
    },
    stringify: function(item) {
      return item.toString()
    }
  })
}

Game.prototype = {
  init: function() {
    this.owner = Blockchain.transaction.from
    this.jackpotBalance = new BigNumber(0)
    this.kingdomsCount = 0
    this.diceResultsCount = 0
    this.round = 1
  },

  getJackpot: function() {
    return this.jackpotBalance
  },

  createKingdom: function(key, type, tier, title, isLocked) {
    if (this.gameIsLocked === true) {
      throw new Error('Game is finished')
    }

    let kingdom = this.kingdoms.get(key)
    if (kingdom) {
      throw new Error('Kingdom is already created')
    }

    const tierValue = parseInt(tier)
    let requiredPrice = new BigNumber(0.03).plus(
      new BigNumber(0.03).mul(tierValue)
    )

    if (isLocked) {
      requiredPrice = requiredPrice.plus(new BigNumber(0.03))
    }

    if (new BigNumber(Blockchain.transaction.value).lt(requiredPrice)) {
      throw new Error('Insufficient funds')
    }

    this.jackpotBalance = new BigNumber(this.jackpotBalance).plus(
      new BigNumber(Blockchain.transaction.value)
    )

    kingdom = new Kingdom()
    kingdom.key = key
    kingdom.title = title
    kingdom.tier = tierValue
    kingdom.type = type
    kingdom.minimumPrice = new BigNumber(0.06)
    kingdom.owner = Blockchain.transaction.from
    kingdom.locked = isLocked

    this._incrementPoints(Blockchain.transaction.from, kingdom.tier)
    this.kingdomsIndexes.put(this.kingdomsCount, key)
    this.kingdomsCount = this.kingdomsCount + 1
    this.kingdoms.put(key, kingdom)
  },

  upgradeKingdom: function(key, tier, locked) {
    if (this.gameIsLocked === true) {
      throw new Error('Game is finished')
    }

    const kingdom = this.kingdoms.get(key)
    if (!kingdom) {
      throw new Error('Kingdom is not exists')
    }

    if (kingdom.owner !== Blockchain.transaction.from) {
      throw new Error('You are not the owner of this land')
    }

    if (tier <= kingdom.tier) {
      throw new Error('Required valid tier')
    }

    const payableTier = tier - kingdom.tier
    const requiredPrice = new BigNumber(0.03).mul(payableTier)

    if (!Blockchain.transaction.value.gte(requiredPrice)) {
      throw new Error(
        requiredPrice.toString(10) + ' is the minimal required price'
      )
    }

    this.jackpotBalance = new BigNumber(this.jackpotBalance).plus(
      new BigNumber(Blockchain.transaction.value)
    )

    kingdom.locked = locked
    kingdom.tier = tier
    this.kingdoms.set(key, kingdom)
  },

  getDiceResults: function() {
    const results = []
    const size = parseInt(this.diceResultsCount)
    for (let i = 0; i < size; i++) {
      results.push(this.diceResults.get(i))
    }
    return results
  },

  getDiceResult: function(index) {
    return this.diceResults.get(index)
  },

  getDiceResultCount: function() {
    return this.diceResultsCount
  },

  attackKingdom: function(key, title) {
    if (this.gameIsLocked === true) {
      throw new Error('Game is finished')
    }

    const kingdom = this.kingdoms.get(key)
    if (!kingdom) {
      throw new Error('Kingdom is not exists')
    }

    if (kingdom.owner === Blockchain.transaction.from) {
      throw new Error('You are already the owner of this land')
    }

    if (kingdom.locked === true) {
      throw new Error('Kingdom is locked')
    }

    const value = new BigNumber(Blockchain.transaction.value)
    const requiredValue = 0.01

    if (value.eq(requiredValue)) {
      throw new Error('Required price is ' + requiredValue.toString(10))
    }

    const rand = Math.floor(Math.random() * 2)

    const diceResult = new DiceResult()
    diceResult.sender = Blockchain.transaction.from
    diceResult.value = rand
    diceResult.kingdomKey = key

    const diceResultCount = parseInt(this.diceResultsCount)
    this.diceResults.set(diceResultCount, diceResult)
    this.diceResultsCount = diceResultCount + 1

    if (rand === 1) {
      // Attacker loose
      if (!Blockchain.transfer(kingdom.owner, value)) {
        throw new Error('transfer failed.')
      }
    } else {
      // Attacker win
      this.jackpotBalance = new BigNumber(this.jackpotBalance).plus(value)
      if (kingdom.tier - 1 === 0) {
        this._decrementPoints(kingdom.owner, kingdom.tier)
        kingdom.tier = 1
        kingdom.title = title
        this._incrementPoints(Blockchain.transaction.from, kingdom.tier)
        kingdom.owner = Blockchain.transaction.from
      } else {
        kingdom.tier -= 1
      }
      this.kingdoms.set(key, kingdom)
    }
  },

  _getPoints: function(tier) {
    return [1, 3, 5, 8, 13][tier - 1]
  },

  _incrementPoints(addr, tier) {
    const previousScore = this.scores.get(addr) || 0
    const points = this._getPoints(tier)
    const newScore = previousScore + points
    this.scores.put(addr, newScore)

    if (newScore >= 120) {
      this.gameIsLocked = true
      this.winner = addr
    }
  },

  _decrementPoints(addr, tier) {
    const previousScore = this.scores.get(addr) || 0
    const points = this._getPoints(tier)
    this.scores.put(addr, previousScore - points)
  },

  finishGame: function() {
    if (
      this.owner != Blockchain.transaction.from ||
      this.gameIsLocked === false
    ) {
      throw new Error('You are not authorized')
    }

    if (!Blockchain.verifyAddress(this.winner)) {
      throw 'Winner address is not correct'
    }

    const fees = new BigNumber(this.jackpotBalance).mul(10).div(1000)
    const winnerPrice = new BigNumber(this.jackpotBalance).minus(fees)

    if (!Blockchain.transfer(this.owner, fees)) {
      throw new Error('transfer failed.')
    }

    if (!Blockchain.transfer(this.winner, winnerPrice)) {
      throw new Error('transfer failed.')
    }

    LocalContractStorage.del('kingdoms')
    LocalContractStorage.del('diceResultsCount')
    LocalContractStorage.del('scores')
    LocalContractStorage.del('diceResults')
    LocalContractStorage.del('kingdomsIndexes')

    this.kingdomsCount = 0
    this.jackpotBalance = new BigNumber(0)
    this.winner = ''
    this.gameIsLocked = false
    this.diceResultsCount = 0
    this.round = this.round + 1
  },

  getAllKingdoms: function() {
    const result = {}
    const size = parseInt(this.kingdomsCount)
    for (let i = 0; i < size; i++) {
      const kingdomKey = this.kingdomsIndexes.get(i)
      if (kingdomKey) {
        result[kingdomKey] = this.kingdoms.get(kingdomKey)
      }
    }
    return result
  },

  getKingdomCount: function() {
    return this.kingdomsCount || 0
  },

  getKingdomByKey: function(key) {
    return this.kingdoms.get(key)
  },

  getKingdomByIndex: function(index) {
    const kingdomIndex = parseInt(index)
    const kingdomKey = this.kingdomsIndexes.get(kingdomIndex)
    return this.kingdoms.get(kingdomKey)
  },

  // Don't worry. This is just a security function.
  // Developers must secure your funds if something goes wrong.
  suicide: function() {
    if (this.owner != Blockchain.transaction.from) {
      throw new Error('You are not authorized')
    }
    if (!Blockchain.transfer(this.owner, new BigNumber(this.jackpotBalance))) {
      throw new Error('transfer failed.')
    }
  }
}

module.exports = Game
