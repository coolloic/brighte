import "server-only";
import { graphql } from "./client";

export type Role = "ADMIN" | "USER";
export type SessionUser = { name: string; email: string; role: Role };

const LOGIN = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      user {
        name
        email
        role
      }
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      name
      email
      role
    }
  }
`;

/** Exchanges email and password for an access token. Throws ApiError (UNAUTHENTICATED, TOO_MANY_REQUESTS…). */
export async function logIn(email: string, password: string): Promise<{ accessToken: string; user: SessionUser }> {
  const data = await graphql<{ login: { accessToken: string; user: SessionUser } }>(LOGIN, { email, password });
  return data.login;
}

/** The user a token belongs to. Throws ApiError UNAUTHENTICATED for a missing, invalid or expired token. */
export async function getUser(token: string): Promise<SessionUser> {
  const { me } = await graphql<{ me: SessionUser }>(ME, {}, { token });
  return { name: me.name, email: me.email, role: me.role };
}
