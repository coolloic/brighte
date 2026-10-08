import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CoverLetterBlock, Profile } from "../chat";

// The cover letter template: the CV's letterhead (name in the accent, contact line, links), then a
// plain business letter. Helvetica, A4, the CV's margins, so the two read as a set.

Font.registerHyphenationCallback((word) => [word]);

const ACCENT = "#00805c";
const TEXT = "#1e2028";
const MUTED = "#4d5866";

const styles = StyleSheet.create({
  page: { paddingVertical: 51, paddingHorizontal: 51, fontFamily: "Helvetica", fontSize: 10.5, color: TEXT },
  name: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: ACCENT },
  headline: { fontSize: 11, lineHeight: 1.35, marginTop: 2 },
  contact: { fontSize: 9, lineHeight: 1.35, color: MUTED, marginTop: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, fontSize: 9 },
  link: { color: ACCENT, marginRight: 12, textDecoration: "none" },
  rule: { marginTop: 10, borderBottomWidth: 0.75, borderBottomColor: ACCENT },
  date: { fontSize: 10.5, lineHeight: 1.4, marginTop: 20 },
  recipient: { fontSize: 10.5, lineHeight: 1.4, marginTop: 14 },
  subject: { fontSize: 10.5, lineHeight: 1.4, fontFamily: "Helvetica-Bold", marginTop: 14 },
  greeting: { fontSize: 10.5, lineHeight: 1.4, marginTop: 14 },
  paragraph: { fontSize: 10.5, lineHeight: 1.5, marginTop: 10 },
  closing: { fontSize: 10.5, lineHeight: 1.4, marginTop: 18 },
  signature: { fontSize: 10.5, lineHeight: 1.4, fontFamily: "Helvetica-Bold", marginTop: 4 },
});

const bare = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/** "Senior Engineer · Brightpath", or the title alone. */
export const jobLine = (job: CoverLetterBlock["job"]) => (job.employer ? `${job.title} · ${job.employer}` : job.title);

export function CoverLetterDocument({ basics, letter, date }: { basics: Profile["basics"]; letter: CoverLetterBlock; date: string }) {
  const location = [basics.location?.city, basics.location?.region, basics.location?.country].filter(Boolean).join(", ");
  const contact = [location, basics.email, basics.phone].filter(Boolean).join(" · ");
  const recipient = [letter.recipient, letter.job.employer].filter(Boolean);
  return (
    <Document title={`${basics.name} cover letter`} author={basics.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{basics.name}</Text>
        {basics.headline ? <Text style={styles.headline}>{basics.headline}</Text> : null}
        {contact ? <Text style={styles.contact}>{contact}</Text> : null}
        {basics.links?.length ? (
          <View style={styles.links}>
            {basics.links.map((link, index) => (
              <Link key={index} src={link.url} style={styles.link}>
                {bare(link.url)}
              </Link>
            ))}
          </View>
        ) : null}
        <View style={styles.rule} />

        <Text style={styles.date}>{date}</Text>
        {recipient.length ? <Text style={styles.recipient}>{recipient.join("\n")}</Text> : null}
        <Text style={styles.subject}>{`Re: ${jobLine(letter.job)}`}</Text>
        <Text style={styles.greeting}>{letter.greeting}</Text>
        {letter.paragraphs.map((paragraph, index) => (
          // orphans/widows: a paragraph never leaves a single line on either side of a page break.
          <Text key={index} style={styles.paragraph} orphans={2} widows={2}>
            {paragraph}
          </Text>
        ))}
        {/* The sign-off and name stay together. */}
        <View wrap={false}>
          <Text style={styles.closing}>{letter.closing}</Text>
          <Text style={styles.signature}>{basics.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
