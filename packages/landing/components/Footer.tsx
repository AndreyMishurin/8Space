import Link from "next/link";
import config from "@/config";
import LogoInftySpace from "@/components/LogoInftySpace";

const Footer = () => {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/10 text-white">
      <div className="max-w-7xl mx-auto px-8 py-24">
        <div className="flex lg:items-start md:flex-row md:flex-nowrap flex-wrap flex-col">
          <div className="w-64 flex-shrink-0 md:mx-0 mx-auto text-center md:text-left">
            <Link
              href="/#"
              aria-current="page"
              className="flex gap-2 justify-center md:justify-start items-center text-white"
            >
              <LogoInftySpace className="h-8" />
            </Link>

            <p className="mt-3 text-sm text-white/70">{config.appDescription}</p>
          </div>

          <div className="flex-grow flex flex-wrap justify-center md:justify-end -mb-10 md:mt-0 mt-10 text-center">
            <div className="lg:w-1/3 md:w-1/2 w-full px-4">
              <div className="footer-title font-semibold text-white/70 tracking-widest text-sm md:text-left mb-3">
                LEGAL
              </div>

              <div className="flex flex-col justify-center items-center md:items-start gap-2 mb-10 text-sm">
                <Link href="/tos" className="text-white/70 hover:text-white transition-colors">
                  Terms of services
                </Link>
                <Link href="/privacy-policy" className="text-white/70 hover:text-white transition-colors">
                  Privacy policy
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-sm text-white/60">
          <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 sm:items-center">
            <div className="leading-relaxed text-center sm:text-left">
              <div className="text-white/80">© 2026 8Space</div>
              <div>Built by Andrey Mishurin</div>
            </div>

            <div className="text-center sm:text-right">
              <div className="flex sm:justify-end justify-center flex-wrap gap-x-5 gap-y-2">
                <a
                  href="https://github.com/AndreyMishurin/8Space/blob/master/LICENSE"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  MIT License
                </a>
                <a
                  href="https://github.com/AndreyMishurin/8Space/blob/master/SECURITY.md"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Security Policy
                </a>
              </div>
              <div className="mt-2">MIT Licensed. Report security issues responsibly.</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
