// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title Interface that can be used to interact with factory contracts.
*/
interface IFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}
