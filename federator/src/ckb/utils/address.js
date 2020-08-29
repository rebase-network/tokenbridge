const crypto = require('crypto');
const EC = require('elliptic').ec;
const BN = require('bn.js');

const ec = new EC('secp256k1');

function privateToPublic(privateKey) {
  if (privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }
  return Buffer.from(ec.keyFromPrivate(privateKey).getPublic(true, 'hex'), 'hex');
};

module.exports = privateToPublic;
