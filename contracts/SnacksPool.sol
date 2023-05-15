// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";

import "./base/RolesManager.sol";
import "./interfaces/ISnacksPool.sol";
import "./interfaces/ILunchBox.sol";
import "./interfaces/ISnacksBase.sol";
import "./interfaces/IInvestmentSystemDistributor.sol";

contract SnacksPool is ISnacksPool, RolesManager, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using PRBMathUD60x18 for uint256;

    uint256 public constant REWARDS_DURATION = 12 hours;
    uint256 private constant BASE_PERCENT = 10000;

    address public poolRewardDistributor;
    address public seniorage;
    address public lunchBox;
    address public snacks;
    address public investmentSystemDistributor;
    uint256 public cumulativeTotalSupplyFactor = PRBMathUD60x18.fromUint(1);
    uint256 private _excludedHoldersSupply;
    uint256 private _notExcludedHoldersSupply;
    uint256 private _excludedHoldersLunchBoxSupply;
    uint256 private _notExcludedHoldersLunchBoxSupply;

    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public rewards;
    mapping(address => uint256) public rewardPerTokenStored;
    mapping(address => uint256) public lastUpdateTimePerToken;
    mapping(address => uint256) public periodFinishPerToken;
    mapping(address => uint256) public rewardRates;
    mapping(address => uint256) public userLastDepositTime;
    mapping(address => uint256) public userLastActivationTime;
    mapping(address => uint256) public userLastCumulativeTotalSupplyFactor;
    mapping(address => bytes) public investorData;
    mapping(address => bool) public isExcludedFromRestrictions;
    mapping(address => uint256) private _balances;
    EnumerableSet.AddressSet private _rewardTokens;
    EnumerableSet.AddressSet private _investors;
    EnumerableSet.AddressSet private _lunchBoxParticipants;

    modifier updateRewards(address user_) {
        for (uint256 i = 0; i < _rewardTokens.length(); i++) {
            _updateReward(_rewardTokens.at(i), user_);
        }
        if (userLastCumulativeTotalSupplyFactor[user_] != cumulativeTotalSupplyFactor) {
            userLastCumulativeTotalSupplyFactor[user_] = cumulativeTotalSupplyFactor;
        }
        _;
    }

    modifier updateRewardPerToken(address rewardToken_, address user_) {
        _updateReward(rewardToken_, user_);
        _;
    }

    modifier onlyValidToken(address rewardToken_) {
        if (!_rewardTokens.contains(rewardToken_)) {
            revert InvalidToken();
        }
        _;
    }

    constructor() {
        _grantRole(AUTHORITY_ROLE, msg.sender);
    }
    
    /**
    * @notice Configures the contract.
    * @dev Could be called by the owner in case of resetting addresses.
    * @param seniorage_ Seniorage contract address.
    * @param poolRewardDistributor_ PoolRewardDistributor contract address.
    * @param lunchBox_ LunchBox contract address.
    * @param snacks_ Snacks token address.
    * @param btcSnacks_ BtcSnacks token address.
    * @param ethSnacks_ EthSnacks token address.
    * @param investmentSystemDistributor_ InvestmentSystemDistributor contract address.
    */
    function configure(
        address seniorage_,
        address poolRewardDistributor_,
        address lunchBox_,
        address snacks_,
        address btcSnacks_,
        address ethSnacks_,
        address investmentSystemDistributor_
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        seniorage = seniorage_;
        poolRewardDistributor = poolRewardDistributor_;
        lunchBox = lunchBox_;
        snacks = snacks_;
        investmentSystemDistributor = investmentSystemDistributor_;
        for (uint256 i = 0; i < _rewardTokens.length(); i++) {
            _rewardTokens.remove(_rewardTokens.at(0));
        }
        _rewardTokens.add(snacks_);
        _rewardTokens.add(btcSnacks_);
        _rewardTokens.add(ethSnacks_);
    }

    /**
    * @notice Approves all snacks to `account_`.
    * @dev Used so that it is possible to redirect rewards to investment programs.
    * @param account_ Account address.
    */
    function approveAllSnacksTo(address account_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < _rewardTokens.length(); i++) {
            IERC20(_rewardTokens.at(i)).approve(account_, type(uint256).max);
        }
    }

    /**
    * @notice Excludes `account_` from all restrictions.
    * @dev Could be called only by the AUTHORITY_ROLE.
    * @param account_ Account address.
    */
    function excludeFromRestrictions(address account_) external onlyRole(AUTHORITY_ROLE) {
        userLastDepositTime[account_] = 0;
        userLastActivationTime[account_] = 0;
        isExcludedFromRestrictions[account_] = true;
    }

    /**
    * @notice Updates cumulative total supply factor.
    * @dev Adjusts `rewardPerTokenStored` and `userRewardPerTokenPaid` to the correct values 
    * after increasing the deposits of non-excluded holders.
    * @param totalSupplyBefore_ Total supply before new adjustment factor value in the Snacks contract.
    */
    function updateTotalSupplyFactor(uint256 totalSupplyBefore_) external {
        if (msg.sender != snacks) {
            revert InvalidCallee();
        }
        if (totalSupplyBefore_ != 0) {
            uint256 totalSupplyFactor = getTotalSupply().div(totalSupplyBefore_);
            cumulativeTotalSupplyFactor = cumulativeTotalSupplyFactor.mul(totalSupplyFactor);
            for (uint256 i = 0; i < _rewardTokens.length(); i++) {
                address rewardToken = _rewardTokens.at(i);
                rewardPerTokenStored[rewardToken] = rewardPerTokenStored[rewardToken].div(totalSupplyFactor);
            }
            emit CumulativeTotalSupplyFactorUpdated(cumulativeTotalSupplyFactor);
        }
    }

    /**
    * @notice Activates investment system for the user.
    * @dev Can be successfully called only if the caller has not yet activated the investment system 
    * and his deposit exceeds 0.
    * @param data_ Data containing information about activated programs.
    */
    function activateInvestmentSystem(bytes calldata data_) external whenNotPaused {
        if (_balances[msg.sender] == 0) {
            revert ZeroDeposit();
        }
        if (_investors.contains(msg.sender)) {
            revert AlreadyActivated();
        }
        IInvestmentSystemDistributor(investmentSystemDistributor).verifyData(data_);
        getReward();
        uint256 lunchBoxPercentage = abi.decode(data_, (uint256));
        if (lunchBoxPercentage != 0) {
            ILunchBox(lunchBox).updateRewardForUser(msg.sender);
            _lunchBoxParticipants.add(msg.sender);
            if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
                _excludedHoldersLunchBoxSupply += _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            } else {
                _notExcludedHoldersLunchBoxSupply += _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            }
        }
        IInvestmentSystemDistributor(investmentSystemDistributor).activateInvestmentSystem(msg.sender, data_);
        _investors.add(msg.sender);
        investorData[msg.sender] = data_;
        if (!isExcludedFromRestrictions[msg.sender]) {
            userLastActivationTime[msg.sender] = block.timestamp;
        }
        emit InvestmentSystemActivated(msg.sender, data_);
    }

    /**
    * @notice Changes data about activated programs for the user.
    * @dev Can be successfully called only if the caller has activated the investment system before.
    * @param data_ New data containing information about activated programs.
    */
    function changeInvestmentSystemData(bytes memory data_) external whenNotPaused {
        if (!_investors.contains(msg.sender)) {
            revert NotActivated();
        }
        bytes memory oldData = investorData[msg.sender];
        if (keccak256(oldData) == keccak256(data_)) {
            revert NoChangeInData();
        }
        IInvestmentSystemDistributor(investmentSystemDistributor).verifyData(data_);
        uint256 lunchBoxPercentage = abi.decode(oldData, (uint256));
        if (lunchBoxPercentage != 0) {
            ILunchBox(lunchBox).getReward(msg.sender);
            _lunchBoxParticipants.remove(msg.sender);
            if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
                _excludedHoldersLunchBoxSupply -= _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            } else {
                _notExcludedHoldersLunchBoxSupply -= _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            }
        }
        lunchBoxPercentage = abi.decode(data_, (uint256));
        if (lunchBoxPercentage != 0) {
            ILunchBox(lunchBox).updateRewardForUser(msg.sender);
            _lunchBoxParticipants.add(msg.sender);
            if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
                _excludedHoldersLunchBoxSupply += _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            } else {
                _notExcludedHoldersLunchBoxSupply += _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            }
        }
        IInvestmentSystemDistributor(investmentSystemDistributor).updateInvestmentSystemData(msg.sender, oldData, data_);
        investorData[msg.sender] = data_;
        emit InvestmentSystemDataChanged(msg.sender, oldData, data_);
    }

    /**
    * @notice Deposits tokens for the user.
    * @dev Updates user's last deposit time. The deposit amount of tokens cannot be equal to 0.
    * @param amount_ Amount of tokens to deposit.
    */
    function stake(uint256 amount_) external whenNotPaused nonReentrant updateRewards(msg.sender) {
        if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
            if (amount_ == 0) {
                revert AttemptToStakeZero();
            }
            if (_lunchBoxParticipants.contains(msg.sender)) {
                ILunchBox(lunchBox).updateRewardForUser(msg.sender);
                _excludedHoldersLunchBoxSupply += 
                    amount_ * abi.decode(investorData[msg.sender], (uint256)) / BASE_PERCENT;
            }
            _balances[msg.sender] += amount_;
            _excludedHoldersSupply += amount_;
        } else {
            uint256 adjustedAmount = amount_.div(ISnacksBase(snacks).adjustmentFactor());
            if (adjustedAmount == 0) {
                revert InvalidAmountToStake();
            }
            if (_lunchBoxParticipants.contains(msg.sender)) {
                ILunchBox(lunchBox).updateRewardForUser(msg.sender);
                _notExcludedHoldersLunchBoxSupply += 
                    adjustedAmount.mul(abi.decode(investorData[msg.sender], (uint256))).div(BASE_PERCENT);
            }
            _balances[msg.sender] += adjustedAmount;
            _notExcludedHoldersSupply += adjustedAmount;
        }
        if (!isExcludedFromRestrictions[msg.sender]) {
            userLastDepositTime[msg.sender] = block.timestamp;
        }
        IERC20(snacks).safeTransferFrom(msg.sender, address(this), amount_);
        emit Staked(msg.sender, amount_);
    }

    /**
    * @notice Withdraws all tokens deposited by the user and gets rewards for him.
    * @dev Withdrawal comission is the same as for the `withdraw()` function.
    */
    function exit() external whenNotPaused {
        withdraw(getBalance(msg.sender));
        getReward();
    }

    /**
    * @notice Notifies the contract of an incoming reward in one of the reward tokens 
    * and recalculates the reward rate.
    * @dev Called by the PoolRewardDistributor contract once every 12 hours.
    * @param rewardToken_ Address of one of the reward tokens.
    * @param reward_ Reward amount.
    */
    function notifyRewardAmount(
        address rewardToken_,
        uint256 reward_
    )
        external
        onlyValidToken(rewardToken_)
        updateRewardPerToken(rewardToken_, address(0))
    {
        if (msg.sender != poolRewardDistributor) {
            revert InvalidCallee();
        }
        if (block.timestamp >= periodFinishPerToken[rewardToken_]) {
            rewardRates[rewardToken_] = reward_ / REWARDS_DURATION;
        } else {
            uint256 remaining = periodFinishPerToken[rewardToken_] - block.timestamp;
            uint256 leftover = remaining * rewardRates[rewardToken_];
            rewardRates[rewardToken_] = (reward_ + leftover) / REWARDS_DURATION;
        }
        uint256 balance;
        if (rewardToken_ == snacks) {
            balance = IERC20(rewardToken_).balanceOf(address(this)) - getTotalSupply();
        } else {
            balance = IERC20(rewardToken_).balanceOf(address(this));
        }
        if (rewardRates[rewardToken_] > balance / REWARDS_DURATION) {
            revert ProvidedRewardTooHigh();
        }
        lastUpdateTimePerToken[rewardToken_] = block.timestamp;
        periodFinishPerToken[rewardToken_] = block.timestamp + REWARDS_DURATION;
        emit RewardAdded(rewardToken_, reward_);
    }

    /**
    * @notice Retrieves the total reward amount for duration in one of the reward tokens.
    * @dev The function allows to get the amount of reward to be distributed in the current period.
    * @param rewardToken_ Address of one of the reward tokens.
    * @return Total reward amount for duration.
    */
    function getRewardForDuration(address rewardToken_) external view onlyValidToken(rewardToken_) returns (uint256) {
        return rewardRates[rewardToken_] * REWARDS_DURATION;
    }
    
    /** 
    * @notice Checks whether the user is a LunchBox participant.
    * @dev If the user is a LunchBox participant, then the reward pattern for him becomes different.
    * @param user_ User address.
    * @return Boolean value indicating whether the user is a LunchBox paricipant.
    */
    function isLunchBoxParticipant(address user_) external view returns (bool) {
        return _lunchBoxParticipants.contains(user_);
    }

    /** 
    * @notice Returns the amount of LunchBox participants.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used in some small count iteration operations.
    * @return The exact amount of the participants.
    */
    function getLunchBoxParticipantsLength() external view returns (uint256) {
        return _lunchBoxParticipants.length();
    }

    /** 
    * @notice Returns an address of the specific LunchBox participant.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used freely in any internal operations (like DELEGATECALL use cases).
    * @param index_ Index.
    * @return The address of a participant.
    */
    function getLunchBoxParticipantAt(uint256 index_) external view returns (address) {
        return _lunchBoxParticipants.at(index_);
    }

    /** 
    * @notice Returns the amount of supply that belong to LunchBox participants.
    * @dev Mind that the `_notExcludedHoldersLunchBoxSupply` variable is 
    * adjusted by factor of Snacks contract.
    * @return The exact amount of the supply.
    */
    function getLunchBoxParticipantsTotalSupply() external view returns (uint256) {
        return 
            _notExcludedHoldersLunchBoxSupply.mul(ISnacksBase(snacks).adjustmentFactor())
            + _excludedHoldersLunchBoxSupply;
    }

    /** 
    * @notice Checks whether the user is a participant of the investment system.
    * @param user_ User address.
    * @return Boolean value indicating whether the user is a paricipant of the investment system.
    */
    function isInvestor(address user_) external view returns (bool) {
        return _investors.contains(user_);
    }

    /** 
    * @notice Returns the amount of supply that belongs to not excluded holders.
    * @dev Mind that the `_notExcludedHoldersSupply` variable is 
    * adjusted by factor of Snacks contract.
    * @return The exact amount of the not excluded holders supply.
    */
    function getNotExcludedHoldersSupply() external view returns (uint256) {
        return _notExcludedHoldersSupply.mul(ISnacksBase(snacks).adjustmentFactor());
    }

    /**
    * @notice Deactivates investment system for the user.
    * @dev Can be successfully called only if the caller has activated the investment system 
    * and it has been over 24 hours since the last activation.
    */
    function deactivateInvestmentSystem() public whenNotPaused updateRewards(msg.sender) {
        if (!_investors.contains(msg.sender)) {
            revert NotActivated();
        }
        if (block.timestamp < userLastActivationTime[msg.sender] + 1 days) {
            revert TooEarlyDeactivation();
        }
        uint256 lunchBoxPercentage = abi.decode(investorData[msg.sender], (uint256));
        if (lunchBoxPercentage != 0) {
            ILunchBox(lunchBox).getReward(msg.sender);
            _lunchBoxParticipants.remove(msg.sender);
            if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
                _excludedHoldersLunchBoxSupply -= _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            } else {
                _notExcludedHoldersLunchBoxSupply -= _balances[msg.sender] * lunchBoxPercentage / BASE_PERCENT;
            }
        }
        IInvestmentSystemDistributor(investmentSystemDistributor).deactivateInvestmentSystem(msg.sender, investorData[msg.sender]);
        _investors.remove(msg.sender);
        delete investorData[msg.sender];
        for (uint256 i = 0; i < _rewardTokens.length(); i++) {
            rewards[msg.sender][_rewardTokens.at(i)] = 0;
        }
        emit InvestmentSystemDeactivated(msg.sender, investorData[msg.sender]);
    }
    
    /**
    * @notice Withdraws the desired amount of deposited tokens for the user.
    * @dev If 24 hours have not passed since the last deposit by the user, 
    * a fee of 50% is charged from the withdrawn amount of deposited tokens
    * and sent to the Seniorage contract. The withdrawn amount of tokens cannot
    * exceed the amount of the deposit or be equal to 0.
    * @param amount_ Desired amount of tokens to withdraw.
    */
    function withdraw(uint256 amount_) public whenNotPaused nonReentrant updateRewards(msg.sender) {
        if (ISnacksBase(snacks).isExcludedHolder(msg.sender)) {
            if (amount_ == 0) {
                revert AttemptToWithdrawZero();
            }
            if (_investors.contains(msg.sender)) {
                if (_lunchBoxParticipants.contains(msg.sender)) {
                    ILunchBox(lunchBox).updateRewardForUser(msg.sender);
                    if (amount_ == _balances[msg.sender]) {
                        deactivateInvestmentSystem();
                    } else {
                        _excludedHoldersLunchBoxSupply -= 
                            amount_ * abi.decode(investorData[msg.sender], (uint256)) / BASE_PERCENT;
                    }
                } else {
                    if (amount_ == _balances[msg.sender]) {
                        deactivateInvestmentSystem();
                    }
                }
            }
            _balances[msg.sender] -= amount_;
            _excludedHoldersSupply -= amount_;
        } else {
            uint256 adjustedAmount = amount_.div(ISnacksBase(snacks).adjustmentFactor());
            if (adjustedAmount == 0) {
                revert InvalidAmountToWithdraw();
            }
            if (_investors.contains(msg.sender)) {
                if (_lunchBoxParticipants.contains(msg.sender)) {
                    ILunchBox(lunchBox).updateRewardForUser(msg.sender);
                    if (_balances[msg.sender] - adjustedAmount <= 1 wei) {
                        deactivateInvestmentSystem();
                    } else {
                        _notExcludedHoldersLunchBoxSupply -= 
                            adjustedAmount.mul(abi.decode(investorData[msg.sender], (uint256))).div(BASE_PERCENT);
                    }
                } else {
                    if (_balances[msg.sender] - adjustedAmount <= 1 wei) {
                        deactivateInvestmentSystem();
                    }
                }
            }
            if (_balances[msg.sender] - adjustedAmount <= 1 wei) {
                _balances[msg.sender] = 0;
            } else {
                _balances[msg.sender] -= adjustedAmount;
            }
            _notExcludedHoldersSupply -= adjustedAmount;
        }
        if (block.timestamp < userLastDepositTime[msg.sender] + 1 days) {
            uint256 seniorageFeeAmount = amount_ / 2;
            IERC20(snacks).safeTransfer(seniorage, seniorageFeeAmount);
            IERC20(snacks).safeTransfer(msg.sender, amount_ - seniorageFeeAmount);
            emit Withdrawn(msg.sender, amount_ - seniorageFeeAmount);
        } else {
            IERC20(snacks).safeTransfer(msg.sender, amount_);
            emit Withdrawn(msg.sender, amount_);
        }
    }
    
    /**
    * @notice Transfers rewards to the user.
    * @dev If the user is a LucnhBox participant, then the reward pattern for him becomes different.
    */
    function getReward() public whenNotPaused nonReentrant updateRewards(msg.sender) {
        if (_investors.contains(msg.sender)) {
            if (_lunchBoxParticipants.contains(msg.sender)) {
                ILunchBox(lunchBox).getReward(msg.sender);
            } else {
                revert ForbiddenToClaimRewards();
            }
        } else {
            for (uint256 i = 0; i < _rewardTokens.length(); i++) {
                address rewardToken = _rewardTokens.at(i);
                uint256 reward = rewards[msg.sender][rewardToken];
                if (reward > 0) {
                    rewards[msg.sender][rewardToken] = 0;
                    IERC20(rewardToken).safeTransfer(msg.sender, reward);
                    emit RewardPaid(rewardToken, msg.sender, reward);
                }
            }
        }
    }

    /**
    * @notice Retrieves the user's deposit amount.
    * @dev User deposits are automatically increased as reward for holding takes into account holders deposits.
    * @param user_ User address.
    * @return Amount of the deposit.
    */
    function getBalance(address user_) public view returns (uint256) {
        if (ISnacksBase(snacks).isExcludedHolder(user_)) {
            return _balances[user_];
        } else {
            return _balances[user_].mul(ISnacksBase(snacks).adjustmentFactor());
        }
    }

    /**
    * @notice Retrieves the total amount of deposited tokens.
    * @dev Since user deposits are automatically increased, total supply has the same behaviour.
    * @return Total amount of deposited tokens.
    */
    function getTotalSupply() public view returns (uint256) {
        return 
            _notExcludedHoldersSupply.mul(ISnacksBase(snacks).adjustmentFactor())
            + _excludedHoldersSupply;
    }

    /**
    * @notice Retrieves the time a reward was applicable for one of the reward tokens.
    * @dev Allows the contract to correctly calculate rewards earned by users.
    * @param rewardToken_ Address of one of the reward tokens.
    * @return Last time reward was applicable for one of the reward tokens.
    */
    function lastTimeRewardApplicable(
        address rewardToken_
    )
        public
        view
        onlyValidToken(rewardToken_)
        returns (uint256)
    {
        return
            block.timestamp < periodFinishPerToken[rewardToken_]
            ? block.timestamp
            : periodFinishPerToken[rewardToken_];
    }

    /**
    * @notice Retrieves the amount of reward per token staked in one of the reward tokens.
    * @dev The logic is derived from the StakingRewards contract.
    * @param rewardToken_ Address of one of the reward tokens.
    * @return Amount of reward per token staked in one of the reward tokens.
    */
    function rewardPerToken(address rewardToken_) public view onlyValidToken(rewardToken_) returns (uint256) {
        uint256 totalSupply = getTotalSupply();
        if (totalSupply == 0) {
            return rewardPerTokenStored[rewardToken_];
        }
        return
            (lastTimeRewardApplicable(rewardToken_) - lastUpdateTimePerToken[rewardToken_])
            * rewardRates[rewardToken_]
            * 1e18
            / totalSupply
            + rewardPerTokenStored[rewardToken_];
    }

    /**
    * @notice Retrieves the amount of rewards earned by the user in one of the reward tokens.
    * @dev Calculates earned reward from the last `userRewardPerTokenPaid` timestamp 
    * to the latest block timestamp time interval.
    * @param user_ User address.
    * @param rewardToken_ Address of one of the reward tokens.
    * @return Amount of rewards earned by the user in one of the reward tokens.
    */
    function earned(
        address user_,
        address rewardToken_
    )
        public
        view
        onlyValidToken(rewardToken_)
        returns (uint256)
    {
        uint256 adjustmentFactor;
        if (userLastCumulativeTotalSupplyFactor[user_] == 0) {
            adjustmentFactor = cumulativeTotalSupplyFactor;
        } else {
            adjustmentFactor = cumulativeTotalSupplyFactor.div(userLastCumulativeTotalSupplyFactor[user_]);
        }
        uint256 rewardPerTokenPaid = userRewardPerTokenPaid[rewardToken_][user_].div(adjustmentFactor);
        return
            getBalance(user_)
            * (rewardPerToken(rewardToken_) - rewardPerTokenPaid)
            / 1e18
            + rewards[user_][rewardToken_];
    }

    /**
    * @notice Updates the reward earned by the user in one of the reward tokens.
    * @dev Called inside `updateRewardPerToken` modifier and `_updateAllRewards()` function.
    * It serves both purpose: gas savings and readability.
    * @param rewardToken_ Address of one of the reward tokens.
    * @param user_ User address.
    */
    function _updateReward(address rewardToken_, address user_) private {
        rewardPerTokenStored[rewardToken_] = rewardPerToken(rewardToken_);
        lastUpdateTimePerToken[rewardToken_] = lastTimeRewardApplicable(rewardToken_);
        if (user_ != address(0)) {
            rewards[user_][rewardToken_] = earned(user_, rewardToken_);
            userRewardPerTokenPaid[rewardToken_][user_] = rewardPerTokenStored[rewardToken_];
        }
    }
}
