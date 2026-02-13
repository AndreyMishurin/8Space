import type { JSX } from "react";
import Image, { StaticImageData } from "next/image";
import introducingSupabaseImg from "@/public/blog/introducing-supabase/header.png";

// ==================================================================================================================================================================
// BLOG CATEGORIES
// ==================================================================================================================================================================

export type categoryType = {
  slug: string;
  title: string;
  titleShort?: string;
  description: string;
  descriptionShort?: string;
};

const categorySlugs: { [key: string]: string } = {
  feature: "feature",
  tutorial: "tutorial",
};

export const categories: categoryType[] = [
  {
    slug: categorySlugs.feature,
    title: "New Features",
    titleShort: "Features",
    description:
      "Here are the latest features we've added to Oko. We're constantly improving to help your team plan better.",
    descriptionShort: "Latest features added to Oko.",
  },
  {
    slug: categorySlugs.tutorial,
    title: "How Tos & Tutorials",
    titleShort: "Tutorials",
    description:
      "Learn how to use Oko with these step-by-step tutorials. Get your team up and running in minutes.",
    descriptionShort:
      "Learn how to use Oko with these step-by-step tutorials.",
  },
];

// ==================================================================================================================================================================
// BLOG AUTHORS
// ==================================================================================================================================================================

export type authorType = {
  slug: string;
  name: string;
  job: string;
  description: string;
  avatar: StaticImageData | string;
  socials?: {
    name: string;
    icon: JSX.Element;
    url: string;
  }[];
};

const socialIcons: {
  [key: string]: {
    name: string;
    svg: JSX.Element;
  };
} = {
  twitter: {
    name: "Twitter",
    svg: (
      <svg
        version="1.1"
        id="svg5"
        x="0px"
        y="0px"
        viewBox="0 0 1668.56 1221.19"
        className="w-9 h-9"
      >
        <g id="layer1" transform="translate(52.390088,-25.058597)">
          <path
            id="path1009"
            d="M283.94,167.31l386.39,516.64L281.5,1104h87.51l340.42-367.76L984.48,1104h297.8L874.15,558.3l361.92-390.99   h-87.51l-313.51,338.7l-253.31-338.7H283.94z M412.63,231.77h136.81l604.13,807.76h-136.81L412.63,231.77z"
          />
        </g>
      </svg>
    ),
  },
  github: {
    name: "GitHub",
    svg: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        viewBox="0 0 24 24"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
};

const authorSlugs: {
  [key: string]: string;
} = {
  oko_team: "oko-team",
};

export const authors: authorType[] = [
  {
    slug: authorSlugs.oko_team,
    name: "Oko Team",
    job: "Building Oko",
    description:
      "The team behind Oko — a collaborative project management tool with Gantt charts, kanban boards, and backlog management.",
    avatar: "https://ui-avatars.com/api/?name=Oko&background=f97316&color=fff&size=128",
    socials: [
      {
        name: socialIcons.github.name,
        icon: socialIcons.github.svg,
        url: "https://github.com/AndreyMishurin/Oko",
      },
    ],
  },
];

// ==================================================================================================================================================================
// BLOG ARTICLES
// ==================================================================================================================================================================

export type articleType = {
  slug: string;
  title: string;
  description: string;
  categories: categoryType[];
  author: authorType;
  publishedAt: string;
  image: {
    src?: StaticImageData;
    urlRelative: string;
    alt: string;
  };
  content: JSX.Element;
};

const styles: {
  [key: string]: string;
} = {
  h2: "text-2xl lg:text-4xl font-bold tracking-tight mb-4 text-base-content",
  h3: "text-xl lg:text-2xl font-bold tracking-tight mb-2 text-base-content",
  p: "text-base-content/90 leading-relaxed",
  ul: "list-inside list-disc text-base-content/90 leading-relaxed",
  li: "list-item",
  code: "text-sm font-mono bg-neutral text-neutral-content p-6 rounded-box my-4 overflow-x-scroll select-all",
  codeInline:
    "text-sm font-mono bg-base-300 px-1 py-0.5 rounded-box select-all",
};

export const articles: articleType[] = [
  {
    slug: "introducing-supabase",
    title: "How Oko Uses Supabase for Auth and Data",
    description:
      "Supabase is an open-source Firebase alternative that powers Oko's authentication, database, and real-time features.",
    categories: [
      categories.find((category) => category.slug === categorySlugs.feature),
    ],
    author: authors.find((author) => author.slug === authorSlugs.oko_team),
    publishedAt: "2025-01-15",
    image: {
      src: introducingSupabaseImg,
      urlRelative: "/blog/introducing-supabase/header.jpg",
      alt: "Supabase and Oko integration",
    },
    content: (
      <>
        <Image
          src={introducingSupabaseImg}
          alt="Supabase and Oko integration"
          width={700}
          height={500}
          priority={true}
          className="rounded-box"
          placeholder="blur"
        />
        <section>
          <h2 className={styles.h2}>Introduction</h2>
          <p className={styles.p}>
            Supabase is an open-source Firebase alternative. It powers
            Oko&apos;s authentication, PostgreSQL database, and row-level
            security — enabling a fully collaborative, single-tenant workspace
            where all team members can manage projects together.
          </p>
        </section>

        <section>
          <h3 className={styles.h3}>1. Create a Supabase project</h3>
          <p className={styles.p}>
            Go to{" "}
            <a href="https://supabase.com/" className="link link-primary">
              Supabase
            </a>{" "}
            and create a free project. Oko uses Supabase for Google OAuth login,
            PostgreSQL database with RLS policies, and real-time subscriptions.
          </p>
        </section>

        <section>
          <h3 className={styles.h3}>2. Configure environment variables</h3>
          <p className={styles.p}>
            Copy the <span className={styles.codeInline}>API URL</span> and{" "}
            <span className={styles.codeInline}>Anon Key</span> from your
            Supabase project settings and add them to your environment files:
          </p>

          <ul className={styles.ul}>
            <li className={styles.li}>.env.local (for the landing page)</li>
            <li className={styles.li}>.env (for the Oko app)</li>
          </ul>
        </section>
      </>
    ),
  },
];
