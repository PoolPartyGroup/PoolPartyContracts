import expectThrow from './../helpers/expectThrow';
import {
    sleep,
    calculateFee,
    calculateSubsidy,
    Status,
    DUE_DILIGENCE_DURATION,
    customSaleArtifact,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './../helpers/utils';
import {smartLog} from "../helpers/utils";

let poolPartyFactory;
let poolParty;
let genericToken;
let customSale;
let mockNameService;

contract('PoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _tokenAddress] = accounts;

    beforeEach(async () => {
        genericToken = await genericTokenArtifact.new({from: _deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
        await genericToken.transferOwnership(customSale.address, {from: _deployer});

        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});

        poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));
        await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
        await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
        await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized with buy and claim function. ', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance) + parseInt(fee), "Correct fee not transferred");
        });

        it('should attempt to release funds using unauthorized account', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await expectThrow(poolParty.releaseFundsToSale({from: _investor3, gas: 300000, value: (subsidy + fee)}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
        });

        it('should attempt to release funds before due diligence has passed', async () => {
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await expectThrow(poolParty.releaseFundsToSale({from: _investor3, gas: 300000, value: (subsidy + fee)}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to release funds without sending any ether', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});

            await expectThrow(poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
        });

        it('should attempt to release funds only sending subsidy', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());

            await expectThrow(poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: subsidy}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
        });

        it('should attempt to release funds only sending fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await expectThrow(poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: fee}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
        });

        it('should attempt to leave pool when funds already released', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (fee + subsidy)});

            await expectThrow(poolParty.leavePool({from: _investor4}));
            assert.notEqual(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

    });

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized with automatic claim. ', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await poolParty.poolTokenBalance(), 0, "Should have received tokens");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance) + parseInt(fee), "Correct fee not transferred");
        });

        it('should attempt to release funds in review state when the total pool size is 0', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            await poolParty.leavePool({from: _investor4});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            await poolParty.leavePool({from: _investor2});
            assert.equal(await poolParty.totalPoolInvestments(), 0, "Pool should have nothing in it");

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            assert.equal(subsidy, 0, "Subsidy should be 0");
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            assert.equal(fee, 0, "Fee should be 0");

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (fee + subsidy)});
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.notEqual(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });
    });

    describe('Function: releaseFundsToSale() - Generic Sale: Non Subsidized with buy and claim function.', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), false, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to non-subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: fee});
            assert.equal(web3.eth.getBalance(customSale.address).toNumber(), (await poolParty.totalPoolInvestments()).toNumber(), "Incorrect sale balance after transfer");
        });

        it('should attempt to release funds to non-subsidized sale with incorrect fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await expectThrow(poolParty.releaseFundsToSale({
                from: _saleOwner,
                gas: 300000,
                value: parseInt(fee) - parseInt(web3.toWei("0.001"))
            }));
            assert.equal(web3.eth.getBalance(customSale.address).toNumber(), 0, "Incorrect sale balance after transfer");
        });

    });

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized Automatic Token Allocation', () => {
        beforeEach(async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale and get tokens', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await poolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await poolParty.poolTokenBalance(), 0, "Should have received tokens");
        });
    });

    describe('Function: releaseFundsToSale() - Generic Sale: 0% fee. ', () => {
        beforeEach(async () => {
            await mockNameService.__callback(web3.sha3("zero.fee.test"), _saleOwner, 0x42);

            await poolPartyFactory.setFeePercentage(0);
            await poolPartyFactory.createNewPoolParty("zero.fee.test", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});

            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(1));
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});

            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to sale with 0% fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            const fee = calculateFee(await poolParty.feePercentage(), await poolParty.totalPoolInvestments());
            assert.equal(fee, 0, "Fee should be 0%");

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance), "There should be no fee");
        });
    });

    describe('Function: releaseFundsToSale() - Generic Sale: Waive Fee. ', () => {
        beforeEach(async () => {
            await mockNameService.__callback(web3.sha3("waive.fee.test"), _saleOwner, 0x42);

            await poolPartyFactory.createNewPoolParty("waive.fee.test", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});

            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(1));
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});

            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to sale with waived fee', async () => {
            await poolParty.waiveFee({from: _deployer});
            assert.equal(await poolParty.feeWaived(), true, "Fee should have been waived");
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());

            await poolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await poolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance), "There should be no fee");
        });

        it('should attempt to waive fee with incorrect account', async () => {
            assert.equal(await poolParty.feeWaived(), false, "Fee should not be waived by default");
            await expectThrow(poolParty.waiveFee({from: _investor2}));
            assert.equal(await poolParty.feeWaived(), false, "Fee should not have been waived");
        });
    });
});

