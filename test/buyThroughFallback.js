import expectThrow from './helpers/expectThrow';

const CustomSaleArtifact = artifacts.require('./test-contracts/CustomSale');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');

let customSale;
let genericToken;

contract('Custom Sale', function (accounts) {

    describe('Buy tokens through custom sale', function () {
        this.slow(5000);

        const [_deployer, _investor1, _investor2, _investor3] = accounts;

        beforeEach(async () => {
            genericToken = await genericTokenArtifact.deployed();
            customSale = await CustomSaleArtifact.deployed();
        });

        it("should buy tokens through fallback", async () => {
            smartLog("Tokens balance [" + await genericToken.balanceOf(_investor1) + "]", true);
            web3.eth.sendTransaction({from: _investor1, to: customSale.address, value: web3.toWei(1), gas: 300000 });
            smartLog("Tokens received investor [" + await genericToken.balanceOf(_investor1) + "]", true);
        });

        it("should buy tokens through buy function", async () => {
            smartLog("Tokens balance [" + await genericToken.balanceOf(_investor2) + "]", true);
            await customSale.buy({from: _investor2, value: web3.toWei("1")});
            smartLog("Tokens received [" + await genericToken.balanceOf(_investor2) + "]", true);
        });

    });

    /***********************************************************/
    /*                    HELPER FUNCTIONS                     */
    /***********************************************************/

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
