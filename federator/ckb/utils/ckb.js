const CKB = require('@nervosnetwork/ckb-sdk-core')
// import NetworkManager from '@common/networkManager';

const getCKB = async () => {
	//   const { nodeURL } = await NetworkManager.getCurrentNetwork();
	const nodeURL = 'https://testnet.getsynapse.io/rpc'
	return new CKB(nodeURL)
}

// export default getCKB
