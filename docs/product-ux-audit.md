# Product experience audit

Status: completed during `v0.7`; retained as the evidence behind the shipped UX.

This audit fixed the order of work for `v0.7`: make the product comfortable to use
before the public landing page borrows its visual language. It covers the product home,
prejoin, and the live meeting workspace. The landing page is deliberately out of scope.

## Evidence

The production build at <https://lor-bay.vercel.app> was inspected on 13 September
2026 in a Chromium browser on Windows. The review used Arabic RTL first and English LTR
second at `390x844`, `1024x768`, and `1440x900`. The following states were exercised:

- start/join home, including the complete release list;
- prejoin with media on and off, device selectors, and the invitation block;
- an empty joined room with media off;
- captions off and on;
- chat and retained transcript opened together; and
- the control bar at phone, laptop, and wide-desktop widths.

No screenshot is committed because the device list and self-view contain private data.
Every finding below names a reproducible route and state instead.

The browser evidence was checked against the component structure in
`app/[locale]/page.tsx`, `components/prejoin/prejoin.tsx`,
`components/call/call-room.tsx`, `components/call/call-controls.tsx`, and
`components/call/captions-notice.tsx`.

## Product direction

LOR. is a meeting desk, not a dashboard. The person or shared screen is the subject;
the product record opens beside it only when requested. One consistent **workspace
door** should lead to chat, board, notes, transcript, decisions, action items, timeline,
memory, and search. This is the memorable interaction: LOR. keeps one meeting and one
record together without scattering them across unrelated controls.

The existing visual system remains authoritative: neutral surfaces, Geist with IBM Plex
Sans Arabic, red only for live or consequential state, and short functional motion. The
red wordmark dot is not a licence to add decorative colour.

### Information hierarchy

The interface has three layers:

1. **Now:** video, current speaker or share, connection, microphone, camera, and leave.
2. **Together:** chat, board, notes, reactions, hand, captions, and screen share.
3. **After:** transcript, decisions, action items, timeline, memory, and search.

The first layer stays visible. The second and third layers live in compact, labelled
menus and one panel slot. Active states such as recording or transcription remain
visible even when their commands move into a menu.

### Responsive model

- **Phone:** a single-row bottom dock for microphone, camera, workspaces, more, and
  leave. A workspace is a full-height sheet above the dock. Secondary settings do not
  create a second control row.
- **Tablet/laptop:** the dock remains one row. One workspace drawer uses at most
  `min(26rem, 42vw)` and the video grid owns the remaining width.
- **Wide desktop:** the same model gains labels where space permits; it does not reveal
  another permanent toolbar merely because space exists.
- **Both directions:** drawers use logical `start`/`end` rules, mixed names are isolated,
  and menus preserve the same semantic order in RTL and LTR.

## Ranked findings

Priority is based on user harm and frequency. Confidence records whether the problem was
seen in the live product as well as in code. Size is an implementation estimate, not an
excuse to defer a high-impact problem.

| ID | Finding and evidence | Harm / frequency / confidence / size | Measurable success |
|---|---|---|---|
| M1 | **Two panel state machines conflict.** On `/<room>` at `1024x768`, open captions, then “Transcript”, then Chat. The transcript covers Chat while Chat still removes `20rem` from the video grid; keyboard focus can enter the hidden chat composer. `recordPanel` and `panel` are independent. | Critical / occasional / high / M | Exactly one complementary region is mounted. Opening any workspace replaces the current one, and focus returns to the invoking control when it closes. |
| M2 | **The call dock consumes the meeting.** At `390x844`, controls form three rows and occupy about 220px; at `1024x768`, Leave and Chat wrap to a second row. Twelve peer-level commands give microphone and Leave no stable position. | High / every call / high / M | The dock is one row at 390, 768, 1024, and 1440px; video loses no more than 72px to it; microphone, camera, workspaces, more, and Leave stay reachable in one tap. |
| M3 | **Captions expose a second toolbar.** Turning captions on adds consent copy plus eight record commands between the stage and dock. At laptop width it spans the viewport; at phone width it competes with the already wrapped controls. | High / frequent / high / S | The persistent notice communicates live transcription, retention, quota/error, and “stop mine” in at most two phone lines. Record navigation moves through the workspace door. |
| M4 | **The room has no compact identity or invite affordance after join.** The invitation link exists only below prejoin. A participant in the call cannot confirm the room or invite someone without navigating away. Tracked by [#224](https://github.com/Lord-shaban/lor/issues/224). | Medium / frequent / high / S | A compact room header exposes Copy invite and participant count without taking more than 48px or competing with connection and sharing warnings. |
| M5 | **Prejoin treats advanced routing as the main task.** At `390x844`, three device selectors and speaker test make the page taller than one viewport even when browser defaults are correct. The task is name, preview, mic/camera state, Join. Tracked by [#225](https://github.com/Lord-shaban/lor/issues/225). | Medium / every first join / high / S | Name, preview, mic/camera state, Join, and an “Audio and video settings” disclosure fit the first task flow; saved/default devices remain available without loss. |
| H1 | **The home reads as a release page.** Thirteen versions occupy roughly 420px and are the largest surface after Start/Join at both desktop and phone widths. The present product task and the future roadmap have equal visual weight. | High / every visit / high / S | Start and Join are the only primary actions above the fold. The release list is removed; source, privacy/no-account reassurance, help, and roadmap remain compact secondary links. |
| H2 | **Start and Join are separated rather than composed as one entry surface.** The primary button sits above a labelled field, so the visitor scans two unrelated blocks even though both answer “how do I enter?”. Error text appears below the whole launcher. | Medium / every visit / high / S | One labelled launcher groups “New meeting” and “Join with code/link”; errors attach to the affected action, and keyboard order matches the visible order. |
| H3 | **The mixed-language example wraps awkwardly in English on phone.** The Arabic quotation and Latin terms split into visually disconnected runs at `390x844`. It demonstrates bidi support but distracts from entry. | Low / every English phone visit / high / XS | The example is secondary, uses a measured text width, and reads in the intended order at 390px without pushing the launcher below the initial context. |

## Approved navigation model

The live call should use four stable control groups. Labels stay visible where they
clarify an unfamiliar action; icons must never be the only accessible name.

| Group | Persistent | Menu or workspace contents |
|---|---|---|
| Call | Microphone, camera, Leave | Screen share, device/video mode, local recording |
| Conversation | Chat badge, Workspaces | Chat, board, notes |
| Meeting record | Live captions/recording status | Transcript, decisions, action items, timeline, memory, search |
| Participation and host | Waiting count when non-zero | Reactions, raise/lower hand; host waiting room, lock, and mute-all |

Rules for this model:

- one `activeWorkspace` union owns every panel; no parallel boolean or second union;
- changing workspace replaces the mounted panel instead of stacking or hiding it;
- menus close on Escape and outside press, return focus, and expose `aria-expanded` and
  `aria-controls`;
- unread/waiting counts remain on the entry control even while their menu is closed;
- live transcription, recording, screen sharing, and reconnecting remain persistent
  status, never hidden in “More”;
- destructive or broadcast actions keep text labels and do not rely on red alone; and
- every target remains at least `44x44px` with a visible focus ring.

## Approved product-home model

The product home is a compact launcher, not the future public landing page:

1. a small header with the wordmark, locale, theme, and one Help/Source menu;
2. one clear promise and the New meeting / Join surface;
3. a short trust row: no account, no download, call works without AI; and
4. compact links to privacy, source, contribution, and roadmap.

Do not copy the landing-page hero, screenshots, videos, feature tour, or contribution
story into this route. Those belong to #212 and #213 after the product language is
settled.

## Delivery order

The evidence changes the release sequence:

1. **#216:** implement M1–M3 together because they share panel and control state.
2. Follow up with [#224](https://github.com/Lord-shaban/lor/issues/224) for M4 and
   [#225](https://github.com/Lord-shaban/lor/issues/225) for M5 only after the new shell
   is verified; they are independent enough to keep out of the first meeting-workspace
   PR.
3. **#214:** replace the release-list-first home with the approved launcher model.
4. **#212:** write the landing story and media brief from screenshots of the merged
   product experience.
5. **#213:** build the public landing page from that approved content.

## Verification contract for #214 and #216

Each implementation PR must include:

- Arabic RTL first, then English LTR at 390, 768, 1024, and 1440px;
- keyboard-only entry, menus, workspace replacement, panel close, and focus return;
- no horizontal scroll and no hidden focused element;
- reduced-motion and 200% zoom checks;
- visible loading, offline, permission-denied, reconnecting, quota, and empty states;
- the two-person browser suite proving decoded media, chat, board, and notes still work
  without an AI key; and
- before/after screenshots made with synthetic names and no real room code, transcript,
  device name, key, or personal self-view.
