const log4js = require('log4js');
const CKB = require('@nervosnetwork/ckb-sdk-core').default;

// Configurations
const config = require('../config/config.js');
const logConfig = require('../config/log-config.json');
const CkbScanner = require('./lib/ckbScanner');
log4js.configure(logConfig);

// Services
const Scheduler = require('./services/Scheduler.js');
const Federator = require('./lib/Federator.js');

const logger = log4js.getLogger('Federators');
logger.info('Kovan Host', config.mainchain.host);
logger.info('Aggron Host', config.sidechain.host);

// ckb rpc
const rpcUrl = 'https://testnet.getsynapse.io/rpc'
const ckb = new CKB(rpcUrl)
const ckbRpc = ckb.rpc

if(!config.mainchain || !config.sidechain) {
    logger.error('Mainchain and Sidechain configuration are required');
    process.exit();
}

const ckbScanner = new CkbScanner({}, log4js.getLogger('ckb'), ckbRpc);
const mainFederator = new Federator(config, log4js.getLogger('MAIN-FEDERATOR'));
const sideFederator = new Federator({
    ...config,
    mainchain: config.sidechain,
    sidechain: config.mainchain,
    storagePath: `${config.storagePath}/side-fed`
}, log4js.getLogger('SIDE-FEDERATOR'));

let pollingInterval = config.runEvery * 1000 * 60; // Minutes
let scheduler = new Scheduler(pollingInterval, logger, { run: () => run() });

scheduler.start().catch((err) => {
    logger.error('Unhandled Error on start()', err);
});

async function run() {
    try {
        // await mainFederator.run();
        await ckbScanner.scanner();
    } catch(err) {
        logger.error('Unhandled Error on run()', err);
        process.exit();
    }
}

async function exitHandler() {
    process.exit();
}

// catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

// export so we can test it
module.exports = { scheduler };
