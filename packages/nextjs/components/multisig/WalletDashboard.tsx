"use client";

import { useState } from "react";
import { Address, Balance, EtherInput } from "@scaffold-ui/components";
import { formatEther, parseEther } from "viem";
import { useSendTransaction } from "wagmi";
import { ArrowDownTrayIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useTransactor,
} from "~~/hooks/scaffold-eth";

export const WalletDashboard = () => {
  const { data: wallet } = useDeployedContractInfo({ contractName: "MultiSigWallet" });
  const { data: threshold } = useScaffoldReadContract({ contractName: "MultiSigWallet", functionName: "threshold" });
  const { data: owners } = useScaffoldReadContract({ contractName: "MultiSigWallet", functionName: "getOwners" });
  const { data: totalDeposited } = useScaffoldReadContract({
    contractName: "MultiSigWallet",
    functionName: "totalDeposited",
  });
  const { data: deposits } = useScaffoldEventHistory({
    contractName: "MultiSigWallet",
    eventName: "Deposit",
    fromBlock: 0n,
    watch: true,
  });

  const [amount, setAmount] = useState("");
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const writeTx = useTransactor();

  const deposit = async () => {
    if (!wallet || !amount) return;
    try {
      await writeTx(() => sendTransactionAsync({ to: wallet.address, value: parseEther(amount) }));
      setAmount("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="vault-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="vault-label">Vault balance</p>
          {wallet && (
            <div className="text-3xl font-bold">
              <Balance address={wallet.address} />
            </div>
          )}
          <div className="mt-2 text-sm opacity-70 flex items-center gap-2">
            <span>Contract</span>
            {wallet && <Address address={wallet.address} />}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="vault-stat">
            <ShieldCheckIcon className="h-5 w-5 text-success" />
            <span className="vault-label">Policy</span>
            <span className="text-xl font-bold">
              {threshold?.toString() ?? "-"} of {owners?.length ?? "-"}
            </span>
          </div>
          <div className="vault-stat">
            <ArrowDownTrayIcon className="h-5 w-5 text-info" />
            <span className="vault-label">Total deposited</span>
            <span className="text-xl font-bold">
              {totalDeposited !== undefined ? Number(formatEther(totalDeposited)).toFixed(4) : "-"} ETH
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="vault-label mb-2">Deposit ETH</p>
          <div className="flex gap-2">
            <div className="grow">
              <EtherInput placeholder="Amount" onValueChange={({ valueInEth }) => setAmount(valueInEth)} />
            </div>
            <button className="btn btn-primary" onClick={deposit} disabled={isPending || !amount}>
              {isPending ? <span className="loading loading-spinner loading-sm" /> : "Deposit"}
            </button>
          </div>
        </div>
        <div>
          <p className="vault-label mb-2">Recent deposits</p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
            {!deposits?.length && <li className="opacity-60">No deposits yet.</li>}
            {deposits?.map(d => (
              <li key={`${d.transactionHash}-${d.logIndex}`} className="flex items-center justify-between gap-2">
                <Address address={d.args.sender} onlyEnsOrAddress />
                <span className="font-mono text-success">+{formatEther(d.args.amount ?? 0n)} ETH</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
