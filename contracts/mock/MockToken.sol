// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract MockToken is ERC20, Ownable {
    bool public blockTransfers;
    bool public blockTransfersFrom;

    mapping(address => mapping(address => bool)) public transfersAllowed;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function setBlockTransfers(bool _block) external {
        blockTransfers = _block;
    }

    function setTransfersAllowed(
        address sender,
        address recipient,
        bool _allowed
    ) external {
        transfersAllowed[sender][recipient] = _allowed;
    }

    function setBlockTransfersFrom(bool _block) external {
        blockTransfersFrom = _block;
    }

    function setBalanceOf(address who, uint256 amount) external {
        uint256 balance = balanceOf(who);
        if (balance > amount) {
            _burn(who, balance - amount);
        } else if (balance < amount) {
            _mint(who, amount - balance);
        }
    }

    function transfer(address recipient, uint256 amount)
        public
        override
        returns (bool)
    {
        if (blockTransfers) {
            if (transfersAllowed[msg.sender][recipient]) {
                super._transfer(msg.sender, recipient, amount);
                return true;
            } else {
                return false;
            }
        } else {
            super._transfer(msg.sender, recipient, amount);
            return true;
        }
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        if (blockTransfersFrom) {
            if (transfersAllowed[sender][recipient]) {
                return super.transferFrom(sender, recipient, amount);
            } else {
                return false;
            }
        } else {
            return super.transferFrom(sender, recipient, amount);
        }
    }

    function getOwner() external view returns (address) {
        return owner();
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
