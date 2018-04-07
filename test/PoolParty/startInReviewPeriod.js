import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');

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

    describe('Function: startInReviewPeriod()', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});
        });

        it('should set In Review state', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);

            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await icoPoolParty.startInReviewPeriod({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should attempt to set In Review state with unauthorized account', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);

            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(icoPoolParty.startInReviewPeriod({from: _investor3}));
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to set In Review state before due diligence duration has elapsed', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});

            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(icoPoolParty.startInReviewPeriod({from: _saleOwner}));
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to set In Review state when not in Diligence state', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});

            assert.notEqual(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await expectThrow(icoPoolParty.startInReviewPeriod({from: _saleOwner}));
            assert.notEqual(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            assert.notEqual(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });
    });

    function sleep(_ms) {
        return new Promise(resolve => setTimeout(resolve, _ms));
    }

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

});

