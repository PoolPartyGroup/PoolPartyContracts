pragma solidity ^0.4.18;

contract INameService {
    mapping(bytes32 => address) public hashedStringResolutions;
}
