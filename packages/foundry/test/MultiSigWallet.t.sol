// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet wallet;
    address a = address(0xA);
    address b = address(0xB);
    address c = address(0xC);
    address d = address(0xD);
    address recipient = address(0xBEEF);

    function setUp() public {
        address[] memory o = new address[](3);
        o[0] = a;
        o[1] = b;
        o[2] = c;
        wallet = new MultiSigWallet(o, 2);
        vm.deal(address(this), 10 ether);
        (bool ok,) = address(wallet).call{ value: 5 ether }("");
        assertTrue(ok);
    }

    function _submit(address to, uint256 v, bytes memory data) internal returns (uint256 id) {
        vm.prank(a);
        id = wallet.submitTransaction(to, v, data);
    }

    function _approve(uint256 id, address who) internal {
        vm.prank(who);
        wallet.approveTransaction(id);
    }

    function _exec(uint256 id, address who) internal {
        vm.prank(who);
        wallet.executeTransaction(id);
    }

    function testDeposit() public view {
        assertEq(wallet.totalDeposited(), 5 ether);
        assertEq(address(wallet).balance, 5 ether);
    }

    function testEthTransfer() public {
        uint256 id = _submit(recipient, 1 ether, "");
        _approve(id, a);
        vm.expectRevert(MultiSigWallet.NotEnoughApprovals.selector);
        _exec(id, a);
        _approve(id, b);
        _exec(id, c);
        assertEq(recipient.balance, 1 ether);
        vm.expectRevert(MultiSigWallet.TxAlreadyExecuted.selector);
        _exec(id, a);
    }

    function testRevoke() public {
        uint256 id = _submit(recipient, 1 ether, "");
        _approve(id, a);
        _approve(id, b);
        vm.prank(b);
        wallet.revokeApproval(id);
        vm.expectRevert(MultiSigWallet.NotEnoughApprovals.selector);
        _exec(id, a);
    }

    function testNonOwnerBlocked() public {
        vm.prank(d);
        vm.expectRevert(MultiSigWallet.NotOwner.selector);
        wallet.submitTransaction(recipient, 1, "");
    }

    function testOwnerMgmtDirectCallReverts() public {
        vm.startPrank(a);
        vm.expectRevert(MultiSigWallet.NotWallet.selector);
        wallet.addOwner(d);
        vm.expectRevert(MultiSigWallet.NotWallet.selector);
        wallet.removeOwner(b);
        vm.expectRevert(MultiSigWallet.NotWallet.selector);
        wallet.changeThreshold(1);
        vm.stopPrank();
    }

    function testAddOwnerAndThresholdViaMultisig() public {
        uint256 id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.addOwner, (d)));
        _approve(id, a);
        _approve(id, b);
        _exec(id, a);
        assertTrue(wallet.isOwner(d));

        id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.changeThreshold, (3)));
        _approve(id, a);
        _approve(id, b);
        _exec(id, a);
        assertEq(wallet.threshold(), 3);

        // cannot remove below threshold
        id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.removeOwner, (d)));
        _approve(id, a);
        _approve(id, b);
        _approve(id, c);
        _exec(id, a);
        assertFalse(wallet.isOwner(d));
        id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.removeOwner, (c)));
        _approve(id, a);
        _approve(id, b);
        _approve(id, c);
        vm.expectRevert();
        _exec(id, a);
    }

    function testRemovedOwnerApprovalIgnored() public {
        uint256 pending = _submit(recipient, 1 ether, "");
        _approve(pending, c);
        _approve(pending, a);

        uint256 id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.removeOwner, (c)));
        _approve(id, a);
        _approve(id, b);
        _exec(id, a);

        vm.expectRevert(MultiSigWallet.NotEnoughApprovals.selector);
        _exec(pending, a);
        assertEq(wallet.validConfirmations(pending), 1);
    }

    function test_failedCallReverts() public {
        uint256 id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.changeThreshold, (9)));
        _approve(id, a);
        _approve(id, b);
        vm.expectRevert();
        _exec(id, a);
        (,,, bool executed,) = wallet.getTransaction(id);
        assertFalse(executed);
    }

    function testReaddedOwnerStaleApprovalIgnored() public {
        uint256 pending = _submit(recipient, 1 ether, "");
        _approve(pending, c);

        uint256 id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.removeOwner, (c)));
        _approve(id, a);
        _approve(id, b);
        _exec(id, a);

        id = _submit(address(wallet), 0, abi.encodeCall(MultiSigWallet.addOwner, (c)));
        _approve(id, a);
        _approve(id, b);
        _exec(id, a);

        assertTrue(wallet.isOwner(c));
        assertFalse(wallet.isConfirmed(pending, c));
        assertEq(wallet.validConfirmations(pending), 0);
    }
}
