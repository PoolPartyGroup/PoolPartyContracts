import expectThrow from './../helpers/expectThrow';
import {
    sleep,
    smartLog,
    Status,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact,
    DUE_DILIGENCE_DURATION
} from './../helpers/utils';

let poolPartyFactory;
let poolParty;
let mockNameService;

contract('PoolParty', (accounts) => {
    const [_deployer, _investor1, _saleOwner, _investor2, _investor3] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("icopoolparty.com"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
    });

    describe('Function: addLegalDocumentation()', () => {
        it('should set supporting documentation location hash', async () => {
            await poolPartyFactory.createNewPoolParty("icopoolparty.com", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), web3.toWei("0.8"), "", {from: _investor1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));
            await poolParty.addFundsToPool(2, {from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await poolParty.addLegalDocumentation("QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D", {from: _investor1});
            assert.equal(await poolParty.legalDocsHash(), web3.fromAscii("QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D"), "Incorrect document hash stored");
        });

        it('should attempt to set documentation location hash after it has already been set', async () => {
            await poolPartyFactory.createNewPoolParty("icopoolparty.com", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), web3.toWei("0.8"), "QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D", {from: _investor1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));
            await poolParty.addFundsToPool(2, {from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(poolParty.addLegalDocumentation("786t96tdsct6c86sc876sc76s87dc687s6c87", {from: _investor1}));
            assert.notEqual(await poolParty.legalDocsHash(), web3.fromAscii("786t96tdsct6c86sc876sc76s87dc687s6c87"), "Incorrect document hash stored");
            assert.equal(await poolParty.legalDocsHash(), web3.fromAscii("QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D"), "Incorrect document hash stored");
        });

        it('should attempt to set documentation location with empty value', async () => {
            await poolPartyFactory.createNewPoolParty("icopoolparty.com", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), web3.toWei("0.8"), "", {from: _investor1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));
            await poolParty.addFundsToPool(2, {from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(poolParty.addLegalDocumentation("", {from: _investor1}));
            assert.equal(await poolParty.legalDocsHash(), web3.fromAscii(""), "Incorrect document hash stored");
        });

        it('should attempt to set documentation location from unauthorized account', async () => {
            await poolPartyFactory.createNewPoolParty("icopoolparty.com", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), web3.toWei("0.8"), "", {from: _investor1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(0));

            await poolParty.addFundsToPool(2, {from: _investor1, value: web3.toWei("1")});
            assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(poolParty.addLegalDocumentation("QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D", {from: _investor3}));
            assert.notEqual(await poolParty.legalDocsHash(), web3.fromAscii("QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D"), "Document has should not have been stored");
        });
    });
});

