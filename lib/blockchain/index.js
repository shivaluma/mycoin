const EventEmitter = require('events');
const R = require('ramda');
const Database = require('../util/database');
const Blocks = require('./blocks');
const Block = require('./block');
const Transactions = require('./transactions');

const Config = require('../config');

class Blockchain {
  constructor(dbName) {
    this.blocksDb = new Db('data/' + dbName + '/' + BLOCKCHAIN_FILE, new Blocks());
    this.transactionsDb = new Db('data/' + dbName + '/' + TRANSACTIONS_FILE, new Transactions());

    this.blocks = this.blocksDb.read(Blocks);
    this.transactions = this.transactionsDb.read(Transactions);

    this.emitter = new EventEmitter();
    this.init();
  }

  init() {
    if (this.blocks.length == 0) {
      console.info('Blockchain empty, adding genesis block');
      this.blocks.push(Block.genesis);
      this.blocksDb.write(this.blocks);
    }

    console.info('Removing transactions that are in the blockchain');
    R.forEach(this.removeBlockTransactionsFromTransactions.bind(this), this.blocks);
  }

  getAllBlocks() {
    return this.blocks;
  }

  getBlockByIndex(index) {
    return R.find(R.propEq("index", index), this.blocks);
  }

  getBlockByHash(hash) {
    return R.find(R.propEq("hash", hash), this.blocks);
  }

  getLastBlock() {
    return R.last(this.blocks)
  }

  getDifficulty(index) {
    return Config.pow.getDifficulty(this.blocks, index)
  }

  getTransactions() {
    return this.transactions
  }

  getTransactionById(id) {
    return R.find(R.propEq("id", id), this.transactions)
  }

}