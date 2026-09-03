const RELEASES = [
  { tag: "v0.0", name: "Foundation", current: true },
  { tag: "v0.1", name: "The Call" },
  { tag: "v0.1.5", name: "Captions" },
  { tag: "v0.1.8", name: "Canvas" },
  { tag: "v0.2", name: "Decisions" },
  { tag: "v0.3", name: "Action items" },
  { tag: "v0.4", name: "Meeting timeline" },
  { tag: "v0.5", name: "Meeting memory" },
  { tag: "v0.6", name: "Semantic search" },
  { tag: "v0.7", name: "Integrations" },
  { tag: "v0.8", name: "Hardening" },
  { tag: "v1.0", name: "Plugin ecosystem" },
];

const REPO = "https://github.com/Lord-shaban/lor";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-50">
          Live Open Rooms
        </p>

        {/* The dot is part of the wordmark, not punctuation: it is the live
            indicator, so it carries the accent the logo uses. */}
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          LOR<span className="text-indigo-500">.</span>
        </h1>

        <p className="mt-4 text-lg text-balance opacity-80">
          Open-source video meetings that remember. No account, no time limit,
          no download.
        </p>

        {/*
          dir="auto" lets the browser pick the paragraph direction from the
          first strong character, and <bdi> isolates the Latin run so the
          surrounding Arabic does not scramble its word order. Every piece of
          mixed text in LOR is rendered this way.
        */}
        <p dir="auto" className="mt-2 text-lg text-balance opacity-80">
          وبيفهم لما تقول &laquo;عملت الـ <bdi>deploy</bdi> على الـ{" "}
          <bdi>server</bdi>&raquo;.
        </p>

        <div className="mt-10 rounded-lg border border-current/15 p-5">
          <p className="text-sm">
            <span className="font-mono font-medium">v0.0</span> — the repository
            foundation is in place. The meeting itself arrives in{" "}
            <span className="font-mono font-medium">v0.1</span>.
          </p>

          <ol className="mt-5 space-y-1.5 font-mono text-xs">
            {RELEASES.map((release) => (
              <li
                key={release.tag}
                className={
                  release.current
                    ? "flex gap-3"
                    : "flex gap-3 opacity-45"
                }
              >
                <span className="w-14 shrink-0 tabular-nums">
                  {release.tag}
                </span>
                <span>{release.name}</span>
                {release.current && (
                  <span className="ms-auto opacity-60">building</span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a className="underline underline-offset-4" href={REPO}>
            Source
          </a>
          <a
            className="underline underline-offset-4"
            href={`${REPO}/milestones`}
          >
            Roadmap
          </a>
          <a
            className="underline underline-offset-4"
            href={`${REPO}/blob/main/CONTRIBUTING.md`}
          >
            Contributing
          </a>
          <span className="opacity-50">AGPL-3.0</span>
        </div>
      </div>
    </main>
  );
}
