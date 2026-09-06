import { Badge } from "@/components/ui/badge";
import { RTTI_META } from "@/lib/toets/constants";
import type { Rtti } from "@/lib/toets/types";

const variant: Record<Rtti, "r" | "t1" | "t2" | "i"> = {
  R: "r",
  T1: "t1",
  T2: "t2",
  I: "i",
};

export function RttiBadge({
  rtti,
  withName = false,
}: {
  rtti: Rtti;
  withName?: boolean;
}) {
  const meta = RTTI_META[rtti];
  return (
    <Badge variant={variant[rtti]} title={meta.uitleg}>
      {withName ? `${meta.kort} · ${meta.naam}` : meta.kort}
    </Badge>
  );
}
