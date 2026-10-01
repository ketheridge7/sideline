import { CopyTextButton } from "@/components/copy-text-button";
import { INSTALLER_NAME } from "@/lib/constants";

export function InstallerSha256({ sha256 }: { sha256: string }) {
  return (
    <details className="mt-3 max-w-2xl" data-installer-sha256={sha256}>
      <summary className="w-fit cursor-pointer list-none text-sm text-muted underline decoration-white/30 underline-offset-4 hover:text-lime [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        Verify download
      </summary>
      <div className="mt-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed text-text">
            <span className="mr-2 font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              SHA-256
            </span>
            {sha256}
          </p>
          <CopyTextButton value={sha256} label="Copy SHA-256" />
        </div>
        <p className="mt-2 text-sm text-muted">
          Verify with <code className="text-text">{`Get-FileHash .\\${INSTALLER_NAME}`}</code>
        </p>
      </div>
    </details>
  );
}
