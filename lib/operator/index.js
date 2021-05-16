const R = require('ramda');

const Wallet = require('./wallet');
const Transaction = require('../blockchain/transaction');
const TransactionBuilder = require('./transactionBuilder');
const Db = require('../util/db');
const ArgumentError = require('../util/argumentError');
const Config = require('../config');


class Operator {
  constructor(dbName, blockchain) {
   
    // INFO: In this implementation the database is a file and every time data is saved it rewrites the file, probably it should be a more robust database for performance reasons
   
    this.blockchain = blockchain;
  }

  addWallet(wallet) {
    return wallet;
  }

  createWalletFromPassword(password) {
    let newWallet = Wallet.fromPassword(password);
    return this.addWallet(newWallet);
  }

  createWalletFromSeed(seed) {
    
    let newWallet = Wallet.fromSeed(seed);
    return this.addWallet(newWallet)
  }




  getBalanceForAddress(addressId) {
    let utxo = this.blockchain.getUnspentTransactionsForAddress(addressId);

    if (utxo == null || utxo.length == 0)
      throw new ArgumentError(`No transactions found for address '${addressId}'`);
    return R.sum(R.map(R.prop('amount'), utxo));
  }

  createTransaction(fromAddressId, toAddressId, amount, changeAddressId) {
    let utxo = this.blockchain.getUnspentTransactionsForAddress(fromAddressId);
    let tx = new TransactionBuilder();
    tx.from(utxo);
    tx.to(toAddressId, amount);
    tx.change(changeAddressId || fromAddressId);
    tx.fee(Config.FEE_PER_TRANSACTION);
    tx.sign(fromAddressId);
    return Transaction.fromJson(tx.build());
  }
}

module.exports = Operator;
