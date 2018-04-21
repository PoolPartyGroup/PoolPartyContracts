import expectThrow from './../helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateFee,
    calculateSubsidy,
    Status,
    Contributions,
    ParticipantStruct,
    DUE_DILIGENCE_DURATION,
    customSaleArtifact,
    dealTokenArtifact,
    foregroundTokenSaleArtifact,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './../helpers/utils';

let foregroundTokenSale;
let dealToken;

let poolPartyFactory;
let poolParty;
let genericToken;
let customSale;
let mockNameService;

contract('PoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _foregroundSaleAddresses] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});

        poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));

        await poolParty.addFundsToPool(2, {from: _investor4, value: web3.toWei("1")});
        await poolParty.addFundsToPool(3, {from: _investor2, value: web3.toWei("1.5")});
        await poolParty.addFundsToPool(2, {from: _investor3, value: web3.toWei("1")});
        await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: claimTokens() - Generic Sale', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});

            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolContributions());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolContributions());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await poolParty.poolTokenBalance(), 0, "Should have received tokens");
        });

        it('should claim tokens from pool', async () => {
            await poolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            await poolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await poolParty.participants(_investor2))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            await poolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await poolParty.participants(_investor3))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should claim tokens from pool multiple times', async () => {
            assert.isAbove((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await poolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), (await poolParty.participants(_investor4))[ParticipantStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            assert.isAbove((await poolParty.getContributionsDue(_investor2))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await poolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await poolParty.participants(_investor2))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), (await poolParty.participants(_investor2))[ParticipantStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await poolParty.getContributionsDue(_investor2))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            assert.isAbove((await poolParty.getContributionsDue(_investor3))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await poolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await poolParty.participants(_investor3))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), (await poolParty.participants(_investor3))[ParticipantStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await poolParty.getContributionsDue(_investor3))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            const totalTokensClaimed = Math.floor((parseInt(investor2PreviousTokensClaimed) + parseInt(investor3PreviousTokensClaimed) + parseInt(investor4PreviousTokensClaimed))/10**8);
            assert.equal((await poolParty.allTokensClaimed())/10**8, totalTokensClaimed, "Incorrect number of total tokens claimed");

            //Send 'bonus' tokens to pool
            await customSale.buy({from: _investor4, value: web3.toWei("10")});
            await genericToken.transfer(poolParty.address, web3.toWei("200"), {from: _investor4});

            assert.isAbove((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await poolParty.claimTokens({from: _investor4}); //Claim again
            const investor4PreviousTokensClaimed1 = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            const total = parseInt(investor4PreviousTokensClaimed) + parseInt(investor4PreviousTokensClaimed1);
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), total, "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), (await poolParty.participants(_investor4))[ParticipantStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");
        });

        it('should attempt to claim tokens from pool multiple times when 2nd attempt has 0 tokens due', async () => {
            await poolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            assert.equal((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens to claim");
            await expectThrow(poolParty.claimTokens({from: _investor4}));
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should attempt to claim from account who is not participant', async () => {
            smartLog("PoolParty [" + poolParty.address + "]", true);
            await expectThrow(poolParty.claimTokens({from: _nonInvestor}));
            assert.equal((await genericToken.balanceOf(_nonInvestor)).toNumber(), 0, "Incorrect number of tokens received");
        });
    });

    describe('Function: claimTokens() - Foreground Sale', () => {
        beforeEach(async () => {
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(60, 1, web3.toWei(0.05, "ether"), _deployer);
            const tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            const tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await foregroundTokenSale.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, _foregroundSaleAddresses, 50, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, {from: _deployer});
            dealToken = dealTokenArtifact.at(await foregroundTokenSale.dealToken());

            await poolParty.configurePool(foregroundTokenSale.address, dealToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolContributions());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolContributions());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 400000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from pool', async () => {
            await poolParty.claimTokensFromVendor({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await poolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 4");

            await poolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await poolParty.participants(_investor2))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 2");

            await poolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await poolParty.participants(_investor3))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 3");
        });

        it('should attempt to claim tokens twice', async () => {
            await poolParty.claimTokensFromVendor({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await poolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 4");

            assert.equal((await poolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens to claim");
            await expectThrow(poolParty.claimTokens({from: _investor4}));
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should attempt to claim tokens in incorrect state', async () => {
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            await expectThrow(poolParty.claimTokens({from: _investor4}));

            const investor4PreviousTokensClaimed = (await poolParty.participants(_investor4))[ParticipantStruct.lastAmountTokensClaimed];
            assert.equal(investor4PreviousTokensClaimed, 0, "Contribution amounts should still reflect 0");
        });
    });
});

