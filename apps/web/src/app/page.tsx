import { gql } from "@/lib/graphql";

type User = { id: string; name: string; email: string };

export default async function Home() {
  const { users } = await gql<{ users: User[] }>(`{ users { id name email } }`);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Brighte</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Next.js → NestJS GraphQL → Sequelize → Postgres
      </p>
      <h2 className="mt-10 text-xl font-medium">Users</h2>
      {users.length === 0 ? (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">No users yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <span className="font-medium">{u.name}</span>{" "}
              <span className="text-zinc-600 dark:text-zinc-400">{u.email}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
