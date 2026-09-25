import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/atoms/Button";
import { Alert } from "@/components/molecules/Alert";
import { FormPageTemplate } from "@/components/templates/FormPageTemplate";
import { ApiError } from "@/lib/api/errors";
import { getServiceOptions, type ServiceOption } from "@/lib/api/registration";
import { siteUrl } from "@/lib/site";
import { RegisterInterest } from "./_components/RegisterInterest";

const TITLE = "Register your interest in Brighte Eats";
const DESCRIPTION =
  "Tell us which Brighte Eats services you'd use, from delivery to pick-up and payment, and be the first to hear when we launch near you.";

export const metadata: Metadata = {
  // The layout's title template applies to child routes only, not this page in the same segment.
  title: "Register your interest | Brighte Eats",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", type: "website", siteName: "Brighte Eats", locale: "en_AU" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

/** Structured data for search engines: this page, published by Brighte. */
function jsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITLE,
    description: DESCRIPTION,
    url: new URL("/", siteUrl()).href,
    inLanguage: "en-AU",
    publisher: { "@type": "Organization", name: "Brighte", url: "https://brighte.com.au" },
  };
  // Escape "<" so the JSON can never close the <script> tag (Next's JSON-LD guidance).
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function RegisterPage() {
  let serviceOptions: ServiceOption[] | undefined;
  try {
    serviceOptions = await getServiceOptions();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error("serviceTypes failed:", error.message);
  }

  return (
    <>
      {/* Structured data for search engines. Raw JSON, so jsonLd() escapes "<". */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <FormPageTemplate
        title={TITLE}
        intro="Tell us which services you'd use and we'll let you know as soon as Brighte Eats launches near you."
        highlights={["Delivery, pick-up and payment options", "Be first to hear when we launch", "No commitment: it takes a minute"]}
      >
        {serviceOptions ? (
          // New on every server render of this page, so navigating to it again (the logo, a link to /) starts
          // a fresh form. Submitting with JavaScript doesn't re-render the page, so the result stays.
          <RegisterInterest serviceOptions={serviceOptions} renderId={randomUUID()} />
        ) : (
          <Alert
            tone="error"
            title="We can't show the form right now"
            action={
              <Link href="/" className={buttonVariants({ variant: "secondary" })}>
                Try again
              </Link>
            }
          >
            Something went wrong on our side. Please try again in a moment.
          </Alert>
        )}
      </FormPageTemplate>
    </>
  );
}
