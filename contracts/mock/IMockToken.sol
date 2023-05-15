// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMockToken is IERC20 {
    function blockTransfers() external view returns (bool);
    function blockTransfersFrom() external view returns (bool);
    function transfersAllowed(address, address) external view returns (bool);
    function setBlockTransfers(bool _block) external;
    function setTransfersAllowed(
        address sender,
        address recipient,
        bool _allowed
    ) external;
    function setBlockTransfersFrom(bool _block) external;
    function setBalanceOf(address who, uint256 amount) external;
    function getOwner() external view returns (address);
    function mint(address account, uint256 amount) external;
    function burn(address account, uint256 amount) external;
}
