import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');

const foregroundTokenSaleArtifact = artifacts.require('./ForegroundTokenSale');
const dealTokenArtifact = artifacts.require('./DealToken');

let foregroundTokenSale;
let dealToken;

const DUE_DILIGENCE_DURATION = 3000;

let icoPoolPartyFactory;
let icoPoolParty;
let genericToken;
let customSale;

const Status = {
    Open: 0,
    WaterMarkReached: 1,
    DueDiligence: 2,
    InReview: 3,
    Claim: 4,
    Refunding: 5
};
const InvestorStruct = {
    investmentAmount: 0,
    lastAmountTokensClaimed: 1,
    percentageContribution: 2,
    arrayIndex: 3,
    hasClaimedRefund: 4,
    isActive: 5,
    refundAmount: 6,
    totalTokensClaimed: 7,
    totalNumberOfClaims: 8
};
const Contributions = {
    percentageContribution: 0,
    refundAmount: 1,
    tokensDue: 2,
    hasClaimedRefund: 3,
    hasClaimedTokens: 4
}

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _foregroundSaleAddresses] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});

        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("1.248397872")});
        await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("1.123847")});
        await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("1.22")});
        await icoPoolParty.setAuthorizedConfigurationAddressTest(_saleOwner, false, {
            from: _investor1,
            value: web3.toWei("0.005")
        });
    });

    describe('Function: claimTokens() - Generic Sale', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});

            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await icoPoolParty.poolTokenBalance(), 0, "Should have received tokens");
        });

        it('should claim tokens from pool', async () => {
            await icoPoolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            await icoPoolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await icoPoolParty.investors(_investor2))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            await icoPoolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await icoPoolParty.investors(_investor3))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should claim tokens from pool multiple times', async () => {
            assert.isAbove((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await icoPoolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), (await icoPoolParty.investors(_investor4))[InvestorStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            assert.isAbove((await icoPoolParty.getContributionsDue(_investor2))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await icoPoolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await icoPoolParty.investors(_investor2))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor2)).toNumber(), (await icoPoolParty.investors(_investor2))[InvestorStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await icoPoolParty.getContributionsDue(_investor2))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            assert.isAbove((await icoPoolParty.getContributionsDue(_investor3))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await icoPoolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await icoPoolParty.investors(_investor3))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor3)).toNumber(), (await icoPoolParty.investors(_investor3))[InvestorStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await icoPoolParty.getContributionsDue(_investor3))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");

            const totalTokensClaimed = Math.floor((parseInt(investor2PreviousTokensClaimed) + parseInt(investor3PreviousTokensClaimed) + parseInt(investor4PreviousTokensClaimed))/10**8);
            assert.equal((await icoPoolParty.allTokensClaimed())/10**8, totalTokensClaimed, "Incorrect number of total tokens claimed");

            //Send 'bonus' tokens to pool
            await customSale.buy({from: _investor4, value: web3.toWei("10")});
            await genericToken.transfer(icoPoolParty.address, web3.toWei("200"), {from: _investor4});

            assert.isAbove((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have a non 0 token balance");
            await icoPoolParty.claimTokens({from: _investor4}); //Claim again
            const investor4PreviousTokensClaimed1 = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            const total = parseInt(investor4PreviousTokensClaimed) + parseInt(investor4PreviousTokensClaimed1);
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), total, "Incorrect number of tokens received");
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), (await icoPoolParty.investors(_investor4))[InvestorStruct.totalTokensClaimed].toNumber(), "Token balance and 'number of tokens claimed' should be the same");
            assert.equal((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens left to claim");
        });

        it('should attempt to claim tokens from pool multiple times when 2nd attempt has 0 tokens due', async () => {
            await icoPoolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");

            assert.equal((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens to claim");
            await expectThrow(icoPoolParty.claimTokens({from: _investor4}));
            assert.equal((await genericToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should attempt to claim from account who is not participant', async () => {
            await expectThrow(icoPoolParty.claimTokens({from: _nonInvestor}));
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

            await icoPoolParty.configurePool(foregroundTokenSale.address, dealToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 400000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from pool', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await icoPoolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 4");

            await icoPoolParty.claimTokens({from: _investor2});
            const investor2PreviousTokensClaimed = (await icoPoolParty.investors(_investor2))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor2)).toNumber(), investor2PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 2");

            await icoPoolParty.claimTokens({from: _investor3});
            const investor3PreviousTokensClaimed = (await icoPoolParty.investors(_investor3))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor3)).toNumber(), investor3PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 3");
        });

        it('should attempt to claim tokens twice', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await icoPoolParty.claimTokens({from: _investor4});
            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received 4");

            assert.equal((await icoPoolParty.getContributionsDue(_investor4))[Contributions.tokensDue], 0, "Should have 0 tokens to claim");
            await expectThrow(icoPoolParty.claimTokens({from: _investor4}));
            assert.equal((await dealToken.balanceOf(_investor4)).toNumber(), investor4PreviousTokensClaimed.toNumber(), "Incorrect number of tokens received");
        });

        it('should attempt to claim tokens in incorrect state', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            await expectThrow(icoPoolParty.claimTokens({from: _investor4}));

            const investor4PreviousTokensClaimed = (await icoPoolParty.investors(_investor4))[InvestorStruct.lastAmountTokensClaimed];
            assert.equal(investor4PreviousTokensClaimed, 0, "Contribution amounts should still reflect 0");
        });

    });


    async function calculateSubsidy() {
        let _expectedGroupDiscountPercent = await icoPoolParty.expectedGroupDiscountPercent();
        smartLog("expectedGroupDiscountPercent [" + _expectedGroupDiscountPercent + "%]");
        let _actualGroupDiscountPercent = await icoPoolParty.actualGroupDiscountPercent();
        smartLog("actualGroupDiscountPercent [" + _actualGroupDiscountPercent + "%]");
        let _expectedGroupTokenPrice = await icoPoolParty.expectedGroupTokenPrice();
        smartLog("expectedGroupTokenPrice [" + web3.fromWei(_expectedGroupTokenPrice) + "]");
        let _totalPoolInvestments = await icoPoolParty.totalPoolInvestments();
        smartLog("totalPoolInvestments [" + web3.fromWei(_totalPoolInvestments) + "]");

        let _groupContPercent = 100 - _actualGroupDiscountPercent;
        let _amountToRelease = _totalPoolInvestments * 100 / _groupContPercent;

        smartLog("amountToRelease [" + web3.fromWei(_amountToRelease) + "]");

        return _amountToRelease - _totalPoolInvestments;
    }

    async function calculateFee() {
        const feePercent = await icoPoolParty.feePercentage();
        const totalPoolInvestment = await icoPoolParty.totalPoolInvestments();
        return totalPoolInvestment * feePercent / 100;
    }

    function sleep(_ms) {
        return new Promise(resolve => setTimeout(resolve, _ms));
    }

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

});

