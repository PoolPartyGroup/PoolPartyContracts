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

let icoPoolPartyFactory;
let icoPoolParty;
let genericToken;
let customSale;
let mockNameService;

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _foregroundSaleAddresses] = accounts;

    beforeEach(async () => {
        genericToken = await genericTokenArtifact.new({from: _deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
        await genericToken.transferOwnership(customSale.address, {from: _deployer});

        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION / 1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});

        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
        await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
        await icoPoolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: claimTokensFromIco(): Generic Sale', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});

            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from ICO', async () => {
            let contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _investor4}));
            const contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have 0 tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromIco(): Generic Sale (automatically call claimTokensFromIco)', () => {
        it('should claim tokens from ICO', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            let contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
        });
    });

    describe('Function: claimTokensFromIco(): Generic Sale', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
        });

        it('should attempt to claim tokens from ICO but get none', async () => {
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            let contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should attempt to claim tokens in incorrect state', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            const contractTokenReceived = await icoPoolParty.poolTokenBalance();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.notEqual(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromIco(): Foreground Sale', () => {
        const TOKEN_PRICE = web3.toWei("0.05");
        beforeEach(async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("2.2387946")});
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(60, 1, TOKEN_PRICE, _deployer);
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

        it('should claim tokens from ICO', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            assert.equal((await dealToken.balanceOf(icoPoolParty.address)).toNumber(), tokensAllocated.toNumber(), "Should have received tokens");

        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _investor3}));
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.equal(tokensAllocated, 0, "Should have received tokens");
        });
    });

    describe('Function: claimRefundFromIco()', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await icoPoolParty.poolTokenBalance(), 0, "Should nothave received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            assert.equal((web3.eth.getBalance(icoPoolParty.address)).toNumber(), 0, "Contract balance too high after release funds");
            await icoPoolParty.claimRefundFromIco({from: _saleOwner});
            assert.equal((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await icoPoolParty.balanceRemainingSnapshot()) + "]");
        });

        it('should attempt to double claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            const fee = calculateFee(await icoPoolParty.feePercentage(), await icoPoolParty.totalPoolInvestments());

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await icoPoolParty.poolTokenBalance(), 0, "Should not have received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            assert.equal((web3.eth.getBalance(icoPoolParty.address)).toNumber(), 0, "Contract balance too high after release funds");
            await icoPoolParty.claimRefundFromIco({from: _saleOwner});
            assert.equal((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await icoPoolParty.balanceRemainingSnapshot()) + "]");
            await expectThrow(icoPoolParty.claimRefundFromIco({from: _saleOwner}));
        });
    });
});

