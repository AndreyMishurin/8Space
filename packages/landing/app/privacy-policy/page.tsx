import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Privacy Policy | ${config.appName}`,
  canonicalUrlRelative: "/privacy-policy",
});

const PrivacyPolicy = () => {
  return (
    <main className="max-w-xl mx-auto">
      <div className="p-5">
        <Link href="/" className="btn btn-ghost">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-extrabold pb-6">
          Privacy Policy for {config.appName}
        </h1>

        <pre
          className="leading-relaxed whitespace-pre-wrap"
          style={{ wordWrap: "break-word" }}
        >{`Last Updated: February 2026

Thank you for visiting ${config.appName} ("we," "us," or "our"). This Privacy Policy outlines how we collect, use, and protect your personal and non-personal information when you use our website located at https://${config.domainName} (the "Website").

By accessing or using the Website, you agree to the terms of this Privacy Policy. If you do not agree with the practices described herein, please do not use the Website.

1. Information We Collect

We collect the following types of information:

a. Personal Information: When you sign in with Google, we receive your name, email address, and profile picture.

b. Non-Personal Information: We automatically collect non-personal information such as browser type, device type, and usage analytics.

2. How We Use Your Information

We use the collected information for:
- Providing and maintaining our services
- Improving user experience
- Sending relevant communications (with your consent)
3. Data Sharing

We do not sell or rent your personal information. We may share data with service providers (e.g. Supabase for authentication and database) strictly as needed to provide our services.

4. Children's Privacy

${config.appName} is not intended for children under the age of 13. We do not knowingly collect personal information from children.

5. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

6. Contact

If you have any questions about this Privacy Policy, please contact us:

Email: ${config.resend.supportEmail}

By using ${config.appName}, you consent to the terms of this Privacy Policy.`}
        </pre>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
