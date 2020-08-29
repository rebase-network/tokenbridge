const Axios = require('axios') 
const { scriptToHash } = require('@nervosnetwork/ckb-sdk-utils')

const cacheURL = 'https://testnet.getsynapse.io/api'

// Add a response interceptor
Axios.interceptors.response.use(
	(response) => {
		// console.log('response', response);
		// Do something with response data
		// const result = response.data;
		// if (result.errCode !== 0) {
		//   console.log(/axios result error/, JSON.stringify(result));
		// }
		return response.data
	},
	(error) => {
		// Do something with response error
		console.log('Axios error: ', error)
		// return Promise.reject(error);
		throw error
	}
)

 const getAddressInfo = async (lockHash) => {
	try {
		const result = await Axios.get(`${cacheURL}/locks/${lockHash}/capacity`)
		if (result.errCode !== 0) {
			return result
		}
		return result.data
	} catch (error) {
		console.log('result error', error)
		return error
	}
}

//  interface UnspentCellsParams {
// 	//   lockHash: string;
// 	limit?: string
// 	typeHash?: string
// 	capacity?: string
// 	hasData?: string
// }

// https://github.com/rebase-network/ckb-cache-layer/blob/master/doc.md
 const getUnspentCells = async (
	lockHash,
	{ limit, typeHash, capacity, hasData }
) => {
	const params = {
        lockHash,
        limit: 20,
		hasData,
	}
	try {
		const result = await Axios.get(`${cacheURL}/locks/${lockHash}/cells/unspent`,{params})
		if (result.errCode !== 0) {
			return result
		}
		return result.data
	} catch (error) {
		console.error('result error', error)
		return error
	}
}

 const getTxHistories = async (lockHash) => {
	const url = `${cacheURL}/locks/${lockHash}/txs`
	const result = await Axios.get(url)

	return result.data
}

// interface TLockAndTypeScripts {
// 	lockHash: string
// 	typeScripts?: CKBComponents.Script[]
// }

 const getUDTsByLockHash = async (params) => {
	const { lockHash } = params
	const pTypeScripts = params.typeScripts
	const typeHashes = []
	if (pTypeScripts !== undefined) {
		for (let i = 0; i < pTypeScripts.length; i++) {
			const typeScript = pTypeScripts[i]
			const typeHash = scriptToHash(typeScript)
			typeHashes.join(typeHash)
		}
	}
	let url = `${cacheURL}/locks/${lockHash}/tokens`

	for (let index = 0; index < typeHashes.length; index++) {
		url += `${typeHashes}`
	}
	const result = await Axios.get(url)
	return result.data
}

 const getUnspentCapacity = async (lockHash) => {
	try {
		const result = await Axios.get(`${cacheURL}/locks/${lockHash}/capacity`)
		if (result.errCode !== 0) {
			return result
		}
		return result.data.emptyCapacity
	} catch (error) {
		return error
	}
}

module.exports = {
    getUnspentCapacity,
    getUDTsByLockHash,
    getTxHistories,
    getUnspentCells,
    getAddressInfo
}