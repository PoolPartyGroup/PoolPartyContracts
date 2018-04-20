import expectThrow from './../helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateFee,
    calculateSubsidy,
    Status,
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
        genericToken = await genericTokenArtifact.new({from: _deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
        await genericToken.transferOwnership(customSale.address, {from: _deployer});

        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION / 1000);
        await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});

        const _poolGuid = await poolPartyFactory.partyGuidList(0);
        poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(_poolGuid));

        await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
        await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
        await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: claimTokensFromVendor(): Generic Sale', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from ICO', async () => {
            let contractTokenReceived = await poolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await poolParty.claimTokensFromVendor({from: _saleOwner});
            contractTokenReceived = await poolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await poolParty.claimTokensFromVendor({from: _saleOwner});
            const contractTokenReceived = await poolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await expectThrow(poolParty.claimTokensFromVendor({from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(poolParty.claimTokensFromVendor({from: _investor4}));
            const contractTokenReceived = await poolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have 0 tokens");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromVendor(): Generic Sale (automatically call claimTokensFromVendor)', () => {
        it('should claim tokens from ICO', async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            let contractTokenReceived = await poolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
        });
    });

    describe('Function: claimTokensFromVendor(): Generic Sale', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
        });

        it('should attempt to claim tokens from ICO but get none', async () => {
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            await poolParty.startInReviewPeriod({from: _saleOwner});
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            let contractTokenReceived = await poolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await poolParty.claimTokensFromVendor({from: _saleOwner});
            contractTokenReceived = await poolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should attempt to claim tokens in incorrect state', async () => {
            await expectThrow(poolParty.claimTokensFromVendor({from: _saleOwner}));
            const contractTokenReceived = await poolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.notEqual(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromVendor(): Foreground Sale', () => {
        const TOKEN_PRICE = web3.toWei("0.05");
        beforeEach(async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("2.2387946")});
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(60, 1, TOKEN_PRICE, _deployer);
            const tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            const tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await foregroundTokenSale.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, _foregroundSaleAddresses, 50, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, {from: _deployer});
            dealToken = dealTokenArtifact.at(await foregroundTokenSale.dealToken());

            await poolParty.configurePool(foregroundTokenSale.address, dealToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 400000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from ICO', async () => {
            await poolParty.claimTokensFromVendor({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(poolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await poolParty.claimTokensFromVendor({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(poolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
            await expectThrow(poolParty.claimTokensFromVendor({from: _saleOwner}));
            assert.equal((await dealToken.balanceOf(poolParty.address)).toNumber(), tokensAllocated.toNumber(), "Should have received tokens");

        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(poolParty.claimTokensFromVendor({from: _investor3}));
            const tokensAllocated = await dealToken.balanceOf(poolParty.address);
            assert.equal(tokensAllocated, 0, "Should have received tokens");
        });
    });

    describe('Function: claimRefundFromVendor()', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await poolParty.poolTokenBalance(), 0, "Should nothave received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "], total investment balance [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "]");
            assert.equal((web3.eth.getBalance(poolParty.address)).toNumber(), 0, "Contract balance too high after release funds");
            await poolParty.claimRefundFromVendor({from: _saleOwner});
            assert.equal((web3.eth.getBalance(poolParty.address)).toNumber(), await poolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "], total investment balance [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await poolParty.balanceRemainingSnapshot()) + "]");
        });

        it('should attempt to double claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await poolParty.poolTokenBalance(), 0, "Should not have received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "], total investment balance [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "]");
            assert.equal((web3.eth.getBalance(poolParty.address)).toNumber(), 0, "Contract balance too high after release funds");
            await poolParty.claimRefundFromVendor({from: _saleOwner});
            assert.equal((web3.eth.getBalance(poolParty.address)).toNumber(), await poolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "], total investment balance [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await poolParty.balanceRemainingSnapshot()) + "]");
            await expectThrow(poolParty.claimRefundFromVendor({from: _saleOwner}));
        });
    });
});

