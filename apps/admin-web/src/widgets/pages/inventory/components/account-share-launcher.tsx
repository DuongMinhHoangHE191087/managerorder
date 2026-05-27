"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button, type ButtonProps } from "@/shared/ui/button";
import { useSourceAccountDecrypt } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { AccountShareModal } from "./account-share-modal";

interface AccountShareLauncherProps {
  account: {
    id: string;
    email: string;
  };
  orderId?: string | null;
  orderItemId?: string | null;
  customerId?: string | null;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function AccountShareLauncher({
  account,
  orderId,
  orderItemId,
  customerId,
  label = "Chia sẻ",
  variant = "secondary",
  size = "sm",
  className,
}: AccountShareLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const secretsQuery = useSourceAccountDecrypt(account.id, isOpen);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <Link2 className="size-3.5" />
        {label}
      </Button>
      <AccountShareModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        account={account}
        secrets={secretsQuery.data ?? null}
        loadingSecrets={secretsQuery.isLoading}
        orderId={orderId}
        orderItemId={orderItemId}
        customerId={customerId}
      />
    </>
  );
}
