const R = require('ramda');
const ec = require("elliptic").ec
const EC = new ec('secp256k1');
const bs58 = require('bs58')
const bcjs = require('bitcoinjs-lib')
class Wallet {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.address = null;
  }

  generateKeyPair() {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    this.privateKey = privateKey.toString(16);
    const key = EC.keyFromPrivate(privateKey, 'hex');
   
    this.publicKey = key.getPublic().encode('hex');
    
    const { address } = bcjs.payments.p2pkh({ pubkey: new Buffer( this.publicKey, 'hex') });

    this.address = address;

  }

  static getAddressByPrivateKey(privateKey) {
    const key = EC.keyFromPrivate(privateKey, 'hex');
   
    const publicKey = key.getPublic().encode('hex');
    
    const { address } = bcjs.payments.p2pkh({ pubkey: new Buffer(publicKey, 'hex') });

    return address
  
  }
}

module.exports = Wallet;
