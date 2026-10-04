// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MultiSigWallet
 * @notice Multi-owner wallet: transactions execute only after `threshold` owner approvals.
 * @dev Owner management (add/remove/threshold) is only callable by the wallet itself,
 *      i.e. through a successfully executed multisig transaction targeting this contract.
 */
contract MultiSigWallet {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold;

    Transaction[] private transactions;
    // Approval records are tagged with the signer's epoch so that approvals of a removed owner never revive on re-adding.
    mapping(uint256 => mapping(address => uint256)) private _approvalEpoch;
    mapping(address => uint256) private _ownerEpoch;

    uint256 public totalDeposited;
    mapping(address => uint256) public depositsBy;

    bool private _executing;

    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(address indexed owner, uint256 indexed txId, address indexed to, uint256 value, bytes data);
    event ApproveTransaction(address indexed owner, uint256 indexed txId);
    event RevokeApproval(address indexed owner, uint256 indexed txId);
    event ExecuteTransaction(address indexed executor, uint256 indexed txId, bytes result);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event ThresholdChanged(uint256 threshold);

    error NotOwner();
    error NotWallet();
    error TxDoesNotExist();
    error TxAlreadyExecuted();
    error AlreadyApproved();
    error NotApproved();
    error NotEnoughApprovals();
    error ExecutionFailed(bytes reason);
    error InvalidOwner();
    error OwnerExists();
    error InvalidThreshold();
    error Reentrancy();

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlyWallet() {
        if (msg.sender != address(this)) revert NotWallet();
        _;
    }

    modifier txExists(uint256 txId) {
        if (txId >= transactions.length) revert TxDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 txId) {
        if (transactions[txId].executed) revert TxAlreadyExecuted();
        _;
    }

    constructor(address[] memory initialOwners, uint256 initialThreshold) {
        if (initialOwners.length == 0 || initialThreshold == 0 || initialThreshold > initialOwners.length) {
            revert InvalidThreshold();
        }
        for (uint256 i = 0; i < initialOwners.length; i++) {
            address o = initialOwners[i];
            if (o == address(0) || o == address(this)) revert InvalidOwner();
            if (isOwner[o]) revert OwnerExists();
            isOwner[o] = true;
            owners.push(o);
            emit OwnerAdded(o);
        }
        threshold = initialThreshold;
        emit ThresholdChanged(initialThreshold);
    }

    receive() external payable {
        totalDeposited += msg.value;
        depositsBy[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // ---------------------------------------------------------------- multisig flow

    /// @notice Propose a transaction. The proposer does not auto-approve.
    function submitTransaction(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 txId)
    {
        txId = transactions.length;
        transactions.push(Transaction({ to: to, value: value, data: data, executed: false, numConfirmations: 0 }));
        emit SubmitTransaction(msg.sender, txId, to, value, data);
    }

    function approveTransaction(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        if (isConfirmed(txId, msg.sender)) revert AlreadyApproved();
        _approvalEpoch[txId][msg.sender] = _ownerEpoch[msg.sender] + 1;
        transactions[txId].numConfirmations += 1;
        emit ApproveTransaction(msg.sender, txId);
    }

    function revokeApproval(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        if (!isConfirmed(txId, msg.sender)) revert NotApproved();
        _approvalEpoch[txId][msg.sender] = 0;
        transactions[txId].numConfirmations -= 1;
        emit RevokeApproval(msg.sender, txId);
    }

    function executeTransaction(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        if (_executing) revert Reentrancy();
        if (validConfirmations(txId) < threshold) revert NotEnoughApprovals();

        Transaction storage t = transactions[txId];
        t.executed = true;

        _executing = true;
        (bool ok, bytes memory result) = t.to.call{ value: t.value }(t.data);
        _executing = false;
        if (!ok) revert ExecutionFailed(result);

        emit ExecuteTransaction(msg.sender, txId, result);
    }

    // ---------------------------------------------------------------- owner management (self-call only)

    function addOwner(address newOwner) external onlyWallet {
        if (newOwner == address(0) || newOwner == address(this)) revert InvalidOwner();
        if (isOwner[newOwner]) revert OwnerExists();
        isOwner[newOwner] = true;
        owners.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) external onlyWallet {
        if (!isOwner[owner]) revert InvalidOwner();
        if (owners.length - 1 < threshold) revert InvalidThreshold();
        isOwner[owner] = false;
        _ownerEpoch[owner] += 1;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
        emit OwnerRemoved(owner);
    }

    function changeThreshold(uint256 newThreshold) external onlyWallet {
        if (newThreshold == 0 || newThreshold > owners.length) revert InvalidThreshold();
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    // ---------------------------------------------------------------- views

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 txId)
        external
        view
        txExists(txId)
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)
    {
        Transaction storage t = transactions[txId];
        return (t.to, t.value, t.data, t.executed, t.numConfirmations);
    }

    function isConfirmed(uint256 txId, address owner) public view returns (bool) {
        return _approvalEpoch[txId][owner] == _ownerEpoch[owner] + 1;
    }

    /// @notice Approvals from accounts that are still owners (ignores approvals of removed owners).
    function validConfirmations(uint256 txId) public view txExists(txId) returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (isConfirmed(txId, owners[i])) count++;
        }
    }
}
