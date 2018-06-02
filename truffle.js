let HDWalletProvider = require("truffle-hdwallet-provider");
require('babel-register');
require('babel-polyfill');
require('dotenv').config();

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*" // match any network
        },
        ganache: {
            host: "localhost",
            port: 9545,
            network_id: "5777"
        },
        mainnet: {
            provider: function () {
                return new HDWalletProvider(process.env.MAINNET_MNEMONIC, "https://mainnet.infura.io/" + process.env.INFURA_API_KEY);
            },
            gas: 6000000,
            gasPrice: 18000000000,
            network_id: "1"
        },
        ropsten: {
            provider: function () {
                return new HDWalletProvider(process.env.ROPSTEN_MNEMONIC, "https://ropsten.infura.io/" + process.env.INFURA_API_KEY);
            },
            gas: 6000000,
            gasPrice: 18000000000,
            network_id: "3"
        },
        rinkeby: {
            provider: function () {
                return new HDWalletProvider(process.env.RINKEBY_MNEMONIC, "https://rinkeby.infura.io/" + process.env.INFURA_API_KEY, 0);
            },
            gas: 6000000,
            gasPrice: 18000000000,
            network_id: "4"
        }
    },

    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};
