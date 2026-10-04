"use client";

import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const OwnersList = () => {
  const { address: connected } = useAccount();
  const { data: owners } = useScaffoldReadContract({ contractName: "MultiSigWallet", functionName: "getOwners" });

  return (
    <section className="vault-card p-6">
      <h2 className="vault-title">Signers ({owners?.length ?? 0})</h2>
      <ul className="mt-3 space-y-2">
        {owners?.map(owner => (
          <li key={owner} className="flex items-center justify-between gap-2">
            <Address address={owner} />
            {owner.toLowerCase() === connected?.toLowerCase() && (
              <span className="badge badge-success badge-sm">You</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
