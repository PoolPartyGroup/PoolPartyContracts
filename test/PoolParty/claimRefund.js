import expectThrow from './../helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateFee,
    calculateSubsidy,
    Status,
    Contributions,
    InvestorStruct,
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

let icoPoolPartyFactory;
let icoPoolParty;
let genericToken;
let customSale;
let mockNameService;

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _foregroundSaleAddresses] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});

        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("1.248397872")});
        await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("1.123847")});
        await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("1.22")});
        await icoPoolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: claimRefund() - Generic Sale', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});

            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await icoPoolParty.poolTokenBalance(), 0, "Should have received tokens");
        });

        it('should claim refund from pool', async () => {
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

        it('should attempt to claim refund from pool multiple times', async () => {
        });

        it('should attempt to claim refund for user not in the pool', async () => {
        });

        it('should attempt to claim refund in incorrect state', async () => {
        });

    });

    describe('Function: claimRefund() - Foreground Sale', () => {
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
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 400000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim refund from pool', async () => {
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

        it('should attempt to claim refund from pool multiple times', async () => {
        });

        it('should attempt to claim refund for user not in the pool', async () => {
        });

        it('should attempt to claim refund in incorrect state', async () => {
        });
    });
});

