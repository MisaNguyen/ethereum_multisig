"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { decodeFunctionData, formatEther } from "viem";
import { useAccount } from "wagmi";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

type ExecutionInfo = { hash: string; result: string };

const TransactionCard = ({ txId, execution }: { txId: bigint; execution?: ExecutionInfo }) => {
  const { address: connected } = useAccount();
  const { data: wallet } = useDeployedContractInfo({ contractName: "MultiSigWallet" });
  const { data: tx } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "getTransaction",
    args: [txId],
  });
  const { data: approvals } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "validConfirmations",
    args: [txId],
  });
  const { data: threshold } = useScaffoldReadContract({ contractName: "MultiSigWallet", functionName: "threshold" });
  const { data: isOwner } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "isOwner",
    args: [connected],
  });
  const { data: approvedByMe } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "isConfirmed",
    args: [txId, connected],
  });
  const { writeContractAsync, isPending } = useScaffoldWriteContract({ contractName: "MultiSigWallet" });

  if (!tx || approvals === undefined || !threshold) return <div className="vault-card h-28 animate-pulse" />;
  const [to, value, data, executed, storedConfirmations] = tx;
  const shownApprovals = executed ? storedConfirmations : approvals;

  let action = "";
  if (data !== "0x") {
    try {
      const decoded =
        wallet && to.toLowerCase() === wallet.address.toLowerCase()
          ? decodeFunctionData({ abi: wallet.abi, data })
          : undefined;
      action = decoded
        ? `${decoded.functionName}(${(decoded.args ?? []).join(", ")})`
        : `Contract call (${data.length / 2 - 1} bytes)`;
    } catch {
      action = `Contract call (${data.length / 2 - 1} bytes)`;
    }
  }

  const ready = !executed && approvals >= threshold;
  const needsMe = !executed && !!isOwner && !approvedByMe && !ready;
  const pct = Math.min(100, Number((shownApprovals * 100n) / threshold));

  const status = executed
    ? { cls: "vault-status-done", label: "Executed", icon: <CheckCircleIcon className="h-4 w-4" /> }
    : ready
      ? { cls: "vault-status-ready", label: "Ready to execute", icon: <CheckCircleIcon className="h-4 w-4" /> }
      : needsMe
        ? {
            cls: "vault-status-needs",
            label: "Needs your approval",
            icon: <ExclamationTriangleIcon className="h-4 w-4" />,
          }
        : { cls: "vault-status-wait", label: "Awaiting approvals", icon: <ClockIcon className="h-4 w-4" /> };

  const call = async (functionName: "approveTransaction" | "revokeApproval" | "executeTransaction") => {
    try {
      await writeContractAsync({ functionName, args: [txId] });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`vault-card p-4 border-l-4 ${status.cls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <span className="font-mono">#{txId.toString()}</span>
          <span className="flex items-center gap-1 text-sm">
            {status.icon}
            {status.label}
          </span>
        </div>
        <span className="font-mono text-lg">{formatEther(value)} ETH</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="opacity-60">To</span>
        <Address address={to} />
        {action && <code className="badge badge-outline font-mono">{action}</code>}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs opacity-80">
          <span>
            {shownApprovals.toString()}/{threshold.toString()} approvals
          </span>
          {approvedByMe && !executed && <span className="text-success">You approved</span>}
        </div>
        <progress
          className={`progress w-full ${executed || ready ? "progress-success" : "progress-warning"}`}
          value={pct}
          max={100}
        />
      </div>

      {executed && (
        <div className="mt-3 text-sm">
          <span className="opacity-60">Result: </span>
          <span className="font-mono break-all">
            {!execution ? "Executed" : execution.result === "0x" ? "Success (no return data)" : execution.result}
          </span>
          {execution && (
            <Link
              href={`/blockexplorer/transaction/${execution.hash}`}
              className="link ml-3 inline-flex items-center gap-1"
            >
              Transaction detail <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {!executed && isOwner && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!approvedByMe && (
            <button className="btn btn-warning btn-sm" disabled={isPending} onClick={() => call("approveTransaction")}>
              Approve
            </button>
          )}
          {approvedByMe && (
            <button
              className="btn btn-outline btn-error btn-sm"
              disabled={isPending}
              onClick={() => call("revokeApproval")}
            >
              Revoke my approval
            </button>
          )}
          {ready && (
            <button className="btn btn-success btn-sm" disabled={isPending} onClick={() => call("executeTransaction")}>
              Execute
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const TransactionQueue = () => {
  const { data: count } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "getTransactionCount",
  });
  const { data: executions } = useScaffoldEventHistory({
    contractName: "MultiSigWallet",
    eventName: "ExecuteTransaction",
    fromBlock: 0n,
    watch: true,
  });

  const executionByTx = new Map<string, ExecutionInfo>();
  executions?.forEach(e => {
    if (e.args.txId !== undefined && e.transactionHash)
      executionByTx.set(e.args.txId.toString(), { hash: e.transactionHash, result: e.args.result ?? "0x" });
  });

  const ids = Array.from({ length: Number(count ?? 0n) }, (_, i) => BigInt(i)).reverse();

  return (
    <section>
      <h2 className="vault-title mb-3">Transaction queue</h2>
      <div className="space-y-3">
        {ids.length === 0 && <div className="vault-card p-6 text-center opacity-70">No transactions yet.</div>}
        {ids.map(id => (
          <TransactionCard key={id.toString()} txId={id} execution={executionByTx.get(id.toString())} />
        ))}
      </div>
    </section>
  );
};
