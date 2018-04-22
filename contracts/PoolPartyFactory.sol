pragma solidity ^0.4.23;

import "./PoolParty.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title PoolPartyFactory
 * @dev Factory to create individual Pool Party contracts. Controls default values that pools are created with
 * @author - Shane van Coller
 */
contract PoolPartyFactory is Ownable {

    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public dueDiligenceDuration;

    address public poolPartyOwnerAddress;
    address public nameServiceAddress;

    address[] public poolAddresses;

    event PoolPartyCreated(address indexed poolAddress, address indexed creator, string poolUrl, uint256 date);
    event FeePercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WithdrawalFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event DueDiligenceDurationUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);

    /**
     * @dev Constructor for the Pool Party Factory
     * @param _poolPartyOwnerAddress Account that the fee for the pool party service goes to
     */
    constructor(address _poolPartyOwnerAddress, address _nameServiceAddress) public {
        require(_poolPartyOwnerAddress != 0x0, "Pool Party owner address is 0x0");
        require(_nameServiceAddress != 0x0, "Name service address is 0x0");
        feePercentage = 6;
        withdrawalFee = 0.0015 ether;
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
     * @param _poolPrice The price of the pool - what the participants expect to get
     * @param _retailPrice The retail price of whats being offered by in the pool
     * @param _legalDocsHash Document/documents associated to the pool (contracts etc). Stored in decentralized storage
     */
    function createNewPoolParty(
        string _rootDomain,
        string _poolName,
        string _poolDescription,
        uint256 _waterMark,
        uint256 _poolPrice,
        uint256 _retailPrice,
        bytes _legalDocsHash
    )
        public
    {
        //Validate non empty inputs
        require(bytes(_rootDomain).length != 0, "Root domain is empty");
        require(bytes(_poolName).length != 0, "Pool Name is empty");
        require(bytes(_poolDescription).length != 0, "Pool description is empty");
        require(_poolPrice > 0, "Pool price is 0");
        require(_waterMark > 0, "WaterMark is 0");
        require(_retailPrice > 0, "Retail price is 0");

        PoolParty poolPartyContract = new PoolParty(_rootDomain, _poolName, _poolDescription, _waterMark, _poolPrice, _retailPrice, _legalDocsHash, msg.sender);
        poolPartyContract.setPoolParameters(feePercentage, withdrawalFee, poolPartyOwnerAddress, dueDiligenceDuration, nameServiceAddress);
        poolPartyContract.transferOwnership(owner);
        poolAddresses.push(address(poolPartyContract));

        emit PoolPartyCreated(poolPartyContract, msg.sender, _rootDomain, now);
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
        require(_feePercentage <= 50, "Fee percent is greater than 50%");
        uint256 _oldValue = feePercentage;
        feePercentage = _feePercentage;

        emit FeePercentageUpdate(msg.sender, _oldValue, _feePercentage, now);
    }

    /**
     * @dev Set the withdrawal fee - used when a person gets kicked from the pool due to KYC
     * @param _withdrawalFee The new withdrawal fee in wei
     */
    function setWithdrawalFeeAmount(uint256 _withdrawalFee) public onlyOwner {
        uint256 _oldValue = withdrawalFee;
        withdrawalFee = _withdrawalFee;

        emit WithdrawalFeeUpdate(msg.sender, _oldValue, _withdrawalFee, now);
    }

    /**
     * @dev Sets the amount of time the pool must be in due diligence state for (in seconds)
     * @param _dueDiligenceDurationInSeconds The new duration in seconds
     */
    function setDueDiligenceDuration(uint256 _dueDiligenceDurationInSeconds) public onlyOwner {
        require(_dueDiligenceDurationInSeconds > 0, "Due diligence duration is 0");
        uint256 _oldValue = dueDiligenceDuration;
        dueDiligenceDuration = _dueDiligenceDurationInSeconds * 1 seconds;

        emit DueDiligenceDurationUpdate(msg.sender, _oldValue, dueDiligenceDuration, now);
    }

    /**
     * @dev Sets the Pool Party owner address. This is the address that the Pool Party fees go to. This is different from the owner of the contract
     * @param _newOwner Address of the new owner
     */
    function setPoolPartyOwnerAddress(address _newOwner) public onlyOwner {
        require(_newOwner != 0x0, "Pool Party owner address is 0x0");
        poolPartyOwnerAddress = _newOwner;
    }
}
