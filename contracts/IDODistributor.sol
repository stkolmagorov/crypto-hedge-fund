// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";

import "./base/RolesManager.sol";
import "./interfaces/IIDODistributor.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/ISnacksBase.sol";
import "./interfaces/IIDOFactory.sol";
import "./interfaces/IIDOPool.sol";

contract IDODistributor is IIDODistributor, RolesManager {
    using SafeERC20 for IERC20;
    using PRBMathUD60x18 for uint256;

    bytes32 public constant INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE = keccak256('INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE');
    bytes32 public constant IDO_FACTORY_ROLE = keccak256('IDO_FACTORY_ROLE');
    uint256 private constant BASE_PERCENT = 10000;
    uint256 private constant SNACKS_REDEEM_PERCENT = 8000;
    uint256 private constant SNACKS_NON_REDEEM_PERCENT = 2000;
    uint256 private constant BUSD_NON_SWAP_PERCENT = 8000;
    uint256 private constant BUSD_TO_ZOINKS_SWAP_PERCENT = 2000;

    address public immutable busd;
    address public immutable router;
    address public zoinks;
    address public btc;
    address public eth;
    address public snacks;
    address public btcSnacks;
    address public ethSnacks;
    address public snacksPool;
    address public idoFactory;

    mapping(uint256 => uint256) public busdAmountToDiversifyById;
    mapping(uint256 => uint256) public zoinksAmountToDiversifyById;
    mapping(uint256 => uint256) public snacksAmountToDiversifyById;
    mapping(uint256 => uint256) public zoinksAmountStoredById;
    mapping(uint256 => uint256) public snacksAmountStoredById;
    mapping(uint256 => uint256) public btcSnacksAmountStoredById;
    mapping(uint256 => uint256) public ethSnacksAmountStoredById;

    /**
    * @param busd_ Binance-Peg BUSD token address.
    * @param router_ Router contract address (from PancakeSwap DEX).
    */
    constructor(
        address busd_,
        address router_
    ) {
        busd = busd_;
        router = router_;
        IERC20(busd_).approve(router_, type(uint256).max);
    }

    /**
    * @notice Configures the contract.
    * @dev Could be called by the owner in case of resetting addresses.
    * @param zoinks_ Zoinks token address.
    * @param btc_ Binance-Peg BTCB token address.
    * @param eth_ Binance-Peg Ethereum token address.
    * @param snacks_ Snacks token address.
    * @param btcSnacks_ BtcSnacks token address.
    * @param ethSnacks_ EthSnacks token address.
    * @param snacksPool_ SnacksPool contract address.
    * @param idoFactory_ IDOFactory contract address.
    * @param investmentSystemDistributor_ InvestmentSystemDistributor contract address.
    */
    function configure(
        address zoinks_,
        address btc_,
        address eth_,
        address snacks_,
        address btcSnacks_,
        address ethSnacks_,
        address snacksPool_,
        address idoFactory_,
        address investmentSystemDistributor_
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        zoinks = zoinks_;
        btc = btc_;
        eth = eth_;
        snacks = snacks_;
        btcSnacks = btcSnacks_;
        ethSnacks = ethSnacks_;
        snacksPool = snacksPool_;
        idoFactory = idoFactory_;
        _grantRole(IDO_FACTORY_ROLE, idoFactory_);
        _grantRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE, investmentSystemDistributor_);
        if (IERC20(zoinks_).allowance(address(this), snacks_) == 0) {
            IERC20(zoinks_).approve(snacks_, type(uint256).max);
        }
        if (IERC20(btc_).allowance(address(this), router) == 0) {
            IERC20(btc_).approve(router, type(uint256).max);
        }
        if (IERC20(eth_).allowance(address(this), router) == 0) {
            IERC20(eth_).approve(router, type(uint256).max);
        }
    }


    /**
    * @notice Exchanges investments of exact IDO.
    * @dev Called by the InvestmentSystemDistributor contract once every 12 hours.
    * @param id_ IDO id. 
    * @param snacksAmount_ Amount of Snacks tokens to exchange.
    * @param btcSnacksAmount_ Amount of BtcSnacks tokens to exchange.
    * @param ethSnacksAmount_ Amount of EthSnacks tokens to exchange.
    * @param btcBusdAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg BTCB token to Binance-Peg BUSD token swap.
    * @param ethBusdAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg Ethereum token to Binance-Peg BUSD token swap.
    * @param busdZoinksAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg BUSD token to Zoinks token swap.
    */
    function exchangeInvestments(
        uint256 id_,
        uint256 snacksAmount_,
        uint256 btcSnacksAmount_,
        uint256 ethSnacksAmount_,
        uint256 btcBusdAmountOutMin_,
        uint256 ethBusdAmountOutMin_,
        uint256 busdZoinksAmountOutMin_
    )
        external
        onlyRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE)
    {
        if (IIDOFactory(idoFactory).isValidIdoId(id_)) {
            _exchangeSnacks(snacksAmount_, id_);
            uint256 busdAmountToSwapOnZoinks = _exchangeBtcSnacks(btcSnacksAmount_, btcBusdAmountOutMin_, id_);
            busdAmountToSwapOnZoinks += _exchangeEthSnacks(ethSnacksAmount_, ethBusdAmountOutMin_, id_);
            if (busdAmountToSwapOnZoinks != 0) {
                _exchangeBusd(busdAmountToSwapOnZoinks, busdZoinksAmountOutMin_, id_);
            }
        } else {
            address idoPoolAddress = IIDOFactory(idoFactory).idoPoolAddressById(id_);
            if (snacksAmount_ != 0) {
                IERC20(snacks).safeTransferFrom(snacksPool, idoPoolAddress, snacksAmount_);
            }
            if (btcSnacksAmount_ != 0) {
                IERC20(btcSnacks).safeTransferFrom(snacksPool, idoPoolAddress, btcSnacksAmount_);
            }
            if (ethSnacksAmount_ != 0) {
                IERC20(ethSnacks).safeTransferFrom(snacksPool, idoPoolAddress, ethSnacksAmount_);
            }
        }
    }

    /**
    * @notice Diversifies exchanged investments for exact IDO.
    * @dev Called by the InvestmentSystemDistributor contract once every 12 hours if IDO is still valid.
    * @param id_ IDO id. 
    */
    function diversify(uint256 id_) external onlyRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE) {
        address idoPoolAddress = IIDOFactory(idoFactory).idoPoolAddressById(id_);
        uint256 busdAmount = busdAmountToDiversifyById[id_];
        uint256 zoinksAmount = zoinksAmountToDiversifyById[id_];
        uint256 totalAmount = busdAmount + zoinksAmount;
        uint256 requiredAmountOfFunds = IIDOPool(idoPoolAddress).requiredAmountOfFunds();
        if (totalAmount != 0) {
            if (totalAmount <= requiredAmountOfFunds) {
                IIDOPool(idoPoolAddress).mint(totalAmount);
                IERC20(busd).safeTransfer(idoPoolAddress, busdAmount);
                IERC20(zoinks).safeTransfer(idoPoolAddress, zoinksAmount);
            } else {
                IIDOPool(idoPoolAddress).mint(requiredAmountOfFunds);
                uint256 adjustmentFactor = totalAmount.div(requiredAmountOfFunds);
                IERC20(busd).safeTransfer(idoPoolAddress, busdAmount.div(adjustmentFactor));
                IERC20(zoinks).safeTransfer(idoPoolAddress, zoinksAmount.div(adjustmentFactor));
                IIDOFactory(idoFactory).closeIdo(id_);
            }
        }
        uint256 snacksAmount = snacksAmountToDiversifyById[id_];
        if (snacksAmount >= 1 ether) {
            IIDOPool(idoPoolAddress).stake(snacksAmount);
            snacksAmountToDiversifyById[id_] = 0;
        }
        if (busdAmount != 0) {
            busdAmountToDiversifyById[id_] = 0;
        }
        if (zoinksAmount != 0) {
            zoinksAmountToDiversifyById[id_] = 0;
        }
    }

    /**
    * @notice Distributes token balances on the contract to exact IDO.
    * @dev The IDO must be valid and the amount of the distribution must 
    * not exceed the current amount of funds required.
    * @param id_ IDO id.
    * @param busdAmount_ Amount of Binance-Peg BUSD tokens to fund. 
    * @param zoinksAmount_ Amount of Zoinks tokens to fund. 
    */
    function fundIDO(uint256 id_, uint256 busdAmount_, uint256 zoinksAmount_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            IIDOFactory(idoFactory).isValidIdoId(id_),
            "IDODistributor: invalid IDO id"
        );
        require(
            busdAmount_ <= IERC20(busd).balanceOf(address(this)) &&
            zoinksAmount_ <= IERC20(zoinks).balanceOf(address(this)),
            "IDODistributor: insufficient balance"
        );
        require(
            busdAmount_ + zoinksAmount_ <= IIDOPool(IIDOFactory(idoFactory).idoPoolAddressById(id_)).requiredAmountOfFunds(),
            "IDODistributor: invalid amount to fund"
        );
        busdAmountToDiversifyById[id_] += busdAmount_;
        zoinksAmountToDiversifyById[id_] += zoinksAmount_;
    }

    /**
    * @notice Approves Snacks tokens to the IDOPool contract.
    * @dev Implements so that it is possible to call the stake function of the IDOPool contract.
    * @param idoPool_ IDOPool contact address. 
    */
    function approveSnacksToIdoPool(address idoPool_) external onlyRole(IDO_FACTORY_ROLE) {
        IERC20(snacks).approve(idoPool_, type(uint256).max);
    }

    /**
    * @notice Exchanges Snacks tokens according to business logic.
    * @dev Implemented to avoid stack too deep.
    * @param snacksAmount_ Amount of Snacks tokens to exchange.
    * @param id_ IDO id.
    */
    function _exchangeSnacks(uint256 snacksAmount_, uint256 id_) private {
        if (snacksAmount_ != 0) {
            IERC20(snacks).safeTransferFrom(snacksPool, address(this), snacksAmount_);
            snacksAmountToDiversifyById[id_] += snacksAmount_ * SNACKS_NON_REDEEM_PERCENT / BASE_PERCENT;
            uint256 snacksAmountToRedeem = snacksAmount_ * SNACKS_REDEEM_PERCENT / BASE_PERCENT + snacksAmountStoredById[id_];
            if (ISnacksBase(snacks).sufficientBuyTokenAmountOnRedeem(snacksAmountToRedeem)) {
                zoinksAmountToDiversifyById[id_] += ISnacksBase(snacks).redeem(snacksAmountToRedeem);
                if (snacksAmountStoredById[id_] != 0) {
                    snacksAmountStoredById[id_] = 0;
                }
            } else {
                snacksAmountStoredById[id_] += snacksAmount_ * SNACKS_REDEEM_PERCENT / BASE_PERCENT;
            }
        }
    }

    /**
    * @notice Exchanges BtcSnacks tokens according to business logic.
    * @dev Implemented to avoid stack too deep.
    * @param btcSnacksAmount_ Amount of BtcSnacks tokens to exchange.
    * @param btcBusdAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg BTCB token to Binance-Peg BUSD token swap.
    * @param id_ IDO id.
    */
    function _exchangeBtcSnacks(
        uint256 btcSnacksAmount_, 
        uint256 btcBusdAmountOutMin_, 
        uint256 id_
    ) 
        private 
        returns (uint256 busdAmountToSwapOnZoinks)
    {
        if (btcSnacksAmount_ != 0) {
            IERC20(btcSnacks).safeTransferFrom(snacksPool, address(this), btcSnacksAmount_);
            uint256 btcSnacksAmountToRedeem = btcSnacksAmount_ + btcSnacksAmountStoredById[id_];
            if (ISnacksBase(btcSnacks).sufficientBuyTokenAmountOnRedeem(btcSnacksAmountToRedeem)) {
                uint256 btcAmount = ISnacksBase(btcSnacks).redeem(btcSnacksAmountToRedeem);
                address[] memory path = new address[](2);
                path[0] = btc;
                path[1] = busd;
                uint256[] memory amounts = new uint256[](2);
                amounts = IRouter(router).swapExactTokensForTokens(
                    btcAmount,
                    btcBusdAmountOutMin_,
                    path,
                    address(this),
                    block.timestamp
                );
                if (btcSnacksAmountStoredById[id_] != 0) {
                    btcSnacksAmountStoredById[id_] = 0;
                }
                busdAmountToDiversifyById[id_] += amounts[1] * BUSD_NON_SWAP_PERCENT / BASE_PERCENT;
                busdAmountToSwapOnZoinks += amounts[1] * BUSD_TO_ZOINKS_SWAP_PERCENT / BASE_PERCENT;
            } else {
                btcSnacksAmountStoredById[id_] += btcSnacksAmount_;
            }
        }
    }

    /**
    * @notice Exchanges EthSnacks tokens according to business logic.
    * @dev Implemented to avoid stack too deep.
    * @param ethSnacksAmount_ Amount of EthSnacks tokens to exchange.
    * @param ethBusdAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg Ethereum token to Binance-Peg BUSD token swap.
    * @param id_ IDO id.
    */
    function _exchangeEthSnacks(
        uint256 ethSnacksAmount_,
        uint256 ethBusdAmountOutMin_,
        uint256 id_
    )
        private
        returns (uint256 busdAmountToSwapOnZoinks)
    {
        if (ethSnacksAmount_ != 0) {
            IERC20(ethSnacks).safeTransferFrom(snacksPool, address(this), ethSnacksAmount_);
            uint256 ethSnacksAmountToRedeem = ethSnacksAmount_ + ethSnacksAmountStoredById[id_];
            if (ISnacksBase(ethSnacks).sufficientBuyTokenAmountOnRedeem(ethSnacksAmountToRedeem)) {
                uint256 ethAmount = ISnacksBase(ethSnacks).redeem(ethSnacksAmountToRedeem);
                address[] memory path = new address[](2);
                path[0] = eth;
                path[1] = busd;
                uint256[] memory amounts = new uint256[](2);
                amounts = IRouter(router).swapExactTokensForTokens(
                    ethAmount,
                    ethBusdAmountOutMin_,
                    path,
                    address(this),
                    block.timestamp
                );
                if (ethSnacksAmountStoredById[id_] != 0) {
                    ethSnacksAmountStoredById[id_] = 0;
                }
                busdAmountToDiversifyById[id_] += amounts[1] * BUSD_NON_SWAP_PERCENT / BASE_PERCENT;
                busdAmountToSwapOnZoinks += amounts[1] * BUSD_TO_ZOINKS_SWAP_PERCENT / BASE_PERCENT;
            } else {
                ethSnacksAmountStoredById[id_] += ethSnacksAmount_;
            }
        }
    }

    /**
    * @notice Exchanges Binance-Peg BUSD tokens according to business logic.
    * @dev Implemented to avoid stack too deep.
    * @param busdAmountToSwapOnZoinks_ Amount of Binance-Peg BUSD tokens to exchange.
    * @param busdZoinksAmountOutMin_ Minimal amount of tokens (slippage tolerance) for 
    * Binance-Peg BUSD token to Zoinks token swap.
    * @param id_ IDO id.
    */
    function _exchangeBusd(
        uint256 busdAmountToSwapOnZoinks_, 
        uint256 busdZoinksAmountOutMin_, 
        uint256 id_
    ) 
        private 
    {
        address[] memory path = new address[](2);
        path[0] = busd;
        path[1] = zoinks;
        uint256[] memory amounts = new uint256[](2);
        amounts = IRouter(router).swapExactTokensForTokens(
            busdAmountToSwapOnZoinks_,
            busdZoinksAmountOutMin_,
            path,
            address(this),
            block.timestamp
        );
        if (ISnacksBase(snacks).sufficientPayTokenAmountOnMint(amounts[1] + zoinksAmountStoredById[id_])) {
            snacksAmountToDiversifyById[id_] += ISnacksBase(snacks).mintWithPayTokenAmount(amounts[1] + zoinksAmountStoredById[id_]);
            if (zoinksAmountStoredById[id_] != 0) {
                zoinksAmountStoredById[id_] = 0;
            }
        } else {
            zoinksAmountStoredById[id_] += amounts[1];
        }
    }
}