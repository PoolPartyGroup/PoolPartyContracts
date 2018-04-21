pragma solidity ^0.4.18;

import "./PoolParty.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title PoolPartyFactory
 * @dev Factory to create individual Pool Party contracts. Controls default value that pools are created with
 * @author - Shane van Coller
 */
contract PoolPartyFactory is Ownable {

    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public groupDiscountPercent;
    uint256 public dueDiligenceDuration;

    address public poolPartyOwnerAddress;
    address public nameServiceAddress;

    address[] public poolAddresses;

    event PoolPartyCreated(address indexed poolAddress, address indexed creator, string poolUrl, uint256 date);
    event FeePercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WithdrawalFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event GroupDiscountPercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WaterMarkUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event DueDiligenceDurationUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event MinOraclizeFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);

    /**
     * @dev Constructor for the Pool Party Factory
     * @param _poolPartyOwnerAddress Account that the fee for the pool party service goes to
     */
    function PoolPartyFactory(address _poolPartyOwnerAddress, address _nameServiceAddress) public {
        require(_poolPartyOwnerAddress != 0x0);
        require(_nameServiceAddress != 0x0);
        feePercentage = 6;
        withdrawalFee = 0.0015 ether;
        groupDiscountPercent = 15;
        dueDiligenceDuration = 604800 seconds; //default of 7 days
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        nameServiceAddress = _nameServiceAddress;
    }

    /**
     * @notice Creates a new pool with the supplied parameters
     * @param _rootDomain Root domain for the pool. Must be unique. Authorized configuration address is obtained from this domain
     * @param _poolName Name for the pool
     * @param _poolDescription Description of what the pool is
     * @param _waterMark The minimum amount in wei for the pool to be considered a success
     * @param _legalDocsHash Document/documents associated to the pool (contracts etc). Stored in decentralized storage
     */
    function createNewPoolParty(
        string _rootDomain,
        string _poolName,
        string _poolDescription,
        uint256 _waterMark,
        uint256 _poolPrice,
        bytes _legalDocsHash
    )
        public
    {
        //Validate non empty inputs
        require(bytes(_rootDomain).length != 0);
        require(bytes(_poolName).length != 0);
        require(bytes(_poolDescription).length != 0);
        require(_poolPrice > 0);
        require(_waterMark > 0);

        PoolParty poolPartyContract = new PoolParty(_rootDomain, _poolName, _poolDescription, _waterMark, _poolPrice, _legalDocsHash, msg.sender);
        poolPartyContract.setPoolParameters(feePercentage, withdrawalFee, groupDiscountPercent, poolPartyOwnerAddress, dueDiligenceDuration, nameServiceAddress);
        poolPartyContract.transferOwnership(owner);
        poolAddresses.push(address(poolPartyContract));

        PoolPartyCreated(poolPartyContract, msg.sender, _rootDomain, now);
    }

    /**
     * @dev Gets the size of the partyList array
     * @return Size of array
     */
    function getPartyListSize()
        public
        view
        returns(uint256)
    {
        return poolAddresses.length;
    }

    /**
     * @dev Set the percentage fee that we take for using this service
     * @param _feePercentage The new fee as a percentage
     */
    function setFeePercentage(uint256 _feePercentage) public onlyOwner {
        require(_feePercentage <= 50);
        uint256 _oldValue = feePercentage;
        feePercentage = _feePercentage;

        FeePercentageUpdate(msg.sender, _oldValue, _feePercentage, now);
    }

    /**
     * @dev Set the withdrawal fee - used when a person gets kicked from the pool due to KYC
     * @param _withdrawalFee The new withdrawal fee in wei
     */
    function setWithdrawalFeeAmount(uint256 _withdrawalFee) public onlyOwner {
        uint256 _oldValue = withdrawalFee;
        withdrawalFee = _withdrawalFee;

        WithdrawalFeeUpdate(msg.sender, _oldValue, _withdrawalFee, now);
    }

    /**
     * @dev Set the discount percentage for the pool - this is the percentage discount the group will get by participating in the pool
     * @param _discountPercent The new percentage discount
     */
    function setGroupPurchaseDiscountPercentage(uint256 _discountPercent) public onlyOwner {
        require(_discountPercent <= 100);
        uint256 _oldValue = groupDiscountPercent;
        groupDiscountPercent = _discountPercent;

        GroupDiscountPercentageUpdate(msg.sender, _oldValue, _discountPercent, now);
    }

    /**
     * @dev Sets the amount of time the pool must be in due diligence state for (in seconds)
     * @param _dueDiligenceDurationInSeconds The new duration in seconds
     */
    function setDueDiligenceDuration(uint256 _dueDiligenceDurationInSeconds) public onlyOwner {
        require(_dueDiligenceDurationInSeconds > 0);
        uint256 _oldValue = dueDiligenceDuration;
        dueDiligenceDuration = _dueDiligenceDurationInSeconds * 1 seconds;

        DueDiligenceDurationUpdate(msg.sender, _oldValue, dueDiligenceDuration, now);
    }

    /**
     * @dev Sets the Pool Party owner address. This is the address that the Pool Party fees go to. This is different from the owner of the contract
     * @param _newOwner Address of the new owner
     */
    function setPoolPartyOwnerAddress(address _newOwner) public onlyOwner {
        require(_newOwner != 0x0);
        poolPartyOwnerAddress = _newOwner;
    }
}
