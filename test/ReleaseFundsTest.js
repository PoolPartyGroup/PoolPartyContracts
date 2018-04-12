import expectThrow from './helpers/expectThrow';
import {
    smartLog,
    sleep,
    calculateSubsidy,
    Status,
    InvestorStruct,
    Contributions,
    DUE_DILIGENCE_DURATION,
    customSaleArtifact,
    genericTokenArtifact,
    poolPartyArtifact,
    poolPartyFactoryArtifact
} from './helpers/utils';

let icoPoolPartyFactory;
let icoPoolParty;
let customSale;
let genericToken;

contract('Generic Pool Party ICO - Release Funds', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    let domainIndex = 0;
    beforeEach(async () => {
        icoPoolPartyFactory = await poolPartyFactoryArtifact.deployed();
        smartLog("Pool Party Factory Address [" + await icoPoolPartyFactory.address + "]");


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
        await icoPoolParty.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
        let poolDetails = await icoPoolParty.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await icoPoolParty.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");
    });

    describe('Generic Sale - Release Funds', function () {
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
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");
        }
        
        async function CompleteConfiguration() {
            //Complete Configuration
            await icoPoolParty.completeConfiguration({from: accounts[7]});
            let poolState = await icoPoolParty.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        }

        async function ReleaseFundsToSale(){
            await sleep(3500);

            await icoPoolParty.startInReviewPeriod({from: accounts[7]});
            
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
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });  

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");
        }



        it("Have a 3rd party try to release pool's funds...", async () => {            
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            
            await sleep(3500);

            await icoPoolParty.startInReviewPeriod({from: accounts[7]});

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

            //Send too little as the subsidy - should fail
            await expectThrow(icoPoolParty.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await expectThrow(icoPoolParty.releaseFundsToSale({
                from: accounts[6],
                value: subsidy + fee,
                gas: 300000
            }));
            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");

            let tokensDue0 = (await icoPoolParty.getContributionsDue(investor1))[Contributions.tokensDue];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");            
        });


        it("should release funds and compare balances...", async () => {
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();

            let investor1tokensDue = (await icoPoolParty.getContributionsDue(investor1))[Contributions.tokensDue];
            smartLog("Investor 1 has [" + investor1tokensDue + "] tokens due");            
            let investor2tokensDue = (await icoPoolParty.getContributionsDue(investor2))[Contributions.tokensDue];
            smartLog("Investor 2 has [" + investor2tokensDue + "] tokens due");            
            let investor3tokensDue = (await icoPoolParty.getContributionsDue(investor3))[Contributions.tokensDue];
            smartLog("Investor 3 has [" + investor3tokensDue + "] tokens due");            
            let investor4tokensDue = (await icoPoolParty.getContributionsDue(investor4))[Contributions.tokensDue];
            smartLog("Investor 4 has [" + investor4tokensDue + "] tokens due");            
            let investor5tokensDue = (await icoPoolParty.getContributionsDue(investor5))[Contributions.tokensDue];
            smartLog("Investor 5 has [" + investor5tokensDue + "] tokens due");   
            let investor6tokensDue = (await icoPoolParty.getContributionsDue(investor6))[Contributions.tokensDue];
            smartLog("Investor 6 has [" + investor6tokensDue + "] tokens due");   
            let investor7tokensDue = (await icoPoolParty.getContributionsDue(investor7))[Contributions.tokensDue];
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
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");

        });



        it("should handle minimum participant balance...", async () => {            
            await expectThrow(
                icoPoolParty.addFundsToPool({from: investor3, value: 3})
            );
        });

        it("should handle small participant balances...", async () => {
            
            smartLog("Adding Ether minimum....");
            //Add a balance that is indivisible by the number of participants (very small wei value)            
            await icoPoolParty.addFundsToPool({from: investor3, value: web3.toWei("0.01", "ether")});

            //await ConfigurePoolDetails();
            //Configure Pool Details
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolParty.buyFunctionName(), "buy()", "Wrong buyFunctionName");

            await CompleteConfiguration();
        
            let totalTokensExpected = (await icoPoolParty.totalPoolInvestments()) * Math.pow(10,18) / (await icoPoolParty.groupEthPricePerToken())
            smartLog("EXPECTED TOKENS: " + totalTokensExpected);
            //poolTokenBalance = tokenAddress.balanceOf(address(this));
            //uint256 _expectedTokenBalance = totalPoolInvestments.mul(tokenPrecision).div(groupEthPricePerToken);
            //require(poolTokenBalance >= _expectedTokenBalance);

            await ReleaseFundsToSale();
            
            let tokensActuallySent = await genericToken.balanceOf(icoPoolParty.address);

            smartLog("ACTUAL TOKENS: " + tokensActuallySent);

            let investor1tokensDue = (await icoPoolParty.getContributionsDue(investor1))[Contributions.tokensDue];
            smartLog("Investor 1 has [" + investor1tokensDue + "] tokens due");            
            let investor2tokensDue = (await icoPoolParty.getContributionsDue(investor2))[Contributions.tokensDue];
            smartLog("Investor 2 has [" + investor2tokensDue + "] tokens due");            
            let investor3tokensDue = (await icoPoolParty.getContributionsDue(investor3))[Contributions.tokensDue];
            smartLog("Investor 3 has [" + investor3tokensDue + "] tokens due");            
            let investor4tokensDue = (await icoPoolParty.getContributionsDue(investor4))[Contributions.tokensDue];
            smartLog("Investor 4 has [" + investor4tokensDue + "] tokens due");            
            let investor5tokensDue = (await icoPoolParty.getContributionsDue(investor5))[Contributions.tokensDue];
            smartLog("Investor 5 has [" + investor5tokensDue + "] tokens due");   
            let investor6tokensDue = (await icoPoolParty.getContributionsDue(investor6))[Contributions.tokensDue];
            smartLog("Investor 6 has [" + investor6tokensDue + "] tokens due");   
            let investor7tokensDue = (await icoPoolParty.getContributionsDue(investor7))[Contributions.tokensDue];
            smartLog("Investor 7 has [" + investor7tokensDue + "] tokens due");   
            
            assert.equal(investor1tokensDue, investor6tokensDue * 2, "Incorrect relative token balances...");
            assert.equal(investor1tokensDue, investor7tokensDue * 4, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, investor7tokensDue * 3, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, investor7tokensDue * 3, "Incorrect relative token balances...");
            assert.equal(investor5tokensDue, (Number(investor6tokensDue) + Number(investor7tokensDue)), "Incorrect relative token balances...");

            smartLog("Investor3TokensDue: " + investor3tokensDue);
            smartLog("Investor6TokensDue: " + investor6tokensDue);
            assert.equal(investor3tokensDue, 0.01 / 0.04 * 10**18, "Incorrect token balance based on expected token price...");
            assert.equal(investor6tokensDue, 2 / 0.04 * 10**18, "Incorrect token balance based on expected token price...");

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });

        it("should deliver the correct fee to the Pool Party owner...", async () => {
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            
            let ownerAddress = await icoPoolParty.poolPartyOwnerAddress();
            smartLog("owner Address: " + ownerAddress);
            let balanceBefore = await web3.eth.getBalance(ownerAddress);
            smartLog("Balance before: " + balanceBefore);

            await ReleaseFundsToSale();
            
            let balanceAfter = await web3.eth.getBalance(ownerAddress);

            const subsidy = calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments());
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");
            let feePercent = await icoPoolParty.feePercentage();
            let total = await icoPoolParty.totalPoolInvestments();
            let fee = total * feePercent / 100;


            assert.equal(balanceAfter - balanceBefore, fee); 

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });

        it("should fail if ReleaseFundsToSale() is called twice...", async () => {
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();
            
            await expectThrow(
                ReleaseFundsToSale()
            );

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });

        it("should fail if no subsidy is sent to subsidized pool...", async () => {
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            
            await sleep(3500);
            
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

            await expectThrow(
                icoPoolParty.releaseFundsToSale({
                    from: accounts[7],
                    value: 0,
                    gas: 300000
                })
            );

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSale.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "]");

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.equal(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });


        it("should send Ether into fallback function if buy() not set...", async () => {

            //Configure Pool Details
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "N/A", "TestValue", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolParty.buyFunctionName(), "N/A", "Wrong buyFunctionName");

            await CompleteConfiguration();

            smartLog("Contract Address: " + customSale.address);
            let balanceBeforeRelease = await web3.eth.getBalance(customSale.address);
            smartLog("Balance Before Release: " + balanceBeforeRelease);

            await ReleaseFundsToSale();
            
            let balanceAfterRelease = await web3.eth.getBalance(customSale.address);
            smartLog("Balance After Release: " + balanceAfterRelease);
            //Total pool investments + subsidy
            //uint256 _groupContributionPercent = uint256(100).sub(actualGroupDiscountPercent);
            let groupDiscountPercent = await icoPoolParty.actualGroupDiscountPercent();
            let totalPoolInvestments = await icoPoolParty.totalPoolInvestments();
            let amountToRelease = totalPoolInvestments / (100 - groupDiscountPercent) * 100;
            //let totalInvestments = await icoPoolParty.totalPoolInvestments()
            //_actualSubsidy = _amountToRelease.sub(totalPoolInvestments);
            smartLog("amountToRelease: " + amountToRelease);
            assert.equal(balanceAfterRelease - balanceBeforeRelease, amountToRelease);

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });


        it("should should be able to call claim() after ReleaseFundsToSale() after minting tokens", async () => {
            
            //Configure Pool Details
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "N/A", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolParty.buyFunctionName(), "N/A", "Wrong buyFunctionName");

            await CompleteConfiguration();

            smartLog("Contract Address: " + customSale.address);
            let balanceBeforeRelease = await web3.eth.getBalance(customSale.address);
            smartLog("Balance Before Release: " + balanceBeforeRelease);

        
            let groupDiscountPercent = await icoPoolParty.actualGroupDiscountPercent(); //20 (0.05 -> 0.04)
            let totalPoolInvestments = await icoPoolParty.totalPoolInvestments();
            let amountToRelease = totalPoolInvestments * 100  / (100 - groupDiscountPercent);

            let tokenPrice = await icoPoolParty.groupEthPricePerToken();
            let tokenPriceWei = tokenPrice / Math.pow(10,18);
            //Manually Mint the tokens
            smartLog("Total Tokens to Mint: " + (amountToRelease / tokenPriceWei) );
            await customSale.mintTokens(icoPoolParty.address, (amountToRelease / tokenPriceWei), {
                from: accounts[7],
                gas: 300000
            });

            //uint256 _expectedTokenBalance = totalPoolInvestments.mul(tokenPrecision).div(groupEthPricePerToken);
            let groupEthPricePerToken = await icoPoolParty.groupEthPricePerToken();
            let expectedTokenBalance = (Number(totalPoolInvestments) + Number(calculateSubsidy(await icoPoolParty.actualGroupDiscountPercent(), await icoPoolParty.totalPoolInvestments()))) * Math.pow(10,18) / groupEthPricePerToken;
            smartLog("Expected Token Balance: " + expectedTokenBalance);

            await ReleaseFundsToSale();
            
            let balanceAfterRelease = await web3.eth.getBalance(customSale.address);
            smartLog("Balance After Release: " + balanceAfterRelease);            
            smartLog("amountToRelease: " + amountToRelease);
            assert.equal(balanceAfterRelease - balanceBeforeRelease, amountToRelease);

            //Check that these accounts cannot withdraw Ether now that they have tokens due to them
            smartLog("Balance Snapshot: " + await icoPoolParty.balanceRemainingSnapshot());
            assert.isAbove(await icoPoolParty.balanceRemainingSnapshot(), 0, "Incorrect balance snapshot...");
        });

    });
});
