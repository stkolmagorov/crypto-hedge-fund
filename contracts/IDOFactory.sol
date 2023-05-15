// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";

import "./base/RolesManager.sol";
import "./interfaces/IIDOFactory.sol";
import "./interfaces/IIDODistributor.sol";
import "./interfaces/IIDOToken.sol";
import "./interfaces/IIDOLunchBoxPool.sol";
import "./interfaces/IIDOPool.sol";
import "./interfaces/ISnacksPool.sol";
import "./interfaces/ISnacksBase.sol";

contract IDOFactory is IIDOFactory, RolesManager {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;
    using Counters for Counters.Counter;
    using PRBMathUD60x18 for uint256;

    struct IDOParameters {
        uint256 numberOfProjects;
        uint256 totalRequiredAmountOfFunds;
        address insuranceRecipient;
        address defaultOwner;
        address authority;
        address idoLunchBoxPoolAddress;
        address idoPoolAddress;
        uint256[] requiredAmountsOfFunds;
        uint256[] shares;
        address[] fundsReceivers;
        address[] idoTokens;
        string[] names;
        string[] symbols;
    }

    bytes32 public constant IDO_CLOSING_ROLE = keccak256('IDO_CLOSING_ROLE');
    bytes32 public constant INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE = keccak256('INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE');

    address public immutable busd;
    address public zoinks;
    address public snacksPool;
    address public idoDistributor;
    bytes public idoTokenBytecode;
    bytes public idoLunchBoxPoolByteCode;
    bytes public idoPoolBytecode;
    Counters.Counter private _nextIdoId;

    mapping(uint256 => address) public idoPoolAddressById;
    mapping(address => uint256) public idByIdoPoolAddress;
    mapping(address => IDOInfo) private _idoInfoByIdoParticipant;
    address[] public snacks;
    EnumerableSet.AddressSet private _idoParticipants;
    EnumerableSet.UintSet private _validIdoIds;

    event IdoOpened(uint256 indexed id);
    event IdoClosed(uint256 indexed id);

    /**
    * @param busd_ Binance-Peg BUSD token address.
    */
    constructor(address busd_) {
        busd = busd_;
        _grantRole(IDO_CLOSING_ROLE, msg.sender);
    }

    /**
    * @notice Configures the contract.
    * @dev Could be called by the owner in case of resetting addresses.
    * @param zoinks_ Zoinks token address.
    * @param snacks_ Snacks token address.
    * @param btcSnacks_ BtcSnacks token address.
    * @param ethSnacks_ EthSnacks token address.
    * @param snacksPool_ SnacksPool contract address.
    * @param idoDistributor_ IDODistributor contract address.
    * @param investmentSystemDistributor_ InvestmentSystemDistributor contract address.
    * @param idoTokenBytecode_ IDOToken contract bytecode.
    * @param idoLunchBoxPoolByteCode_ IDOLunchBoxPool contract bytecode.
    * @param idoPoolBytecode_ IDOPool contract bytecode.
    */
    function configure(
        address zoinks_,
        address snacks_,
        address btcSnacks_,
        address ethSnacks_,
        address snacksPool_,
        address idoDistributor_,
        address investmentSystemDistributor_,
        bytes memory idoTokenBytecode_,
        bytes memory idoLunchBoxPoolByteCode_,
        bytes memory idoPoolBytecode_
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        zoinks = zoinks_;
        delete snacks;
        snacks.push(snacks_);
        snacks.push(btcSnacks_);
        snacks.push(ethSnacks_);
        snacksPool = snacksPool_;
        idoDistributor = idoDistributor_;
        idoTokenBytecode = idoTokenBytecode_;
        idoLunchBoxPoolByteCode = idoLunchBoxPoolByteCode_;
        idoPoolBytecode = idoPoolBytecode_;
        _grantRole(IDO_CLOSING_ROLE, idoDistributor_);
        _grantRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE, investmentSystemDistributor_);
    }

    /**
    * @notice Opens IDO.
    * @dev Could be called only by the owner. 
    * @param idoParameters_ IDO parameters.
    */
    function openIdo(IDOParameters memory idoParameters_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IDOParameters memory idoParametersWithInstances = _createInstances(idoParameters_);
        _initialize(idoParametersWithInstances);
        address idoLunchBoxPoolAddress = idoParametersWithInstances.idoLunchBoxPoolAddress;
        address idoPoolAddress = idoParametersWithInstances.idoPoolAddress;
        ISnacksPool(snacksPool).excludeFromRestrictions(idoLunchBoxPoolAddress);
        ISnacksPool(snacksPool).excludeFromRestrictions(idoPoolAddress);
        IIDODistributor(idoDistributor).approveSnacksToIdoPool(idoPoolAddress);
        _grantRole(IDO_CLOSING_ROLE, idoPoolAddress);
        uint256 id = getNextIdoId();
        idoPoolAddressById[id] = idoPoolAddress;
        idByIdoPoolAddress[idoPoolAddress] = id;
        _validIdoIds.add(id);
        _nextIdoId.increment();
        emit IdoOpened(id);
    }

    /**
    * @notice Closes IDO by its id.
    * @dev Could be called only by the IDO_CLOSING_ROLE.
    * @param id_ IDO id.
    */
    function closeIdo(uint256 id_) external onlyRole(IDO_CLOSING_ROLE) {
        require(
            _validIdoIds.remove(id_),
            "IDOFactory: id not found"
        );
        emit IdoClosed(id_);
    }

    /**
    * @notice Updates IDO info for the user.
    * @dev Could be called only by the InvestmentSystemDistributor contract.
    * @param user_ User address.
    * @param idoInfo_ IDO info.
    */
    function updateIdoParticipantInfo(
        address user_, 
        IDOInfo memory idoInfo_
    ) 
        external 
        onlyRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE) 
    {
        _idoInfoByIdoParticipant[user_] = idoInfo_;
        if (!_idoParticipants.contains(user_)) {
            _idoParticipants.add(user_);
        }
    }

    /**
    * @notice Deletes IDO info for the user.
    * @dev Could be called only by the InvestmentSystemDistributor contract.
    * @param user_ User address.
    */
    function deleteIdoParticipantInfo(address user_) external onlyRole(INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE) {
        delete _idoInfoByIdoParticipant[user_];
        _idoParticipants.remove(user_);
    }

    /**
    * @notice Checks whether `user_` is an IDO participant.
    * @param user_ User address.
    * @return Boolean value indicating whether `user_` is an IDO participant.
    */
    function isIdoParticipant(address user_) external view returns (bool) {
        return _idoParticipants.contains(user_);
    }

    /** 
    * @notice Returns the amount of IDO participants.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used in some small count iteration operations.
    * @return The exact amount of the participants.
    */
    function getIdoParticipantsLength() external view returns (uint256) {
        return _idoParticipants.length();
    }

    /** 
    * @notice Returns an address of the specific IDO participant.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used freely in any internal operations (like DELEGATECALL use cases).
    * @return The address of a participant.
    */
    function getIdoParticipantAt(uint256 index_) external view returns (address) {
        return _idoParticipants.at(index_);
    }

    /** 
    * @notice Returns an IDO info of the specific IDO participant.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used freely in any internal operations (like DELEGATECALL use cases).
    * @param user_ User address.
    * @return idoInfo_ IDO info of a participant.
    */
    function getIdoParticipantInfo(address user_) external view returns (IDOInfo memory idoInfo_) {
        return _idoInfoByIdoParticipant[user_];
    }

    /**
    * @notice Checks whether the IDO to which the `id_` belongs is open.
    * @dev Used as a check in many IDO contracts.
    * @param id_ IDO id.
    * @return Boolean value indicating whether the IDO to which the `id_` belongs is open.
    */
    function isValidIdoId(uint256 id_) external view returns (bool) {
        return _validIdoIds.contains(id_);
    }

    /**
    * @notice Returns the number of open IDOs.
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used in some small count iteration operations.
    * @return Number of open IDOs.
    */
    function getValidIdoIdsLength() external view returns (uint256) {
        return _validIdoIds.length();
    }

    /**
    * @notice Returns the ID of one of the open IDOs by index. 
    * @dev The time complexity of this function is derived from EnumerableSet.Bytes32Set set so it's
    * able to be used freely in any internal operations (like DELEGATECALL use cases). 
    * @param index_ Index.
    * @return One of the open IDOs id by index. 
    */
    function getValidIdoIdAt(uint256 index_) external view returns (uint256) {
        return _validIdoIds.at(index_);
    } 

    /**
    * @notice Returns the ID of the next IDO to open.
    * @dev Used by the IDOFactory contract.
    * @return Next IDO id to open.
    */
    function getNextIdoId() public view returns (uint256) {
        return _nextIdoId.current();
    }

    /**
    * @notice Creates IDOToken, IDOLunchBoxPool and IDOPool contracts.
    * @dev Overwrites the `idoParameters_` structure fields.
    * @param idoParameters_ IDO parameters.
    */
    function _createInstances(
        IDOParameters memory idoParameters_
    ) 
        private 
        returns (IDOParameters memory) 
    {
        _verifyData(idoParameters_);
        bytes memory idoTokenBytecodeMemory = idoTokenBytecode;
        for (uint256 i = 0; i < idoParameters_.numberOfProjects; i++) {
            address idoToken;
            assembly {
                idoToken := create(0, add(idoTokenBytecodeMemory, 0x20), mload(idoTokenBytecodeMemory))
            }
            idoParameters_.idoTokens[i] = idoToken;
            idoParameters_.shares[i] = idoParameters_.totalRequiredAmountOfFunds.div(idoParameters_.requiredAmountsOfFunds[i]);
        }
        address idoLunchBoxPoolAddress;
        bytes memory idoLunchBoxPoolByteCodeMemory = idoLunchBoxPoolByteCode;
        assembly {
            idoLunchBoxPoolAddress := create(0, add(idoLunchBoxPoolByteCodeMemory, 0x20), mload(idoLunchBoxPoolByteCodeMemory))
        }
        idoParameters_.idoLunchBoxPoolAddress = idoLunchBoxPoolAddress;
        address idoPoolAddress;
        bytes memory idoPoolBytecodeMemory = idoPoolBytecode;
        assembly {
            idoPoolAddress := create(0, add(idoPoolBytecodeMemory, 0x20), mload(idoPoolBytecodeMemory))
        }
        idoParameters_.idoPoolAddress = idoPoolAddress;
        return idoParameters_;
    }

    /**
    * @notice Initializes IDOToken, IDOLunchBoxPool and IDOPool contracts.
    * @dev Implemented to avoid stack too deep.
    * @param idoParametersWithInstances_ IDO parameters with instances.
    */
    function _initialize(IDOParameters memory idoParametersWithInstances_) private {
        IIDOLunchBoxPool(idoParametersWithInstances_.idoLunchBoxPoolAddress).initialize(
            snacks[0],
            snacksPool,
            idoParametersWithInstances_.idoPoolAddress,
            idoParametersWithInstances_.authority
        );
        IDOPoolParameters memory idoPoolParameters = IDOPoolParameters(
            idoParametersWithInstances_.insuranceRecipient,
            idoParametersWithInstances_.defaultOwner,
            idoParametersWithInstances_.authority,
            idoParametersWithInstances_.idoLunchBoxPoolAddress,
            idoParametersWithInstances_.requiredAmountsOfFunds,
            idoParametersWithInstances_.shares,
            idoParametersWithInstances_.fundsReceivers,
            idoParametersWithInstances_.idoTokens
        );
        IIDOPool(idoParametersWithInstances_.idoPoolAddress).initialize(
            idoPoolParameters,
            snacks,
            idoDistributor,
            snacksPool,
            zoinks,
            busd
        );
        for (uint256 i = 0; i < idoParametersWithInstances_.requiredAmountsOfFunds.length; i++) {
            IIDOToken(idoParametersWithInstances_.idoTokens[i]).initialize(
                idoParametersWithInstances_.requiredAmountsOfFunds[i],
                idoParametersWithInstances_.names[i],
                idoParametersWithInstances_.symbols[i],
                idoParametersWithInstances_.idoPoolAddress
            );
        }
    }

    /**
    * @notice Verifies data containing in the `idoParameters_` structure.
    * @dev Implemented to avoid stack too deep.
    * @param idoParameters_ IDO parameters.
    */
    function _verifyData(IDOParameters memory idoParameters_) private pure {
        uint256 numberOfProjects = idoParameters_.numberOfProjects;
        require(
            numberOfProjects == idoParameters_.requiredAmountsOfFunds.length &&
            numberOfProjects == idoParameters_.shares.length &&
            numberOfProjects == idoParameters_.fundsReceivers.length &&
            numberOfProjects == idoParameters_.idoTokens.length &&
            numberOfProjects == idoParameters_.names.length &&
            numberOfProjects == idoParameters_.symbols.length,
            "IDOFactory: invalid array lengths"
        );
        uint256 sum;
        for (uint256 i = 0; i < numberOfProjects; i++) {
            sum += idoParameters_.requiredAmountsOfFunds[i];
        }
        require(
            sum == idoParameters_.totalRequiredAmountOfFunds,
            "IDOFactory: invalid sum"
        );
    }
}