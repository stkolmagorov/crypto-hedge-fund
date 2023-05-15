// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title IDOPoolParameters struct.
*/
interface IIDOPoolParameters {
    struct IDOPoolParameters {
        address insuranceRecipient;
        address defaultOwner;
        address authority;
        address idoLunchBoxPoolAddress;
        uint256[] requiredAmountsOfFunds;
        uint256[] shares;
        address[] fundsReceivers;
        address[] idoTokens;
    }
}