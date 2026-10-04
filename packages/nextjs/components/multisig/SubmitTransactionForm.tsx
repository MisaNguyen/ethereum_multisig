"use client";

import { useState } from "react";
import { AddressInput, EtherInput } from "@scaffold-ui/components";
import { Address as AddressType, Hex, isAddress, isHex, parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const SubmitTransactionForm = () => {
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [data, setData] = useState("");
  const { writeContractAsync, isPending } = useScaffoldWriteContract({ contractName: "MultiSigWallet" });

  const submit = async () => {
    if (!isAddress(to)) return notification.error("Enter a valid recipient address");
    if (data && !isHex(data)) return notification.error("Calldata must be 0x-prefixed hex");
    try {
      await writeContractAsync({
        functionName: "submitTransaction",
        args: [to as AddressType, value ? parseEther(value) : 0n, (data || "0x") as Hex],
      });
      setTo("");
      setValue("");
      setData("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="vault-card p-6">
      <h2 className="vault-title">Propose transaction</h2>
      <div className="mt-3 space-y-3">
        <AddressInput placeholder="Recipient / contract address" value={to} onChange={setTo} />
        <EtherInput placeholder="Value (optional)" onValueChange={({ valueInEth }) => setValue(valueInEth)} />
        <input
          className="input input-bordered w-full font-mono"
          placeholder="Calldata 0x� (optional, for contract calls)"
          value={data}
          onChange={e => setData(e.target.value.trim())}
        />
        <button className="btn btn-primary w-full" onClick={submit} disabled={isPending || !to}>
          {isPending ? <span className="loading loading-spinner loading-sm" /> : "Submit proposal"}
        </button>
      </div>
    </section>
  );
};
