/* global artifacts */

const dappConfig = require("../test/helpers/dappConfig.js");

const IcoPoolPartyFactory = artifacts.require("./IcoPoolPartyFactory.sol");
const UrlBuilder = artifacts.require("./libraries/OraclizeQueryBuilder.sol");
const OraclizeTest = artifacts.require("./OracalizeTest.sol");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(UrlBuilder);

    deployer.link(UrlBuilder, IcoPoolPartyFactory);

    if (network == "develop" || network == "development") {
        deployer.link(UrlBuilder, OraclizeTest);
        deployer.deploy(OraclizeTest);
    }

    deployer.deploy(IcoPoolPartyFactory, accounts[0]).then(async () => {
        dappConfig.addKeyToDappConfig("IcoPoolPartyFactoryAddress", IcoPoolPartyFactory.address);
        if (network == "develop" || network == "development") {
            const factory = await IcoPoolPartyFactory.deployed();
            return factory.setDueDiligenceDuration(3, {from: accounts[0]});
        }
    });
};

