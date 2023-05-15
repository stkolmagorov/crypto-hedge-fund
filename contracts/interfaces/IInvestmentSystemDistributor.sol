// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./IIDOInfo.sol";

/**
* @title Interface that can be used to interact with the InvestmentSystemDistributor contract.
*/
interface IInvestmentSystemDistributor is IIDOInfo {
    function activateInvestmentSystem(address user, bytes calldata data) external;
    function updateInvestmentSystemData(address user, bytes calldata oldData, bytes calldata newData) external;
    function deactivateInvestmentSystem(address user, bytes calldata data) external;
    function verifyData(bytes calldata data) external view;
}
