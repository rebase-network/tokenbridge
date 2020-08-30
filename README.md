# CKB <-> ETH Token Bridge

This token bridge is a hackathon project, so it has very limited feature:
1. Only support a fixed federator, ckb user and eth user to use
2. Only support cross token from Ethereum to CKB


## How to run federator

```bash
cd federator
npm i
cp config/config.sample.js config/config.js
npm run start
```

Then waiting for `Cross` logs from Ethereum.

## How to interact with token bridge

Interact it with frontend app: https://github.com/rebase-network/tokenbridge-frontend
