// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/MultiSigWallet.sol";

/**
 * @notice Deploys MultiSigWallet with a threshold of 2.
 * @dev Local chain (31337): owners are Anvil accounts #0-#2 (publicly known keys, never use elsewhere).
 *      Any other chain: set OWNERS=0xA,0xB,0xC (comma-separated) or the script reverts.
 */
contract DeployMultiSigWallet is ScaffoldETHDeploy {
    uint256 public constant APPROVAL_THRESHOLD = 2;

    function run() external ScaffoldEthDeployerRunner {
        address[] memory owners;
        if (block.chainid == 31337) {
            owners = new address[](3);
            owners[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
            owners[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
            owners[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        } else {
            owners = vm.envAddress("OWNERS", ",");
        }

        new MultiSigWallet(owners, APPROVAL_THRESHOLD);
    }
}
