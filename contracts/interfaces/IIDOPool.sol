// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./IIDOPoolParameters.sol";

/**
* @title Interface that can be used to interact with the IDOPool contract.
*/
interface IIDOPool is IIDOPoolParameters {
    function requiredAmountOfFunds() external view returns (uint256);
    function fundsRaisedByProjectId(uint256 projectId) external view returns (uint256);
    function requiredAmountOfFundsByProjectId(uint256 projectId) external view returns (uint256);
    function mint(uint256 amount) external;
    function stake(uint256 amount) external;
    function initialize(
        IDOPoolParameters memory idoPoolParameters,
        address[] memory snacks,
        address idoDistributor,
        address snacksPool,
        address zoinks,
        address busd
    )
        external;

    event RewardFromInsuranceDepositReceived(uint256 indexed snacksReward, uint256 indexed btcSnacksReward, uint256 indexed ethSnacksReward);
    event MerkleRootForIdoTokensUpdated(bytes32 indexed oldMerkleRoot, bytes32 indexed newMerkleRoot);
    event MerkleRootForSnacksUpdated(bytes32 indexed oldMerkleRoot, bytes32 indexed newMerkleRoot);
    event IdoTokensClaimed(address indexed account, address indexed idoToken, uint256 indexed amount);
    event SnacksClaimed(address indexed account, address indexed token, uint256 indexed amount);
    event FundsReceiverChanged(address indexed newFundsReceiver, uint256 indexed projectId);
    event IdoTokenNameAndSymbolChanged(string indexed newName, string indexed newSymbol, uint256 indexed projectId);
    event ProjectRemoved(uint256 indexed projectId);
    event RewardForProjectProvided(uint256 indexed reward);
    event InsuranceDepositClosed();
    event RaisedFundsClaimed(address indexed fundsReceiver, uint256 indexed busdAmount, uint256 indexed zoinksAmount);
}