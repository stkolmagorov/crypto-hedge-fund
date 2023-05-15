// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./base/RolesManager.sol";
import "./interfaces/IIDOLunchBoxPool.sol";
import "./interfaces/ISnacksPool.sol";

contract IDOLunchBoxPool is IIDOLunchBoxPool, RolesManager {
    using SafeERC20 for IERC20;

    bytes32 public constant IDO_POOL_ROLE = keccak256('IDO_POOL_ROLE');
    uint256 private constant BASE_PERCENT = 10000;

    address public snacks;
    address public snacksPool;
    address public idoPool;
    bool private _isInitialized;

    /**
    * @notice Initializes the contract.
    * @dev Called by the IDOFactory contract when IDO opens.
    * @param snacks_ Snacks token address.
    * @param snacksPool_ SnacksPool contract address.
    * @param idoPool_ IDOPool contract address.
    * @param authority_ Authorised address.
    */
    function initialize(
        address snacks_,
        address snacksPool_,
        address idoPool_,
        address authority_
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            !_isInitialized,
            "IDOLunchBoxPool: already initialized"
        );
        snacks = snacks_;
        snacksPool = snacksPool_;
        idoPool = idoPool_;
        _grantRole(IDO_POOL_ROLE, idoPool_);
        _grantRole(AUTHORITY_ROLE, authority_);
        IERC20(snacks_).approve(snacksPool_, type(uint256).max);
        _isInitialized = true;
    }

    /**
    * @notice Stakes `amount_` tokens to the SnacksPool.
    * @dev Could be called only by the IDOPool contract.
    * @param amount_ Amount of tokens to stake.
    */
    function stake(uint256 amount_) external onlyRole(IDO_POOL_ROLE) {
        IERC20(snacks).safeTransferFrom(msg.sender, address(this), amount_);
        ISnacksPool(snacksPool).stake(IERC20(snacks).balanceOf(address(this)));
    }

    /**
    * @notice Gets rewards for staking and redirects them to the IDOPool contract.
    * @dev Could be called only by the IDOPool contract.
    */
    function getReward() external onlyRole(IDO_POOL_ROLE) {
        address snacksPoolAddress = snacksPool;
        require(
            ISnacksPool(snacksPoolAddress).isLunchBoxParticipant(address(this)),
            "IDOLunchBoxPool: LunchBox was not activated"
        );
        address snacksAddress = snacks;
        uint256 snacksBalanceBefore = IERC20(snacksAddress).balanceOf(address(this));
        ISnacksPool(snacksPoolAddress).getReward();
        uint256 difference = IERC20(snacksAddress).balanceOf(address(this)) - snacksBalanceBefore;
        if (difference != 0) {
            IERC20(snacksAddress).safeTransfer(idoPool, difference);
        }
    }
    
    /**
    * @notice Exits from the SnacksPool and redirects deposit and rewards to the IDOPool contract.
    * @dev Could be called only by the IDOPool contract.
    */
    function exit() external onlyRole(IDO_POOL_ROLE) {
        ISnacksPool(snacksPool).exit();
        uint256 balance = IERC20(snacks).balanceOf(address(this));
        IERC20(snacks).safeTransfer(idoPool, balance);
    }

    /**
    * @notice Activates LunchBox.
    * @dev Could be called only by the owner.
    * @param data_ Data for LunchBox activation.
     */
    function activateLunchBox(bytes calldata data_) external onlyRole(AUTHORITY_ROLE) {
        require(
            abi.decode(data_, (uint256)) == BASE_PERCENT,
            "IDOLunchBoxPool: invalid percentage"
        );
        ISnacksPool(snacksPool).activateInvestmentSystem(data_);
    }
}