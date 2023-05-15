// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";

import "./base/RolesManager.sol";
import "./interfaces/IIDOPool.sol";
import "./interfaces/IIDOToken.sol";
import "./interfaces/IIDOFactory.sol";
import "./interfaces/ISnacksPool.sol";
import "./interfaces/IIDOLunchBoxPool.sol";
import "./interfaces/ISnacksBase.sol";
import "./interfaces/IZoinks.sol";

contract IDOPool is IIDOPool, RolesManager {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using PRBMathUD60x18 for uint256;

    bytes32 public constant IDO_DISTRIBUTOR_ROLE = keccak256('IDO_DISTRIBUTOR_ROLE');
    uint256 private constant BASE_PERCENT = 10000;
    uint256 private constant REDEEM_FEE_PERCENT = 1000;

    uint256 public allowablePercentageForDirectFunding = 2000;
    uint256 public numberOfProjects;
    uint256 public numberOfProjectsInProgress;
    uint256 public requiredAmountOfFunds;
    uint256 public cumulativeCommonSnacksReward;
    uint256 public cumulativeCommonBtcSnacksReward;
    uint256 public cumulativeCommonEthSnacksReward;
    address public idoFactory;
    address public snacksPool;
    address public zoinks;
    address public busd;
    address public defaultOwner;
    address public insuranceRecipient;
    address public idoLunchBoxPool;
    bytes32 public merkleRootForIdoTokens;
    bytes32 public merkleRootForSnacks;
    bool public isInsuranceDepositClosed;
    bool private _isInitialized;

    mapping(address => mapping(address => uint256)) public cumulativeIdoTokensClaimed;
    mapping(address => mapping(address => uint256)) public cumulativeSnacksClaimed;
    mapping(address => uint256) public projectIdByFundsReceiver;
    mapping(uint256 => address) public fundsReceiverByProjectId;
    mapping(uint256 => uint256) public fundsRaisedByProjectId;
    mapping(uint256 => uint256) public initialAllowableAmountToFundByProjectId;
    mapping(uint256 => uint256) public currentAllowableAmountToFundByProjectId;
    mapping(uint256 => uint256) public requiredAmountOfFundsByProjectId;
    mapping(uint256 => uint256) public cumulativeSnacksRewardByProjectId;
    mapping(uint256 => uint256) public zoinksAmountStoredByProjectId;
    mapping(uint256 => bool) public isFundraisingCompletedByProjectId;
    mapping(uint256 => bool) public isRemovedByProjectId;
    uint256[] public shares;
    address[] public idoTokens;
    address[] public snacks;
    EnumerableSet.AddressSet private _fundsReceivers;

    /**
    * @notice Initializes the contract.
    * @dev Called by the IDOFactory contract when IDO opens.
    * @param idoPoolParameters_ IDOPool parameters.
    * @param snacks_ Snacks token addresses.
    * @param idoDistributor_ IDODistributor contract address.
    * @param snacksPool_ SnacksPool contract address.
    * @param zoinks_ Zoinks token address.
    * @param busd_ Binance-Peg BUSD token address.
    */
    function initialize(
        IDOPoolParameters memory idoPoolParameters_,
        address[] memory snacks_,
        address idoDistributor_,
        address snacksPool_,
        address zoinks_,
        address busd_
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(
            !_isInitialized,
            "IDOPool: already initialized"
        );
        uint256 totalRequiredAmountOfFunds;
        for (uint256 i = 0; i < idoPoolParameters_.fundsReceivers.length; i++) {
            address fundsReceiver = idoPoolParameters_.fundsReceivers[i];
            _fundsReceivers.add(fundsReceiver);
            projectIdByFundsReceiver[fundsReceiver] = i;
            fundsReceiverByProjectId[i] = fundsReceiver;
            requiredAmountOfFundsByProjectId[i] = idoPoolParameters_.requiredAmountsOfFunds[i];
            uint256 allowableAmount = 
                idoPoolParameters_.requiredAmountsOfFunds[i] * allowablePercentageForDirectFunding / BASE_PERCENT;
            initialAllowableAmountToFundByProjectId[i] = allowableAmount;
            currentAllowableAmountToFundByProjectId[i] = allowableAmount;
            totalRequiredAmountOfFunds += idoPoolParameters_.requiredAmountsOfFunds[i];
        }
        numberOfProjects = idoPoolParameters_.idoTokens.length;
        numberOfProjectsInProgress = idoPoolParameters_.idoTokens.length;
        shares = idoPoolParameters_.shares;
        idoTokens = idoPoolParameters_.idoTokens;
        snacks = snacks_;
        requiredAmountOfFunds = totalRequiredAmountOfFunds;
        insuranceRecipient = idoPoolParameters_.insuranceRecipient;
        defaultOwner = idoPoolParameters_.defaultOwner;
        idoFactory = msg.sender;
        idoLunchBoxPool = idoPoolParameters_.idoLunchBoxPoolAddress;
        snacksPool = snacksPool_;
        zoinks = zoinks_;
        busd = busd_;
        _grantRole(DEFAULT_ADMIN_ROLE, idoPoolParameters_.defaultOwner);
        _grantRole(AUTHORITY_ROLE, idoPoolParameters_.authority);
        _grantRole(IDO_DISTRIBUTOR_ROLE, idoDistributor_);
        address snacksAddress = snacks_[0];
        IERC20(zoinks_).approve(snacksAddress, type(uint256).max);
        IERC20(busd_).approve(zoinks_, type(uint256).max);
        IERC20(snacksAddress).approve(idoPoolParameters_.idoLunchBoxPoolAddress, type(uint256).max);
        IERC20(snacksAddress).approve(snacksPool_, type(uint256).max);
        _isInitialized = true;
    }

    /**
    * @notice Sets funds receiver of `projectId_`.
    * @dev Called by the owner when project metadata needs to be changed.
    * @param projectId_ Project id.
    * @param newFundsReceiver_ New funds receiver address.
    */
    function setFundsReceiver(
        uint256 projectId_,
        address newFundsReceiver_
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        require(
            !isFundraisingCompletedByProjectId[projectId_],
            "IDOPool: project was completed or removed"
        );
        require(
            !_fundsReceivers.contains(newFundsReceiver_),
            "IDOPool: invalid funds receiver"
        );
        _fundsReceivers.remove(fundsReceiverByProjectId[projectId_]);
        _fundsReceivers.add(newFundsReceiver_);
        projectIdByFundsReceiver[newFundsReceiver_] = projectId_;
        fundsReceiverByProjectId[projectId_] = newFundsReceiver_;
        emit FundsReceiverChanged(newFundsReceiver_, projectId_);
    }

    /**
    * @notice Changes IDO token name and symbol of `projectId_`.
    * @dev Called by the owner when project metadata needs to be changed.
    * @param projectId_ Project id.
    * @param newName_ New IDO token name.
    * @param newSymbol_ New IDO token symbol.
    */
    function changeIdoTokenNameAndSymbol(
        uint256 projectId_,
        string calldata newName_, 
        string calldata newSymbol_
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        IIDOToken(idoTokens[projectId_]).changeNameAndSymbol(newName_, newSymbol_);
        emit IdoTokenNameAndSymbolChanged(newName_, newSymbol_, projectId_);
    }

    /** 
    * @notice Changes required amount of funds of `projectId_`.
    * @dev Called by the owner when project metadata needs to be changed.
    * @param projectId_ Project id.
    * @param newRequiredAmountOfFunds_ New required amount of funds.
    */
    function changeRequiredAmountOfFunds(
        uint256 projectId_,
        uint256 newRequiredAmountOfFunds_
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        require(
            !isFundraisingCompletedByProjectId[projectId_],
            "IDOPool: already closed"
        );
        uint256 oldRequiredAmountOfFunds = requiredAmountOfFundsByProjectId[projectId_];
        require(
            newRequiredAmountOfFunds_ > fundsRaisedByProjectId[projectId_] &&
            newRequiredAmountOfFunds_ != oldRequiredAmountOfFunds,
            "IDOPool: invalid new required amount of funds value"
        );
        uint256 difference;
        if (newRequiredAmountOfFunds_ > oldRequiredAmountOfFunds) {
            difference = newRequiredAmountOfFunds_ - oldRequiredAmountOfFunds;
            requiredAmountOfFunds += difference;
        } else {
            difference = oldRequiredAmountOfFunds - newRequiredAmountOfFunds_;
            requiredAmountOfFunds -= difference;
        }
        requiredAmountOfFundsByProjectId[projectId_] = newRequiredAmountOfFunds_;
        uint256 directFundAmount = 
            initialAllowableAmountToFundByProjectId[projectId_] - currentAllowableAmountToFundByProjectId[projectId_]; 
        uint256 newAllowableAmountToFund = 
            requiredAmountOfFundsByProjectId[projectId_] * allowablePercentageForDirectFunding / BASE_PERCENT;
        if (newAllowableAmountToFund > directFundAmount) {
            currentAllowableAmountToFundByProjectId[projectId_] = newAllowableAmountToFund - directFundAmount;
        } else {
            currentAllowableAmountToFundByProjectId[projectId_] = 0;
        }
        initialAllowableAmountToFundByProjectId[projectId_] = newAllowableAmountToFund;
        IIDOToken(idoTokens[projectId_]).changeMaxSupply(newRequiredAmountOfFunds_);
        for (uint256 i = 0; i < numberOfProjects; i++) {
            if (!isFundraisingCompletedByProjectId[i]) {
                shares[i] = 
                    requiredAmountOfFunds.div(requiredAmountOfFundsByProjectId[i] - fundsRaisedByProjectId[i]);
            }
        }
    }

    /**
    * @notice Removes `projectId_` from IDO.
    * @dev Could be called only by the owner.
    * @param projectId_ Project id.
    */
    function removeProject(uint256 projectId_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        require(
            !isFundraisingCompletedByProjectId[projectId_],
            "IDOPool: already closed"
        );
        IERC20(zoinks).safeTransfer(defaultOwner, IERC20(zoinks).balanceOf(address(this)).div(shares[projectId_]));
        IERC20(busd).safeTransfer(defaultOwner, IERC20(busd).balanceOf(address(this)).div(shares[projectId_]));
        isFundraisingCompletedByProjectId[projectId_] = true;
        _fundsReceivers.remove(fundsReceiverByProjectId[projectId_]);
        numberOfProjectsInProgress--;
        requiredAmountOfFunds = 
            requiredAmountOfFunds - (requiredAmountOfFundsByProjectId[projectId_] - fundsRaisedByProjectId[projectId_]);
        if (numberOfProjectsInProgress > 0) {
            for (uint256 i = 0; i < shares.length; i++) {
                if (i == projectId_) {
                    shares[i] = 0;
                } else if (!isFundraisingCompletedByProjectId[i]) {
                    shares[i] = requiredAmountOfFunds.div(requiredAmountOfFundsByProjectId[i] - fundsRaisedByProjectId[i]);
                }
            }
        } else {
            IIDOFactory factory = IIDOFactory(idoFactory);
            factory.closeIdo(factory.idByIdoPoolAddress(address(this)));
        }
        isRemovedByProjectId[projectId_] = true;
        currentAllowableAmountToFundByProjectId[projectId_] = 0;
        emit ProjectRemoved(projectId_);
    }

    /**
    * @notice Changes allowable percentage for direct funding.
    * @dev Could be called only by the owner.
    * @param newAllowablePercentageForDirectFunding_ New allowable percentage for direct funding value.
    */
    function changeAllowablePercentageForDirectFunding(
        uint256 newAllowablePercentageForDirectFunding_
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            newAllowablePercentageForDirectFunding_ <= BASE_PERCENT &&
            newAllowablePercentageForDirectFunding_ != allowablePercentageForDirectFunding,
            "IDOPool: invalid percentage"
        );
        for (uint256 i = 0; i < numberOfProjects; i++) {
            if (!isFundraisingCompletedByProjectId[i]) {
                uint256 directFundAmount 
                    = initialAllowableAmountToFundByProjectId[i] - currentAllowableAmountToFundByProjectId[i]; 
                uint256 newAllowableAmountToFund = 
                    requiredAmountOfFundsByProjectId[i] * newAllowablePercentageForDirectFunding_ / BASE_PERCENT;
                if (newAllowableAmountToFund > directFundAmount) {
                    currentAllowableAmountToFundByProjectId[i] = newAllowableAmountToFund - directFundAmount;
                } else {
                    currentAllowableAmountToFundByProjectId[i] = 0;
                }
                initialAllowableAmountToFundByProjectId[i] = newAllowableAmountToFund;
            }
        }
    }

    /**
    * @notice Funds exact project redeeming Snacks tokens.
    * @dev Amount of received Zoinks tokens after redeem cannot exceed `currentAllowableAmountToFundByProjectId`.
    * @param projectId_ Project id.
    * @param amount_ Amount of Snacks tokens to fund.
    */
    function fundProjectDirectly(uint256 projectId_, uint256 amount_) external whenNotPaused {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        require(
            !isFundraisingCompletedByProjectId[projectId_],
            "IDOPool: fundraising completed"
        );
        address snacksAddress = snacks[0];
        require(
            ISnacksBase(snacksAddress).sufficientBuyTokenAmountOnRedeem(amount_),
            "IDOPool: insufficient amount"
        );
        IERC20(snacksAddress).safeTransferFrom(msg.sender, address(this), amount_);
        uint256 zoinksAmount = ISnacksBase(snacksAddress).redeem(amount_);
        uint256 difference = requiredAmountOfFundsByProjectId[projectId_] - fundsRaisedByProjectId[projectId_];
        require(
            zoinksAmount < currentAllowableAmountToFundByProjectId[projectId_] &&
            zoinksAmount < difference,
            "IDOPool: invalid amount"
        );
        IIDOToken(idoTokens[projectId_]).mintFor(msg.sender, zoinksAmount);
        fundsRaisedByProjectId[projectId_] += zoinksAmount;
        requiredAmountOfFunds -= zoinksAmount;
        currentAllowableAmountToFundByProjectId[projectId_] -= zoinksAmount;
    }

    /**
    * @notice Provides reward in Binance-Peg BUSD tokens for `projectId_` from external source.
    * @dev `amount_` must be greater then zero and `projectId_` must not be removed.
    * @param projectId_ Project id.
    * @param amount_ Amount of Binance-Peg BUSD tokens.
    */
    function provideRewardForProject(uint256 projectId_, uint256 amount_) external whenNotPaused {
        require(
            projectId_ < numberOfProjects,
            "IDOPool: invalid id"
        );
        require(
            !isRemovedByProjectId[projectId_],
            "IDOPool: project was removed"
        );
        address snacksAddress = snacks[0];
        require(
            ISnacksBase(snacksAddress).sufficientPayTokenAmountOnMint(amount_),
            "IDOPool: insufficient amount"
        );
        IERC20(busd).safeTransferFrom(msg.sender, address(this), amount_);
        IZoinks(zoinks).mint(amount_);
        uint256 snacksAmount = ISnacksBase(snacksAddress).mintWithPayTokenAmount(amount_);
        cumulativeSnacksRewardByProjectId[projectId_] += snacksAmount;
        emit RewardForProjectProvided(snacksAmount);
    }

    /**
    * @notice Mints IDO tokens.
    * @dev Called by the IDODistributor contract every 12 hours if IDO is still valid.
    * @param amount_ Amount of raised funds. 
    */
    function mint(uint256 amount_) external onlyRole(IDO_DISTRIBUTOR_ROLE) {
        uint256 leftover;
        uint256 length = numberOfProjects;
        uint256 zoinksBalance = IERC20(zoinks).balanceOf(address(this));
        uint256 busdBalance = IERC20(busd).balanceOf(address(this));
        for (uint256 i = 0; i < length; i++) {
            if (!isFundraisingCompletedByProjectId[i]) {
                uint256 amountToMint = amount_.div(shares[i]);
                uint256 difference = requiredAmountOfFundsByProjectId[i] - fundsRaisedByProjectId[i];
                if (amountToMint >= difference) {
                    IIDOToken(idoTokens[i]).mint(difference);
                    fundsRaisedByProjectId[i] += difference;
                    requiredAmountOfFunds -= difference;
                    leftover += difference;
                    isFundraisingCompletedByProjectId[i] = true;
                    numberOfProjectsInProgress--;
                    address fundsReceiver = fundsReceiverByProjectId[i];
                    IERC20(zoinks).safeTransfer(
                        fundsReceiver, 
                        zoinksBalance.div(shares[i])
                    );
                    IERC20(busd).safeTransfer(
                        fundsReceiver, 
                        busdBalance.div(shares[i])
                    );
                    shares[i] = 0;
                    currentAllowableAmountToFundByProjectId[i] = 0;
                }
            }
        }
        if (leftover > 0) {
            amount_ -= leftover;
            for (uint256 i = 0; i < length; i++) {
                if (!isFundraisingCompletedByProjectId[i]) {
                    shares[i] = 
                        requiredAmountOfFunds.div(requiredAmountOfFundsByProjectId[i] - fundsRaisedByProjectId[i]);
                }
            }
        }
        for (uint256 i = 0; i < length; i++) {
            if (!isFundraisingCompletedByProjectId[i]) {
                uint256 amountToMint = amount_.div(shares[i]);
                IIDOToken(idoTokens[i]).mint(amountToMint);
                fundsRaisedByProjectId[i] += amountToMint;
            }
        }
        requiredAmountOfFunds -= amount_;
    }

    /**
    * @notice Stakes `amount_` tokens to the SnacksPool.
    * @dev Could be called only by the IDODistributor contract if IDO is still valid.
    * @param amount_ Amount of tokens to stake.
    */
    function stake(uint256 amount_) external onlyRole(IDO_DISTRIBUTOR_ROLE) {
        IERC20(snacks[0]).safeTransferFrom(msg.sender, address(this), amount_);
        uint256 amountToStake = amount_ / 2;
        ISnacksPool(snacksPool).stake(amountToStake);
        IIDOLunchBoxPool(idoLunchBoxPool).stake(amountToStake);
    }

    /**
    * @notice Gets rewards for staking.
    * @dev Called by the authorised address once every 12 hours.
    */
    function getReward() external whenNotPaused onlyRole(AUTHORITY_ROLE) {
        require(
            !isInsuranceDepositClosed,
            "IDOPool: insurance deposit was closed"
        );
        address snacksToken = snacks[0];
        address btcSnacksToken = snacks[1];
        address ethSnacksToken = snacks[2];
        uint256 snacksBalanceBefore = IERC20(snacksToken).balanceOf(address(this));
        uint256 btcSnacksBalanceBefore = IERC20(btcSnacksToken).balanceOf(address(this));
        uint256 ethSnacksBalanceBefore = IERC20(ethSnacksToken).balanceOf(address(this));
        ISnacksPool(snacksPool).getReward();
        IIDOLunchBoxPool(idoLunchBoxPool).getReward();
        uint256 snacksDifference = IERC20(snacksToken).balanceOf(address(this)) - snacksBalanceBefore;
        uint256 btcSnacksDifference = IERC20(btcSnacksToken).balanceOf(address(this)) - btcSnacksBalanceBefore;
        uint256 ethSnacksDifference = IERC20(ethSnacksToken).balanceOf(address(this)) - ethSnacksBalanceBefore;
        address insuranceRecipientAddress = insuranceRecipient;
        if (snacksDifference != 0) {
            IERC20(snacksToken).safeTransfer(insuranceRecipientAddress, snacksDifference / 2);
            cumulativeCommonSnacksReward += snacksDifference / 2;
        }
        if (btcSnacksDifference != 0) {
            IERC20(btcSnacksToken).safeTransfer(insuranceRecipientAddress, btcSnacksDifference / 2);
            cumulativeCommonBtcSnacksReward += btcSnacksDifference / 2;
        }
        if (ethSnacksDifference != 0) {
            IERC20(ethSnacksToken).safeTransfer(insuranceRecipientAddress, ethSnacksDifference / 2);
            cumulativeCommonEthSnacksReward += ethSnacksDifference / 2;
        }
        emit RewardFromInsuranceDepositReceived(snacksDifference, btcSnacksDifference, ethSnacksDifference);
    }

    /**
    * @notice Closes insurance deposit when IDO was covered.
    * @dev Could be called only by the authorised address.
    */
    function closeInsuranceDeposit() external whenNotPaused onlyRole(AUTHORITY_ROLE) {
        require(
            !isInsuranceDepositClosed,
            "IDOPool: already closed"
        );
        address snacksToken = snacks[0];
        address btcSnacksToken = snacks[1];
        address ethSnacksToken = snacks[2];
        uint256 snacksBalanceBefore = IERC20(snacksToken).balanceOf(address(this));
        uint256 btcSnacksBalanceBefore = IERC20(btcSnacksToken).balanceOf(address(this));
        uint256 ethSnacksBalanceBefore = IERC20(ethSnacksToken).balanceOf(address(this));
        ISnacksPool(snacksPool).exit();
        IIDOLunchBoxPool(idoLunchBoxPool).exit();
        uint256 snacksDifference = IERC20(snacksToken).balanceOf(address(this)) - snacksBalanceBefore;
        uint256 btcSnacksDifference = IERC20(btcSnacksToken).balanceOf(address(this)) - btcSnacksBalanceBefore;
        uint256 ethSnacksDifference = IERC20(ethSnacksToken).balanceOf(address(this)) - ethSnacksBalanceBefore;
        address ownerAddress = defaultOwner;
        IERC20(snacksToken).safeTransfer(ownerAddress, snacksDifference);
        IERC20(btcSnacksToken).safeTransfer(ownerAddress, btcSnacksDifference);
        IERC20(ethSnacksToken).safeTransfer(ownerAddress, ethSnacksDifference);
        isInsuranceDepositClosed = true;
        emit InsuranceDepositClosed();
    }

    /**
    * @notice Sets the root of the Merkle tree for IDO tokens.
    * @dev Called by the authorised address once every 12 hours.
    * @param merkleRootForIdoTokens_ Merkle tree root for IDO tokens.
    */
    function setMerkleRootForIdoTokens(bytes32 merkleRootForIdoTokens_) external whenNotPaused onlyRole(AUTHORITY_ROLE) {
        emit MerkleRootForIdoTokensUpdated(merkleRootForIdoTokens, merkleRootForIdoTokens_);
        merkleRootForIdoTokens = merkleRootForIdoTokens_;
    }

    /**
    * @notice Sets the root of the Merkle tree for Snacks tokens.
    * @dev Called by the authorised address once every 12 hours.
    * @param merkleRootForSnacks_ Merkle tree root for Snacks tokens.
    */
    function setMerkleRootForSnacks(bytes32 merkleRootForSnacks_) external whenNotPaused onlyRole(AUTHORITY_ROLE) {
        emit MerkleRootForSnacksUpdated(merkleRootForSnacks, merkleRootForSnacks_);
        merkleRootForSnacks = merkleRootForSnacks_;
    }

    /**
    * @notice Transfers IDO tokens to the user.
    * @dev Updates cumulative claimed amounts for `account_` to avoid double-spending.
    * @param account_ Account address.
    * @param expectedMerkleRoot_ Expected Merkle root.
    * @param merkleProof_ Merkle proof.
    * @param cumulativeIdoTokenAmounts_ Cumulative IDO token amounts.
    */
    function claimIdoTokens(
        address account_,
        bytes32 expectedMerkleRoot_,
        bytes32[] calldata merkleProof_,
        uint256[] calldata cumulativeIdoTokenAmounts_
    ) 
        external 
        whenNotPaused
    {
        require(
            merkleRootForIdoTokens == expectedMerkleRoot_, 
            "IDOPool: merkle root was updated"
        );
        bytes32 leaf = keccak256(
            abi.encodePacked(
                account_, 
                cumulativeIdoTokenAmounts_
            )
        );
        require(
            MerkleProof.verifyCalldata(
                merkleProof_,
                merkleRootForIdoTokens,
                leaf
            ),
            "IDOPool: invalid proof"
        );
        for (uint256 i = 0; i < idoTokens.length; i++) {
            address idoToken = idoTokens[i];
            uint256 amount = cumulativeIdoTokenAmounts_[i] - cumulativeIdoTokensClaimed[account_][idoToken];
            if (amount != 0) {
                cumulativeIdoTokensClaimed[account_][idoToken] = cumulativeIdoTokenAmounts_[i];
                IERC20(idoToken).safeTransfer(account_, amount);
                emit IdoTokensClaimed(account_, idoToken, amount);
            }
        }
    }

    /**
    * @notice Transfers SNACK/BSNACK/ETSNACK tokens to the user.
    * @dev Updates cumulative claimed amounts for `account_` to avoid double-spending.
    * @param account_ Account address.
    * @param expectedMerkleRoot_ Expected Merkle root.
    * @param merkleProof_ Merkle proof.
    * @param cumulativeSnacksAmounts_ Cumulative SNACK/BSNACK/ETSNACK tokens amounts.
    */
    function claimSnacks(
        address account_,
        bytes32 expectedMerkleRoot_,
        bytes32[] calldata merkleProof_,
        uint256[] calldata cumulativeSnacksAmounts_
    ) 
        external 
        whenNotPaused
    {
        require(
            merkleRootForSnacks == expectedMerkleRoot_, 
            "IDOPool: merkle root was updated"
        );
        bytes32 leaf = keccak256(
            abi.encodePacked(
                account_, 
                cumulativeSnacksAmounts_
            )
        );
        require(
            MerkleProof.verifyCalldata(
                merkleProof_,
                merkleRootForSnacks,
                leaf
            ),
            "IDOPool: invalid proof"
        );
        for (uint256 i = 0; i < snacks.length; i++) {
            address token = snacks[i];
            uint256 amount = cumulativeSnacksAmounts_[i] - cumulativeSnacksClaimed[account_][token];
            if (amount != 0) {
                cumulativeSnacksClaimed[account_][token] = cumulativeSnacksAmounts_[i];
                IERC20(token).safeTransfer(account_, amount);
                emit SnacksClaimed(account_, token, amount);
            }
        }
    }

    /**
    * @notice Checks whether `fundsReceiver_` is in the funds receivers list.
    * @param fundsReceiver_ Funds receiver address.
    * @return Boolean value indicating whether `fundsReceiver_` is in the funds receivers list.
    */
    function isFundsReceiver(address fundsReceiver_) external view returns (bool) {
        return _fundsReceivers.contains(fundsReceiver_);
    }

    /** 
    * @notice Returns the amount of funds receivers.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used in some small count iteration operations.
    * @return The exact amount of the funds receivers.
    */
    function getFundsReceiversLength() external view returns (uint256) {
        return _fundsReceivers.length();
    }

    /** 
    * @notice Returns an address of the specific funds receiver.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used freely in any internal operations (like DELEGATECALL use cases).
    * @return The address of a funds receiver.
    */
    function getFundsReceiverAt(uint256 index_) external view returns (address) {
        return _fundsReceivers.at(index_);
    } 
}