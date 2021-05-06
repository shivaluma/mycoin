const EventEmitter = require('events');
const R = require('ramda');
const Database = require('../util/database');
const Blocks = require('./blocks');
const Block = require('./block');
const Transactions = require('./transactions');

const Config = require('../config');

const BLOCKCHAIN_FILE = 'blocks.json';
const TRANSACTIONS_FILE = 'transactions.json';

class Blockchain {
  constructor(dbName) {
    this.blocksDb = new Database('data/' + dbName + '/' + BLOCKCHAIN_FILE, new Blocks());
    this.transactionsDb = new Database(
      'data/' + dbName + '/' + TRANSACTIONS_FILE,
      new Transactions()
    );

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
    return R.find(R.propEq('index', index), this.blocks);
  }

  getBlockByHash(hash) {
    return R.find(R.propEq('hash', hash), this.blocks);
  }

  getLastBlock() {
    return R.last(this.blocks);
  }

  getDifficulty(index) {
    return Config.pow.getDifficulty(this.blocks, index);
  }

  getTransactions() {
    return this.transactions;
  }

  getTransactionById(id) {
    return R.find(R.propEq('id', id), this.transactions);
  }

  getTransactionsFromBlocks(transactionId) {
    return R.find(
      R.compose(R.find(R.propEq('id', transactionId)), R.prop('transactions')),
      this.blocks
    );
  }

  addBlock(newBlock, emit = true) {
    if (this.checkBlock(newBlock, this.getLastBlock())) {
      this.blocks.push(newBlock);
      this.blocksDb.write(this.blocks);

      this.removeBlockTransactionsFromTransactions(newBlock);

      console.info(`Block added: ${newBlock.hash}`);
      console.debug(`Block added: ${JSON.stringify(newBlock)}`);
      if (emit) this.emitter.emit('blockAdded', newBlock);

      return newBlock;
    }
  }

  checkBlock(newBlock, lastBlock, blockchainToValidate = this.blocks) {
    return true;
  }

  replaceChain(newBlockchain) {
    // It doesn't make sense to replace this blockchain by a smaller one
    if (newBlockchain.length <= this.blocks.length) {
      console.error('Blockchain shorter than the current blockchain');
      throw new BlockchainAssertionError('Blockchain shorter than the current blockchain');
    }

    // Verify if the new blockchain is correct
    this.checkChain(newBlockchain);

    // Get the blocks that diverges from our blockchain
    console.info(
      'Received blockchain is valid. Replacing current blockchain with received blockchain'
    );
    let newBlocks = R.takeLast(newBlockchain.length - this.blocks.length, newBlockchain);

    // Add each new block to the blockchain
    R.forEach((block) => {
      this.addBlock(block, false);
    }, newBlocks);

    this.emitter.emit('blockchainReplaced', newBlocks);
  }

  checkChain(blockchainToValidate) {
    // Check if the genesis block is the same
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(Block.genesis)) {
      console.error("Genesis blocks aren't the same");
      throw new BlockchainAssertionError("Genesis blocks aren't the same");
    }

    // Compare every block to the previous one (it skips the first one, because it was verified before)
    try {
      for (let i = 1; i < blockchainToValidate.length; i++) {
        this.checkBlock(blockchainToValidate[i], blockchainToValidate[i - 1], blockchainToValidate);
      }
    } catch (ex) {
      console.error('Invalid block sequence');
      throw new BlockchainAssertionError('Invalid block sequence', null, ex);
    }
    return true;
  }
}

module.exports = Blockchain;
