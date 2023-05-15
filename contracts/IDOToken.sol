// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./openzeppelin/ERC20.sol";

import "./base/RolesManager.sol";
import "./interfaces/IIDOToken.sol";

contract IDOToken is IIDOToken, ERC20, RolesManager {
    bytes32 public constant IDO_POOL_ROLE = keccak256('IDO_POOL_ROLE'); 

    uint256 public maxSupply;

    /**
    * @notice Initializes the contract.
    * @dev Called by the IDOFactory contract when IDO opens.
    * @param maxSupply_ Max supply.
    * @param name_ Token name.
    * @param symbol_ Token symbol.
    * @param idoPool_ IDOPool contract address.
    */
    function initialize(
        uint256 maxSupply_,
        string memory name_, 
        string memory symbol_,
        address idoPool_
    ) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        maxSupply = maxSupply_;
        _name = name_;
        _symbol = symbol_;
        _grantRole(IDO_POOL_ROLE, idoPool_);
    }

    /**
    * @notice Mints `amount` tokens.
    * @dev Could be called only by the IDOPool contract.
    * @param amount_ Amount of tokens to mint.
    */
    function mint(uint256 amount_) external onlyRole(IDO_POOL_ROLE) {
        require(
            totalSupply() + amount_ <= maxSupply,
            "IDOToken: max supply exceeded"
        );
        _mint(msg.sender, amount_);
    }

    /**
    * @notice Mints `amount` tokens for `account_`.
    * @dev Could be called only by the IDOPool contract.
    * @param account_ Account address.
    * @param amount_ Amount of tokens to mint.
    */
    function mintFor(address account_, uint256 amount_) external onlyRole(IDO_POOL_ROLE) {
        require(
            totalSupply() + amount_ <= maxSupply,
            "IDOToken: max supply exceeded"
        );
        _mint(account_, amount_);
    }

    /**
    * @notice Changes max supply.
    * @dev Could be called only by the IDOPool contract.
    * @param newMaxSupply_ New max supply value.
    */
    function changeMaxSupply(uint256 newMaxSupply_) external onlyRole(IDO_POOL_ROLE) {
        maxSupply = newMaxSupply_;
    }

    /**
    * @notice Changes token name and symbol.
    * @dev Could be called only by the IDOPool contract.
    * @param newName_ New token name.
    * @param newSymbol_ New token symbol.
    */
    function changeNameAndSymbol(
        string calldata newName_, 
        string calldata newSymbol_
    ) 
        external 
        onlyRole(IDO_POOL_ROLE) 
    {
        _name = newName_;
        _symbol = newSymbol_;
    }
}