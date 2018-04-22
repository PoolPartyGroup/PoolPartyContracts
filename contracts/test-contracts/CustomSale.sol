pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./GenericToken.sol";

/**
 * IMPORTANT: This is an overly simplified version of a token sale contract used only by ICO Pool Party as a proof of concept
 * This code SHOULD NOT be used in any production application.
 */
contract CustomSale is Ownable {
    GenericToken public token;
    uint256 tokenPrice;
    uint256 amountSentToSale;

    function () public payable {
        require(address(this).delegatecall(bytes4(keccak256("buy()"))));
    }

    constructor(uint256 _tokenPrice, address _token) public {
        tokenPrice = _tokenPrice;
        token = GenericToken(_token);
    }

    function buy() public payable {
        uint256 tokensToSend = msg.value*10**18/tokenPrice; //Precision is important here
        mintTokens(msg.sender, tokensToSend);
    }

    function buyWithIntentToRefund() public payable {
        //Does not mint tokens -- mimics a sale that eventually doesn't reach its goal
        amountSentToSale = msg.value;
    }

    function refund() public {
        msg.sender.transfer(amountSentToSale);
    }

    function mintTokens(address _recipient, uint256 _amount) public {
        token.mint(_recipient, _amount);
    }

    function withdrawFunds() public onlyOwner {
        msg.sender.transfer(address(this).balance);
    }
}
