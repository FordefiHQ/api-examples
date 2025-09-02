// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract Greeter {
    function sayHello(string memory h) external pure returns (string memory){
        require(
            keccak256(abi.encodePacked(h)) == keccak256(abi.encodePacked("hello Fordefi!")), "must say hello Fordefi!"
            );
        return("hello!");
    }
}