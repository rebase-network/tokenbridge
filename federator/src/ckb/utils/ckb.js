const CKB = require('@nervosnetwork/ckb-sdk-core').default;
// import NetworkManager from '@common/networkManager';

function getCKB() {
	//   const { nodeURL } = await NetworkManager.getCurrentNetwork();
	const nodeURL = 'https://testnet.getsynapse.io/rpc'
	return new CKB(nodeURL)
}

// export default getCKB
module.exports = getCKB;