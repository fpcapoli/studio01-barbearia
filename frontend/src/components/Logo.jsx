export const LOGO_URL =
  "https://customer-assets-cm19k8pv.emergentagent.net/job_d50b059d-2c1b-492d-b2a0-ebf6165365c9/artifacts/2b3a48c499dc7c57_IMG_9493.jpeg";

export function Logo({ className = "h-11 w-11", showText = true }) {
  return (
    <div className="flex items-center gap-3" data-testid="navbar-brand-logo">
      <img
        src={LOGO_URL}
        alt="Studio01 Barbearia"
        className={`${className} rounded-md object-cover ring-1 ring-zinc-700`}
      />
      {showText && (
        <div className="leading-none">
          <div className="font-heading text-lg font-extrabold uppercase tracking-tight text-white">
            Studio<span className="text-amber-400">01</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            Barbearia
          </div>
        </div>
      )}
    </div>
  );
}
