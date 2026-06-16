export interface ManagedUser {
  user_id: string;
  username: string;
  role: "admin" | "user";
  created_at?: string;
  updated_at?: string;
}

export interface ListUsersResponse {
  items: ManagedUser[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: "admin" | "user";
}

export interface CreateUserResponse {
  user: ManagedUser;
}
