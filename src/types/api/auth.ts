import type { AuthUser } from "@/stores/auth-store";

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  user: AuthUser;
}

export interface AuthSecuritySummary {
  session?: {
    cookie_name?: string;
    http_only?: boolean;
    same_site?: string;
    secure?: boolean;
    ttl?: string;
  };
  csrf?: {
    cookie_name?: string;
    header_name?: string;
    same_site?: string;
    secure?: boolean;
  };
  bootstrap_admin?: {
    username?: string;
    password_source?: "env" | "default";
  };
  default_node?: {
    node_id?: string | null;
    using_default_secret?: boolean;
  };
  login_protection?: {
    max_failures?: number;
    window_seconds?: number;
    block_seconds?: number;
  };
}
