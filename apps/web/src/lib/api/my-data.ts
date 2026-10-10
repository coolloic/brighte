import "server-only";
import { graphql } from "./client";

// "My data" (MY_DATA=on, local use only): what a chat visitor saved, keyed by their email, and
// search over it for the chat's recall. Public operations: no token.

export type MyDataKind = "PROFILE" | "TAILORED_CV" | "COVER_LETTER";
export type MyDataSummary = { id: string; kind: MyDataKind; title: string; createdAt: string };
export type MyDataMatch = { text: string; score: number; document: MyDataSummary };
export type SavedMyData = { profile: unknown; documents: MyDataSummary[] };

const SUMMARY = "id kind title createdAt";

const SAVE = /* GraphQL */ `
  mutation SaveMyData($email: String!, $kind: MyDataKind!, $title: String!, $content: String!, $chunks: [String!]!) {
    saveMyData(email: $email, kind: $kind, title: $title, content: $content, chunks: $chunks) { ${SUMMARY} }
  }
`;

const GET = /* GraphQL */ `
  query MyData($email: String!) {
    myData(email: $email) { profile documents { ${SUMMARY} } }
  }
`;

const SEARCH = /* GraphQL */ `
  query SearchMyData($email: String!, $query: String!, $limit: Int!) {
    searchMyData(email: $email, query: $query, limit: $limit) { text score document { ${SUMMARY} } }
  }
`;

export type SaveMyDataInput = { email: string; kind: MyDataKind; title: string; content: unknown; chunks: string[] };

/** Saves a document and its chunks (the API embeds them). Throws ApiError (FORBIDDEN when MY_DATA is off). */
export async function saveMyData({ content, ...input }: SaveMyDataInput, requestHeaders: Headers): Promise<MyDataSummary> {
  const data = await graphql<{ saveMyData: MyDataSummary }>(SAVE, { ...input, content: JSON.stringify(content) }, { requestHeaders });
  return data.saveMyData;
}

/** The newest saved profile (parsed) and the other documents, or null when nothing is saved. */
export async function getMyData(email: string, requestHeaders: Headers): Promise<SavedMyData | null> {
  const { myData } = await graphql<{ myData: { profile: string | null; documents: MyDataSummary[] } | null }>(GET, { email }, { requestHeaders });
  if (!myData) return null;
  return { profile: myData.profile === null ? null : (JSON.parse(myData.profile) as unknown), documents: myData.documents };
}

/** The saved chunks closest to the query, most similar first. */
export async function searchMyData(email: string, query: string, limit: number, requestHeaders: Headers): Promise<MyDataMatch[]> {
  const { searchMyData: matches } = await graphql<{ searchMyData: MyDataMatch[] }>(SEARCH, { email, query, limit }, { requestHeaders });
  return matches;
}
