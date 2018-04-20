import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    InvestorStruct,
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

contract('ICO Pool Party', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    let domainIndex = 0;
    before(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("testDomain" + domainIndex + ".io"), investor7.toString(), 0x42);

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
        const _poolGuid = await poolPartyFactory.partyGuidList(domainIndex);
        poolParty = poolPartyArtifact.at(await poolPartyFactory.poolAddresses(_poolGuid));
        domainIndex++;
        
        //ADD FUNDS TO POOL (for each of the 5 participants)
        smartLog("Adding Funds to pool...", true);
        await poolParty.addFundsToPool({from: investor1, value: web3.toWei("4", "ether")});
        await poolParty.addFundsToPool({from: investor2, value: web3.toWei("3", "ether")});
        await poolParty.addFundsToPool({from: investor3, value: web3.toWei("2", "ether")});
        await poolParty.addFundsToPool({from: investor4, value: web3.toWei("1", "ether")});
        await poolParty.addFundsToPool({from: investor5, value: web3.toWei("3", "ether")});
        await poolParty.addFundsToPool({from: investor6, value: web3.toWei("2", "ether")});
        await poolParty.addFundsToPool({from: investor7, value: web3.toWei("1", "ether")});
        
        smartLog("Confirming investment amounts...", true);
        let totalInvested = await poolParty.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("16", "ether"), "Incorrect total");
        
        let investmentAmount = (await poolParty.investors(investor1))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount, web3.toWei("4", "ether"), "Incorrect balance");
        
        let investmentAmount2 = (await poolParty.investors(investor2))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount2, web3.toWei("3", "ether"), "Incorrect balance");
        
        let investmentAmount3 = (await poolParty.investors(investor3))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount3, web3.toWei("2", "ether"), "Incorrect balance");

        let investmentAmount7 = (await poolParty.investors(investor7))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount7, web3.toWei("1", "ether"), "Incorrect balance");

        //Have investor 3 leave the pool
        smartLog("Having Investor 3 leave the pool...", true);
        await poolParty.leavePool({from: investor3});
        totalInvested = await poolParty.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        
        //Set the Authorized Configuration Address
        let poolState = await poolParty.poolStatus();
        await poolParty.setAuthorizedConfigurationAddress({from: deployer});
        let poolDetails = await poolParty.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await poolParty.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");
    });

    describe('Generic Sale - Claim Tests', function () {
        this.slow(5000);

        before(async () => {            
            smartLog("Starting tests...");
        });

        it("should check the pool's balance", async () => {
            smartLog("Checking pool balance...", true);
            let totalInvested = await poolParty.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        });


        async function ConfigurePoolDetails(){
            //Configure Pool Details
            await poolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: investor7});
            assert.equal(await poolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");
        }
        
        async function CompleteConfiguration() {
            //Complete Configuration
            await poolParty.completeConfiguration({from: investor7});
            let poolState = await poolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        }

        async function ReleaseFundsToSale(){
            await sleep(3500);

            await poolParty.startInReviewPeriod({from: investor7});
            
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
            let theState = await poolParty.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await poolParty.totalPoolInvestments()) + "]");

            const subsidy = calculateSubsidy(await poolParty.actualGroupDiscountPercent(), await poolParty.totalPoolInvestments());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await poolParty.feePercentage();
            let total = await poolParty.totalPoolInvestments();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            await poolParty.releaseFundsToSale({
                from: investor7,
                value: subsidy + fee,
                gas: 300000
            });  

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(poolParty.address)) + "]");
        }



        it("should not be able to claim refund twice", async () => {            
            //Configure Pool Details
            await poolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: investor7});
            assert.equal(await poolParty.buyFunctionName(), "buyWithIntentToRefund()", "Wrong buyFunctionName");

            await CompleteConfiguration();
            await ReleaseFundsToSale();

            smartLog("Getting snapshot...");

            //Get snapshot value
            let firstSnapshot = await poolParty.balanceRemainingSnapshot();
            smartLog("firstSnapshot: " + firstSnapshot);

            let accountBalanceBefore = await web3.eth.getBalance(investor1);
            let contributionBefore = web3.toWei("4", "ether");

            smartLog("accountBalanceBefore: " + accountBalanceBefore);
            smartLog("contributionBefore: " + contributionBefore);


            await poolParty.claimRefundFromVendor({
                from: investor7,
                gas: 300000
            });

            smartLog("claimRefundFromVendor() called...");

            //Have someone claim
            await poolParty.claimRefund({
                from: investor1,
                gas: 300000
            });

            smartLog("claimRefund() called...");

            //Investor who claimed tokens due? Ether due?
            await expectThrow(
                poolParty.claimRefund({
                    from: investor1,
                    gas: 300000
                })
            );
        });


        it("should not allow leaving pool while in claim state...", async () => {            
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();

            smartLog("leaving pool...");

            //Now in Claim state
            //Have investor1 try to leave the pool
            //Should only be able to claim tokens or refund
            await expectThrow(
                poolParty.leavePool({
                    from: investor1,
                    gas: 300000
                })
            );
            smartLog("leavePool() called...");
        });


        it("should be able to empty pool of tokens...", async () => {            
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();
            
            let startingBalance = await genericToken.balanceOf(poolParty.address);
            
            smartLog("startingBalance: " + startingBalance);

            smartLog("claiming tokens...");
            await poolParty.claimTokens({
                    from: investor1,
                    gas: 300000
            });
            
            smartLog("claiming tokens 2...");
            await poolParty.claimTokens({
                from: investor2,
                gas: 300000
            });            

            smartLog("claiming tokens 4...");
            await poolParty.claimTokens({
                from: investor4,
                gas: 300000
            });

            smartLog("claiming tokens 5...");
            await poolParty.claimTokens({
                from: investor5,
                gas: 300000
            });

            smartLog("claiming tokens 6...");
            await poolParty.claimTokens({
                from: investor6,
                gas: 300000
            });

            smartLog("claiming tokens 7...");
            await poolParty.claimTokens({
                from: investor7,
                gas: 300000
            });

            smartLog("all tokens claimed...");

            let finalBalance = await genericToken.balanceOf(poolParty.address);

            smartLog("finalBalance: " + finalBalance);

            //NOTE: this test only covers the balance being very, very close to correct -- not counting rounding wei values
            //for each of the pool participants (1/10th of 1%)
            assert.isAbove(startingBalance * .001,finalBalance, "tokens still remaining after withdrawal...");

        });
    });
});
