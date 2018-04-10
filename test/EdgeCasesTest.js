import expectThrow from './helpers/expectThrow';

let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let icoPoolParty = artifacts.require('./IcoPoolParty');
let customSale = artifacts.require('./test-contracts/CustomSale');
let genericToken = artifacts.require('./test-contracts/GenericToken');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;
let customSaleContract;
let genericTokenContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};



contract('Generic Pool Party ICO - Release Funds', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    var domainIndex = 0;
    beforeEach(async () => {
        icoPoolPartyFactoryContract = await icoPoolPartyFactory.deployed();
        smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");


        genericTokenContract = await genericToken.new({from: deployer});
        customSaleContract = await customSale.new(web3.toWei("0.05"), genericTokenContract.address, {from: deployer});
        await genericTokenContract.transferOwnership(customSaleContract.address, {from: deployer});

        //genericTokenContract = await genericToken.deployed();
        //customSaleContract = await CustomSale.deployed();

        //CREATE A NEW POOL
        smartLog("Creating new pool...", true);
        await icoPoolPartyFactoryContract.setDueDiligenceDuration(3);
        await icoPoolPartyFactoryContract.setWaterMark(web3.toWei("10"));
        await icoPoolPartyFactoryContract.createNewPoolParty("testDomain" + domainIndex + ".io", {from: deployer});
        const poolAddress = await icoPoolPartyFactoryContract.partyList(domainIndex);
        domainIndex++;        
        icoPoolPartyContract = icoPoolParty.at(poolAddress);
        
        //ADD FUNDS TO POOL (for each of the 5 participants)
        smartLog("Adding Funds to pool...", true);
        await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("4", "ether")});
        await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("3", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor3, value: web3.toWei("2", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor4, value: web3.toWei("1", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor5, value: web3.toWei("3", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor6, value: web3.toWei("2", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor7, value: web3.toWei("1", "ether")});  
        
        smartLog("Confirming investment amounts...", true);
        let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("16", "ether"), "Incorrect total");
        
        let investmentAmount = (await icoPoolPartyContract.investors(investor1))[0];
        assert.equal(investmentAmount, web3.toWei("4", "ether"), "Incorrect balance");
        
        let investmentAmount2 = (await icoPoolPartyContract.investors(investor2))[0];
        assert.equal(investmentAmount2, web3.toWei("3", "ether"), "Incorrect balance");
        
        let investmentAmount3 = (await icoPoolPartyContract.investors(investor3))[0];
        assert.equal(investmentAmount3, web3.toWei("2", "ether"), "Incorrect balance");

        let investmentAmount7 = (await icoPoolPartyContract.investors(investor7))[0];
        assert.equal(investmentAmount7, web3.toWei("1", "ether"), "Incorrect balance");

        //Have investor 3 leave the pool
        smartLog("Having Investor 3 leave the pool...", true);
        await icoPoolPartyContract.leavePool({from: investor3});
        totalInvested = await icoPoolPartyContract.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        
        //Set the Authorized Configuration Address
        let poolState = await icoPoolPartyContract.poolStatus();
        await icoPoolPartyContract.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
        let poolDetails = await icoPoolPartyContract.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await icoPoolPartyContract.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");

        //Configure Pool Details
        await icoPoolPartyContract.configurePool(customSaleContract.address, genericTokenContract.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
        assert.equal(await icoPoolPartyContract.buyFunctionName(), "buy()", "Wrong buyFunctionName");

        //Complete Configuration
        await icoPoolPartyContract.completeConfiguration({from: accounts[7]});
        poolState = await icoPoolPartyContract.poolStatus();
        assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
    });

    describe('Generic Sale - Release Funds', function () {
        this.slow(5000);

        before(async () => {            
            smartLog("Starting tests...");
        });

        it("should check the pool's balance", async () => {
            smartLog("Checking pool balance...", true);
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        });

        it("Have a 3rd party try to release pool's funds...", async () => {            
            await sleep(3500);

            await icoPoolPartyContract.startInReviewPeriod({from: accounts[7]});

            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
            let theState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");            

            let subsidy = await calculateSubsidy();
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await icoPoolPartyContract.feePercentage();
            let total = await icoPoolPartyContract.totalPoolInvestments();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await expectThrow(icoPoolPartyContract.releaseFundsToSale({
                from: accounts[6],
                value: subsidy + fee,
                gas: 300000
            }));      

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");

            let tokensDue0 = (await icoPoolPartyContract.getContributionsDue(investor1))[2];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
        });


        it("should release funds and compare balances...", async () => {
            await sleep(3500);

            await icoPoolPartyContract.startInReviewPeriod({from: accounts[7]});
            
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
            let theState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");            

            let subsidy = await calculateSubsidy();
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await icoPoolPartyContract.feePercentage();
            let total = await icoPoolPartyContract.totalPoolInvestments();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });      

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");

            let investor1tokensDue = (await icoPoolPartyContract.getContributionsDue(investor1))[2];
            smartLog("Investor 1 has [" + investor1tokensDue + "] tokens due");            
            let investor2tokensDue = (await icoPoolPartyContract.getContributionsDue(investor2))[2];
            smartLog("Investor 2 has [" + investor2tokensDue + "] tokens due");            
            let investor3tokensDue = (await icoPoolPartyContract.getContributionsDue(investor3))[2];
            smartLog("Investor 3 has [" + investor3tokensDue + "] tokens due");            
            let investor4tokensDue = (await icoPoolPartyContract.getContributionsDue(investor4))[2];
            smartLog("Investor 4 has [" + investor4tokensDue + "] tokens due");            
            let investor5tokensDue = (await icoPoolPartyContract.getContributionsDue(investor5))[2];
            smartLog("Investor 5 has [" + investor5tokensDue + "] tokens due");   
            let investor6tokensDue = (await icoPoolPartyContract.getContributionsDue(investor6))[2];
            smartLog("Investor 6 has [" + investor6tokensDue + "] tokens due");   
            let investor7tokensDue = (await icoPoolPartyContract.getContributionsDue(investor7))[2];
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
            smartLog("Balance Snapshot: " + await icoPoolPartyContract.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolPartyContract.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");            
        });

    });

    /***********************************************************/
    /*                    HELPER FUNCTIONS                     */

    /***********************************************************/

    function smartLog(message, override) {
        let verbose = true;
        if (verbose || override)
            console.log(message);
    }

    async function calculateSubsidy() {
        let _expectedGroupDiscountPercent = await icoPoolPartyContract.expectedGroupDiscountPercent();
        smartLog("expectedGroupDiscountPercent [" + _expectedGroupDiscountPercent + "%]");
        let _actualGroupDiscountPercent = await icoPoolPartyContract.actualGroupDiscountPercent();
        smartLog("actualGroupDiscountPercent [" + _actualGroupDiscountPercent + "%]");
        let _expectedGroupTokenPrice = await icoPoolPartyContract.expectedGroupTokenPrice();
        smartLog("expectedGroupTokenPrice [" + web3.fromWei(_expectedGroupTokenPrice) + "]");
        let _totalPoolInvestments = await icoPoolPartyContract.totalPoolInvestments();
        smartLog("totalPoolInvestments [" + web3.fromWei(_totalPoolInvestments) + "]");

        let _groupContPercent = 100 - _actualGroupDiscountPercent;
        let _amountToRelease = _totalPoolInvestments * 100 / _groupContPercent;

        smartLog("amountToRelease [" + web3.fromWei(_amountToRelease) + "]");

        return _amountToRelease - _totalPoolInvestments;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
