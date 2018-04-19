import expectThrow from './../helpers/expectThrow';
import {
    FactoryDefaultConfig,
    ZERO_ADDRESS,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './../helpers/utils';

let poolPartyFactory;
let poolParty;
let mockNameService;

contract('PoolPartyFactory Contract', (accounts) => {
    const [_deployer, _creator1, _creator2, _creator3, _newOwner] = accounts;

    beforeEach(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("api.test.foreground.io"), _creator3.toString(), 0x42);

        poolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, mockNameService.address, {from: _deployer});
    });

    describe('Function: createNewPoolParty', () => {
        it('should create new pool', async () => {
            await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), "QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d", {from: _creator1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));
            assert.equal(await poolParty.rootDomain(), "api.test.foreground.io", "Incorrect root domain stored");
            assert.equal(await poolParty.poolName(), "Pool name", "Incorrect pool name stored");
            assert.equal(await poolParty.poolDescription(), "Pool description", "Incorrect pool description stored");
            assert.equal(await poolParty.supportingDocsHash(), web3.fromAscii("QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d"), "Incorrect document hash stored");
            assert.equal(await poolParty.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect pool fee percentage");
            assert.equal(await poolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");
        });

        it('should attempt to call "setPoolParameters" manually', async () => {
            await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), "QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d", {from: _creator1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));
            await expectThrow(poolParty.setPoolParameters(49, 4, 4, _creator2, 6, 8, _creator3, {from: _creator1}));
            assert.equal(await poolParty.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect pool fee percentage");

            await expectThrow(poolParty.setPoolParameters(49, 4, 4, _creator2, 6, 8, _creator3, {from: _deployer}));
            assert.equal(await poolParty.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect pool fee percentage");
        });

        it('should attempt to create new pool with empty domain name, pool name and pool description', async () => {
            await expectThrow(poolPartyFactory.createNewPoolParty("", "", "", 0, "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");

            await expectThrow(poolPartyFactory.createNewPoolParty("domain.com", "", "", web3.toWei("15"), "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");

            await expectThrow(poolPartyFactory.createNewPoolParty("", "Pool name", "", 0, "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");

            await expectThrow(poolPartyFactory.createNewPoolParty("", "", "Pool Description", 0, "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");

            await expectThrow(poolPartyFactory.createNewPoolParty("domain.com", "", "Pool Description", 0, "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");

            await expectThrow(poolPartyFactory.createNewPoolParty("domain.com", "Pool Name", "", web3.toWei("15"), "", {from: _creator1}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");
        });

        it('should create new pool with really long domain name, pool name and pool descripion', async () => {
            await poolPartyFactory.createNewPoolParty("thisisareallylongdomainnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisi" +
                "saddedjusttomakeitevenlongerbecausewhynotrightthisisareallylongdomainnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisisad" +
                "dedjusttomakeitevenlongerbecausewhynotrightandmaybejustalittlelongertobeabsolutelysureitworksok.com",
                "thisisareallylongpoolnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisi" +
                "saddedjusttomakeitevenlongerbecausewhynotrightthisisareallylongpoolnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisisad" +
                "dedjusttomakeitevenlongerbecausewhynotrightandmaybejustalittlelongertobeabsolutelysureitworksok",
                "thisisareallylongpooldescriptiononpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisi" +
                "saddedjusttomakeitevenlongerbecausewhynotrightthisisareallylongpooldescriptiononpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisisad" +
                "dedjusttomakeitevenlongerbecausewhynotrightandmaybejustalittlelongertobeabsolutelysureitworksok", web3.toWei("15"), "", {from: _creator1});
            assert.equal(await poolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");
        });

        it('should attempt to create pool with same name as already existing', async () => {
            await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator1});
            await expectThrow(poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator2}));
            assert.equal(await poolPartyFactory.getPartyListSize(), 1, "Too many contracts in the list");
        });

        it('should create multiple new pools', async () => {
            await poolPartyFactory.createNewPoolParty("test1.com", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));
            assert.equal(await poolParty.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect fee percentage");
            assert.equal(await poolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");

            await poolPartyFactory.createNewPoolParty("test2.com", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator2});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(1));
            assert.equal(await poolParty.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Incorrect withdrawal fee");
            assert.equal(await poolPartyFactory.getPartyListSize(), 2, "Incorrect number of entries in the list");

            await poolPartyFactory.createNewPoolParty("test3.com", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator3});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(2));
            assert.equal(await poolParty.expectedGroupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Incorrect group discount percentage");
            assert.equal(await poolPartyFactory.getPartyListSize(), 3, "Incorrect number of entries in the list");

            await poolPartyFactory.createNewPoolParty("test4.com", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator2});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(3));
            assert.equal(await poolPartyFactory.getPartyListSize(), 4, "Incorrect number of entries in the list");
        });
    });

    describe('Function: getContractAddressByName', () => {
        it('should get the address of the pool party contract by name', async () => {
            await poolPartyFactory.createNewPoolParty("api.test.foreground.io", "Pool name", "Pool description", web3.toWei("15"), "", {from: _creator1});
            poolParty = poolPartyArtifact.at(await poolPartyFactory.partyList(0));

            const poolAddress = await poolPartyFactory.getContractAddressByName("api.test.foreground.io");
            assert.equal(poolAddress, poolParty.address, "Incorrect address for pool party contract");
        });

        it('should attempt to get the address of a contract that does not exist', async () => {
            const poolAddress = await poolPartyFactory.getContractAddressByName("notfound.com");
            assert.equal(poolAddress, ZERO_ADDRESS, "Pool address should be 0");
        });
    });

    describe('Function: setFeePercentage', () => {
        it('should set a new fee percentage', async () => {
            await poolPartyFactory.setFeePercentage(5, {from: _deployer});
            assert.equal(await poolPartyFactory.feePercentage(), 5, "Incorrect fee percentage");
            assert.notEqual(await poolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage did not change");

            await poolPartyFactory.setFeePercentage(50, {from: _deployer});
            assert.equal(await poolPartyFactory.feePercentage(), 50, "Incorrect fee percentage");
            assert.notEqual(await poolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage did not change");
        });

        it('should attempt to set a new fee percentage with non owner account', async () => {
            await expectThrow(poolPartyFactory.setFeePercentage(10, {from: _creator1}));
            assert.notEqual(await poolPartyFactory.feePercentage(), 10, "Fee percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");
        });

        it('should attempt to set a new fee percentage above 50%', async () => {
            await expectThrow(poolPartyFactory.setFeePercentage(51, {from: _deployer}));
            assert.notEqual(await poolPartyFactory.feePercentage(), 51, "Fee percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");

            await expectThrow(poolPartyFactory.setFeePercentage(138, {from: _deployer}));
            assert.notEqual(await poolPartyFactory.feePercentage(), 138, "Fee percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");
        });
    });

    describe('Function: setWithdrawalFeeAmount', () => {
        it('should set a new withdrawal fee', async () => {
            await poolPartyFactory.setWithdrawalFeeAmount(web3.toWei("0.01"), {from: _deployer});
            assert.equal(await poolPartyFactory.withdrawalFee(), web3.toWei("0.01"), "Incorrect withdrawal fee");
            assert.notEqual(await poolPartyFactory.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Withdrawal fee did not change");
        });

        it('should attempt to set a new withdrawal fee with non owner account', async () => {
            await expectThrow(poolPartyFactory.setWithdrawalFeeAmount(web3.toWei("0.95"), {from: _creator1}));
            assert.notEqual(await poolPartyFactory.withdrawalFee(), web3.toWei("0.95"), "Withdrawal fee changed when it shouldn't have");
            assert.equal(await poolPartyFactory.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Withdrawal fee changed when it shouldn't have");
        });
    });

    describe('Function: setGroupPurchaseDiscountPercentage', () => {
        it('should set a new group discount percentage', async () => {
            await poolPartyFactory.setGroupPurchaseDiscountPercentage(35, {from: _deployer});
            assert.equal(await poolPartyFactory.groupDiscountPercent(), 35, "Incorrect group discount percentage");
            assert.notEqual(await poolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage did not change");

            await poolPartyFactory.setGroupPurchaseDiscountPercentage(100, {from: _deployer});
            assert.equal(await poolPartyFactory.groupDiscountPercent(), 100, "Group discount percentage did not change when it shouldn't have");
            assert.notEqual(await poolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage did not change");
        });

        it('should attempt to set a new group discount percentage with non owner account', async () => {
            await expectThrow(poolPartyFactory.setGroupPurchaseDiscountPercentage(7, {from: _creator1}));
            assert.notEqual(await poolPartyFactory.groupDiscountPercent(), 7, "Group discount percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");
        });

        it('should attempt to set a new group discount percentage greater than 100%', async () => {
            await expectThrow(poolPartyFactory.setGroupPurchaseDiscountPercentage(101, {from: _deployer}));
            assert.notEqual(await poolPartyFactory.groupDiscountPercent(), 101, "Group discount percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");

            await expectThrow(poolPartyFactory.setGroupPurchaseDiscountPercentage(150, {from: _deployer}));
            assert.notEqual(await poolPartyFactory.groupDiscountPercent(), 150, "Group discount percentage changed when it shouldn't have");
            assert.equal(await poolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");
        });
    });

    describe('Function: setPoolPartyOwnerAddress', () => {
        it('should set a new Pool Party owner address', async () => {
            await poolPartyFactory.setPoolPartyOwnerAddress(_newOwner, {from: _deployer});
            assert.equal(await poolPartyFactory.poolPartyOwnerAddress(), _newOwner, "Incorrect PP owner");
        });

        it('should attempt to set a new pool Party owner with non owner account', async () => {
            await expectThrow(poolPartyFactory.setPoolPartyOwnerAddress(_newOwner, {from: _creator1}));
            assert.notEqual(await poolPartyFactory.poolPartyOwnerAddress(), _newOwner, "PP owner changed when it shouldn't have");
            assert.equal(await poolPartyFactory.poolPartyOwnerAddress(), _deployer, "PP owner changed when it shouldn't have");
        });

        it('should attempt to set a new pool Party owner to blank address', async () => {
            await expectThrow(poolPartyFactory.setPoolPartyOwnerAddress(ZERO_ADDRESS, {from: _deployer}));
            assert.notEqual(await poolPartyFactory.poolPartyOwnerAddress(), ZERO_ADDRESS, "PP owner changed when it shouldn't have");
            assert.equal(await poolPartyFactory.poolPartyOwnerAddress(), _deployer, "PP owner changed when it shouldn't have");
        });
    });
});

