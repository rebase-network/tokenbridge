const fs = require('fs');

const CodeHash = "0x48dbf59b4c7ee1547238021b4869bceedf4eea6b43772e5d66ef8865b6ae7212"

module.exports = class CkbScanner {

  constructor(config, logger, rpc) {
    this.config = config;
    this.logger = logger;
    this.rpc = rpc;
  }

  async scanner(fromBlkNum) {
    const _tipBlkNum = await this.rpc.getTipBlockNumber()
    const tipBlkNum = parseInt(_tipBlkNum, 16)

    console.log(/tipBlkNum/, tipBlkNum)
    this.logger.info("tipBlkNum: " + tipBlkNum)
    let toBlkNum = fromBlkNum

    for (; toBlkNum <= tipBlkNum; toBlkNum++) {
      this.findUDT(toBlkNum)
      sleep(500)
    }

  }

  async findUDT(blkNum) {

    console.log(/blkNum/, blkNum)

    const block = await this.rpc.getBlockByNumber(BigInt(blkNum))
    const txs = block.transactions

    for (const tx of txs) {

      for (const [inx, output] of tx.outputs.entries()) {
        const typeObj = output.type

        if (typeObj) {

          if (typeObj.codeHash === CodeHash) {
            const amount = parseSUdtAmount(tx.outputsData[inx])
            const _findBlkNum = block.header.number
            const findBlkNum = parseInt(_findBlkNum, 16)

            console.log(/findBlkNum/, findBlkNum)
            console.log(/txHash/, tx.hash)
            console.log(/amount/, amount)

            this.logger.info(amount)

          }
        }
      }

    }

  }
}

const parseSUdtAmount = (bigEndianHexStr) => {
  const littleEndianStr = bigEndianHexStr.replace('0x', '').match(/../g).reverse().join('');
  const first128Bit = littleEndianStr.substr(16);
  return parseInt(`0x${first128Bit}`, 16);
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
