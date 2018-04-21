pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";
import "./interfaces/INameService.sol";

/**
 * @title PoolParty
 * @dev Individual pool for a selected vendor
 * @author - Shane van Coller
 */
contract PoolParty is Ownable {
    using SafeMath for uint256;

    /* Constants */
    uint256 constant VERSION = 1;
    uint256 constant DECIMAL_PRECISION = 10**18;

    string public rootDomain;
    string public poolName;
    string public poolDescription;
    string public buyFunctionName;
    string public refundFunctionName;
    string public claimFunctionName;

    bytes public legalDocsHash;

    uint256 public waterMark;
    uint256 public poolPrice;
    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public expectedGroupDiscountPercent;
    uint256 public expectedGroupTokenPrice;
    uint256 public publicEthPricePerToken;
    uint256 public groupEthPricePerToken;
    uint256 public actualGroupDiscountPercent;
    uint256 public totalPoolContributions;
    uint256 public poolTokenBalance;
    uint256 public poolParticipants;
    uint256 public reviewPeriodStart;
    uint256 public balanceRemainingSnapshot;
    uint256 public tokenPrecision;
    uint256 public dueDiligenceDuration;
    uint256 public poolSubsidyAmount;
    uint256 public allTokensClaimed;

    address public poolPartyOwnerAddress;
    address public destinationAddress;
    address public authorizedConfigurationAddress;
    address public poolCreator;

    bool public subsidyRequired;
    bool public configUrlRequiresWww;
    bool public feeWaived;
    bool poolParamsSet;

    bytes32 hashedBuyFunctionName;
    bytes32 hashedRefundFunctionName;
    bytes32 hashedClaimFunctionName;

    IErc20Token public tokenAddress;
    INameService public nameService;

    Status public poolStatus;
    address[] public participantList;

    mapping(address => Participant) public participants;
    mapping(address => KickedParticipant) public kickedParticipants;
    mapping(bytes32 => bytes32) queryMapping;

    struct KickedParticipant {
        bool hasBeenKicked;
        KickReason kickReason;
    }

    struct Participant {
        uint256 amountContributed;
        uint256 lastAmountTokensClaimed;
        uint256 percentageContribution;
        uint256 arrayIndex;
        bool hasClaimedRefund;
        bool isActive;
        uint256 refundAmount;
        uint256 totalTokensClaimed;
        uint256 numberOfTokenClaims;
        uint256 quantity;
    }

    enum Status {Open, WaterMarkReached, DueDiligence, InReview, Claim}
    enum KickReason {Other, Kyc}

    event PoolCreated(string poolName, address poolCreator, uint256 date);
    event PoolParametersSet(string rootDomain, uint256 date);
    event SaleDetailsConfigured(address configurer, uint256 date);
    event FundsAdded(address indexed participant, uint256 quantity, uint256 amount, uint256 date);
    event FundsWithdrawn(address indexed participant, uint256 amount, uint256 date);
    event FundsReleasedToVendor(uint256 totalAmountContributed, uint256 subsidyAmount, uint256 feeAmount,  address tokenSaleAddress, uint256 date);
    event TokensClaimed(address indexed participant, uint256 amountContributed, uint256 tokensTransferred, uint256 date);
    event ParticipantKicked(address indexed participant, uint256 fee, uint256 amount, KickReason reason, uint256 date);
    event RefundClaimed(address indexed participant, uint256 amount, uint256 date);
    event AuthorizedAddressConfigured(address initiator, uint256 date);
    event PoolConfigured(address initiator, address destination, address tokenAddress, string buyFnName, string claimFnName, string refundFnName, uint256 publicTokenPrice, uint256 groupTokenPrice, bool subsidy, uint256 date);

    event ClaimedTokensFromVendor(address indexed owner, uint256 tokenBalance, uint256 date);
    event ClaimedRefundFromVendor(address indexed owner, address initiator, uint256 refundedAmount, uint256 date);
    event NoRefundFromVendor(address indexed owner, address initiator, uint256 date);

    /**
     * @dev Check the state of the watermark only if the current state is 'Open' or 'WaterMarkReached'
     */
    modifier assessWaterMark {
        _;

        if (poolStatus == Status.Open || poolStatus == Status.WaterMarkReached) { //Only worry about the watermark before the ACA has configured the "sale"
            if (totalPoolContributions < waterMark) { //If the pool total drops below watermark, change status to OPEN
                poolStatus = Status.Open;
            } else if (totalPoolContributions >= waterMark) { //If the pool total equals watermark or more, change status to WATERMARKREACHED
                poolStatus = Status.WaterMarkReached;
            }
        }
    }

    /**
     * @dev Only allow the authorized address to execute a function
     */
    modifier onlyAuthorizedAddress {
        require (authorizedConfigurationAddress != 0x0 && msg.sender == authorizedConfigurationAddress);
        _;
    }

    /**
     * @dev Only allow the pool creator address to execute a function
     */
    modifier onlyPoolCreator {
        require (poolCreator != 0x0 && msg.sender == poolCreator);
        _;
    }

    /**
     * @dev Pool constructor which initializes starting parameters
     * @param _rootDomain Official domain name for the sale
     * @param _poolName Name for the pool
     * @param _poolDescription Description of what the pool is
     * @param _waterMark Minimum amount in wei the pool has to reach in order for funds to be released to sale contract
     * @param _docsLocationHash (Optional) Document/documents associated to the pool (contracts etc). Stored in decentralized storage
     * @param _poolCreator The creator of the pool
     */
    function PoolParty(
        string _rootDomain,
        string _poolName,
        string _poolDescription,
        uint256 _waterMark,
        uint256 _poolPrice,
        bytes _docsLocationHash,
        address _poolCreator
    )
        public
    {
        rootDomain = _rootDomain;
        poolName = _poolName;
        poolDescription = _poolDescription;
        waterMark = _waterMark;
        poolPrice = _poolPrice;
        legalDocsHash = _docsLocationHash;
        poolCreator = _poolCreator;

        PoolCreated(rootDomain, poolCreator, now);
    }

    /**
     * @dev Sets the pool parameters straight after creation, can only be set once and only called by the initial owner of the contract (the Factory)
     * @param _feePercentage Fee percentage for using Pool Party
     * @param _withdrawalFee Fee charged for kicking a participant
     * @param _groupDiscountPercent Expected percentage discount that the pool will receive
     * @param _poolPartyOwnerAddress Address to pay the Pool Party fee to
     * @param _dueDiligenceDuration Minimum duration in seconds of the due diligence state
     * @param _nameService Address of the name service to get the authorized coion address from
     */
    function setPoolParameters(
        uint256 _feePercentage,
        uint256 _withdrawalFee,
        uint256 _groupDiscountPercent,
        address _poolPartyOwnerAddress,
        uint256 _dueDiligenceDuration,
        address _nameService
    )
        public
        onlyOwner
    {
        require(!poolParamsSet);
        poolParamsSet = true;

        feePercentage = _feePercentage;
        withdrawalFee = _withdrawalFee;
        expectedGroupDiscountPercent = _groupDiscountPercent;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        dueDiligenceDuration = _dueDiligenceDuration;
        nameService = INameService(_nameService);

        poolParticipants = 0;
        reviewPeriodStart = 0;
        feeWaived = false;

        PoolParametersSet(rootDomain, now);
    }

    /**
     * @dev Default fallback function - does nothing else except accept payment
     */
    function () public payable {
    }

    /**
     * @dev Allow the creator of the pool to attach any document/documents associated to the pool (contracts etc). Can only be set once
     * @param _docsLocationHash Decentralized storage location hash of the documents
     */
    function addLegalDocumentation(bytes _docsLocationHash)
        public
        onlyPoolCreator
    {
        require(_docsLocationHash.length > 0);
        require(legalDocsHash.length == 0);
        legalDocsHash = _docsLocationHash;
    }

    /**
	 * @dev Add funds to the pool. Contract status needs to be 'Open', 'WaterMarkReached' or 'DueDiligence' in order to contribute additional funds
	 */
    function addFundsToPool(uint256 _quantity)
        public
        assessWaterMark
        payable
    {
        require( //Can only add funds until the pool is 'InReview' state
            poolStatus == Status.Open ||
            poolStatus == Status.WaterMarkReached ||
            poolStatus == Status.DueDiligence
        );
        require(_quantity > 0);
        require(msg.value == poolPrice.mul(_quantity));

        Participant storage _participant = participants[msg.sender];

        if(_participant.isActive == false) {
            poolParticipants = poolParticipants.add(1);
            participantList.push(msg.sender);
            _participant.isActive = true;
            _participant.hasClaimedRefund = false;
            _participant.arrayIndex = participantList.length-1;
        }

        uint256 _amountContributed = msg.value;
        _participant.amountContributed = participants[msg.sender].amountContributed.add(_amountContributed);
        _participant.quantity = _participant.quantity.add(_quantity);
        totalPoolContributions = totalPoolContributions.add(_amountContributed);

        FundsAdded(msg.sender, _quantity, msg.value, now);
    }

    /**
     * @dev User can withdraw funds and leave the pool at any time. There is no penalty for user withdrawing their contribution - they only pay the gas fee for the transaction
     */
    function leavePool()
        public
        assessWaterMark
    {
        Participant storage _participant = participants[msg.sender];
        require(_participant.isActive);
        require(_participant.amountContributed > 0);

        uint256 _amountToRefund = _participant.amountContributed;
        uint256 _index = _participant.arrayIndex;
        delete participants[msg.sender];

        totalPoolContributions = totalPoolContributions.sub(_amountToRefund);
        removeUserFromList(_index);
        poolParticipants = poolParticipants.sub(1);
        FundsWithdrawn(msg.sender, _amountToRefund, now);

        msg.sender.transfer(_amountToRefund);
    }

    /**
     * @dev Name Service call to get the authorized configuration address
     */
    function setAuthorizedConfigurationAddress() public {
        require(poolStatus == Status.WaterMarkReached);

        authorizedConfigurationAddress = nameService.hashedStringResolutions(keccak256(rootDomain));
        AuthorizedAddressConfigured(msg.sender, now);
    }

    /**
     * @dev Configure sale parameters - only the authorized address can do this
     * @param _destination Address where the pool funds will be sent once released
     * @param _tokenAddress Address of the token being bought (must be an ERC20 token)
     * @param _buyFnName Name of the buy function in the "sale" contract
     * @param _claimFnName Name of the claim tokens function in the "sale" contract
     * @param _refundFnName Name of the claim refund function in the "sale" contract
     * @param _publicTokenPrice Price of the token if bought directly from the ICO
     * @param _groupTokenPrice Discounted price of the token for participants in the pool
     * @param _subsidy Whether a subsidy amount is due when releasing the funds
     */
    function configurePool(
        address _destination,
        address _tokenAddress,
        string _buyFnName,
        string _claimFnName,
        string _refundFnName,
        uint256 _publicTokenPrice,
        uint256 _groupTokenPrice,
        bool _subsidy
    )
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.WaterMarkReached);
        require(
            _destination != 0x0 &&
            _tokenAddress != 0x0 &&
            bytes(_buyFnName).length > 0 &&
            bytes(_refundFnName).length > 0 &&
            bytes(_claimFnName).length > 0 &&
            _publicTokenPrice > 0 &&
            _groupTokenPrice > 0
        );

        destinationAddress = _destination;
        tokenAddress = IErc20Token(_tokenAddress);
        buyFunctionName = _buyFnName;
        hashedBuyFunctionName = keccak256(buyFunctionName);
        refundFunctionName = _refundFnName;
        hashedRefundFunctionName = keccak256(refundFunctionName);
        claimFunctionName = _claimFnName;
        hashedClaimFunctionName = keccak256(claimFunctionName);
        publicEthPricePerToken = _publicTokenPrice;
        groupEthPricePerToken = _groupTokenPrice;
        subsidyRequired = _subsidy;

        PoolConfigured(msg.sender, _destination, _tokenAddress, _buyFnName, _claimFnName, _refundFnName, _publicTokenPrice, _groupTokenPrice, _subsidy, now);
    }


    /**
     * @dev Complete the configuration and start the due diligence timer for participants to review the configured parameters - only the authorized address can do this
     */
    function completeConfiguration()
        public
        onlyAuthorizedAddress
    {
        require(
            destinationAddress != 0x0 &&
            address(tokenAddress) != 0x0 &&
            hashedBuyFunctionName != 0x0 &&
            hashedRefundFunctionName != 0x0 &&
            hashedClaimFunctionName != 0x0 &&
            publicEthPricePerToken > 0 &&
            groupEthPricePerToken > 0
        );
        //Check that the configured token price is at least the expected percentage off
        expectedGroupTokenPrice = publicEthPricePerToken.sub(publicEthPricePerToken.mul(expectedGroupDiscountPercent).div(100));
        require (expectedGroupTokenPrice >= groupEthPricePerToken);

        uint8 decimals = tokenAddress.decimals();
        tokenPrecision = power(10, decimals);

        actualGroupDiscountPercent = (publicEthPricePerToken.sub(groupEthPricePerToken)).mul(100).div(publicEthPricePerToken);

        poolStatus = Status.DueDiligence;
        reviewPeriodStart = now;
        SaleDetailsConfigured(msg.sender, now);
    }

    /**
     * @dev Allows authorized configuration address to remove users who do not comply with KYC. A small fee is charged to the person being kicked from the pool (only enough to cover gas costs of the transaction)
     * @param _participantToKick Address of the person to kick from the pool.
     */
    function kickUser(address _participantToKick, KickReason _reason)
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);

        Participant storage _participant = participants[_participantToKick];
        uint256 _amountToRefund = _participant.amountContributed;
        uint256 _index = _participant.arrayIndex;
        require(_amountToRefund > 0);
        delete participants[_participantToKick];

        poolParticipants = poolParticipants.sub(1);
        removeUserFromList(_index);
        totalPoolContributions = totalPoolContributions.sub(_amountToRefund);

        KickedParticipant storage _kickedUser = kickedParticipants[_participantToKick];
        _kickedUser.hasBeenKicked = true;
        _kickedUser.kickReason = _reason;

        //fee to cover gas costs for being kicked - taken from participant
        uint256 _fee = _amountToRefund < withdrawalFee ? _amountToRefund : withdrawalFee;
        ParticipantKicked(_participantToKick, _fee, _amountToRefund.sub(_fee), _reason, now);

        msg.sender.transfer(_fee);
        _participantToKick.transfer(_amountToRefund.sub(_fee));
    }

    /**
     * @dev Once the pool is 'InReview' status, the funds can be released to the Sale contract in exchange for tokens - only the authorized address can do this
     * NOTE: address.call is used to get around the fact that the minimum gas amount is sent with a .send() or .transfer() - this call needs more than the minimum
     */
    function releaseFundsToSale()
        public
        onlyAuthorizedAddress
        payable
    {
        require(poolStatus == Status.InReview);

        //The fee must be paid by the authorized configuration address
        uint256 _feeAmount = totalPoolContributions.mul(feePercentage).div(100);
        uint256 _amountToRelease = 0;
        uint256 _actualSubsidy = 0;

        if (subsidyRequired) { //If a subsidy is required, calculate the subsidy amount which should be sent to this function at time of calling
            uint256 _groupContributionPercent = uint256(100).sub(actualGroupDiscountPercent);
            _amountToRelease = totalPoolContributions.mul(100).div(_groupContributionPercent);
            _actualSubsidy = _amountToRelease.sub(totalPoolContributions);
            require(msg.value >= _actualSubsidy.add(_feeAmount)); //Amount sent to the function should be the subsidy amount + the fee
        } else { //No subsidy, only fee has to be paid
            require(msg.value >= _feeAmount);
            _amountToRelease = totalPoolContributions;
        }

        poolSubsidyAmount = _actualSubsidy;

        //Transfer the fee to pool party owners
        poolPartyOwnerAddress.transfer(_feeAmount);

        //Release funds to sale contract
        if (hashedBuyFunctionName == keccak256("N/A")) { //Call fallback function
            require(destinationAddress.call.gas(300000).value(_amountToRelease)());
        } else { //Call function specified during creation
            require(destinationAddress.call.gas(300000).value(_amountToRelease)(bytes4(hashedBuyFunctionName)));
        }

        balanceRemainingSnapshot = address(this).balance;

        //If there is no claim function then assume tokens are minted at time they are bought (for example TokenMarketCrowdSale)
        if (hashedClaimFunctionName == keccak256("N/A")) {
            claimTokensFromVendor();
        }

        FundsReleasedToVendor(_amountToRelease, _actualSubsidy, _feeAmount, destinationAddress, now);
    }


    /**
     * @dev If tokens are not minted by vendor at time of purchase, they need to be claimed once the sale is over - only the authorized address can do this.
     */
    function claimTokensFromVendor()
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);
        require(poolTokenBalance == 0);

        if (hashedClaimFunctionName != keccak256("N/A")) {
            require(destinationAddress.call(bytes4(hashedClaimFunctionName)));
        }

        poolTokenBalance = tokenAddress.balanceOf(address(this));
        if (poolTokenBalance > 0) {
            poolStatus = Status.Claim;
            ClaimedTokensFromVendor(address(this), poolTokenBalance, now);
        }
    }

    /**
	 * @dev In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for users to claim their funds back - only the authorized address can do this
     */
    function claimRefundFromVendor()
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);
        require(poolTokenBalance == 0);

        require(destinationAddress.call(bytes4(hashedRefundFunctionName)));

        if (address(this).balance >= totalPoolContributions) {
            poolStatus = Status.Claim;
            balanceRemainingSnapshot = address(this).balance.sub(poolSubsidyAmount);
            msg.sender.transfer(poolSubsidyAmount); //Return the subsidy amount to the vendor as the pool has no claim to this
            ClaimedRefundFromVendor(address(this), msg.sender, balanceRemainingSnapshot, now);
        } else {
            NoRefundFromVendor(address(this), msg.sender, now);
        }
    }

    /**
     * @dev Called by each pool participant. Tokens are distributed proportionately to how much they contributed.
     */
    function claimTokens() public {
        Participant storage _participant = participants[msg.sender];
        require(poolStatus == Status.Claim);
        require(_participant.isActive);
        require(_participant.amountContributed > 0);

        var(_percentageContribution, _refundAmount, _tokensDue) = calculateParticipationAmounts(msg.sender);
        if (_participant.percentageContribution == 0) {
            _participant.percentageContribution = _percentageContribution;
            _participant.refundAmount = _refundAmount;
        }

        poolTokenBalance = tokenAddress.balanceOf(address(this)); //Get the latest token balance for the pool

        require(_tokensDue > 0); //User has to have tokens due to proceed

        _participant.lastAmountTokensClaimed = _tokensDue;
        _participant.totalTokensClaimed = _participant.totalTokensClaimed.add(_tokensDue); //Increment number of tokens claimed by tokens due for this call
        _participant.numberOfTokenClaims = _participant.numberOfTokenClaims.add(1);
        allTokensClaimed = allTokensClaimed.add(_tokensDue); //Increment allTokensClaimed by tokens due

        TokensClaimed(msg.sender, _participant.amountContributed, _tokensDue, now);
        tokenAddress.transfer(msg.sender, _tokensDue); //Transfer the tokens to the user
    }

    /**
     * @dev Called by each pool participant. If there are any funds left in the contract after the sale completes, participants are entitled to claim their share proportionality to how much they contributed
     * NOTE: This is a 'call once' function - once refund is claimed, it cannot be called again
     */
    function claimRefund() public {
        Participant storage _participant = participants[msg.sender];
        require(poolStatus == Status.Claim);
        require(_participant.isActive);
        require(_participant.amountContributed > 0);
        require(!_participant.hasClaimedRefund);

        _participant.hasClaimedRefund = true;

        var(_percentageContribution, _refundAmount,) = calculateParticipationAmounts(msg.sender);

        if (_participant.percentageContribution == 0) {
            _participant.percentageContribution = _percentageContribution;
            _participant.refundAmount = _refundAmount;
        }

        require(_participant.refundAmount > 0);

        RefundClaimed(msg.sender, _participant.refundAmount, now);
        msg.sender.transfer(_participant.refundAmount);
    }

    /**
     * @dev - Set the pool state to 'InReview'. Only allowed by authorized address
     */
    function startInReviewPeriod()
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.DueDiligence);
        require(reviewPeriodStart != 0);
        require(now >= reviewPeriodStart + dueDiligenceDuration);

        poolStatus = Status.InReview;
    }

    /**
     * @dev Returns all relevant pool configurations in 1 function
     */
    function getConfigDetails()
        public
        view
        returns (address, address, address, uint256, uint256, bool, string, string, string)
    {
        return (destinationAddress, tokenAddress, authorizedConfigurationAddress, publicEthPricePerToken, groupEthPricePerToken, subsidyRequired, buyFunctionName, refundFunctionName, claimFunctionName);
    }

    /**
     * @dev Returns all relevant pool details in 1 function
     */
    function getPoolDetails()
        public
        view
        returns (Status, uint256, uint256, uint256, uint256, uint256)
    {
        return (poolStatus, totalPoolContributions, poolParticipants, withdrawalFee, waterMark, reviewPeriodStart);
    }

    /**
     * @dev Allows anyone to query the percentage contribution, refund amount and tokens due for a given address. If no tokens have been received by the sale contract, returns 0
     * @param _user The user address of the account to look up
     */
    function getContributionsDue(address _user)
        public
        view
        returns (uint256, uint256, uint256, bool)
    {
        if (poolStatus != Status.Claim) {return (0, 0, 0, false);}

        Participant storage _participant = participants[_user];
        var(_percentageContribution, _refundAmount, _tokensDue) = calculateParticipationAmounts(_user);
        return (_percentageContribution, _refundAmount, _tokensDue, _participant.hasClaimedRefund);
    }

    /**
     * @dev Allows the pool fee to be waived
     */
    function waiveFee()
        public
        onlyOwner
    {
        require(!feeWaived);
        feeWaived = true;
        feePercentage = 0;
    }

    /**********************/
    /* INTERNAL FUNCTIONS */
    /**********************/

    /**
     * @dev Internal function to calculate the relevant contributions for a given user
     * @param _user User to calculate for
     */
    function calculateParticipationAmounts(address _user)
        internal
        view
        returns (uint256, uint256, uint256)
    {
        Participant storage _participant = participants[_user];
        uint256 _poolTokenBalance = tokenAddress.balanceOf(address(this));
        uint256 _lifetimeTokensReceived = _poolTokenBalance + allTokensClaimed;
        uint256 _percentageContribution = _participant.amountContributed.mul(100).mul(DECIMAL_PRECISION).div(totalPoolContributions);
        uint256 _refundAmount = balanceRemainingSnapshot.mul(_percentageContribution).div(100).div(DECIMAL_PRECISION);
        uint256 _tokensDue = _lifetimeTokensReceived.mul(_percentageContribution).div(100).div(DECIMAL_PRECISION).sub(_participant.totalTokensClaimed);

        return (_percentageContribution, _refundAmount, _tokensDue);
    }

    /**
     * @dev Move the last element of the array to the index of the element being deleted, update the index of the item being moved, delete the last element of the
     *      array (because its now at position _index), reduce the size of the array
     * @param _index Index of deleted item
     */
    function removeUserFromList(uint256 _index) internal {
        participantList[_index] = participantList[participantList.length - 1];
        participants[participantList[_index]].arrayIndex = _index;
        delete participantList[participantList.length - 1];
        participantList.length--;
    }

    /**
     * @dev Set precision based on decimal places in the token
     */
    function power(uint256 _a, uint256 _b) internal pure returns (uint256) {
        return _a ** _b;
    }
}