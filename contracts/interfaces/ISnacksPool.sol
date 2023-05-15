// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
* @title Interface that can be used to interact with the SnacksPool contract.
*/
interface ISnacksPool {
    function getLunchBoxParticipantsTotalSupply() external view returns (uint256);
    function isLunchBoxParticipant(address user) external view returns (bool);
    function getNotExcludedHoldersSupply() external view returns (uint256);
    function getTotalSupply() external view returns (uint256);
    function updateTotalSupplyFactor(uint256 totalSupplyBefore) external;
    function getBalance(address user) external view returns (uint256);
    function investorData(address user) external view returns (bytes memory);
    function excludeFromRestrictions(address account) external;
    function stake(uint256 amount) external;
    function exit() external;
    function activateInvestmentSystem(bytes calldata data) external;
    function getReward() external;

    event RewardAdded(address indexed rewardToken, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed rewardToken, address indexed user, uint256 reward);
    event CumulativeTotalSupplyFactorUpdated(uint256 indexed cumulativeTotalSupplyFactor);
    event InvestmentSystemActivated(address indexed user, bytes indexed data);
    event InvestmentSystemDataChanged(address indexed user, bytes indexed oldData, bytes indexed newData);
    event InvestmentSystemDeactivated(address indexed user, bytes indexed data);

    error ZeroDeposit();
    error AlreadyActivated();
    error NotActivated();
    error AttemptToStakeZero();
    error AttemptToWithdrawZero();
    error InvalidAmountToStake();
    error InvalidAmountToWithdraw();
    error ProvidedRewardTooHigh();
    error TooEarlyDeactivation();
    error ForbiddenToClaimRewards();
    error InvalidCallee();
    error InvalidToken();
    error NoChangeInData();
}
