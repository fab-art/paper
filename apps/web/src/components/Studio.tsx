import type { ComponentProps } from "react";
import LegacyStudio from "../../../../frontend/src/components/Studio";

export default function Studio(props: ComponentProps<typeof LegacyStudio>) {
  return <LegacyStudio {...props} />;
}
