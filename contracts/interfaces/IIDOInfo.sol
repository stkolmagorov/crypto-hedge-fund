// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title IDOInfo struct.
*/
interface IIDOInfo {
    struct IDOInfo {
        uint256[] percentages;
        uint256[] indicies;
    }
}