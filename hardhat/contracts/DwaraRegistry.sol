// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DwaraRegistry {
    mapping(address => bytes32) public controllerToDidHash;
    
    event Registered(address indexed controller, bytes32 didHash, uint256 ts);

    function register(bytes32 didHash, address controller) external {
        controllerToDidHash[controller] = didHash;
        emit Registered(controller, didHash, block.timestamp);
    }

    function getDidHash(address controller) external view returns (bytes32) {
        return controllerToDidHash[controller];
    }
}
