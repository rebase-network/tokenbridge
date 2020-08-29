const web3 = require('web3');
const fs = require('fs');
const abiBridge = require('../../../abis/Bridge.json');
const abiFederation = require('../../../abis/Federation.json');
const TransactionSender = require('./TransactionSender.js');
const CustomError = require('./CustomError');
const utils = require('./utils');
// const privateToPublic = require('../../ckb/utils/address');
const crypto = require('crypto');
const EC = require('elliptic').ec;
const BN = require('bn.js');
const ec = new EC('secp256k1');

const { pubkeyToAddress } = require('@nervosnetwork/ckb-sdk-utils');
const mintSudtTransaction = require('../ckb/mintSudtTransaction');

module.exports = class Federator {
    constructor(config, logger, Web3 = web3) {
        this.config = config;
        this.logger = logger;

        this.mainWeb3 = new Web3(config.mainchain.host);
        this.sideWeb3 = new Web3(config.sidechain.host);

        this.mainBridgeContract = new this.mainWeb3.eth.Contract(abiBridge, this.config.mainchain.bridge);
        this.sideBridgeContract = new this.sideWeb3.eth.Contract(abiBridge, this.config.sidechain.bridge);
        this.federationContract = new this.sideWeb3.eth.Contract(abiFederation, this.config.sidechain.federation);

        this.transactionSender = new TransactionSender(this.sideWeb3, this.logger);

        this.lastBlockPath = `${config.storagePath || __dirname}/lastBlock.txt`;
    }

    async run() {
        let retries = 1;
        const sleepAfterRetrie = 3000;
        while(retries > 0) {
            try {
                const currentBlock = await this.mainWeb3.eth.getBlockNumber();
                const chainId = await this.mainWeb3.eth.net.getId();
                let confirmations = 0; //for rsk regtest and ganache
                if(chainId == 31 || chainId == 42) { // rsk testnet and kovan
                    confirmations = 10
                }
                if(chainId == 30 || chainId == 1) { // rsk mainnet and ethereum mainnet
                    confirmations = 120
                }
                const toBlock = currentBlock - confirmations;
                this.logger.info('Running to Block', toBlock);

                if (toBlock <= 0) {
                    return false;
                }

                if (!fs.existsSync(this.config.storagePath)) {
                    fs.mkdirSync(this.config.storagePath);
                }

                let fromBlock = null;
                try {
                    fromBlock = fs.readFileSync(this.lastBlockPath, 'utf8');
                } catch(err) {
                    fromBlock = this.config.mainchain.fromBlock || 0;
                }
                if(fromBlock >= toBlock){
                    this.logger.warn(`Current chain Height ${toBlock} is the same or lesser than the last block processed ${fromBlock}`);
                    return false;
                }
                fromBlock = parseInt(fromBlock)+1;
                this.logger.debug('Running from Block', fromBlock);
                
                const recordsPerPage = 1000;
                const numberOfPages = Math.ceil((toBlock - fromBlock) / recordsPerPage);
                this.logger.debug(`Total pages ${numberOfPages}, blocks per page ${recordsPerPage}`);

                var fromPageBlock = fromBlock;
                for(var currentPage = 1; currentPage <= numberOfPages; currentPage++) { 
                    var toPagedBlock = fromPageBlock + recordsPerPage-1;
                    if(currentPage == numberOfPages) {
                        toPagedBlock = toBlock
                    }
                    this.logger.debug(`Page ${currentPage} getting events from block ${fromPageBlock} to ${toPagedBlock}`);
                    const logs = await this.mainBridgeContract.getPastEvents('Cross', {
                        fromBlock: fromPageBlock,
                        toBlock: toPagedBlock
                    });
                    if (!logs) throw new Error('Failed to obtain the logs');

                    this.logger.info(`Found ${logs.length} logs`);
                    await this._processLogs(logs, toPagedBlock);
                    fromPageBlock = toPagedBlock + 1;
                }
                return true;
            } catch (err) {
                this.logger.error(new Error('Exception Running Federator'), err);
                retries--;
                this.logger.debug(`Run ${3-retries} retrie`);
                if( retries > 0) {
                    await utils.sleep(sleepAfterRetrie);
                } else {
                    process.exit();
                }
            }
        }
    }

    privateToPublic(privateKey) {
        if (privateKey.length !== 32) {
          throw new Error('Private key must be 32 bytes');
        }
        return Buffer.from(ec.keyFromPrivate(privateKey).getPublic(true, 'hex'), 'hex');
    };

    publicKeyToAddress = (publicKey, prefix) => {
        const pubkey = publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`;
        return pubkeyToAddress(pubkey, {
          prefix,
          type: "0x01",
          codeHashOrCodeHashIndex: '0x00',
        });
      };

    async _processLogs(logs, toBlock) {

        try {
            for(let log of logs) {
            
                this.logger.info('Processing event log:', log);
    
                const { _to: receiver, _amount: amount, _symbol: symbol, _tokenAddress: tokenAddress,
                    _decimals: decimals, _granularity:granularity } = log.returnValues;
                                       
                // const ckbPrivateKey = '6db47b34420e526812ff77a78e716edc50800ec2e9ec4eec769ae010edf4b016';
                // const federatorPK  = '0x82312a7eb2168e6f36401f35942062f75b17466dce7df8be484e7b9588a09d03';    
                const federatorPK  = '0xdde136f5c95a2f37cb1480c3bc3d9f18b49225fc8449e5a16a853fc0a7d4efaa';            
                // const ckbPublicKey = this.privateToPublic(Buffer.from(ckbPrivateKey, 'hex'));
                // const ckbPublicKey = this.privateToPublic(Buffer.from(ckbPrivateKey, 'hex')).toString('hex');
                // const fedPublicKey = this.privateToPublic(Buffer.from(federatorPK, 'hex')).toString('hex');
                // const fedAddres = this.publicKeyToAddress(fedPublicKey,'ckt');
                // const fedAddres = 'ckt1qyqwtq7qhg6j9hfqxnndmxyzmlamn85dhs7sjn8rsl';
                const fedAddres = 'ckt1qyqwtq7qhg6j9hfqxnndmxyzmlamn85dhs7sjn8rsl';
                console.log(/fedAddres/,fedAddres); //ckt1qyqdzyak353u6vf900t5qfmzzsr4wpx6a96s6749ne
    
                const toCKBAddress = 'ckt1qyqgadxhtq27ygrm62dqkdj32gl95j8gl56qum0yyn';
                const ckbAmount = this.mainWeb3.utils.fromWei(amount, 'ether');
                const mintResult = await mintSudtTransaction(fedAddres, fedAddres, ckbAmount * 10 ** 8, 100000 ,federatorPK);
                
                // 逻辑是不是先创建在转？？？
                console.log(/mintResult/,mintResult);
                
                this._saveProgress(this.lastBlockPath, toBlock);
                return true;
            }
        } catch (error) {
            throw new CustomError(`Exception processing logs`, err);
        }
    }

    // async _processLogs(logs, toBlock) {
    //     try {
    //         const transactionSender = new TransactionSender(this.sideWeb3, this.logger);
    //         const from = await transactionSender.getAddress(this.config.privateKey);
            
    //         for(let log of logs) {
    //             this.logger.info('Processing event log:', log);

    //             const { _to: receiver, _amount: amount, _symbol: symbol, _tokenAddress: tokenAddress,
    //                 _decimals: decimals, _granularity:granularity } = log.returnValues;

    //             let transactionId = await this.federationContract.methods.getTransactionId(
    //                 tokenAddress,
    //                 receiver,
    //                 amount,
    //                 symbol,
    //                 log.blockHash,
    //                 log.transactionHash,
    //                 log.logIndex,
    //                 decimals,
    //                 granularity
    //             ).call();
    //             this.logger.info('get transaction id:', transactionId);

    //             let wasProcessed = await this.federationContract.methods.transactionWasProcessed(transactionId).call();
    //             if (!wasProcessed) {
    //                 let hasVoted = await this.federationContract.methods.hasVoted(transactionId).call({from: from});
    //                 if(!hasVoted) {
    //                     this.logger.info(`Voting tx: ${log.transactionHash} block: ${log.blockHash} token: ${symbol}`);
    //                     await this._voteTransaction(tokenAddress,
    //                         receiver,
    //                         amount,
    //                         symbol,
    //                         log.blockHash,
    //                         log.transactionHash,
    //                         log.logIndex,
    //                         decimals,
    //                         granularity);
    //                 } else {
    //                     this.logger.debug(`Block: ${log.blockHash} Tx: ${log.transactionHash} token: ${symbol}  has already been voted by us`);
    //                 }
                    
    //             } else {
    //                 this.logger.debug(`Block: ${log.blockHash} Tx: ${log.transactionHash} token: ${symbol} was already processed`);
    //             }
    //         }
    //         this._saveProgress(this.lastBlockPath, toBlock);

    //         return true;
    //     } catch (err) {
    //         throw new CustomError(`Exception processing logs`, err);
    //     }
    // }

    async _voteTransaction(tokenAddress, receiver, amount, symbol, blockHash, transactionHash, logIndex, decimals, granularity) {
        try {

            const transactionSender = new TransactionSender(this.sideWeb3, this.logger);
            this.logger.info(`Voting Transfer ${amount} of ${symbol} trough sidechain bridge ${this.sideBridgeContract.options.address} to receiver ${receiver}`);
            
            let txId = await this.federationContract.methods.getTransactionId(
                tokenAddress,
                receiver,
                amount,
                symbol,
                blockHash,
                transactionHash,
                logIndex,
                decimals,
                granularity
            ).call();
            
            let txData = await this.federationContract.methods.voteTransaction(
                tokenAddress,
                receiver,
                amount,
                symbol,
                blockHash,
                transactionHash,
                logIndex,
                decimals,
                granularity
            ).encodeABI();

            this.logger.info(`voteTransaction(${tokenAddress}, ${receiver}, ${amount}, ${symbol}, ${blockHash}, ${transactionHash}, ${logIndex}, ${decimals}, ${granularity})`);
            await transactionSender.sendTransaction(this.federationContract.options.address, txData, 0, this.config.privateKey);
            this.logger.info(`Voted transaction:${transactionHash} of block: ${blockHash} token ${symbol} to Federation Contract with TransactionId:${txId}`);
            return true;
        } catch (err) {
            throw new CustomError(`Exception Voting tx:${transactionHash} block: ${blockHash} token ${symbol}`, err);
        }
    }

    _saveProgress (path, value) {
        if (value) {
            fs.writeFileSync(path, value);
        }
    }
}
