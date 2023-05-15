// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./IIDOInfo.sol";
import "./IIDOPoolParameters.sol";

/**
* @title Interface that can be used to interact with the IDOFactory contract.
*/
interface IIDOFactory is IIDOInfo, IIDOPoolParameters {
    function idoPoolAddressById(uint256 id) external view returns (address);
    function idByIdoPoolAddress(address idoPool) external view returns (uint256);
    function isValidIdoId(uint256 id) external view returns (bool);
    function getNextIdoId() external view returns (uint256);
    function isIdoParticipant(address user) external view returns (bool);
    function closeIdo(uint256 id) external;
    function updateIdoParticipantInfo(address user, IDOInfo memory idoInfo) external;
    function deleteIdoParticipantInfo(address user) external;
}