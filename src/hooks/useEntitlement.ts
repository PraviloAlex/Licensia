import { useEffect, useState } from "react";
import { getAccessTier, getTrialDaysLeft, type AccessTier } from "../lib/entitlement";

export type Entitlement = {
  tier: AccessTier;
  trialDaysLeft: number;
  isPro: boolean;
  hasFullAccess: boolean;
};

function read(): Entitlement {
  const tier = getAccessTier();
  return {
    tier,
    trialDaysLeft: getTrialDaysLeft(),
    isPro: tier === "pro",
    hasFullAccess: tier !== "free",
  };
}

/**
 * Reactive access tier. Recomputes on mount and on cross-tab storage changes
 * (e.g. a dev PRO override flip) so gated UI updates without a manual reload.
 */
export function useEntitlement(): Entitlement {
  const [entitlement, setEntitlement] = useState<Entitlement>(read);

  useEffect(() => {
    const onStorage = () => setEntitlement(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return entitlement;
}
