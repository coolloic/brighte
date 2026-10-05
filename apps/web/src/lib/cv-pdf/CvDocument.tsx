import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { dateRange, educationDates, formatDate, type Profile } from "../chat";

// The CV template: one column, ATS-friendly (real text, standard headings, no tables or graphics),
// Helvetica (built into PDF), A4. Wording follows the chat's ProfilePreview.

// No hyphenation: it split words ("Interac-tion") and corrupted links ("exam-ple.com") that readers
// and CV-screening software copy. Words wrap whole instead.
Font.registerHyphenationCallback((word) => [word]);

const ACCENT = "#00805c";
const TEXT = "#1e2028";
const MUTED = "#4d5866";

const styles = StyleSheet.create({
  page: { paddingVertical: 51, paddingHorizontal: 51, fontFamily: "Helvetica", fontSize: 10, color: TEXT },
  // Line height on each text style, with its font size: react-pdf resolves a unitless line height
  // against the element's own font size (18 when it only inherits one, so lines spaced far apart).
  // Not on the page: the fixed footer inherited it and was laid out thousands of points off the page.
  line: { fontSize: 10, lineHeight: 1.35 },
  // Its own line height: inherited from the page, 1.35 would be of 10pt, and the headline overlapped it.
  name: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: ACCENT },
  headline: { fontSize: 11, lineHeight: 1.35, marginTop: 2 },
  contact: { fontSize: 9, lineHeight: 1.35, color: MUTED, marginTop: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, fontSize: 9 },
  link: { color: ACCENT, marginRight: 12, textDecoration: "none" },
  section: { marginTop: 14 },
  heading: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1, textTransform: "uppercase", paddingBottom: 2, borderBottomWidth: 0.75, borderBottomColor: ACCENT, marginBottom: 6 },
  entry: { marginBottom: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between" },
  // The title takes what's left and wraps; the dates keep their width (they overlapped a long title).
  title: { fontSize: 10.5, lineHeight: 1.35, fontFamily: "Helvetica-Bold", flex: 1, paddingRight: 8 },
  dates: { fontSize: 9.5, lineHeight: 1.35, color: MUTED, flexShrink: 0 },
  subtitle: { fontSize: 9.5, lineHeight: 1.35, color: MUTED },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10, fontSize: 10, lineHeight: 1.35 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 24, left: 51, right: 51, fontSize: 8, color: MUTED, textAlign: "right" },
});

const join = (parts: (string | undefined)[], separator = " · ") => parts.filter(Boolean).join(separator);
const bare = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {/* minPresenceAhead: the heading never ends a page alone. */}
      <Text style={styles.heading} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items?: string[] }) {
  return (items ?? []).map((item, index) => (
    // Unbreakable: a page break split the bullet from its text.
    <View key={index} style={styles.bullet} wrap={false}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function Entry({ title, dates, subtitle, summary, bullets }: { title: ReactNode; dates?: string; subtitle?: string; summary?: string; bullets?: string[] }) {
  const [first, ...rest] = bullets ?? [];
  return (
    <View style={styles.entry}>
      {/* The heading (title, dates, subtitle) and its first content (the summary, else the first
          bullet) are one unbreakable block: a role's heading never ends a page on its own. */}
      <View wrap={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {dates ? <Text style={styles.dates}>{dates}</Text> : null}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {summary ? <Text style={[styles.line, { marginTop: 2 }]}>{summary}</Text> : <Bullets items={first ? [first] : []} />}
      </View>
      <Bullets items={summary ? bullets : rest} />
    </View>
  );
}

export function CvDocument({ cv }: { cv: Profile }) {
  const { basics, work, projects, education, skills, certificates, languages } = cv;
  const location = [basics.location?.city, basics.location?.region, basics.location?.country].filter(Boolean).join(", ");
  const contact = join([location, basics.email, basics.phone]);
  return (
    <Document title={`${basics.name} CV`} author={basics.name}>
      <Page size="A4" style={styles.page}>
        {/* The content, apart from the fixed footer. */}
        <View>
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

        {basics.summary ? (
          <Section title="Summary">
            <Text style={styles.line}>{basics.summary}</Text>
          </Section>
        ) : null}

        {work?.length ? (
          <Section title="Experience">
            {work.map((role, index) => (
              <Entry
                key={index}
                title={role.position}
                dates={dateRange(role.start, role.end)}
                subtitle={join([role.employer, role.location])}
                summary={role.summary}
                bullets={role.highlights}
              />
            ))}
          </Section>
        ) : null}

        {projects?.length ? (
          <Section title="Projects">
            {projects.map((project, index) => (
              <Entry
                key={index}
                title={project.url ? <Link src={project.url} style={{ color: TEXT, textDecoration: "none" }}>{project.name}</Link> : project.name}
                summary={project.description}
                bullets={project.highlights}
              />
            ))}
          </Section>
        ) : null}

        {education?.length ? (
          <Section title="Education">
            {education.map((item, index) => {
              const title = [item.qualification, item.field].filter(Boolean).join(", ");
              return (
                <Entry
                  key={index}
                  title={title ? `${title} · ${item.institution}` : item.institution}
                  dates={educationDates(item.start, item.end)}
                  subtitle={item.grade}
                />
              );
            })}
          </Section>
        ) : null}

        {skills?.length ? (
          <Section title="Skills">
            {skills.map((group, index) => (
              <Text key={index} style={[styles.line, { marginBottom: 2 }]}>
                {group.group ? <Text style={{ fontFamily: "Helvetica-Bold" }}>{`${group.group}: `}</Text> : null}
                {group.keywords.join(", ")}
              </Text>
            ))}
          </Section>
        ) : null}

        {certificates?.length ? (
          <Section title="Certificates">
            {certificates.map((item, index) => (
              <Text key={index} style={[styles.line, { marginBottom: 2 }]}>
                {join([item.name, item.issuer, item.date && formatDate(item.date)])}
              </Text>
            ))}
          </Section>
        ) : null}

        {languages?.length ? (
          <Section title="Languages">
            <Text style={styles.line}>{languages.map((item) => (item.fluency ? `${item.language} (${item.fluency})` : item.language)).join(", ")}</Text>
          </Section>
        ) : null}

        </View>
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : "")} />
      </Page>
    </Document>
  );
}
