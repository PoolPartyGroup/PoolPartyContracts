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
    const [_deployer, _investor1, _saleOwner] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("icopoolparty.com"), _saleOwner, 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await poolPartyFactory.createNewPoolParty("icopoolparty.com", "Pool name", "Pool description", web3.toWei("1"), web3.toWei("0.5"), "", {from: _investor1});
        const _poolGuid = await poolPartyFactory.partyGuidList(0);
        poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(_poolGuid));

        await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});

        assert.equal(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
    });

    describe('Function: setAuthorizedConfigurationAddress()', () => {
        it('should set authorized configuration address', async () => {
            await poolParty.setAuthorizedConfigurationAddress({from: _investor1});
            assert.equal(await poolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });

        it('should attempt to set authorized configuration address in wrong state', async () => {
            await poolParty.leavePool({from: _investor1});
            await poolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.1")});
            assert.notEqual(await poolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(poolParty.setAuthorizedConfigurationAddress({from: _investor1}));
            assert.notEqual(await poolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });
    });
});

