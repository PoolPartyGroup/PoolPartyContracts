const fs = require("fs");
const poolPartyFactoryConfig = JSON.parse(fs.readFileSync("../build/contracts/IcoPoolPartyFactory.json"));
const poolPartyConfig = JSON.parse(fs.readFileSync("../build/contracts/IcoPoolParty.json"));
const nameServiceConfig = JSON.parse(fs.readFileSync("../build/contracts/PoolPartyNameService.json"));
const mockNameServiceConfig = JSON.parse(fs.readFileSync("../build/contracts/MockNameService.json"));

let configObj = {"PoolPartyFactoryAbi": poolPartyFactoryConfig.abi, "PoolPartyAbi": poolPartyConfig.abi, "PoolPartyNameServiceAbi": nameServiceConfig.abi, "MockNameServiceAbi": mockNameServiceConfig.abi};

const dappConfig = {
    addKeyToDappConfig: async (_key, _value) => {
        configObj[_key] = _value;
        fs.writeFileSync("./build/contract-config.js", "var contractConfig = " + JSON.stringify(configObj) + ";");
    }
};

module.exports = dappConfig;