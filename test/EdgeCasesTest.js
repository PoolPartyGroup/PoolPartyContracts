import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    ParticipantStruct,
    Contributions,
    DUE_DILIGENCE_DURATION,
    customSaleArtifact,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact,
    mockNameServiceArtifact
} from './helpers/utils';

let poolPartyFactory;
let poolParty;
let customSale;
let genericToken;
let mockNameService;


contract('Generic Pool Party ICO - Release Funds', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    let domainIndex = 0;

    before(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        poolPartyFactory = await poolPartyFactoryArtifact.new(deployer, mockNameService.address, {from: deployer});
    });

    beforeEach(async () => {
        smartLog("Pool Party Factory Address [" + await poolPartyFactory.address + "]");
        await mockNameService.__callback(web3.sha3("testDomain" + domainIndex + ".io"), investor7.toString(), 0x42);

        genericToken = await genericTokenArtifact.new({from: deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: deployer});
        await genericToken.transferOwnership(customSale.address, {from: deployer});

        //genericToken = await genericTokenArtifact.deployed();
        //customSale = await CustomSale.deployed();

        //CREATE A NEW POOL
        smartLog("Creating new pool...", true);
        await poolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await poolPartyFactory.createNewPoolParty("testDomain" + domainIndex + ".io", "Pool name", "Pool description", web3.toWei("10"), web3.toWei("0.5"), "QmNd7C8BwUqfhfq6xyRRMzxk1v3dALQjDxwBg4yEJkU24D", {from: deployer});
        poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(domainIndex));
        domainIndex++;


        //ADD FUNDS TO POOL (for each of the 5 participants)
        smartLog("Adding Funds to pool...", true);
        await poolParty.addFundsToPool(8, {from: investor1, value: web3.toWei("4", "ether")});
        await poolParty.addFundsToPool(6, {from: investor2, value: web3.toWei("3", "ether")});
        await poolParty.addFundsToPool(4, {from: investor3, value: web3.toWei("2", "ether")});
        await poolParty.addFundsToPool(2, {from: investor4, value: web3.toWei("1", "ether")});
        await poolParty.addFundsToPool(6, {from: investor5, value: web3.toWei("3", "ether")});
        await poolParty.addFundsToPool(4, {from: investor6, value: web3.toWei("2", "ether")});
        await poolParty.addFundsToPool(2, {from: investor7, value: web3.toWei("1", "ether")});
        
        smartLog("Confirming investment amounts...", true);
        let totalInvested = await poolParty.totalPoolContributions();
        assert.equal(totalInvested, web3.toWei("16", "ether"), "Incorrect total");
        
        let investmentAmount = (await poolParty.participants(investor1))[ParticipantStruct.amountContributed];
        assert.equal(investmentAmount, web3.toWei("4", "ether"), "Incorrect balance");
        
        let investmentAmount2 = (await poolParty.participants(investor2))[ParticipantStruct.amountContributed];
        assert.equal(investmentAmount2, web3.toWei("3", "ether"), "Incorrect balance");
        
        let investmentAmount3 = (await poolParty.participants(investor3))[ParticipantStruct.amountContributed];
        assert.equal(investmentAmount3, web3.toWei("2", "ether"), "Incorrect balance");

        let investmentAmount7 = (await poolParty.participants(investor7))[ParticipantStruct.amountContributed];
        assert.equal(investmentAmount7, web3.toWei("1", "ether"), "Incorrect balance");

        //Have investor 3 leave the pool
        smartLog("Having Investor 3 leave the pool...", true);
        await poolParty.leavePool({from: investor3});
        totalInvested = await poolParty.totalPoolContributions();
        assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        
        //Set the Authorized Configuration Address
        let poolState = await poolParty.poolStatus();
        await poolParty.setAuthorizedConfigurationAddress({from: deployer});
        let poolDetails = await poolParty.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await poolParty.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");

        //Configure Pool Details
        await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: investor7});
        assert.equal(await poolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");

        //Complete Configuration
        await poolParty.completeConfiguration({from: investor7});
        poolState = await poolParty.poolStatus();
        assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
    });

    describe('Generic Sale - Release Funds', function () {
        this.slow(5000);

        before(async () => {            
            smartLog("Starting tests...");
        });

        it("should check the pool's balance", async () => {
            smartLog("Checking pool balance...", true);
            let totalInvested = await poolParty.totalPoolContributions();
            assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        });

        it("Have a 3rd party try to release pool's funds...", async () => {            
            await sleep(3500);

            await poolParty.startInReviewPeriod({from: investor7});

            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
            let theState = await poolParty.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await poolParty.totalPoolContributions()) + "]");

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolContributions());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await poolParty.feePercentage();
            let total = await poolParty.totalPoolContributions();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(poolParty.releaseFundsToSale({
                from: investor7,
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await expectThrow(poolParty.releaseFundsToSale({
                from: investor6,
                value: subsidy + fee,
                gas: 300000
            }));      

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");

            let tokensDue0 = (await poolParty.getContributionsDue(investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
        });


        it("should release funds and compare balances...", async () => {
            await sleep(3500);

            await poolParty.startInReviewPeriod({from: investor7});
            
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
            let theState = await poolParty.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await poolParty.totalPoolContributions()) + "]");

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolContributions());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await poolParty.feePercentage();
            let total = await poolParty.totalPoolContributions();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(poolParty.releaseFundsToSale({
                from: investor7,
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await poolParty.releaseFundsToSale({
                from: investor7,
                value: subsidy + fee,
                gas: 300000
            });      

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");

            let investor1tokensDue = (await poolParty.getContributionsDue(investor1))[Contributions.tokensDue];
            smartLog("Investor 1 has [" + investor1tokensDue + "] tokens due");            
            let investor2tokensDue = (await poolParty.getContributionsDue(investor2))[Contributions.tokensDue];
            smartLog("Investor 2 has [" + investor2tokensDue + "] tokens due");            
            let investor3tokensDue = (await poolParty.getContributionsDue(investor3))[Contributions.tokensDue];
            smartLog("Investor 3 has [" + investor3tokensDue + "] tokens due");            
            let investor4tokensDue = (await poolParty.getContributionsDue(investor4))[Contributions.tokensDue];
            smartLog("Investor 4 has [" + investor4tokensDue + "] tokens due");            
            let investor5tokensDue = (await poolParty.getContributionsDue(investor5))[Contributions.tokensDue];
            smartLog("Investor 5 has [" + investor5tokensDue + "] tokens due");   
            let investor6tokensDue = (await poolParty.getContributionsDue(investor6))[Contributions.tokensDue];
            smartLog("Investor 6 has [" + investor6tokensDue + "] tokens due");   
            let investor7tokensDue = (await poolParty.getContributionsDue(investor7))[Contributions.tokensDue];
            smartLog("Investor 7 has [" + investor7tokensDue + "] tokens due");   

            assert.equal(investor3tokensDue, 0, "Incorrect total, expected 0 tokens");
            assert.equal(investor1tokensDue, investor6tokensDue * 2, "Incorrect relative token balances...");
            assert.equal(investor1tokensDue, investor7tokensDue * 4, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, investor7tokensDue * 3, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, investor7tokensDue * 3, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, (Number(investor6tokensDue) + Number(investor7tokensDue)), "Incorrect relative token balances...");

            smartLog("Investor1TokensDue: " + investor1tokensDue);
            smartLog("Investor6TokensDue: " + investor6tokensDue);
            assert.equal(investor1tokensDue, 4 / 0.04 * 10**18, "Incorrect token balance based on expected token price...");
            assert.equal(investor6tokensDue, 2 / 0.04 * 10**18, "Incorrect token balance based on expected token price...");

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await poolParty.balanceRemainingSnapshot());
            assert.equal(await poolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });

    });
});
