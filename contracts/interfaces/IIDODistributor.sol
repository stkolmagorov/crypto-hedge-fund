// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title Interface that can be used to interact with the IDODistributor contract.
*/
interface IIDODistributor {
    function exchangeInvestments(
        uint256 id,
        uint256 snacksAmount,
        uint256 btcSnacksAmount,
        uint256 ethSnacksAmount,
        uint256 btcBusdAmountOutMin,
        uint256 ethBusdAmountOutMin,
        uint256 busdZoinksAmountOutMin
    )
        external;
    function diversify(uint256 id) external;
    function approveSnacksToIdoPool(address idoPool) external;
}