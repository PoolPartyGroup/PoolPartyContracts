pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract GenericToken is MintableToken {
    string public constant name = "Pool Party";
    string public constant symbol = "PRTY";
    uint8 public constant decimals = 18;

    /**
     * @dev - Empty constructor
     */
    constructor () public {}
}
