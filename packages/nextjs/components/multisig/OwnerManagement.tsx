"use client";

import { useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { Hex, encodeFunctionData, isAddress } from "viem";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type Action = "addOwner" | "removeOwner" | "changeThreshold";

export const OwnerManagement = () => {
  const { data: wallet } = useDeployedContractInfo({ contractName: "MultiSigWallet" });
  const { data: owners } = useScaffoldReadContract({ contractName: "MultiSigWallet", functionName: "getOwners" });
  const { writeContractAsync, isPending } = useScaffoldWriteContract({ contractName: "MultiSigWallet" });

  const [action, setAction] = useState<Action>("addOwner");
  const [target, setTarget] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const propose = async () => {
    if (!wallet) return;
    let data: Hex;
    if (action === "changeThreshold") {
      const t = Number(newThreshold);
      if (!Number.isInteger(t) || t < 1) return notification.error("Threshold must be a positive integer");
      data = encodeFunctionData({ abi: wallet.abi, functionName: "changeThreshold", args: [BigInt(t)] });
    } else {
      if (!isAddress(target)) return notification.error("Enter a valid owner address");
      data = encodeFunctionData({ abi: wallet.abi, functionName: action, args: [target] });
    }
    try {
      await writeContractAsync({ functionName: "submitTransaction", args: [wallet.address, 0n, data] });
      setTarget("");
      setNewThreshold("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="vault-card p-6">
      <h2 className="vault-title">Governance</h2>
      <p className="text-sm opacity-70">
        Creates a self-targeted proposal. Calldata is encoded for you and runs only after the threshold approves.
      </p>
      <div role="tablist" className="tabs tabs-box mt-3">
        {(
          [
            ["addOwner", "Add owner"],
            ["removeOwner", "Remove owner"],
            ["changeThreshold", "Threshold"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            className={`tab ${action === key ? "tab-active" : ""}`}
            onClick={() => setAction(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {action === "changeThreshold" ? (
          <input
            type="number"
            min={1}
            max={owners?.length}
            className="input input-bordered w-full"
            placeholder={`New threshold (1 � ${owners?.length ?? "?"})`}
            value={newThreshold}
            onChange={e => setNewThreshold(e.target.value)}
          />
        ) : (
          <AddressInput placeholder="Owner address" value={target} onChange={setTarget} />
        )}
        <button className="btn btn-primary w-full" onClick={propose} disabled={isPending}>
          {isPending ? <span className="loading loading-spinner loading-sm" /> : "Propose change"}
        </button>
      </div>
    </section>
  );
};
