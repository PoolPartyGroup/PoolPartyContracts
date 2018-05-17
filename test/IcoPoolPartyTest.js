import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    Contributions,
    DUE_DILIGENCE_DURATION,
    KickReason,
    ParticipantStruct,
    dealTokenArtifact,
    foregroundTokenSaleArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './helpers/utils';

let poolPartyFactory;
let poolParty;
let foregroundTokenSale;
let dealToken;
let mockNameService;

contract('Pool Party ICO', function (accounts) {

    describe('Run through happy path sale', function () {
        this.slow(5000);

        const [_deployer, _investor1, _investor2, _investor6, _investor7, _foregroundSaleAddresses] = accounts;
        
        before(async () => {
            mockNameService = await mockNameServiceArtifact.new();
            await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _investor7.toString(), 0x42);

            poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
            smartLog("Pool Party Factory Address [" + await poolPartyFactory.address + "]");

            await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);

//            foregroundTokenSale = await foregroundTokenSaleArtifact.new(400, 100, web3.toWei(0.05, "ether"), _investor1);
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(400, 1, web3.toWei(0.05, "ether"), _investor1);
            let tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            let tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await foregroundTokenSale.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, _foregroundSaleAddresses, 50, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, {from: _deployer});
            dealToken = dealTokenArtifact.at(await foregroundTokenSale.dealToken());
        });

        it("should create new Pool Party", async () => {
            const tx = await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("10"), web3.toWei("0.5"), web3.toWei("0.8"), "", {from:_investor1});
            smartLog(tx);
            poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));
            smartLog("Foreground Pool Party Address [" + poolParty.address + "]");

            await poolPartyFactory.createNewPoolParty("themktplace.io", "Pool name", "Pool description", web3.toWei("15"), web3.toWei("0.5"), web3.toWei("0.8"), "");
            const poolPartyContract2 = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(1));

            smartLog("MKT.place Party Address [" + poolPartyContract2.address + "]");
        });

        it("should get pool details", async () => {
            const poolDetails = await poolParty.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
        });

        it("should add funds to pool", async () => {
            await poolParty.addFundsToPool(12, {from: _deployer, value: web3.toWei("6", "ether")});
            let investmentAmount = (await poolParty.participants(_deployer))[ParticipantStruct.amountContributed];
            let totalInvested = await poolParty.totalPoolContributions();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await poolParty.leavePool({from: _deployer});
            let investmentAmount = (await poolParty.participants(_deployer))[ParticipantStruct.amountContributed];
            smartLog("Investment amount for user [" + investmentAmount + "]");
            assert.equal(investmentAmount, 0, "Incorrect balance");

            let totalInvested = await poolParty.totalPoolContributions();
            smartLog("Total pool investment amount [" + totalInvested + "]");
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should buy more", async () => {
            await poolParty.addFundsToPool(13, {from: _deployer, value: web3.toWei("6.5", "ether")});
            let investmentAmount = (await poolParty.participants(_deployer))[ParticipantStruct.amountContributed];
            let totalInvested = await poolParty.totalPoolContributions();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6.5", "ether"), "Incorrect balance");

            await poolParty.addFundsToPool(10, {from: _investor1, value: web3.toWei("5", "ether")});
            let investmentAmount2 = (await poolParty.participants(_investor1))[ParticipantStruct.amountContributed];
            totalInvested = await poolParty.totalPoolContributions();
            smartLog("Investment amount for user [" + investmentAmount2 + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount2, web3.toWei("5", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("11.5", "ether"), "Incorrect total");
        });

        it("should add additional funds", async () => {
            await poolParty.addFundsToPool(2, {from: _investor2, value: web3.toWei("1", "ether")});
            const poolState = await poolParty.poolStatus();
            smartLog("Pool State is [" + poolState + "]");
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
        });

        it("should configure pool details", async () => {
            await poolParty.configurePool(foregroundTokenSale.address, dealToken.address, "N/A", "claimToken()", "claimRefund()", true, {from: _investor7});
            assert.equal(await poolParty.buyFunctionName(), "N/A", "Wrong buyFunctionName");
        });

        it("should complete configuration", async () => {
            await poolParty.completeConfiguration({from: _investor7});
            const poolState = await poolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        });

        it("Should kick user", async () => {
            //Expect throw because of wrong state
            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _investor7}));
            await sleep(3000);
            await poolParty.startInReviewPeriod({from: _investor7});

            await poolParty.kickUser(_investor2, KickReason.Other, {from: _investor7});
            smartLog("Account 2 eth after being kicked [" + web3.fromWei((await poolParty.participants(_investor2))[ParticipantStruct.amountContributed]) + "]");
            assert.equal((await poolParty.participants(_investor2))[ParticipantStruct.amountContributed], 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await poolParty.totalPoolContributions()) + "]");
            assert.equal(await poolParty.totalPoolContributions(), web3.toWei("11.5", "ether"), "Total investments should be 11 eth");
        });

        it("Should manually purchase token", async () => {
            web3.eth.sendTransaction({
                from: _investor2,
                to: foregroundTokenSale.address,
                value: web3.toWei("1.7", "ether"),
                gas: 300000
            });
            smartLog("Sale Contract Balance after manual purchase [" + web3.fromWei(web3.eth.getBalance(foregroundTokenSale.address)) + "]");
        });

        it("Should release funds to ICO", async () => {
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(foregroundTokenSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");

            await foregroundTokenSale.updateLatestSaleState({from: _investor6});
            smartLog("Sale State is [" + await foregroundTokenSale.state() + "]");

            const subsidy = calculateSubsidy(await poolParty.discountPercent(), await poolParty.totalPoolContributions());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            const feePercent = await poolParty.feePercentage();
            const total = await poolParty.totalPoolContributions();
            const fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(poolParty.releaseFundsToSale({
                from: _investor7,
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await poolParty.releaseFundsToSale({
                from: _investor7,
                value: subsidy + fee,
                gas: 300000
            });

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(foregroundTokenSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
            smartLog("Token Balance [" + await foregroundTokenSale.purchases(poolParty.address) + "]");
        });

        it("Should get 0 tokens due balance - tokens haven't been claimed yet", async () => {
            var tokensDue0 = (await poolParty.getContributionsDue(_deployer))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 0 should 0 tokens");
            var tokensDue1 = (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 1 should 0 tokens");
        });

        it("Should complete sale", async () => {
            web3.eth.sendTransaction({
                from: _investor2,
                to: foregroundTokenSale.address,
                value: web3.toWei("20", "ether"),
                gas: 300000
            });
            smartLog("Sale Contract Balance after manual purchase [" + web3.fromWei(web3.eth.getBalance(foregroundTokenSale.address)) + "]");
        });

        it("Should claim tokens from ICO", async () => {
            await foregroundTokenSale.updateLatestSaleState({from: _investor6});
            smartLog("Sale State is (should be 5) [" + await foregroundTokenSale.state() + "]");
            smartLog("Tokens received [" + await poolParty.poolTokenBalance() + "]");

            await poolParty.claimTokensFromVendor({from: _investor7});
            smartLog("Tokens Received [" + await poolParty.poolTokenBalance() + "]");
            smartLog("Pool Party token balance [" + await dealToken.balanceOf(poolParty.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            var tokensDue0 = (await poolParty.getContributionsDue(_deployer))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");
            var tokensDue1 = (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Total tokens received from sale [" + await poolParty.poolTokenBalance() + "]");
            smartLog("Account 0 eth investment [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.amountContributed]) + "]");

            await poolParty.claimTokens({from: _deployer});
            smartLog("Account 0 token balance [" + await dealToken.balanceOf(_deployer) + "]");
            assert.isAbove(await dealToken.balanceOf(_deployer), 0, "Token balance must be greater than 0");

            await poolParty.claimTokens({from: _investor1});
            smartLog("Account 1 token balance [" + await dealToken.balanceOf(_investor1) + "]");
            assert.isAbove(await dealToken.balanceOf(_investor1), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance after everyone claims [" + await dealToken.balanceOf(poolParty.address) + "]");

            smartLog("Account 0 has [" + (await poolParty.getContributionsDue(_deployer))[Contributions.tokensDue] + "] tokens due after claim");
            smartLog("Account 1 has [" + (await poolParty.getContributionsDue(_investor1))[Contributions.tokensDue] + "] tokens due after claim");

            smartLog("Account 0 Contribution percentage [" + (await poolParty.participants(_deployer))[ParticipantStruct.percentageContribution] + "]");
            smartLog("Account 1 Contribution percentage [" + (await poolParty.participants(_investor1))[ParticipantStruct.percentageContribution] + "]");

            smartLog("Balance remaining Snapshot [" + web3.fromWei(await poolParty.balanceRemainingSnapshot()) + "]");

            smartLog("Account 0 amount back [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.refundAmount]) + "]");
            smartLog("Account 1 amount back [" + web3.fromWei((await poolParty.participants(_investor1))[ParticipantStruct.refundAmount]) + "]");
        });

        it("should claim refund after successful sale", async () => {
            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_deployer)) + "]");

            await poolParty.claimRefund({from: _deployer});

            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.percentageContribution]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await poolParty.participants(_deployer))[ParticipantStruct.refundAmount]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(_deployer)) + "]");

            //Can't claim again
            await expectThrow(poolParty.claimRefund({from: _deployer}));
            //smartLog("Account 1 Contribution percentage [" + (await poolParty.participants(_investor1))[ParticipantStruct.percentageContribution] + "]");

        });
    });
});
