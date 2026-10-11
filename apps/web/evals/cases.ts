// The eval set: synthetic CVs and job ads with known answers. Every person, employer and number is
// made up. Each case has a trap that tempts the model to invent or misread something; the traps are
// where the never-invent rules fail, so they matter more than the easy parts.
//
// `expected` follows the profile rules in the career persona: dates as precise as the CV ("2019"
// stays "2019"), "present" only when the CV says the role is current, skills groups only with the
// CV's own headings, and bullets copied as written.

import type { Profile } from "@/lib/chat";

export type ExpectedRole = { employer: string; position: string; start?: string; end?: string; bullets: string[] };

export type EvalCase = {
  id: string;
  /** What this case tests beyond the basics. */
  trap: string;
  cv: string;
  jobAd: string;
  expected: {
    name: string;
    email?: string;
    roles: ExpectedRole[];
    /** Every keyword in the profile's skills section (empty when the CV has none). */
    skills: string[];
    education: { institution: string; end?: string }[];
    /** The rest of the profile (headline, contact, summary, projects, certificates…), so the profile a later step starts from is complete. */
    rest?: Partial<Omit<Profile, "basics">> & { basics?: Partial<Profile["basics"]> };
  };
  /** The job ad's requirements whose status is clear: matched against the report's items by `requirement`. */
  match: { requirement: RegExp; status: "met" | "partial" | "missing" }[];
  /** Questions for "My data" recall, and a phrase the right saved chunk contains. */
  recall: { query: string; expect: string }[];
};

export const CASES: EvalCase[] = [
  {
    id: "frontend-senior",
    trap: "The job wants GraphQL, which the CV never mentions.",
    cv: `Jane Citizen
Senior Front-end Engineer
Sydney, NSW · jane.citizen@example.com · 0412 345 678

Profile
Front-end engineer with 8 years of React, focused on accessible, fast web apps.

Experience
Senior Front-end Engineer, Acme Lending — Sydney
Mar 2021 – Present
- Led the React and TypeScript rebuild of the customer loan portal (40,000 monthly users).
- Ran the WCAG 2.1 AA audit and added automated accessibility checks to CI.
- Mentored 2 graduate engineers.

Front-end Engineer, Globex Insurance — Sydney
Feb 2017 – Feb 2021
- Built the quote flow in React, cutting drop-off by 18%.
- Introduced Storybook and a shared component library.

Education
BSc, Computer Science — University of Sydney, 2016

Skills
React, TypeScript, Next.js, Storybook, Accessibility (WCAG)`,
    jobAd: `Senior Front-end Engineer, Brightpath Fintech
We're looking for an engineer with 5+ years of React and strong TypeScript. You'll own accessibility across our lending products and work with our GraphQL API. Experience mentoring other engineers is a plus.`,
    expected: {
      name: "Jane Citizen",
      email: "jane.citizen@example.com",
      roles: [
        {
          employer: "Acme Lending",
          position: "Senior Front-end Engineer",
          start: "2021-03",
          end: "present",
          bullets: [
            "Led the React and TypeScript rebuild of the customer loan portal (40,000 monthly users).",
            "Ran the WCAG 2.1 AA audit and added automated accessibility checks to CI.",
            "Mentored 2 graduate engineers.",
          ],
        },
        {
          employer: "Globex Insurance",
          position: "Front-end Engineer",
          start: "2017-02",
          end: "2021-02",
          bullets: ["Built the quote flow in React, cutting drop-off by 18%.", "Introduced Storybook and a shared component library."],
        },
      ],
      skills: ["React", "TypeScript", "Next.js", "Storybook", "Accessibility (WCAG)"],
      education: [{ institution: "University of Sydney", end: "2016" }],
      rest: {
        basics: { headline: "Senior Front-end Engineer", phone: "0412 345 678", location: { city: "Sydney", region: "NSW" }, summary: "Front-end engineer with 8 years of React, focused on accessible, fast web apps." },
        education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
      },
    },
    match: [
      { requirement: /react/i, status: "met" },
      { requirement: /typescript/i, status: "met" },
      { requirement: /graphql/i, status: "missing" },
      { requirement: /accessib/i, status: "met" },
    ],
    recall: [
      { query: "What accessibility work have I done?", expect: "WCAG 2.1 AA audit" },
      { query: "Have I coached junior developers?", expect: "Mentored 2 graduate engineers" },
    ],
  },
  {
    id: "ambiguous-dates",
    trap: 'A role dated "2019–20", and a role with no bullets.',
    cv: `Tom Nguyen
Backend Developer
Melbourne, VIC · tom.nguyen@example.com

Experience
Backend Developer, Initech
2021 – Present
- Maintain Node.js services handling 2 million requests a day.
- Moved the billing jobs from cron to a Postgres-backed queue.

Junior Developer, Hooli
2019–20

Education
Bachelor of IT — RMIT University, 2018

Skills
Node.js, PostgreSQL, Docker`,
    jobAd: `Backend Engineer, Paywave
Node.js and PostgreSQL required. Kubernetes experience required. You'll build payment services at scale.`,
    expected: {
      name: "Tom Nguyen",
      email: "tom.nguyen@example.com",
      roles: [
        {
          employer: "Initech",
          position: "Backend Developer",
          start: "2021",
          end: "present",
          bullets: ["Maintain Node.js services handling 2 million requests a day.", "Moved the billing jobs from cron to a Postgres-backed queue."],
        },
        { employer: "Hooli", position: "Junior Developer", start: "2019", end: "2020", bullets: [] },
      ],
      skills: ["Node.js", "PostgreSQL", "Docker"],
      education: [{ institution: "RMIT University", end: "2018" }],
      rest: {
        basics: { headline: "Backend Developer", location: { city: "Melbourne", region: "VIC" } },
        education: [{ institution: "RMIT University", qualification: "Bachelor of IT", end: "2018" }],
      },
    },
    match: [
      { requirement: /node/i, status: "met" },
      { requirement: /postgres/i, status: "met" },
      { requirement: /kubernetes/i, status: "missing" },
    ],
    recall: [{ query: "Tell me about my queue migration", expect: "Postgres-backed queue" }],
  },
  {
    id: "no-email",
    trap: "The CV has no email or phone: the profile must not make one up.",
    cv: `Priya Shah
Product Designer

Experience
Product Designer, Umbrella Health
Jul 2020 – Present
- Redesigned the patient booking flow; bookings completed rose from 61% to 78%.
- Ran 30 usability sessions with patients over 70.

UX Designer, Stark Retail
Jan 2018 – Jun 2020
- Designed the click-and-collect checkout.

Education
Bachelor of Design — UNSW, 2017

Skills
Figma, User research, Prototyping`,
    jobAd: `Senior Product Designer, CareConnect
Healthcare design experience required. Strong user research. Figma. Experience designing native mobile apps (iOS/Android) required.`,
    expected: {
      name: "Priya Shah",
      roles: [
        {
          employer: "Umbrella Health",
          position: "Product Designer",
          start: "2020-07",
          end: "present",
          bullets: ["Redesigned the patient booking flow; bookings completed rose from 61% to 78%.", "Ran 30 usability sessions with patients over 70."],
        },
        { employer: "Stark Retail", position: "UX Designer", start: "2018-01", end: "2020-06", bullets: ["Designed the click-and-collect checkout."] },
      ],
      skills: ["Figma", "User research", "Prototyping"],
      education: [{ institution: "UNSW", end: "2017" }],
      rest: {
        basics: { headline: "Product Designer" },
        education: [{ institution: "UNSW", qualification: "Bachelor of Design", end: "2017" }],
      },
    },
    match: [
      { requirement: /health/i, status: "met" },
      { requirement: /research/i, status: "met" },
      { requirement: /mobile|ios|android/i, status: "missing" },
    ],
    recall: [{ query: "How did I improve bookings?", expect: "61% to 78%" }],
  },
  {
    id: "skills-in-bullets",
    trap: "No skills section: skills appear only inside bullets, so the profile's skills section stays empty.",
    cv: `Liam O'Brien
Data Analyst
Brisbane, QLD · liam.obrien@example.com

Experience
Data Analyst, Wayne Logistics
Apr 2022 – Present
- Wrote SQL reports on delivery times for 12 depots.
- Automated the weekly fleet report in Python, saving 6 hours a week.

Reporting Officer, Queensland Rail
2019 – 2022
- Built Excel dashboards for on-time running.

Education
Bachelor of Business (Analytics) — QUT, 2018`,
    jobAd: `Senior Data Analyst, FreightCo
SQL required. Python for automation. Tableau dashboards required. Logistics experience preferred.`,
    expected: {
      name: "Liam O'Brien",
      email: "liam.obrien@example.com",
      roles: [
        {
          employer: "Wayne Logistics",
          position: "Data Analyst",
          start: "2022-04",
          end: "present",
          bullets: ["Wrote SQL reports on delivery times for 12 depots.", "Automated the weekly fleet report in Python, saving 6 hours a week."],
        },
        { employer: "Queensland Rail", position: "Reporting Officer", start: "2019", end: "2022", bullets: ["Built Excel dashboards for on-time running."] },
      ],
      skills: [],
      education: [{ institution: "QUT", end: "2018" }],
      rest: {
        basics: { headline: "Data Analyst", location: { city: "Brisbane", region: "QLD" } },
        education: [{ institution: "QUT", qualification: "Bachelor of Business (Analytics)", end: "2018" }],
      },
    },
    match: [
      { requirement: /sql/i, status: "met" },
      { requirement: /python/i, status: "met" },
      { requirement: /tableau/i, status: "missing" },
      { requirement: /logistic/i, status: "met" },
    ],
    recall: [{ query: "What have I automated?", expect: "saving 6 hours a week" }],
  },
  {
    id: "career-changer",
    trap: "A teacher turned developer: the job's 3+ years of professional development isn't there.",
    cv: `Maria Rossi
Junior Web Developer
Adelaide, SA · maria.rossi@example.com

Profile
Former secondary maths teacher, now building web apps after a full-stack bootcamp.

Experience
Junior Web Developer, Pied Piper
Feb 2025 – Present
- Build React components for the customer dashboard.
- Fixed 40 bugs in the first three months.

Maths Teacher, Adelaide High School
2015 – 2024
- Taught Years 9–12 maths; wrote the school's first coding elective.

Education
Full-Stack Web Development Bootcamp — Coder Academy, 2024
Bachelor of Education — University of Adelaide, 2014

Skills
JavaScript, React, HTML, CSS`,
    jobAd: `Mid-level Front-end Developer, EduTech Labs
3+ years of professional software development required. React and JavaScript. Experience in education is a strong plus.`,
    expected: {
      name: "Maria Rossi",
      email: "maria.rossi@example.com",
      roles: [
        {
          employer: "Pied Piper",
          position: "Junior Web Developer",
          start: "2025-02",
          end: "present",
          bullets: ["Build React components for the customer dashboard.", "Fixed 40 bugs in the first three months."],
        },
        {
          employer: "Adelaide High School",
          position: "Maths Teacher",
          start: "2015",
          end: "2024",
          bullets: ["Taught Years 9–12 maths; wrote the school's first coding elective."],
        },
      ],
      skills: ["JavaScript", "React", "HTML", "CSS"],
      education: [
        { institution: "Coder Academy", end: "2024" },
        { institution: "University of Adelaide", end: "2014" },
      ],
      rest: {
        basics: { headline: "Junior Web Developer", location: { city: "Adelaide", region: "SA" }, summary: "Former secondary maths teacher, now building web apps after a full-stack bootcamp." },
        education: [
          { institution: "Coder Academy", qualification: "Full-Stack Web Development Bootcamp", end: "2024" },
          { institution: "University of Adelaide", qualification: "Bachelor of Education", end: "2014" },
        ],
      },
    },
    match: [
      { requirement: /3\+? years|professional/i, status: "missing" },
      { requirement: /react/i, status: "met" },
      { requirement: /education/i, status: "met" },
    ],
    recall: [{ query: "Have I taught coding?", expect: "coding elective" }],
  },
  {
    id: "java-not-kotlin",
    trap: "The job wants Kotlin; the CV is Java only. Close, but not the same.",
    cv: `Ahmed Khan
Software Engineer
Perth, WA · ahmed.khan@example.com

Experience
Software Engineer, Soylent Mining
Jun 2019 – Present
- Build Java and Spring Boot services for the ore tracking platform.
- Cut the nightly batch from 4 hours to 50 minutes.

Graduate Developer, Vandelay Industries
Feb 2017 – May 2019
- Maintained the Java invoicing system.

Education
Bachelor of Engineering (Software) — Curtin University, 2016

Skills
Java, Spring Boot, AWS, Oracle`,
    jobAd: `Senior Kotlin Engineer, MineSight
Kotlin required (4+ years). Spring Boot. AWS. Mining industry experience a plus.`,
    expected: {
      name: "Ahmed Khan",
      email: "ahmed.khan@example.com",
      roles: [
        {
          employer: "Soylent Mining",
          position: "Software Engineer",
          start: "2019-06",
          end: "present",
          bullets: ["Build Java and Spring Boot services for the ore tracking platform.", "Cut the nightly batch from 4 hours to 50 minutes."],
        },
        { employer: "Vandelay Industries", position: "Graduate Developer", start: "2017-02", end: "2019-05", bullets: ["Maintained the Java invoicing system."] },
      ],
      skills: ["Java", "Spring Boot", "AWS", "Oracle"],
      education: [{ institution: "Curtin University", end: "2016" }],
      rest: {
        basics: { headline: "Software Engineer", location: { city: "Perth", region: "WA" } },
        education: [{ institution: "Curtin University", qualification: "Bachelor of Engineering (Software)", end: "2016" }],
      },
    },
    match: [
      { requirement: /kotlin/i, status: "missing" },
      { requirement: /spring/i, status: "met" },
      { requirement: /aws/i, status: "met" },
      { requirement: /mining/i, status: "met" },
    ],
    recall: [{ query: "What performance improvement did I make?", expect: "4 hours to 50 minutes" }],
  },
  {
    id: "graduate-projects",
    trap: "No jobs at all: projects and education only. Nothing goes under experience.",
    cv: `Chloe Martin
Computer Science Graduate
Canberra, ACT · chloe.martin@example.com

Projects
Bus Tracker — a React Native app showing live Canberra bus times, 500 downloads.
- Used the Transport Canberra open data feed.
Study Planner — a web app for planning assignments, built with Vue.

Education
Bachelor of Computer Science — ANU, 2025

Skills
JavaScript, React Native, Vue, Git`,
    jobAd: `Graduate Software Engineer, GovTech
A computer science degree. Some experience building apps. 1+ year of commercial experience preferred.`,
    expected: {
      name: "Chloe Martin",
      email: "chloe.martin@example.com",
      roles: [],
      skills: ["JavaScript", "React Native", "Vue", "Git"],
      education: [{ institution: "ANU", end: "2025" }],
      rest: {
        basics: { headline: "Computer Science Graduate", location: { city: "Canberra", region: "ACT" } },
        projects: [
          { name: "Bus Tracker", description: "a React Native app showing live Canberra bus times, 500 downloads.", highlights: ["Used the Transport Canberra open data feed."] },
          { name: "Study Planner", description: "a web app for planning assignments, built with Vue." },
        ],
        education: [{ institution: "ANU", qualification: "Bachelor of Computer Science", end: "2025" }],
      },
    },
    match: [
      { requirement: /degree|computer science/i, status: "met" },
      { requirement: /commercial/i, status: "missing" },
    ],
    recall: [{ query: "Which app did I build with live bus times?", expect: "Bus Tracker" }],
  },
  {
    id: "designer-links",
    trap: 'Lowercase "present", and links to keep exactly.',
    cv: `Sam Lee
UI Designer
Hobart, TAS · sam.lee@example.com · samlee.design · github.com/samlee

Experience
UI Designer, Cyberdyne Apps
Aug 2023 – present
- Designed the onboarding screens for 3 mobile apps.
- Created the icon set used across the product.

Junior Designer, Tyrell Studio
Mar 2021 – Jul 2023
- Produced marketing site layouts in Figma.

Education
Diploma of Graphic Design — TAFE Tasmania, 2020

Skills
Figma, Illustrator, Design systems`,
    jobAd: `Product Designer, Wonka Software
Figma and design systems required. A degree in design or HCI required. Motion design a plus.`,
    expected: {
      name: "Sam Lee",
      email: "sam.lee@example.com",
      roles: [
        {
          employer: "Cyberdyne Apps",
          position: "UI Designer",
          start: "2023-08",
          end: "present",
          bullets: ["Designed the onboarding screens for 3 mobile apps.", "Created the icon set used across the product."],
        },
        { employer: "Tyrell Studio", position: "Junior Designer", start: "2021-03", end: "2023-07", bullets: ["Produced marketing site layouts in Figma."] },
      ],
      skills: ["Figma", "Illustrator", "Design systems"],
      education: [{ institution: "TAFE Tasmania", end: "2020" }],
      rest: {
        basics: {
          headline: "UI Designer",
          location: { city: "Hobart", region: "TAS" },
          links: [
            { label: "samlee.design", url: "https://samlee.design" },
            { label: "github.com/samlee", url: "https://github.com/samlee" },
          ],
        },
        education: [{ institution: "TAFE Tasmania", qualification: "Diploma of Graphic Design", end: "2020" }],
      },
    },
    match: [
      { requirement: /figma/i, status: "met" },
      { requirement: /degree/i, status: "partial" },
      { requirement: /motion/i, status: "missing" },
    ],
    recall: [{ query: "Did I make icons?", expect: "icon set" }],
  },
  {
    id: "nurse-to-product",
    trap: "Certificates and languages; the job wants product management experience the CV doesn't have.",
    cv: `Grace Okafor
Clinical Nurse Specialist
Darwin, NT · grace.okafor@example.com

Experience
Clinical Nurse Specialist, Royal Darwin Hospital
2018 – Present
- Led the rollout of the electronic medication chart to 4 wards.
- Trained 120 nurses on the new system.

Registered Nurse, Alice Springs Hospital
2013 – 2018
- Worked in the emergency department.

Education
Bachelor of Nursing — Charles Darwin University, 2012

Certificates
Certificate IV in Training and Assessment, 2019

Languages
English (native), Igbo (fluent)`,
    jobAd: `Clinical Product Owner, HealthStack
Clinical background required. Experience rolling out clinical systems. 2+ years in product management required.`,
    expected: {
      name: "Grace Okafor",
      email: "grace.okafor@example.com",
      roles: [
        {
          employer: "Royal Darwin Hospital",
          position: "Clinical Nurse Specialist",
          start: "2018",
          end: "present",
          bullets: ["Led the rollout of the electronic medication chart to 4 wards.", "Trained 120 nurses on the new system."],
        },
        { employer: "Alice Springs Hospital", position: "Registered Nurse", start: "2013", end: "2018", bullets: ["Worked in the emergency department."] },
      ],
      skills: [],
      education: [{ institution: "Charles Darwin University", end: "2012" }],
      rest: {
        basics: { headline: "Clinical Nurse Specialist", location: { city: "Darwin", region: "NT" } },
        education: [{ institution: "Charles Darwin University", qualification: "Bachelor of Nursing", end: "2012" }],
        certificates: [{ name: "Certificate IV in Training and Assessment", date: "2019" }],
        languages: [
          { language: "English", fluency: "native" },
          { language: "Igbo", fluency: "fluent" },
        ],
      },
    },
    match: [
      { requirement: /clinical background/i, status: "met" },
      { requirement: /rolling out|rollout|clinical systems/i, status: "met" },
      { requirement: /product management/i, status: "missing" },
    ],
    recall: [{ query: "How many people have I trained?", expect: "Trained 120 nurses" }],
  },
  {
    id: "numbers-and-titles",
    trap: "Specific numbers and an acting title: both must be copied exactly, not rounded or promoted.",
    cv: `Ben Walsh
Operations Manager
Sydney, NSW · ben.walsh@example.com

Experience
Acting Operations Manager, Massive Dynamic
Sep 2024 – Present
- Run a team of 9 coordinators across 2 warehouses.
- Reduced picking errors by 23% in six months.

Operations Coordinator, Massive Dynamic
Jan 2020 – Aug 2024
- Scheduled 140 deliveries a day.

Education
Diploma of Logistics — TAFE NSW, 2019

Skills
Rostering, Inventory control, SAP`,
    jobAd: `Operations Manager, Shipright
5+ years in operations. Experience managing a team of 10 or more. SAP required.`,
    expected: {
      name: "Ben Walsh",
      email: "ben.walsh@example.com",
      roles: [
        {
          employer: "Massive Dynamic",
          position: "Acting Operations Manager",
          start: "2024-09",
          end: "present",
          bullets: ["Run a team of 9 coordinators across 2 warehouses.", "Reduced picking errors by 23% in six months."],
        },
        { employer: "Massive Dynamic", position: "Operations Coordinator", start: "2020-01", end: "2024-08", bullets: ["Scheduled 140 deliveries a day."] },
      ],
      skills: ["Rostering", "Inventory control", "SAP"],
      education: [{ institution: "TAFE NSW", end: "2019" }],
      rest: {
        basics: { headline: "Operations Manager", location: { city: "Sydney", region: "NSW" } },
        education: [{ institution: "TAFE NSW", qualification: "Diploma of Logistics", end: "2019" }],
      },
    },
    match: [
      { requirement: /team of 10|managing a team/i, status: "partial" },
      { requirement: /sap/i, status: "met" },
    ],
    recall: [{ query: "How did I reduce errors?", expect: "picking errors by 23%" }],
  },
  {
    id: "listed-skills-ended-role",
    trap: "GraphQL and Kubernetes appear only in the skills section (still met, never a gap, and not credited to a role), and the latest role has ended: nothing is current.",
    cv: `Tom Nguyen
Full-stack Engineer
Melbourne, VIC · tom.nguyen@example.com

Experience
Full-stack Engineer, Initech
Mar 2021 – Jun 2026
- Built the customer billing portal in React and TypeScript.
- Wrote Node.js services for invoice generation.

Software Developer, Hooli
2017 – 2021
- Maintained the internal reporting tool in Java.

Skills
Front end: React, TypeScript
Back end: Node.js, GraphQL, PostgreSQL
Infrastructure: Docker, Kubernetes

Education
Bachelor of Computer Science — Monash University, 2016`,
    jobAd: `Senior Full-stack Engineer, Vandelay Industries
React and TypeScript required. You'll build GraphQL APIs on PostgreSQL. Kubernetes experience required. Go is a plus.`,
    expected: {
      name: "Tom Nguyen",
      email: "tom.nguyen@example.com",
      roles: [
        {
          employer: "Initech",
          position: "Full-stack Engineer",
          start: "2021-03",
          end: "2026-06",
          bullets: ["Built the customer billing portal in React and TypeScript.", "Wrote Node.js services for invoice generation."],
        },
        { employer: "Hooli", position: "Software Developer", start: "2017", end: "2021", bullets: ["Maintained the internal reporting tool in Java."] },
      ],
      skills: ["React", "TypeScript", "Node.js", "GraphQL", "PostgreSQL", "Docker", "Kubernetes"],
      education: [{ institution: "Monash University", end: "2016" }],
      rest: {
        basics: { headline: "Full-stack Engineer", location: { city: "Melbourne", region: "VIC" } },
        skills: [
          { group: "Front end", keywords: ["React", "TypeScript"] },
          { group: "Back end", keywords: ["Node.js", "GraphQL", "PostgreSQL"] },
          { group: "Infrastructure", keywords: ["Docker", "Kubernetes"] },
        ],
        education: [{ institution: "Monash University", qualification: "Bachelor of Computer Science", end: "2016" }],
      },
    },
    match: [
      { requirement: /react|typescript/i, status: "met" },
      { requirement: /graphql/i, status: "met" },
      { requirement: /kubernetes/i, status: "met" },
      { requirement: /\bgo\b/i, status: "missing" },
    ],
    recall: [{ query: "What did I build at Initech?", expect: "customer billing portal" }],
  },
];
