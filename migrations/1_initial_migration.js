var Migrations = artifacts.require("./Migrations.sol");
const dappConfig = require("../test/helpers/dappConfig.js");

module.exports = function (deployer, network) {
    dappConfig.addKeyToDappConfig("Network", network);
    deployer.deploy(Migrations);
};
