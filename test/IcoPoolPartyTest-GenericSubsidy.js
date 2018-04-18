import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    Contributions,
    KickReason,
    DUE_DILIGENCE_DURATION,
    InvestorStruct,
    genericTokenArtifact,
    customSaleArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './helpers/utils';

let poolPartyFactory;
let poolParty;
let customSale;
let genericToken;
let mockNameService;

contract('Generic Pool Party ICO', function (accounts) {

    describe('Generic Sale', function () {
        this.slow(5000);

        const [_deployer, _investor1, _investor2, _investor3] = accounts;

        before(async () => {
            mockNameService = await mockNameServiceArtifact.new();
            await mockNameService.__callback(web3.sha3("api.test.foreground.io"), accounts[7].toString(), 0x42);

            poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
            smartLog("Pool Party Factory Address [" + await poolPartyFactory.address + "]");
            await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
            genericToken = await genericTokenArtifact.deployed();
            customSale = await customSaleArtifact.deployed();
        });

        it("should create new Pool Party", async () => {
            await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), {from: _deployer});
            const poolAddress = await poolPartyFactory.partyList(0);
            poolParty = poolPartyArtifact.at(poolAddress);

            /* Try create another pool with a name that already exists */
            await expectThrow(poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15")));
        });

        it("should add funds to pool", async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("6", "ether")});

            let investmentAmount = (await poolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            let totalInvested = await poolParty.totalPoolInvestments();
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await poolParty.leavePool({from: _investor1});
            let investmentAmount = (await poolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            assert.equal(investmentAmount, 0, "Incorrect balance");

            let totalInvested = await poolParty.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should add more funds to pool", async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("6.03123123", "ether")});
            let investmentAmount = (await poolParty.investors(_investor1))[InvestorStruct.investmentAmount];
            let totalInvested = await poolParty.totalPoolInvestments();

            assert.equal(investmentAmount, web3.toWei("6.03123123", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6.03123123", "ether"), "Incorrect total");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("9", "ether")});
            let investmentAmount2 = (await poolParty.investors(_investor2))[InvestorStruct.investmentAmount];
            totalInvested = await poolParty.totalPoolInvestments();

            assert.equal(investmentAmount2, web3.toWei("9", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("15.03123123", "ether"), "Incorrect total");
        });

        it("should configure pool", async () => {
            const poolState = await poolParty.poolStatus();
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await poolParty.setAuthorizedConfigurationAddress({from: accounts[0]});
            const poolDetails = await poolParty.getPoolDetails();
            smartLog("Pool details [" + poolDetails + "]");
            const configDetails = await poolParty.getConfigDetails();
            smartLog("Config details [" + configDetails + "]");
        });

        it("should configure pool details", async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await poolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");
            //await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("1")});
        });

        it("should complete configuration", async () => {
            await poolParty.completeConfiguration({from: accounts[7]});
            const poolState = await poolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        });

        /*it.skip("Should kick user", async () => {
            //Expect throw because of wrong state
            await expectThrow(poolParty.kickUser(_investor3, KickReason.Other, {from: accounts[7]}));
            await sleep(3000);
            await poolParty.kickUser(_investor3, KickReason.Other, {from: accounts[7]});
            smartLog("Account 3 eth after being kicked [" + web3.fromWei((await poolParty.investors(_investor3))[InvestorStruct.investmentAmount]) + "]");
            assert.equal((await poolParty.investors(_investor3))[InvestorStruct.investmentAmount], 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "]");
            //assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("11.03123123", "ether"), "Total investments should be 11 eth");
        });*/

        it("Should release funds to ICO", async () => {
            await sleep(3500);

            await poolParty.startInReviewPeriod({from: accounts[7]});

            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
            const poolState = await poolParty.poolStatus();
            smartLog("Pool State should be 3 [" + poolState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "]");
            //smartLog("Hashed Buy FN Name [" + await poolParty.hashedBuyFunctionName() + "]");

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            const feePercent = await poolParty.feePercentage();
            const total = await poolParty.totalPoolInvestments();
            const fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(poolParty.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await poolParty.releaseFundsToSale({
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");

            const tokensDue0 = (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");

        });

        it("Should claim tokens from ICO", async () => {
            smartLog("Tokens Received [" + await poolParty.poolTokenBalance() + "]");
            smartLog("Pool Party token balance [" + await genericToken.balanceOf(poolParty.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            const tokensDue0 = (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");

            const tokensDue1 = (await poolParty.getContributionsDue(_investor2))[Contributions.tokensDue];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Token Decimals [" + await genericToken.decimals() + "]");
            smartLog("Total tokens received from sale [" + await poolParty.poolTokenBalance() + "]");
            smartLog("Account 0 eth investment [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.investmentAmount]) + "]");

            await poolParty.claimTokens({from: _investor1});
            smartLog("Account 0 token balance [" + await genericToken.balanceOf(_investor1) + "]");
            assert.isAbove(await genericToken.balanceOf(_investor1), 0, "Token balance must be greater than 0");

            await poolParty.claimTokens({from: _investor2});
            smartLog("Account 1 token balance [" + await genericToken.balanceOf(_investor2) + "]");
            assert.isAbove(await genericToken.balanceOf(_investor2), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance after everyone claims [" + await genericToken.balanceOf(poolParty.address) + "]");

            smartLog("Account 0 has [" + (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue] + "] tokens due after claim");
            smartLog("Account 1 has [" + (await poolParty.getContributionsDue(_investor2))[Contributions.tokensDue] + "] tokens due after claim");

            smartLog("Account 0 Contribution percentage [" + (await poolParty.investors(_investor1))[InvestorStruct.percentageContribution] + "]");
            smartLog("Account 1 Contribution percentage [" + (await poolParty.investors(_investor2))[InvestorStruct.percentageContribution] + "]");

            smartLog("Balance remaining Snapshot [" + web3.fromWei(await poolParty.balanceRemainingSnapshot()) + "]");

            smartLog("Account 0 amount back [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 1 amount back [" + web3.fromWei((await poolParty.investors(_investor2))[InvestorStruct.refundAmount]) + "]");
        });

        it("should claim refund after successful sale", async () => {
            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_investor1)) + "]");

            await poolParty.claimRefund({from:_investor1});

            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await poolParty.investors(_investor1))[InvestorStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_investor1)) + "]");

            //Can't claim again
            await expectThrow(poolParty.claimRefund({from: _investor1}));
            //smartLog("Account 1 Contribution percentage [" + (await poolParty.investors(_investor2))[InvestorStruct.percentageContribution] + "]");

        });
    });
});
