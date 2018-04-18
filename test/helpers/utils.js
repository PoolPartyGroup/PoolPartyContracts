export const FactoryDefaultConfig = {
    FeePercentage: 6,
    WithdrawlFee: web3.toWei("0.0015"),
    GroupDiscountPercent: 15,
    WaterMark: web3.toWei("15")
};
export const Status = {
    Open: 0,
    WaterMarkReached: 1,
    DueDiligence: 2,
    InReview: 3,
    Claim: 4,
    Refunding: 5
};
export const InvestorStruct = {
    investmentAmount: 0,
    lastAmountTokensClaimed: 1,
    percentageContribution: 2,
    arrayIndex: 3,
    hasClaimedRefund: 4,
    isActive: 5,
    refundAmount: 6,
    totalTokensClaimed: 7,
    totalNumberOfClaims: 8
};
export const Contributions = {
    percentageContribution: 0,
    refundAmount: 1,
    tokensDue: 2,
    hasClaimedRefund: 3,
    hasClaimedTokens: 4
};
export const KickReason = {
    Other: 0,
    Kyc: 1
};

export const DUE_DILIGENCE_DURATION = 3000;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const MIN_CONT_AMOUNT = web3.toWei("0.01");

export const poolPartyFactoryArtifact = artifacts.require('./PoolPartyFactory');
export const poolPartyArtifact = artifacts.require('./PoolParty');
export const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
export const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');
export const foregroundTokenSaleArtifact = artifacts.require('./ForegroundTokenSale');
export const dealTokenArtifact = artifacts.require('./DealToken');
export const mockNameServiceArtifact = artifacts.require('./test-contracts/MockNameService');

export function calculateFee(_feePercent, _totalInvestment) {
    return _totalInvestment * _feePercent / 100;
}
export function calculateSubsidy(_actualDiscountPercent, _totalInvestment) {
    smartLog("actualGroupDiscountPercent [" + _actualDiscountPercent + "%]");
    smartLog("totalPoolInvestments [" + web3.fromWei(_totalInvestment) + "]");

    let _groupContPercent = 100 - _actualDiscountPercent;
    let _amountToRelease = _totalInvestment * 100 / _groupContPercent;

    smartLog("amountToRelease [" + web3.fromWei(_amountToRelease) + "]");

    return _amountToRelease - _totalInvestment;
}
export function smartLog(message, override) {
    let verbose = false;
    if (verbose || override)
        console.log(message);
}
export function sleep(_ms) {
    return new Promise(resolve => setTimeout(resolve, _ms));
}