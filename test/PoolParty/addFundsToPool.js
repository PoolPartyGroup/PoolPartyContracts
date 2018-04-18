import expectThrow from './../helpers/expectThrow';
import {
    sleep,
    Status,
    KickReason,
    DUE_DILIGENCE_DURATION,
    ZERO_ADDRESS,
    MIN_CONT_AMOUNT,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './../helpers/utils';

const expectedDiscountPercentage = 15;

let poolPartyFactory;
let poolParty;
let genericToken;
let mockNameService;

contract('PoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _tokenAddress] = accounts;

    beforeEach(async () => {
        genericToken = await genericTokenArtifact.new();

        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("1"), {from: _investor1});
        poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));

    });

    describe('Function: addFundsToPool()', () => {
        it('should add funds to pool when in "Open" status', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");

            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.5")});
            assert.equal((await poolParty.investors(_investor1))[0], web3.toWei("0.5"), "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.5"), "Incorrect total investment balance");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.41234351")});
            assert.equal((await poolParty.investors(_investor2))[0], web3.toWei("0.41234351"), "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.91234351"), "Incorrect total investment balance");
        });

        it('should attempt to add funds to pool with amount lower than the minimum', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await expectThrow(poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.009")}));
            assert.notEqual((await poolParty.investors(_investor1))[0], web3.toWei("0.009"), "Incorrect investment amount balance");
            assert.notEqual(await poolParty.totalPoolInvestments(), web3.toWei("0.009"), "Incorrect total investment balance");
        });

        it('should add funds to pool with minimum amount', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await poolParty.addFundsToPool({from: _investor1, value: MIN_CONT_AMOUNT});
            assert.equal((await poolParty.investors(_investor1))[0], MIN_CONT_AMOUNT, "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.01"), "Incorrect total investment balance");
        });

        it('should add funds to pool when in "Watermark" status', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.25")});
            assert.equal((await poolParty.investors(_investor2))[0], web3.toWei("0.25"), "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1.25"), "Incorrect total investment balance");
        });

        it('should add funds to pool when in "Due Diligence" status', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.2")});
            assert.equal((await poolParty.investors(_investor2))[0], web3.toWei("0.2"), "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1.2"), "Incorrect total investment balance");
        });

        it('should attempt to add funds to pool when in "In Review" status', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            await poolParty.leavePool({from: _investor2});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await expectThrow(poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.3")}));
            assert.notEqual((await poolParty.investors(_investor2))[0], web3.toWei("0.3"), "Incorrect investment amount balance");
            assert.notEqual(await poolParty.totalPoolInvestments(), web3.toWei("1.3"), "Incorrect total investment balance");

            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
        });

        it('should calculate the correct number of pool participants', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.05")});
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.03")});
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.03")});
            assert.equal(await poolParty.poolParticipants(), 3, "Incorrect number of participants");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.01")});
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.01")});
            assert.equal(await poolParty.poolParticipants(), 3, "Incorrect number of participants");
        });

        it('should confirm correct values in investors struct', async () => {
            assert.equal((await poolParty.investors(_nonInvestor))[0], 0, "Default values should be 0");
            assert.equal((await poolParty.investors(_nonInvestor))[1], 0, "Default values should be 0");
            assert.equal((await poolParty.investors(_nonInvestor))[2], 0, "Default values should be 0");
            assert.equal((await poolParty.investors(_nonInvestor))[3], 0, "Default values should be 0");
            assert.equal((await poolParty.investors(_nonInvestor))[4], false, "Default value should be false");
            assert.equal((await poolParty.investors(_nonInvestor))[5], false, "Default value should be false");
            assert.equal((await poolParty.investors(_nonInvestor))[6], 0, "Default values should be 0");
            assert.equal((await poolParty.investors(_nonInvestor))[7], false, "Default value should be false");

            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.02")});
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");
            assert.equal((await poolParty.investors(_investor1))[0], web3.toWei("0.02"), "Incorrect investor balance");
            assert.equal((await poolParty.investors(_investor1))[1], 0, "Should still be default value");
            assert.equal((await poolParty.investors(_investor1))[2], 0, "Should still be default value");
            assert.equal((await poolParty.investors(_investor1))[3], 0, "Index should be 0");
            assert.equal((await poolParty.investors(_investor1))[4], false, "Investor has not claimed refund");
            assert.equal((await poolParty.investors(_investor1))[5], true, "Investor should be active");
            assert.equal((await poolParty.investors(_investor1))[6], 0, "Should still be default value");
            assert.equal((await poolParty.investors(_investor1))[7], false, "Investor has not claimed tokens");

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.025")});
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
            assert.equal((await poolParty.investors(_investor2))[0], web3.toWei("0.025"), "Incorrect investor balance");
            assert.equal((await poolParty.investors(_investor2))[3], 1, "Index should be 1");
            assert.equal((await poolParty.investors(_investor2))[4], false, "Investor has not claimed refund");
            assert.equal((await poolParty.investors(_investor2))[5], true, "Investor should be active");
            assert.equal((await poolParty.investors(_investor2))[7], false, "Investor has not claimed tokens");
        });
    });

    describe('Function: leavePool()', () => {
        it('should leave pool in "Open" status', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.6")});
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");

            await poolParty.leavePool({from: _investor1});
            assert.equal((await poolParty.investors(_investor1))[0], 0, "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), 0, "Incorrect total investment balance");
        });

        it('should leave pool in "Watermark" status -> back to "Open" status', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await poolParty.leavePool({from: _investor1});
            assert.equal((await poolParty.investors(_investor1))[0], 0, "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), 0, "Incorrect total investment balance");
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
        });

        it('should leave pool in "Watermark" status -> stay in "Watermark" status', async () => {
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await poolParty.leavePool({from: _investor2});
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
        });

        it('should leave pool in "Due Diligence" status', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.05")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");

            await poolParty.leavePool({from: _investor2});
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal((await poolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should leave pool in "In Review" status', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.09")});
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.011")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            await poolParty.leavePool({from: _investor3});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await poolParty.leavePool({from: _investor2});
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal((await poolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should leave pool and be removed from the list', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.01")});
            assert.equal((await poolParty.investors(_investor1))[3], 0, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal((await poolParty.investors(_investor2))[3], 1, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.03")});
            assert.equal((await poolParty.investors(_investor3))[3], 2, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.04")});
            assert.equal((await poolParty.investors(_investor4))[3], 3, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 4, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.1"), "Incorrect total investment balance");

            await poolParty.leavePool({from: _investor2});
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Investment balance should be 0");
            assert.equal((await poolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal((await poolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 3, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.08"), "Incorrect total investment balance");

            await poolParty.leavePool({from: _investor3});
            assert.equal((await poolParty.investors(_investor3))[0], 0, "Investment balance should be 0");
            assert.equal((await poolParty.investors(_investor3))[5], false, "Investor should not be active");
            assert.equal((await poolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal((await poolParty.investors(_investor1))[3], 0, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.05"), "Incorrect total investment balance");
        });

        it('should attempt to leave pool when balance is 0', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.2")});
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Investor should have a 0 balance");

            await expectThrow(poolParty.leavePool({from: _investor2}));
            assert.equal((await poolParty.investors(_investor2))[0], 0, "Investor 2 should still have 0 balance");
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");
        });
    });

    describe('Function: configurePool()', () => {
        it('should configure pool', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});

            assert.equal(await poolParty.destinationAddress(), _saleAddress, "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.tokenAddress(), _tokenAddress, "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.buyFunctionName(), "buy()", "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.claimFunctionName(), "claim()", "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.refundFunctionName(), "refund()", "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.publicEthPricePerToken(), web3.toWei("0.05"), "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.groupEthPricePerToken(), web3.toWei("0.04"), "Incorrect Sale Owner Configured");
            assert.equal(await poolParty.subsidyRequired(), true, "Incorrect Sale Owner Configured");
        });

        it('should attempt to configure pool in before setting the authorized configuration address', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");
        });

        it('should attempt to configure pool in before watermark reached', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.1")});
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");
        });

        it('should attempt to configure pool with incorrect values', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});

            await expectThrow(poolParty.configurePool(ZERO_ADDRESS, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleOwner, ZERO_ADDRESS, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", 0, web3.toWei("0.04"), true, {from: _saleOwner}));
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), 0, true, {from: _saleOwner}));

            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Sale configuration should not have been completed");
        });

        it('should attempt to configure pool in incorrect state', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.leavePool({from: _investor4});
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");

            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");
        });

        it('should attempt to configure pool with non authorized configuration address', async () => {
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await expectThrow(poolParty.configurePool(_saleAddress, _tokenAddress, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _investor4}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");
        });
    });

    describe('Function: completeConfiguration()', () => {
        it('should complete configuration when group price configuration is more than the expected pool discount', async () => {
            assert.equal(await poolPartyFactory.groupDiscountPercent(), expectedDiscountPercentage, "Expected discount should be 20%");
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            //0.6 is more that a 15% discount of the public sale price (1 eth)
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("1"), web3.toWei("0.6"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should complete configuration when group price configuration is exactly the expected pool discount', async () => {
            assert.equal(await poolPartyFactory.groupDiscountPercent(), expectedDiscountPercentage, "Expected discount should be 20%");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            //0.85 is exactly 15% discount of the public sale price (1 eth)
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("1"), web3.toWei("0.85"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in the incorrect state");
        });

        it('should attempt to complete configuration when group price configuration is less than expected pool discount', async () => {
            assert.equal(await poolPartyFactory.groupDiscountPercent(), expectedDiscountPercentage, "Expected discount should be 20%");
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            //0.9 is less than 15% discount of the public sale price (1 eth) so this should fail
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("1"), web3.toWei("0.9"), true, {from: _saleOwner});
            await expectThrow(poolParty.completeConfiguration({from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool configuration should not have been completed");
        });

        it('should attempt to complete configuration with non authorized configuration address', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await expectThrow(poolParty.completeConfiguration({from: _investor1}));
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
        });

        it('should attempt to complete configuration before watermark is reached', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.1")});
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.tokenAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.publicEthPricePerToken(), 0, "Pool in incorrect status");
            assert.equal(await poolParty.groupEthPricePerToken(), 0, "Pool in incorrect status");
            await expectThrow(poolParty.completeConfiguration({from: _investor1}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");

            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
        });

        it('should attempt to complete configuration before authorized owner is set ', async () => {
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("1")});
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.tokenAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.publicEthPricePerToken(), 0, "Pool in incorrect status");
            assert.equal(await poolParty.groupEthPricePerToken(), 0, "Pool in incorrect status");
            await expectThrow(poolParty.completeConfiguration({from: _investor4}));
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Configuration should not have been completed");
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
        });

        it('should attempt to complete configuration before configuring the pool', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            assert.equal(await poolParty.destinationAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.tokenAddress(), ZERO_ADDRESS, "Pool in incorrect status");
            assert.equal(await poolParty.publicEthPricePerToken(), 0, "Pool in incorrect status");
            assert.equal(await poolParty.groupEthPricePerToken(), 0, "Pool in incorrect status");
            await expectThrow(poolParty.completeConfiguration({from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
        });
    });

    describe('Function: kickUser()', () => {
        it('should kick user', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.6"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");
        });

        it('should attempt to kick user before due diligence has elapsed', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
        });

        it('should attempt to kick user using non authorized configuration account', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await sleep(DUE_DILIGENCE_DURATION);

            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _investor2}));
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
        });

        it('should attempt to kick user in incorrect state', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            assert.equal(await poolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await expectThrow(poolParty.kickUser(_investor4, KickReason.Other, {from: _saleOwner}));

            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner}));

            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner}));

            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await expectThrow(poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner}));

            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
        });

        it('should attempt to kick user that does not exist', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await sleep(DUE_DILIGENCE_DURATION);

            await expectThrow(poolParty.kickUser(_investor1, KickReason.Other, {from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
        });

        it('should kick user and make sure they are correctly removed from the list', async () => {
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.1")});
            assert.equal((await poolParty.investors(_investor1))[3], 0, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.2")});
            assert.equal((await poolParty.investors(_investor2))[3], 1, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.3")});
            assert.equal((await poolParty.investors(_investor3))[3], 2, "Incorrect list index");
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.4")});
            assert.equal((await poolParty.investors(_investor4))[3], 3, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 4, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");

            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});

            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});

            await poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner});

            assert.equal((await poolParty.investors(_investor2))[0], 0, "Investment balance should be 0");
            assert.equal((await poolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal((await poolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 3, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.8"), "Incorrect total investment balance");

            await poolParty.kickUser(_investor3, KickReason.Other, {from: _saleOwner});
            assert.equal((await poolParty.investors(_investor3))[0], 0, "Investment balance should be 0");
            assert.equal((await poolParty.investors(_investor3))[5], false, "Investor should not be active");
            assert.equal((await poolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal((await poolParty.investors(_investor1))[3], 0, "Incorrect list index");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.5"), "Incorrect total investment balance");
        });

        it.skip('should check that the fee has been paid to the executor of the transaction, and the rest of the funds sent to investor', async () => {
            await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            await poolParty.configurePool(_saleAddress, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 2, "Incorrect number of participants");

            await sleep(DUE_DILIGENCE_DURATION);
            await poolParty.startInReviewPeriod({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await poolParty.kickUser(_investor2, KickReason.Other, {from: _saleOwner});
            //TODO: Check fee amount paid to _saleOwner and balance transferred to investor
            assert.equal(await poolParty.totalPoolInvestments(), web3.toWei("0.6"), "Incorrect total investment balance");
            assert.equal(await poolParty.poolParticipants(), 1, "Incorrect number of participants");
        });

    });
});

