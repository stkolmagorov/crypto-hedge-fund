// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title Interface that can be used to interact with the IDOLunchBoxPool contract.
*/
interface IIDOLunchBoxPool {
    function stake(uint256 amount) external;
    function exit() external;
    function getReward() external;
    function initialize(
        address snacks,
        address snacksPool,
        address idoPool,
        address defaultOwner
    )
        external;
}