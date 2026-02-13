import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Terms of Service | ${config.appName}`,
  canonicalUrlRelative: "/tos",
});

const TOS = () => {
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
          Terms of Service for {config.appName}
        </h1>

        <pre
          className="leading-relaxed whitespace-pre-wrap"
          style={{ wordWrap: "break-word" }}
        >{`Last Updated: February 2026

Welcome to ${config.appName}!

These Terms of Service ("Terms") govern your use of the ${config.appName} website at https://${config.domainName} ("Website") and the services provided by ${config.appName}. By using our Website and services, you agree to these Terms.

1. Description of ${config.appName}

${config.appName} is a collaborative team planning platform that provides Gantt charts, kanban boards, and backlog management for project teams.

2. Use of Service

By creating an account, you gain access to ${config.appName}'s project management features. You agree to use the service in compliance with applicable laws and these Terms.

3. Data Collection and Use

We collect and store user data, including name, email, and authentication information, as necessary to provide our services. For details on how we handle your data, please refer to our Privacy Policy at https://${config.domainName}/privacy-policy.

4. Limitation of Liability

${config.appName} is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising from the use of our service.

5. Updates to Terms

We may update these Terms from time to time. Users will be notified of significant changes via email or through the Website.

6. Contact

For any questions or concerns regarding these Terms of Service, please contact us at ${config.resend.supportEmail}.

Thank you for using ${config.appName}!`}
        </pre>
      </div>
    </main>
  );
};

export default TOS;
