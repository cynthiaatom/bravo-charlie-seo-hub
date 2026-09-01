export type WpRegistrationRequest = {
  protocol_version: "bcseo-hub-v1";
  registration_code: string;
  site_id: string;
  site_secret: string;
  site_secret_fingerprint: string;
  site_url: string;
  site_name: string;
  wordpress?: string;
  plugin_version: string;
  status_endpoint: string;
  update_endpoint: string;
  capabilities: string[];
};

export type WpRegistrationResponse = {
  site_record_id: string;
  dashboard_url: string;
  google_connect_url: string;
};

export type WpHeartbeat = {
  site_id: string;
  site_url: string;
  site_name: string;
  plugin_version: string;
  wordpress?: string;
  health?: {
    score?: number;
    missing_descriptions?: number;
    missing_titles?: number;
    noindex_count?: number;
  };
  cwv?: Record<string, unknown>;
  "404_hits"?: number;
  generated_at: string;
};

export type HubToWpUpdate = {
  hub_site_record_id?: string;
  gsc?: { connected: boolean; property?: string };
  cwv?: {
    assessment?: "good" | "needs-improvement" | "poor" | "unknown";
    lcp_ms?: number;
    inp_ms?: number;
    cls?: number;
    ttfb_ms?: number;
    performance_score?: number;
    source?: string;
    measured_at?: string;
  };
};
