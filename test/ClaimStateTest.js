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

let icoPoolPartyFactory;
let icoPoolParty;
let customSale;
let genericToken;
let mockNameService;

contract('ICO Pool Party', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    let domainIndex = 0;
    before(async () => {
        mockNameService = await mockNameServiceArtifact.new();
        await mockNameService.__callback(web3.sha3("testDomain" + domainIndex + ".io"), investor7.toString(), 0x42);

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(deployer, mockNameService.address, {from: deployer});
    });

    beforeEach(async () => {
        smartLog("Pool Party Factory Address [" + await icoPoolPartyFactory.address + "]");

        await mockNameService.__callback(web3.sha3("testDomain" + domainIndex + ".io"), investor7.toString(), 0x42);

        genericToken = await genericTokenArtifact.new({from: deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: deployer});
        await genericToken.transferOwnership(customSale.address, {from: deployer});

        //genericToken = await genericTokenArtifact.deployed();
        //customSale = await CustomSale.deployed();

        //CREATE A NEW POOL
        smartLog("Creating new pool...", true);
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("10"));
        await icoPoolPartyFactory.createNewPoolParty("testDomain" + domainIndex + ".io", {from: deployer});
        const poolAddress = await icoPoolPartyFactory.partyList(domainIndex);
        domainIndex++;        
        icoPoolParty = poolPartyArtifact.at(poolAddress);
        
        //ADD FUNDS TO POOL (for each of the 5 participants)
        smartLog("Adding Funds to pool...", true);
        await icoPoolParty.addFundsToPool({from: investor1, value: web3.toWei("4", "ether")});
        await icoPoolParty.addFundsToPool({from: investor2, value: web3.toWei("3", "ether")});
        await icoPoolParty.addFundsToPool({from: investor3, value: web3.toWei("2", "ether")});
        await icoPoolParty.addFundsToPool({from: investor4, value: web3.toWei("1", "ether")});
        await icoPoolParty.addFundsToPool({from: investor5, value: web3.toWei("3", "ether")});
        await icoPoolParty.addFundsToPool({from: investor6, value: web3.toWei("2", "ether")});
        await icoPoolParty.addFundsToPool({from: investor7, value: web3.toWei("1", "ether")});
        
        smartLog("Confirming investment amounts...", true);
        let totalInvested = await icoPoolParty.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("16", "ether"), "Incorrect total");
        
        let investmentAmount = (await icoPoolParty.investors(investor1))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount, web3.toWei("4", "ether"), "Incorrect balance");
        
        let investmentAmount2 = (await icoPoolParty.investors(investor2))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount2, web3.toWei("3", "ether"), "Incorrect balance");
        
        let investmentAmount3 = (await icoPoolParty.investors(investor3))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount3, web3.toWei("2", "ether"), "Incorrect balance");

        let investmentAmount7 = (await icoPoolParty.investors(investor7))[InvestorStruct.investmentAmount];
        assert.equal(investmentAmount7, web3.toWei("1", "ether"), "Incorrect balance");

        //Have investor 3 leave the pool
        smartLog("Having Investor 3 leave the pool...", true);
        await icoPoolParty.leavePool({from: investor3});
        totalInvested = await icoPoolParty.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        
        //Set the Authorized Configuration Address
        let poolState = await icoPoolParty.poolStatus();
        await icoPoolParty.setAuthorizedConfigurationAddress({from: deployer});
        let poolDetails = await icoPoolParty.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await icoPoolParty.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");
    });

    describe('Generic Sale - Claim Tests', function () {
        this.slow(5000);

        before(async () => {            
            smartLog("Starting tests...");
        });

        it("should check the pool's balance", async () => {
            smartLog("Checking pool balance...", true);
            let totalInvested = await icoPoolParty.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        });


        async function ConfigurePoolDetails(){
            //Configure Pool Details
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: investor7});
            assert.equal(await icoPoolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");
        }
        
        async function CompleteConfiguration() {
            //Complete Configuration
            await icoPoolParty.completeConfiguration({from: investor7});
            let poolState = await icoPoolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        }

        async function ReleaseFundsToSale(){
            await sleep(3500);

            await icoPoolParty.startInReviewPeriod({from: investor7});
            
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");
            let theState = await icoPoolParty.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");

            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await icoPoolParty.feePercentage();
            let total = await icoPoolParty.totalPoolInvestments();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            await icoPoolParty.releaseFundsToSale({
                from: investor7,
                value: subsidy + fee,
                gas: 300000
            });  

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");
        }



        it("should not be able to claim refund twice", async () => {            
            //Configure Pool Details
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: investor7});
            assert.equal(await icoPoolParty.buyFunctionName(), "buyWithIntentToRefund()", "Wrong buyFunctionName");

            await CompleteConfiguration();
            await ReleaseFundsToSale();

            smartLog("Getting snapshot...");

            //Get snapshot value
            let firstSnapshot = await icoPoolParty.balanceRemainingSnapshot();
            smartLog("firstSnapshot: " + firstSnapshot);

            let accountBalanceBefore = await web3.eth.getBalance(investor1);
            let contributionBefore = web3.toWei("4", "ether");

            smartLog("accountBalanceBefore: " + accountBalanceBefore);
            smartLog("contributionBefore: " + contributionBefore);


            await icoPoolParty.claimRefundFromIco({
                from: investor7,
                gas: 300000
            });

            smartLog("claimRefundFromIco() called...");

            //Have someone claim
            await icoPoolParty.claimRefund({
                from: investor1,
                gas: 300000
            });

            smartLog("claimRefund() called...");

            //Investor who claimed tokens due? Ether due?
            await expectThrow(
                icoPoolParty.claimRefund({
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
                icoPoolParty.leavePool({
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
            
            let startingBalance = await genericToken.balanceOf(icoPoolParty.address);
            
            smartLog("startingBalance: " + startingBalance);

            smartLog("claiming tokens...");
            await icoPoolParty.claimTokens({
                    from: investor1,
                    gas: 300000
            });
            
            smartLog("claiming tokens 2...");
            await icoPoolParty.claimTokens({
                from: investor2,
                gas: 300000
            });            

            smartLog("claiming tokens 4...");
            await icoPoolParty.claimTokens({
                from: investor4,
                gas: 300000
            });

            smartLog("claiming tokens 5...");
            await icoPoolParty.claimTokens({
                from: investor5,
                gas: 300000
            });

            smartLog("claiming tokens 6...");
            await icoPoolParty.claimTokens({
                from: investor6,
                gas: 300000
            });

            smartLog("claiming tokens 7...");
            await icoPoolParty.claimTokens({
                from: investor7,
                gas: 300000
            });

            smartLog("all tokens claimed...");

            let finalBalance = await genericToken.balanceOf(icoPoolParty.address);

            smartLog("finalBalance: " + finalBalance);

            //NOTE: this test only covers the balance being very, very close to correct -- not counting rounding wei values
            //for each of the pool participants (1/10th of 1%)
            assert.isAbove(startingBalance * .001,finalBalance, "tokens still remaining after withdrawal...");

        });
    });
});
