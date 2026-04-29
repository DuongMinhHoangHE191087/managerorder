"use client";

import { useRouter } from "next/navigation";
import { CustomerCreateSurface } from "@/widgets/pages/customers/components/customer-create-surface";

export function CreateCustomerForm() {
  const router = useRouter();

  return (
    <CustomerCreateSurface
      mode="page"
      defaultEntityType="customer"
      onCancel={() => router.push("/customers")}
      onSuccess={() => router.push("/customers")}
    />
  );
}
