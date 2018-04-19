import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    customSaleArtifact,
    genericTokenArtifact,
} from './helpers/utils';

let customSale;
let genericToken;

contract('Custom Sale', function (accounts) {

    describe('Buy tokens through custom sale', function () {
        this.slow(5000);

        const [_deployer, _investor1, _investor2, _investor3] = accounts;

        beforeEach(async () => {
            smartLog("Test - " + web3.sha3(1), true);
            smartLog("Test - " + web3.sha3("2123"), true);
            genericToken = await genericTokenArtifact.deployed();
            customSale = await customSaleArtifact.deployed();
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

        it("should withdraw funds", async () => {
            smartLog("Tokens balance [" + await genericToken.balanceOf(_investor2) + "]", true);
            await customSale.buy({from: _investor2, value: web3.toWei("1")});
            smartLog("Tokens received [" + await genericToken.balanceOf(_investor2) + "]", true);

            await customSale.buy({from: _investor1, value: web3.toWei("20")});
            smartLog("Sale balance [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]", true);
            smartLog("Deployer balance [" + web3.fromWei((web3.eth.getBalance(_deployer))) + "]", true);
            await expectThrow(customSale.withdrawFunds({from: _investor2}));
            await customSale.withdrawFunds({from: _deployer});
            smartLog("Sale balance [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]", true);
            smartLog("Deployer balance [" + web3.fromWei((web3.eth.getBalance(_deployer))) + "]", true);
        });


    });
});
