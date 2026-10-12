"use client";
import { Composer } from "@/components/vault/composer";
import { VaultGate } from "@/components/vault/vault-gate";

export default function NewMessagePage() {
  return (
    <VaultGate>
      <Composer />
    </VaultGate>
  );
}
