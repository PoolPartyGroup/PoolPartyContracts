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

let icoPoolPartyFactory;
let icoPoolParty;
let mockNameService;

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _saleOwner] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("icopoolparty.com"), _saleOwner, 0x42);

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("icopoolparty.com", {from: _investor1});
        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});

        assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
    });

    describe('Function: setAuthorizedConfigurationAddress()', () => {
        it('should set authorized configuration address', async () => {
            await icoPoolParty.setAuthorizedConfigurationAddress({from: _investor1});
            assert.equal(await icoPoolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });

        it('should attempt to set authorized configuration address in wrong state', async () => {
            await icoPoolParty.leavePool({from: _investor1});
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.1")});
            assert.notEqual(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(icoPoolParty.setAuthorizedConfigurationAddress({from: _investor1}));
            assert.notEqual(await icoPoolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });
    });
});

