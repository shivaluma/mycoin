const R = require('ramda');
const CryptoUtil = require('../util/CryptoUtil')
const Config = require('../config')
class Block {
  toHash() {
      
      return CryptoUtil.hash(this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce);
  }

  getDifficulty() {
      
      return parseInt(this.hash.substring(0, 14), 16);
  }

  static get genesis() {
      return Block.fromJson(Config.genesisBlock);
  }

  static fromJson(data) {
      let block = new Block();
      R.forEachObjIndexed((value, key) => {
          if (key == 'transactions' && value) {
              block[key] = Transactions.fromJson(value);
          } else {
              block[key] = value;
          }
      }, data);

      block.hash = block.toHash();
      return block;
  }

}

module.exports = Block;