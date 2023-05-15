// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title Interface that can be used to interact with the IDOToken contract.
*/
interface IIDOToken {
    function mint(uint256 amount) external;
    function mintFor(address account, uint256 amount) external;
    function changeNameAndSymbol(string calldata newName, string calldata newSymbol) external;
    function changeMaxSupply(uint256 newMaxSupply) external;
    function initialize(
        uint256 maxSupply,
        string memory name, 
        string memory symbol,
        address idoPool
    ) 
        external;
}