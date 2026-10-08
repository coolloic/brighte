import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Heading } from "@/components/atoms/Heading";
import { Text } from "@/components/atoms/Text";
import { buttonVariants } from "@/components/atoms/Button";
import { Alert } from "@/components/molecules/Alert";
import { AppShell } from "@/components/templates/AppShell";
import { chatConfig, configuredPersona, getPersona } from "@/lib/chat/server";
import { defaultModel, modelKey } from "@/lib/llm";
import { modelCatalog } from "@/lib/llm/server";
import { siteUrl } from "@/lib/site";
import { Chat } from "./_components/Chat";

/** Title and description follow the persona (CHAT_PERSONA), read when the page renders. */
export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = getPersona(chatConfig().persona);
  return {
    // The layout's title template applies to child routes only, not this page in the same segment.
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url: "/", type: "website" },
    twitter: { title, description },
  };
}

/** Structured data for search engines: this page, a free web app. */
function jsonLd(name: string, description: string) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: new URL("/", siteUrl()).href,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    inLanguage: "en-AU",
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  };
  // Escape "<" so the JSON can never close the <script> tag (Next's JSON-LD guidance).
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function HomePage() {
  // Rendered per request: the CSP nonce (src/proxy.ts), and the model list may have changed.
  await connection();
  const config = chatConfig();
  const persona = configuredPersona(config);
  const models = await modelCatalog.list();
  const initial = defaultModel(models, config.defaultModel);

  return (
    <AppShell wide>
      {/* Structured data for search engines. Raw JSON, so jsonLd() escapes "<". */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(persona.title, persona.description) }} />
      {/* A readable column on phones and tablets; the full 90% width on desktop. */}
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <Heading level={1}>{persona.title}</Heading>
        <Text size="lg" tone="muted" className="mt-3 mb-6">
          {persona.description}
        </Text>
        {initial ? (
          <Chat
            assistantName={persona.name}
            greeting={persona.greeting}
            suggestions={persona.suggestions}
            models={models}
            defaultModel={modelKey(initial)}
            maxChars={persona.maxMessageChars}
            limits={{ maxFiles: config.maxFiles, maxFileBytes: config.maxFileBytes, maxRequestBytes: config.maxRequestBytes }}
          />
        ) : (
          // No provider key set, or every provider's model list failed.
          <Alert
            tone="error"
            title="The chat isn't available right now"
            action={
              <Link href="/" className={buttonVariants({ variant: "secondary" })}>
                Try again
              </Link>
            }
          >
            Something went wrong on our side. Please try again in a moment.
          </Alert>
        )}
      </div>
    </AppShell>
  );
}
