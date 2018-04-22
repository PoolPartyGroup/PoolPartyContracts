/* global artifacts */
const dappConfig = require("../test/helpers/dappConfig.js");
const fs = require('fs');

const IcoPoolPartyFactory = artifacts.require("PoolPartyFactory");
const NameService = artifacts.require("PoolPartyNameService");
const MockNameService = artifacts.require("MockNameService");

module.exports = function (deployer, network, accounts) {
    const config = JSON.parse(fs.readFileSync('./config/deploymentConfig.json'));

    if (config.nameService.deployNameService) {
        deployer.deploy(NameService).then(function () {
            return deployer.deploy(IcoPoolPartyFactory, accounts[0], NameService.address).then(async () => {
                dappConfig.addKeyToDappConfig("PoolPartyNameService", NameService.address);
                dappConfig.addKeyToDappConfig("IcoPoolPartyFactoryAddress", IcoPoolPartyFactory.address);
            });
        });
    } else if (config.nameService.deployMockService) {
        deployer.deploy(MockNameService).then(function () {
            return deployer.deploy(IcoPoolPartyFactory, accounts[0], MockNameService.address).then(async () => {
                dappConfig.addKeyToDappConfig("PoolPartyNameService", MockNameService.address);
                dappConfig.addKeyToDappConfig("IcoPoolPartyFactoryAddress", IcoPoolPartyFactory.address);
            });
        });
    } else {
        deployer.deploy(IcoPoolPartyFactory, accounts[0], config.nameService.address).then(async () => {
            dappConfig.addKeyToDappConfig("PoolPartyNameService", config.nameService.address);
            dappConfig.addKeyToDappConfig("IcoPoolPartyFactoryAddress", IcoPoolPartyFactory.address);
        });
    }
};