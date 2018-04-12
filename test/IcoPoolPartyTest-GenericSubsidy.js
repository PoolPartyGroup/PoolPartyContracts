import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    Contributions,
    KickReason,
    InvestorStruct,
    genericTokenArtifact,
    customSaleArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact
} from './helpers/utils';

let icoPoolPartyFactory;
let icoPoolParty;
let customSale;
let genericToken;

contract('Generic Pool Party ICO', function (accounts) {

    describe('Generic Sale', function () {
        this.slow(5000);

        const [_deployer, _investor1, _investor2, _investor3] = accounts;

        before(async () => {
            icoPoolPartyFactory = await poolPartyFactoryArtifact.deployed();
            smartLog("Pool Party Factory Address [" + await icoPoolPartyFactory.address + "]");
            await icoPoolPartyFactory.setDueDiligenceDuration(3);
            genericToken = await genericTokenArtifact.deployed();
            customSale = await customSaleArtifact.deployed();
        });

        it("should create new Pool Party", async () => {
            await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _deployer});
            const poolAddress = await icoPoolPartyFactory.partyList(0);
            icoPoolParty = poolPartyArtifact.at(poolAddress);

            /* Try create another pool with a name that already exists */
            await expectThrow(icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io"));
        });

        it("should add funds to pool", async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("6", "ether")});

            let investmentAmount = (await icoPoolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            let totalInvested = await icoPoolParty.totalPoolInvestments();
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await icoPoolParty.leavePool({from: _investor1});
            let investmentAmount = (await icoPoolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            assert.equal(investmentAmount, 0, "Incorrect balance");

            let totalInvested = await icoPoolParty.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should add more funds to pool", async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("6.03123123", "ether")});
            let investmentAmount = (await icoPoolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            let totalInvested = await icoPoolParty.totalPoolInvestments();

            assert.equal(investmentAmount, web3.toWei("6.03123123", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6.03123123", "ether"), "Incorrect total");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("9", "ether")});
            let investmentAmount2 = (await icoPoolParty.investors(_investor2))[InvestorStruct.investmentAmount];
            totalInvested = await icoPoolParty.totalPoolInvestments();

            assert.equal(investmentAmount2, web3.toWei("9", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("15.03123123", "ether"), "Incorrect total");
        });

        //LEGIT SKIP
        it.skip("should configure pool using actual oraclize call", async () => {
            await icoPoolParty.addFundsToPool({from: accounts[2], value: web3.toWei("1", "ether")});
            const poolState = await icoPoolParty.poolStatus();
            smartLog("Pool State is [" + poolState + "]");
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await icoPoolParty.configurePool({from: accounts[0], value: web3.toWei("0.5")});

            await sleep(100000);
            const poolDetails = await icoPoolParty.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
        });

        it("should configure pool quickly", async () => {
            const poolState = await icoPoolParty.poolStatus();
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await icoPoolParty.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
            const poolDetails = await icoPoolParty.getPoolDetails();
            smartLog("Pool details [" + poolDetails + "]");
            const configDetails = await icoPoolParty.getConfigDetails();
            smartLog("Config details [" + configDetails + "]");
        });

        it("should configure pool details", async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");
            //await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("1")});
        });

        it("should complete configuration", async () => {
            await icoPoolParty.completeConfiguration({from: accounts[7]});
            const poolState = await icoPoolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        });

        /*it.skip("Should kick user", async () => {
            //Expect throw because of wrong state
            await expectThrow(icoPoolParty.kickUser(_investor3, KickReason.Other, {from: accounts[7]}));
            await sleep(3000);
            await icoPoolParty.kickUser(_investor3, KickReason.Other, {from: accounts[7]});
            smartLog("Account 3 eth after being kicked [" + web3.fromWei((await icoPoolParty.investors(_investor3))[InvestorStruct.investmentAmount]) + "]");
            assert.equal((await icoPoolParty.investors(_investor3))[InvestorStruct.investmentAmount], 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            //assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("11.03123123", "ether"), "Total investments should be 11 eth");
        });*/

        it("Should release funds to ICO", async () => {
            await sleep(3500);

            await icoPoolParty.startInReviewPeriod({from: accounts[7]});

            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");
            const poolState = await icoPoolParty.poolStatus();
            smartLog("Pool State should be 3 [" + poolState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            //smartLog("Hashed Buy FN Name [" + await icoPoolParty.hashedBuyFunctionName() + "]");

            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            const feePercent = await icoPoolParty.feePercentage();
            const total = await icoPoolParty.totalPoolInvestments();
            const fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(icoPoolParty.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await icoPoolParty.releaseFundsToSale({
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");

            const tokensDue0 = (await icoPoolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");

        });

        it("Should claim tokens from ICO", async () => {
            smartLog("Tokens Received [" + await icoPoolParty.poolTokenBalance() + "]");
            smartLog("Pool Party token balance [" + await genericToken.balanceOf(icoPoolParty.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            const tokensDue0 = (await icoPoolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");

            const tokensDue1 = (await icoPoolParty.getContributionsDue(_investor2))[Contributions.tokensDue];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Token Decimals [" + await genericToken.decimals() + "]");
            smartLog("Total tokens received from sale [" + await icoPoolParty.poolTokenBalance() + "]");
            smartLog("Account 0 eth investment [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.investmentAmount]) + "]");

            await icoPoolParty.claimTokens({from: _investor1});
            smartLog("Account 0 token balance [" + await genericToken.balanceOf(_investor1) + "]");
            assert.isAbove(await genericToken.balanceOf(_investor1), 0, "Token balance must be greater than 0");

            await icoPoolParty.claimTokens({from: _investor2});
            smartLog("Account 1 token balance [" + await genericToken.balanceOf(_investor2) + "]");
            assert.isAbove(await genericToken.balanceOf(_investor2), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance after everyone claims [" + await genericToken.balanceOf(icoPoolParty.address) + "]");

            smartLog("Account 0 has [" + (await icoPoolParty.getContributionsDue(_investor1))[Contributions.tokensDue] + "] tokens due after claim");
            smartLog("Account 1 has [" + (await icoPoolParty.getContributionsDue(_investor2))[Contributions.tokensDue] + "] tokens due after claim");

            smartLog("Account 0 Contribution percentage [" + (await icoPoolParty.investors(_investor1))[InvestorStruct.percentageContribution] + "]");
            smartLog("Account 1 Contribution percentage [" + (await icoPoolParty.investors(_investor2))[InvestorStruct.percentageContribution] + "]");

            smartLog("Balance remaining Snapshot [" + web3.fromWei(await icoPoolParty.balanceRemainingSnapshot()) + "]");

            smartLog("Account 0 amount back [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 1 amount back [" + web3.fromWei((await icoPoolParty.investors(_investor2))[InvestorStruct.refundAmount]) + "]");
        });

        it("should claim refund after successful sale", async () => {
            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_investor1)) + "]");

            await icoPoolParty.claimRefund({from:_investor1});

            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_investor1)) + "]");

            //Can't claim again
            await expectThrow(icoPoolParty.claimRefund({from: _investor1}));
            //smartLog("Account 1 Contribution percentage [" + (await icoPoolParty.investors(_investor2))[InvestorStruct.percentageContribution] + "]");

        });
    });
});
