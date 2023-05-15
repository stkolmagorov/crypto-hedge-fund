// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./base/RolesManager.sol";
import "./interfaces/IInvestmentSystemDistributor.sol";
import "./interfaces/ILunchBox.sol";
import "./interfaces/IIDODistributor.sol";
import "./interfaces/IIDOFactory.sol";

contract InvestmentSystemDistributor is IInvestmentSystemDistributor, RolesManager {
    bytes32 public constant SNACKS_POOL_ROLE = keccak256('SNACKS_POOL_ROLE'); 
    uint256 private constant BASE_PERCENT = 10000;

    address public lunchBox;
    address public idoDistributor;
    address public idoFactory;

    event RewardsDeliveredToLunchBox(
        uint256 indexed totalRewardAmountForParticipantsInSnacks,
        uint256 indexed totalRewardAmountForParticipantsInBtcSnacks,
        uint256 indexed totalRewardAmountForParticipantsInEthSnacks
    );
    event RewardsDeliveredToIdo(
        uint256 id,
        uint256 indexed totalRewardAmountForParticipantsInSnacks,
        uint256 indexed totalRewardAmountForParticipantsInBtcSnacks,
        uint256 indexed totalRewardAmountForParticipantsInEthSnacks
    );

    /**
    * @notice Configures the contract.
    * @dev Could be called by the owner in case of resetting addresses.
    * @param snacksPool_ SnacksPool contract address.
    * @param lunchBox_ LunchBox contract address.
    * @param idoDistributor_ IDODistributor contract address.
    * @param idoFactory_ IDOFactory contract address.
    * @param authority_ Authorised address.
    */
    function configure(
        address snacksPool_,
        address lunchBox_,
        address idoDistributor_,
        address idoFactory_,
        address authority_
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        lunchBox = lunchBox_;
        idoDistributor = idoDistributor_;
        idoFactory = idoFactory_;
        _grantRole(SNACKS_POOL_ROLE, snacksPool_);
        _grantRole(AUTHORITY_ROLE, authority_);
    }

    /**
    * @notice Activates investment system for the user.
    * @dev Could be called only by the SnacksPool contract.
    * @param user_ User address.
    * @param data_ Data containing information about activated programs.
    */
    function activateInvestmentSystem(
        address user_,
        bytes calldata data_
    ) 
        external 
        onlyRole(SNACKS_POOL_ROLE)
    {
        (, IDOInfo memory idoInfo) = abi.decode(data_, (uint256, IDOInfo));
        if (idoInfo.indicies.length != 0 && idoInfo.percentages.length != 0) {
            IIDOFactory(idoFactory).updateIdoParticipantInfo(user_, idoInfo);
        }
    }

    /**
    * @notice Updates data about activated programs for the user.
    * @dev Could be called only by the SnacksPool contract.
    * @param user_ User address.
    * @param newData_ New data containing information about activated programs.
    */
    function updateInvestmentSystemData(
        address user_,
        bytes calldata,
        bytes calldata newData_
    ) 
        external 
        onlyRole(SNACKS_POOL_ROLE)
    {
        (, IDOInfo memory idoInfo) = abi.decode(newData_, (uint256, IDOInfo));
        address idoFactoryAddress = idoFactory;
        if (IIDOFactory(idoFactoryAddress).isIdoParticipant(user_)) {
            if (idoInfo.indicies.length != 0 && idoInfo.percentages.length != 0) {
                IIDOFactory(idoFactoryAddress).updateIdoParticipantInfo(user_, idoInfo);
            } else {
                IIDOFactory(idoFactoryAddress).deleteIdoParticipantInfo(user_);
            }
        } else {
            IIDOFactory(idoFactoryAddress).updateIdoParticipantInfo(user_, idoInfo);
        }
    }

    /**
    * @notice Deactivates investment system for the user.
    * @dev Could be called only by the SnacksPool contract.
    * @param user_ User address.
    */
    function deactivateInvestmentSystem(address user_, bytes calldata) external onlyRole(SNACKS_POOL_ROLE) {
        address idoFactoryAddress = idoFactory;
        if (IIDOFactory(idoFactoryAddress).isIdoParticipant(user_)) {
            IIDOFactory(idoFactoryAddress).deleteIdoParticipantInfo(user_);
        }
    }

    /**
     * @notice Delivers all the accumulated rewards in
     * Snacks/BtcSnacks/EthSnacks tokens to the LunchBox.
     * @dev Called by the authorised address once every 12 hours.
     * @param totalRewardAmountForParticipantsInSnacks_ Total amount of Snacks token that
     * belongs to the LunchBox participants.
     * @param totalRewardAmountForParticipantsInBtcSnacks_ Total amount of BtcSnacks token that
     * belongs to the LunchBox participants.
     * @param totalRewardAmountForParticipantsInEthSnacks_ Total amount of EthSnacks token that
     * belongs to the LunchBox participants.
     * @param zoinksBusdAmountOutMin_ The amount of slippage tolerance for
     * Zoinks token to Binance-Peg BUSD token swap.
     * @param btcBusdAmountOutMin_ The amount of slippage tolerance for
     * Binance-Peg BTCB token to Binance-Peg BUSD token swap.
     * @param ethBusdAmountOutMin_ The amount of slippage tolerance for
     * Binance-Peg Ethereum token to Binance-Peg BUSD token swap.
     */
    function deliverRewardsToLunchBox(
        uint256 totalRewardAmountForParticipantsInSnacks_,
        uint256 totalRewardAmountForParticipantsInBtcSnacks_,
        uint256 totalRewardAmountForParticipantsInEthSnacks_,
        uint256 zoinksBusdAmountOutMin_,
        uint256 btcBusdAmountOutMin_,
        uint256 ethBusdAmountOutMin_
    ) 
        external 
        whenNotPaused 
        onlyRole(AUTHORITY_ROLE) 
    {
        ILunchBox(lunchBox).stakeForSnacksPool(
            totalRewardAmountForParticipantsInSnacks_,
            totalRewardAmountForParticipantsInBtcSnacks_,
            totalRewardAmountForParticipantsInEthSnacks_,
            zoinksBusdAmountOutMin_,
            btcBusdAmountOutMin_,
            ethBusdAmountOutMin_
        );
        emit RewardsDeliveredToLunchBox(
            totalRewardAmountForParticipantsInSnacks_,
            totalRewardAmountForParticipantsInBtcSnacks_,
            totalRewardAmountForParticipantsInEthSnacks_
        );
    }

    /**
    * @notice Delivers all the accumulated rewards in 
    * Snacks/BtcSnacks/EthSnacks tokens to the IDO.
    * @dev Called by the authorised address once every 12 hours.
    * @param id_ IDO id. 
    * @param totalRewardAmountForParticipantsInSnacks_ Total amount of Snacks token that 
    * belongs to the exact IDO participants.
    * @param totalRewardAmountForParticipantsInBtcSnacks_ Total amount of BtcSnacks token that 
    * belongs to the exact IDO participants.
    * @param totalRewardAmountForParticipantsInEthSnacks_ Total amount of EthSnacks token that 
    * belongs to the exact IDO participants.
    * @param btcBusdAmountOutMin_ The amount of slippage tolerance for 
    * Binance-Peg BTCB token to Binance-Peg BUSD token swap.
    * @param ethBusdAmountOutMin_ The amount of slippage tolerance for 
    * Binance-Peg Ethereum token to Binance-Peg BUSD token swap.
    * @param busdZoinksAmountOutMin_ The amount of slippage tolerance for 
    * Binance-Peg BUSD token to Zoinks token swap.
    */
    function deliverRewardsToIdo(
        uint256 id_,
        uint256 totalRewardAmountForParticipantsInSnacks_,
        uint256 totalRewardAmountForParticipantsInBtcSnacks_,
        uint256 totalRewardAmountForParticipantsInEthSnacks_,
        uint256 btcBusdAmountOutMin_,
        uint256 ethBusdAmountOutMin_,
        uint256 busdZoinksAmountOutMin_
    )
        external 
        whenNotPaused
        onlyRole(AUTHORITY_ROLE) 
    {
        require(
            id_ < IIDOFactory(idoFactory).getNextIdoId(),
            "InvestmentSystemDistributor: invalid IDO id"
        );
        IIDODistributor(idoDistributor).exchangeInvestments(
            id_,
            totalRewardAmountForParticipantsInSnacks_,
            totalRewardAmountForParticipantsInBtcSnacks_,
            totalRewardAmountForParticipantsInEthSnacks_,
            btcBusdAmountOutMin_,
            ethBusdAmountOutMin_,
            busdZoinksAmountOutMin_
        );
        if (IIDOFactory(idoFactory).isValidIdoId(id_)) {
            IIDODistributor(idoDistributor).diversify(id_);
        }
        emit RewardsDeliveredToIdo(
            id_,
            totalRewardAmountForParticipantsInSnacks_,
            totalRewardAmountForParticipantsInBtcSnacks_,
            totalRewardAmountForParticipantsInEthSnacks_
        );
    }

    /**
    * @notice Verifies data containing information about activated programs.
    * @dev Used as a check inside the SnacksPool contract.
    * @param data_ Data containing information about activated programs.
    */
    function verifyData(bytes calldata data_) external view {
        (uint256 lunchBoxPercentage, IDOInfo memory idoInfo) = abi.decode(data_, (uint256, IDOInfo));
        require(
            idoInfo.percentages.length == idoInfo.indicies.length,
            "InvestmentSystemDistributor: invalid array lengths in IDO data"
        );
        uint256 idoPercentagesSum;
        for (uint256 i = 0; i < idoInfo.indicies.length; i++) {
            require(
                IIDOFactory(idoFactory).isValidIdoId(idoInfo.indicies[i]),
                "InvestmentSystemDistributor: invalid IDO id"
            );
            require(
                idoInfo.percentages[i] != 0,
                "InvestmentSystemDistributor: invalid percentage in IDO data"
            );
            idoPercentagesSum += idoInfo.percentages[i];
        }
        require(
            lunchBoxPercentage + idoPercentagesSum == BASE_PERCENT,
            "InvestmentSystemDistributor: invalid sum of percentages"
        );
    }
}