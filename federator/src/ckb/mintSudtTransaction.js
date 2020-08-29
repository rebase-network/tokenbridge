const _ = require('lodash')
const BN = require('bn.js')
const { addressToScript, ScriptHashType } = require('@keyper/specs')
const {
	scriptToHash,
	toHexInLittleEndian,
} = require('@nervosnetwork/ckb-sdk-utils')
const { getUnspentCells } = require('./utils/apis')
const { getDepFromLockType } = require('./utils/deps')
const { getDepFromType } = require('./utils/constants/typesInfo')
// const getCKB = require('./utils/ckb')

const CKB = require('@nervosnetwork/ckb-sdk-core').default

const SUDT_MIN_CELL_CAPACITY = 142
const CKB_TOKEN_DECIMALS = 10 ** 8

//  interface GenerateTxResult {
//   tx: CKBComponents.RawTransaction;
//   fee: string;
// }

//  interface CreateRawTxResult {
//   tx: CKBComponents.RawTransaction;
//   target: string;
// }

//  interface CkbCells {
//   cells: Cell[];
//   total: any;
// }

const getInputCKBCells = async (lockHash, params) => {
	const unspentCells = await getUnspentCells(lockHash, params)
	// Error handling
	if (unspentCells.errCode !== undefined && unspentCells.errCode !== 0) {
		return unspentCells
	}

	if (_.isEmpty(unspentCells)) {
		throw new Error('There is not available live cells')
	}

	function getTotalCapity(total, cell) {
		return BigInt(total) + BigInt(cell.capacity)
	}
	const totalCapity = unspentCells.reduce(getTotalCapity, 0)
	const inputCells = {
		cells: unspentCells,
		total: new BN(totalCapity),
	}
	return inputCells
}

const getLockScriptName = (lockScript) => {
	// let lockScriptName = null
	// if (lockScript.codeHash === ADDRESS_TYPE_CODEHASH.Secp256k1) {
	// 	lockScriptName = 'Secp256k1'
	// } else if (lockScript.codeHash === ADDRESS_TYPE_CODEHASH.Keccak256) {
	// 	lockScriptName = 'Keccak256'
	// } else if (lockScript.codeHash === ADDRESS_TYPE_CODEHASH.AnyPay) {
	// 	lockScriptName = 'AnyPay'
	// }
	return 'Secp256k1'
}

// const TestDaiTypeScript = {
// 	hashType: 'data',
// 	codeHash:'0x48dbf59b4c7ee1547238021b4869bceedf4eea6b43772e5d66ef8865b6ae7212',
// 	args: '0x0466a2e7b55dad9353271614ca3a1b6016d3c6b69e3239c6ba7e37ef1bbe0a0e',
// }

// const TestDaiTypeHash = scriptToHash(TestDaiTypeScript) // '0x7abd58773ffee5866ffd30cd287e88f8139dd0cad5deb9e189c68b4b26bf9899';

/**
 *
 * create Mint Sudt Raw transaction.
 * @
 * @param {CkbCells} inputCkbCells
 * @param {CKBComponents.Script} fromLockScript
 * @param {*} mintSudtAmount
 * @param {CKBComponents.Script} toLockScript
 * @param {CKBComponents.Script} sudtLockScript
 * @param {*} deps
 * @param {*} fee
 * @returns {CreateRawTxResult}
 */
function mintSudtRawTx(
	inputCkbCells,
	fromLockScript,
	mintSudtAmount,
	toLockScript,
	deps,
	fee
) {
	const rawTx = {
		version: '0x0',
		cellDeps: deps,
		headerDeps: [],
		inputs: [],
		outputs: [],
		witnesses: [],
		outputsData: [],
	}
	const config = {
		index: 0,
		length: -1,
	}

	// 1.input CKB
	for (let i = 0; i < inputCkbCells.cells.length; i++) {
		const element = inputCkbCells.cells[i]
		rawTx.inputs.push({
			previousOutput: element.outPoint,
			since: '0x0',
		})
		rawTx.witnesses.push('0x')
	}
	rawTx.witnesses[0] = {
		lock: '',
		inputType: '',
		outputType: '',
	}

	const toSudtCapacity = SUDT_MIN_CELL_CAPACITY * CKB_TOKEN_DECIMALS

	// 2. output | mint sudt
	const toLockHash = scriptToHash(toLockScript)
	const fromLockHash = scriptToHash(fromLockScript)
	const toSudtOutputCell = {
		capacity: `0x${new BN(toSudtCapacity).toString(16)}`,
		lock: {
			hashType: toLockScript.hashType,
			codeHash: toLockScript.codeHash,
			args: toLockScript.args,
		},
		type: {
			hashType: 'data',
			codeHash: '0x48dbf59b4c7ee1547238021b4869bceedf4eea6b43772e5d66ef8865b6ae7212',
			args: toLockHash,
		},
	}
	rawTx.outputs.push(toSudtOutputCell)
	const sUdtLeSend = toHexInLittleEndian(BigInt(mintSudtAmount), 16)
	rawTx.outputsData.push(sUdtLeSend)

	// 1. output | ckb charge
	const ckbCharge = BigInt(inputCkbCells.total) - BigInt(toSudtCapacity) - BigInt(fee)
	rawTx.outputs.push({
		capacity: `0x${new BN(ckbCharge.toString()).toString(16)}`,
		lock: {
			hashType: fromLockScript.hashType,
			codeHash: fromLockScript.codeHash,
			args: fromLockScript.args,
		},
	})
	rawTx.outputsData.push('0x')

	const signObj = {
		target: scriptToHash(fromLockScript),
		config,
		tx: rawTx,
	}
	return signObj
}

const createSudtTransaction = async (
	fromAddress,
	toAddress,
	sendSudtAmount,
	fee
) => {
	const fromLockScript = addressToScript(fromAddress)
	const fromLockHash = scriptToHash(fromLockScript)
	const params = {
		capacity: SUDT_MIN_CELL_CAPACITY * CKB_TOKEN_DECIMALS,
		hasData: 'false',
	}
	// 1. input CKB cells
	const inputCkbCells = await getInputCKBCells(fromLockHash, params)

	const toLockScript = addressToScript(toAddress)
	const fromLockScripeName = getLockScriptName(fromLockScript)
	const toLockScriptName = getLockScriptName(toLockScript)

	const deps = [
		{
			outPoint: {
				txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',
				index: '0x0',
			},
			depType: 'depGroup',
		},
		{
			outPoint: {
				txHash:'0xc1b2ae129fad7465aaa9acc9785f842ba3e6e8b8051d899defa89f5508a77958',
				index: '0x0',
			},
			depType: 'code',
		},
	]

	// const Secp256k1Dep =  [{"outPoint":{"txHash":"0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37","index":"0x0"},"depType":"depGroup"},{"outPoint":{"txHash":"0xc1b2ae129fad7465aaa9acc9785f842ba3e6e8b8051d899defa89f5508a77958","index":"0x0"},"depType":"code"}];
	// deps.push(Secp256k1Dep)
	// if (fromLockScripeName === toLockScriptName) {
	// 	const fromDepObj = await getDepFromLockType(fromLockScripeName)
	// 	deps.push(Secp256k1Dep)
	// } else {
	// 	const fromDepObj = await getDepFromLockType(fromLockScripeName)
	// 	const toDepObj = await getDepFromLockType(toLockScriptName)
	// 	deps.push(fromDepObj)
	// 	deps.push(toDepObj)
	// }
	// const sUdtDep = await getDepFromType('simpleudt')
	// deps.push(sUdtDep)

	let rawTxObj = null
	rawTxObj = mintSudtRawTx(
		inputCkbCells,
		fromLockScript,
		sendSudtAmount,
		toLockScript,
		deps,
		fee
	)
	return rawTxObj
}

//  const signSudtTransaction = async (lockHash, password, rawTxObj) => {
//   if (rawTxObj.errCode !== undefined && rawTxObj.errCode !== 0) {
//     return rawTxObj;
//   }
//   const signedTx = await signTx(lockHash, password, rawTxObj.tx, rawTxObj.config);
//   return signedTx;
// };

async function mintSudtTransaction(
	fromAddress,
	toAddress,
	mintSudtAmount,
	fee,
	privateKey
) {
	// const ckb = getCKB();
	const ckb = new CKB('https://testnet.getsynapse.io/rpc') // instantiate the JS SDK with provided node url

	const lockScript = addressToScript(fromAddress)
	const lockHash = scriptToHash(lockScript)
	const rawTxObj = await createSudtTransaction(
		fromAddress,
		toAddress,
		mintSudtAmount,
		fee
	)
	//   const signedTx = await signSudtTransaction(lockHash, password, rawTxObj);
	const rawTx = rawTxObj.tx
	console.log(/rawTx/, JSON.stringify(rawTx))

	let signedTx = null
	try {
		signedTx = ckb.signTransaction(privateKey)(rawTx, []);
	} catch (error) {
		console.error(`Failed to signed tx: ${error}`)
	}
	console.log(/signedTx/, JSON.stringify(signedTx))
	const txResultObj = {
		txHash: null,
	}
	try {
		const realTxHash = await ckb.rpc.sendTransaction(signedTx)
		console.log(/realTxHash/, realTxHash)
		txResultObj.txHash = realTxHash
	} catch (error) {
		console.error(`Failed to send tx: ${error}`)
	}
	return txResultObj
}

module.exports = mintSudtTransaction
