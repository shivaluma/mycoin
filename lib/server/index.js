const express = require('express');
const R = require('ramda');
const compresson = require('compression');
const Block = require('../blockchain/block');
const Transaction = require('../blockchain/transaction');
const TransactionAssertionError = require('../blockchain/transactionAssert');
const BlockAssertionError = require('../blockchain/blockAssert');
const HTTPError = require('./httpError');
const ArgumentError = require('../util/argumentError');
const CryptoUtil = require('../util/cryptoUtil');
const timeago = require('timeago.js');
const Wallet = require('../operator/wallet');
const cors = require('cors')
class HttpServer {
  constructor(node, blockchain, operator, miner) {
    this.app = express();

    
    this.app.use(express.json());
    this.app.use(compresson());
    this.app.use(cors())
    this.app.locals.formatters = {
      time: (rawTime) => {
        const timeInMS = new Date(rawTime * 1000);
        return `${timeInMS.toLocaleString()} - ${timeago().format(timeInMS)}`;
      },
      hash: (hashString) => {
        return hashString != '0'
          ? `${hashString.substr(0, 5)}...${hashString.substr(hashString.length - 5, 5)}`
          : '<empty>';
      },
      amount: (amount) => amount.toLocaleString(),
    };

    // this.app.get('/blockchain', (req, res) => {
    //   if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
    //     res.render('blockchain/index.pug', {
    //       pageTitle: 'Blockchain',
    //       blocks: blockchain.getAllBlocks(),
    //     });
    //   else throw new HTTPError(400, 'Accept content not supported');
    // });

    this.app.get('/blockchain/blocks', (req, res) => {
      res.status(200).send(blockchain.getAllBlocks());
    });

    this.app.get('/blockchain/blocks/latest', (req, res) => {
      let lastBlock = blockchain.getLastBlock();
      if (lastBlock == null) throw new HTTPError(404, 'Last block not found');

      res.status(200).send(lastBlock);
    });

    this.app.put('/blockchain/blocks/latest', (req, res) => {
      let requestBlock = Block.fromJson(req.body);
      let result = node.checkReceivedBlock(requestBlock);

      if (result == null) res.status(200).send('Requesting the blockchain to check.');
      else if (result) res.status(200).send(requestBlock);
      else throw new HTTPError(409, 'Blockchain is update.');
    });

    this.app.get('/blockchain/blocks/:hash([a-zA-Z0-9]{64})', (req, res) => {
      let blockFound = blockchain.getBlockByHash(req.params.hash);
      if (blockFound == null)
        throw new HTTPError(404, `Block not found with hash '${req.params.hash}'`);

      res.status(200).send(blockFound);
    });

    this.app.get('/blockchain/blocks/:index', (req, res) => {
      let blockFound = blockchain.getBlockByIndex(parseInt(req.params.index));
      if (blockFound == null)
        throw new HTTPError(404, `Block not found with index '${req.params.index}'`);

      res.status(200).send(blockFound);
    });

    this.app.get('/blockchain/blocks/transactions/:transactionId([a-zA-Z0-9]{64})', (req, res) => {
      let transactionFromBlock = blockchain.getTransactionFromBlocks(req.params.transactionId);
      if (transactionFromBlock == null)
        throw new HTTPError(
          404,
          `Transaction '${req.params.transactionId}' not found in any block`
        );

      res.status(200).send(transactionFromBlock);
    });

   

    this.app.post('/blockchain/transactions', (req, res) => {
      let requestTransaction = Transaction.fromJson(req.body);
      let transactionFound = blockchain.getTransactionById(requestTransaction.id);

      if (transactionFound != null)
        throw new HTTPError(409, `Transaction '${requestTransaction.id}' already exists`);

      try {
        let newTransaction = blockchain.addTransaction(requestTransaction);
        res.status(201).send(newTransaction);
      } catch (ex) {
        if (ex instanceof TransactionAssertionError)
          throw new HTTPError(400, ex.message, requestTransaction, ex);
        else throw ex;
      }
    });


    this.app.get('/blockchain/transactions', (req, res) => {
      res.status(200).send(blockchain.getAllTransactions());
    });


    this.app.get('/blockchain/transactions/unspent', (req, res) => {
      res.status(200).send(blockchain.getUnspentTransactionsForAddress(req.query.address));
    });

   

    this.app.post('/operator/wallet', (req, res) => {
      let newWallet = new Wallet()

      newWallet.generateKeyPair()

      return res.status(201).send(newWallet);
    });

    this.app.get('/operator/wallets/:privateKey', (req, res) => {
      let walletFound = Wallet.getAddressByPrivateKey(req.params.privateKey);
      if (walletFound == null)
        throw new HTTPError(404, `Wallet not found with id '${req.params.walletId}'`);

     

      res.status(200).send(walletFound);
    });

    this.app.post('/operator/wallets/transactions', (req, res) => {
      try {
        let newTransaction = operator.createTransaction(
          req.body.fromAddress,
          req.body.toAddress,
          req.body.amount,
          req.body['changeAddress'] || req.body.fromAddress
        );

        newTransaction.check();

        let transactionCreated = blockchain.addTransaction(Transaction.fromJson(newTransaction));
        res.status(201).send(transactionCreated);
      } catch (ex) {
        if (ex instanceof ArgumentError || ex instanceof TransactionAssertionError)
          throw new HTTPError(400, ex.message, ex);
        else throw ex;
      }
    });

    // this.app.get('/operator/wallets/:walletId/addresses', (req, res) => {
    //   let walletId = req.params.walletId;
    //   try {
    //     let addresses = operator.getAddressesForWallet(walletId);
    //     res.status(200).send(addresses);
    //   } catch (ex) {
    //     if (ex instanceof ArgumentError) throw new HTTPError(400, ex.message, walletId, ex);
    //     else throw ex;
    //   }
    // });

    // this.app.post('/operator/wallets/:walletId/addresses', (req, res) => {
    //   let walletId = req.params.walletId;
    //   let password = req.headers.password;

    //   if (password == null) throw new HTTPError(401, "Wallet's password is missing.");
    //   let passwordHash = CryptoUtil.hash(password);

    //   try {
    //     if (!operator.checkWalletPassword(walletId, passwordHash))
    //       throw new HTTPError(403, `Invalid password for wallet '${walletId}'`);

    //     let newAddress = operator.generateAddressForWallet(walletId);
    //     res.status(201).send({ address: newAddress });
    //   } catch (ex) {
    //     if (ex instanceof ArgumentError) throw new HTTPError(400, ex.message, walletId, ex);
    //     else throw ex;
    //   }
    // });

    this.app.get('/operator/:addressId/balance', (req, res) => {
      let addressId = req.params.addressId;

      try {
        let balance = operator.getBalanceForAddress(addressId);
        res.status(200).send({ balance: balance });
      } catch (ex) {
        if (ex instanceof ArgumentError) throw new HTTPError(404, ex.message, { addressId }, ex);
        else throw ex;
      }
    });

    this.app.get('/node/peers', (req, res) => {
      res.status(200).send(node.peers);
    });

    this.app.post('/node/peers', (req, res) => {
      let newPeer = node.connectToPeer(req.body);
      res.status(201).send(newPeer);
    });

    this.app.get('/node/transactions/:transactionId([a-zA-Z0-9]{64})/confirmations', (req, res) => {
      node.getConfirmations(req.params.transactionId).then((confirmations) => {
        res.status(200).send({ confirmations: confirmations });
      });
    });

    this.app.post('/miner/mine', (req, res, next) => {
      miner
        .mine(req.body.rewardAddress, req.body['feeAddress'] || req.body.rewardAddress)
        .then((newBlock) => {
          newBlock = Block.fromJson(newBlock);
          blockchain.addBlock(newBlock);
          res.status(201).send(newBlock);
        })
        .catch((ex) => {
          if (ex instanceof BlockAssertionError && ex.message.includes('Invalid index'))
            next(
              new HTTPError(409, 'A new block were added before we were able to mine one'),
              null,
              ex
            );
          else next(ex);
        });
    });

    this.app.use(function (err, req, res, next) {
      // eslint-disable-line no-unused-vars
      if (err instanceof HTTPError) res.status(err.status);
      else res.status(500);
      res.send(err.message + (err.cause ? ' - ' + err.cause.message : ''));
    });
  }

  listen(host, port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, (err) => {
        if (err) reject(err);
        console.info(
          `Listening http on port: ${
            this.server.address().port
          }`
        );
        resolve(this);
      });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        console.info('Closing http');
        resolve(this);
      });
    });
  }
}

module.exports = HttpServer;
