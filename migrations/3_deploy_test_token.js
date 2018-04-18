/* global artifacts */
const dappConfig = require("../test/helpers/dappConfig.js");
const fs = require('fs');

const CustomSale = artifacts.require("CustomSale");
const GenericToken = artifacts.require("GenericToken");
const MokenNameService = artifacts.require("MockNameService");

module.exports = function (deployer, network, accounts) {
    const config = JSON.parse(fs.readFileSync('./config/deploymentConfig.json'));

    if (config.testContract.deployTestContracts) {
        deployer.deploy(GenericToken).then(function () {
            return deployer.deploy(CustomSale, web3.toWei("0.05"), GenericToken.address).then(async () => {
                const _token = await GenericToken.deployed();
                const _sale = await CustomSale.deployed();
                dappConfig.addKeyToDappConfig("GenericTokenAddress", _token.address);
                dappConfig.addKeyToDappConfig("CustomSaleAddress", _sale.address);
                return _token.transferOwnership(_sale.address, {from: accounts[0]});
            });
        });
    }
};
