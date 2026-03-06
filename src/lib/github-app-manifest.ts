import { randomBytes } from "crypto";

export function generateManifest(baseUrl: string): object {
  const suffix = randomBytes(3).toString("hex");
  return {
    name: `copilot-dashboard-${suffix}`,
    url: baseUrl,
    redirect_url: `${baseUrl}/setup`,
    setup_url: `${baseUrl}/setup`,
    hook_attributes: {
      url: `${baseUrl}/api/webhooks/github`,
    },
    public: true,
    default_permissions: {
      organization_copilot_seat_management: "read",
      organization_administration: "read",
    },
    default_events: [],
  };
}
