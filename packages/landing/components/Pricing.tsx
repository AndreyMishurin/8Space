import Link from "next/link";

const Pricing = () => {
  return (
    <section className="bg-base-200 overflow-hidden" id="pricing">
      <div className="py-24 px-8 max-w-5xl mx-auto">
        <div className="flex flex-col text-center w-full mb-20">
          <p className="font-medium text-primary mb-8">Pricing</p>
          <h2 className="font-bold text-3xl lg:text-5xl tracking-tight">
            Start managing projects with your team today!
          </h2>
        </div>
        <div className="flex justify-center">
          <Link href="/app" className="btn btn-primary btn-lg">
            Get Started — Free
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
