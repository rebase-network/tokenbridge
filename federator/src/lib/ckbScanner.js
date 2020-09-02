const fs = require('fs')
const ckbUtils = require('@nervosnetwork/ckb-sdk-utils')
const { shannonToCKBFormatter } = require('../ckb/utils/formatters')

const CodeHash =
	'0x48dbf59b4c7ee1547238021b4869bceedf4eea6b43772e5d66ef8865b6ae7212'

const TEST_UDT_TYPE_HASH =
	'0x7abd58773ffee5866ffd30cd287e88f8139dd0cad5deb9e189c68b4b26bf9899'

const EMPTY_TX_HASH =
	'0x0000000000000000000000000000000000000000000000000000000000000000'

module.exports = class CkbScanner {
	constructor(config, logger, rpc) {
		this.config = config
		this.logger = logger
		this.rpc = rpc
	}

	async scanner() {
		const tipBlockNumber = await this.rpc.getTipBlockNumber()
		// const tipBN = parseInt(tipBlockNumber, 16);
		const tipBN = 401286
		this.logger.info('tipBlockNumber: ' + tipBN)

		console.log(
			/this.config.ckbBlockStoragePath/,
			this.config.ckbBlockStoragePath
		)

		if (!fs.existsSync(this.config.ckbBlockStoragePath)) {
			fs.mkdirSync(this.config.ckbBlockStoragePath)
		}
		let fromBlock = null
		try {
			fromBlock = fs.readFileSync(this.lastBlockPath, 'utf8')
		} catch (err) {
			fromBlock = this.config.mainchain.fromBlock || 0
		}
		// for (let fromBlock; fromBlock <= tipBN; fromBlock++) {
		// 	this.findCrossUDT(fromBlock)
		// 	sleep(5000)
		// }
		this.findCrossUDT(tipBN)
	}

	async findCrossUDT(blkNum) {
		const block = await this.rpc.getBlockByNumber(BigInt(blkNum))
		const txs = block.transactions
		for (const tx of txs) {
			const txHash =
				'0xb9a937ae8dba78ebd07b1eec18879f7b6662d6bd8574bb59e7edf17dabe5cd13'
			const txObj = await this.rpc.getTransaction(txHash)

			const { inputs, outputs, outputsData } = txObj.transaction

			// 1.输入的用SUDT
			let inputsSudt = []
			let inputsAmount = 0
			for (const input of inputs) {
				let inputSudt = {
					amount: 0,
					typeHash: null,
					lockHash: null,
				}

				const befTxHash = input.previousOutput.txHash

				if (befTxHash !== EMPTY_TX_HASH) {
					const befIndex = parseInt(input.previousOutput.index, 16)
					const befTransaction = (
						await this.rpc.getTransaction(befTxHash)
					).transaction

					const befInputs = befTransaction.inputs
					const befOutputs = befTransaction.outputs
					const befOutputsData = befTransaction.outputsData

					const befOutput = befOutputs[befIndex]

					const lockHash = ckbUtils.scriptToHash(befOutput.lock)
					let typeHash = null
					if (befOutput.type !== null) {
						typeHash = ckbUtils.scriptToHash(befOutput.type)
						if (TEST_UDT_TYPE_HASH === typeHash) {
							inputsAmount =
								inputsAmount +
								parseSUdtAmount(befOutputsData[befIndex])
							inputSudt = {
								amount: inputsAmount,
								typeHash: typeHash,
								lockHash: lockHash,
							}
							inputsSudt.push(inputSudt)
						}
					}
				}
			}
			this.logger.info('inputs SUDT', inputsSudt)

			// 2.输出的用SUDT
			let outpusSudt = []
			let outputsAmount = 0
			for (let index = 0; index < outputs.length; index++) {
				let outputSudt = {
					amount: 0,
					typeHash: null,
					lockHash: null,
				}

				const output = outputs[index]

				const lockHash = ckbUtils.scriptToHash(output.lock)
				let typeHash = null
				if (output.type !== null) {
					typeHash = ckbUtils.scriptToHash(output.type)
					if (TEST_UDT_TYPE_HASH === typeHash) {
						const outputData = outputsData[index]
						outputsAmount =
							outputsAmount + parseSUdtAmount(outputData)
						outputSudt = {
							amount: outputsAmount,
							typeHash: typeHash,
							lockHash: lockHash,
						}
						outpusSudt.push(outputSudt)
					}
				}
			}
			this.logger.info('outputs SUDT', outpusSudt)

			// 3. 是否销毁的判断
			let isBurning = false
			let burningAmount = 0
			if (inputsSudt.length === outpusSudt.length) {
				const inputSudt = inputsSudt[0]
				const outputSudt = outpusSudt[0]
				const inputAmount = inputSudt.amount
				const outputAmount = outputSudt.amount
				if (
					inputSudt.lockHash === outputSudt.lockHash &&
					inputSudt.typeHash === outputSudt.typeHash
				) {
					if (inputAmount > outputAmount) {
						burningAmount = inputAmount - outputAmount
					}
				}
			}
			burningAmount = shannonToCKBFormatter(burningAmount.toString())
			this.logger.info('burning SUDT Amount', burningAmount)
		}
		return null
	}
}

const parseSUdtAmount = (bigEndianHexStr) => {
	const littleEndianStr = bigEndianHexStr
		.replace('0x', '')
		.match(/../g)
		.reverse()
		.join('')
	const first128Bit = littleEndianStr.substr(16)
	return parseInt(`0x${first128Bit}`, 16)
}

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
