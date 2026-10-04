"use client";

import type { NextPage } from "next";
import { OwnerManagement } from "~~/components/multisig/OwnerManagement";
import { OwnersList } from "~~/components/multisig/OwnersList";
import { SubmitTransactionForm } from "~~/components/multisig/SubmitTransactionForm";
import { TransactionQueue } from "~~/components/multisig/TransactionQueue";
import { WalletDashboard } from "~~/components/multisig/WalletDashboard";

const Home: NextPage = () => {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <WalletDashboard />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TransactionQueue />
        </div>
        <div className="space-y-6">
          <OwnersList />
          <SubmitTransactionForm />
          <OwnerManagement />
        </div>
      </div>
    </div>
  );
};

export default Home;
