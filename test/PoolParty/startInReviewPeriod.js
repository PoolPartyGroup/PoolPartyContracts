import expectThrow from './../helpers/expectThrow';
import {
    sleep,
    Status,
    DUE_DILIGENCE_DURATION,
    customSaleArtifact,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './../helpers/utils';


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

        poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));
        await poolParty.addFundsToPool({from: _investor4, value: web3.toWei("1.248397872")});
        await poolParty.addFundsToPool({from: _investor2, value: web3.toWei("1.123847")});
        await poolParty.addFundsToPool({from: _investor3, value: web3.toWei("1.22")});
        await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
    });

    describe('Function: startInReviewPeriod()', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});
        });

        it('should set In Review state', async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);

            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await poolParty.startInReviewPeriod({from: _saleOwner});
            assert.equal(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should attempt to set In Review state with unauthorized account', async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);

            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(poolParty.startInReviewPeriod({from: _investor3}));
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to set In Review state before due diligence duration has elapsed', async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await poolParty.completeConfiguration({from: _saleOwner});

            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(poolParty.startInReviewPeriod({from: _saleOwner}));
            assert.equal(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to set In Review state when not in Diligence state', async () => {
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});

            assert.notEqual(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(poolParty.startInReviewPeriod({from: _saleOwner}));
            assert.notEqual(await poolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            assert.notEqual(await poolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });
    });
});

