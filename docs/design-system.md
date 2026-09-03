# Design system

The reasoning behind the tokens. Read this before changing a colour, adding a shade, or
introducing a new radius, so the next change extends the system rather than working
around it.

## What this interface is for

LOR. is a tool, not a landing page. Its home screen has one job — get you into a meeting
in two clicks — and its main screen is video, where every coloured pixel of chrome
competes with somebody's face. So the interface recedes. Almost everything is
achromatic, and the one colour that appears has to earn it.

This is also an Arabic-first product. RTL is the layout we design against and LTR is the
second pass, which rules out any decision that only works in one direction.

## Colour

### One rule, applied everywhere

**Red means live.** Recording, an open microphone, a transmitting caption, a call in
progress. It is never a brand accent, never a default button, never decoration. When
red appears, something is happening right now.

That gives the palette its shape: a neutral base, and a single hue reserved for state.
It is also why the wordmark's dot is red — the dot *is* the live indicator, so the logo
and the interface say the same thing with the same colour.

There is deliberately **no decorative accent colour**. A primary button is the
foreground colour at full strength, which is the highest contrast available and needs no
hue at all. Adding a brand blue or indigo here would be the templated default and would
compete with the one colour that carries meaning.

### The scale

Neutrals are a true grey with a barely perceptible cool cast, not a tinted lavender or
warm cream. Faces are the subject; a tinted surround shifts skin tones.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#ffffff` | `#0a0a0b` | Page |
| `--surface` | `#f7f7f8` | `#141416` | Raised panel, sidebar, video tile backing |
| `--surface-strong` | `#eeeef0` | `#1e1e21` | Input, hover, pressed |
| `--foreground` | `#0f0f11` | `#f4f4f5` | Body text, primary buttons |
| `--muted` | `#6b6b73` | `#a1a1aa` | Secondary text, still 4.5:1 on its background |
| `--border` | `#e4e4e7` | `#2a2a2e` | Hairlines, tile edges |
| `--live` | `#dc2626` | `#f87171` | Recording, open mic, live captions |
| `--danger` | `#dc2626` | `#f87171` | Destructive actions |

`--live` and `--danger` share a value on purpose. Both mean *this is consequential right
now*, and splitting them into two reds that differ slightly would read as an accident.

### The call is always dark

The meeting screen ignores the theme and stays dark, in both light and dark mode. Video
is bright and a light surround around a bright rectangle is fatiguing over an hour, which
is why every tool people actually use for long calls does this. The rest of the product
follows the system preference.

## Type

**Geist** for Latin, **IBM Plex Sans Arabic** for Arabic, in one stack so the browser
picks per character. This is not a stylistic pairing so much as a requirement: Geist has
no Arabic coverage at all, and the Arabic face has to match its geometry rather than sit
next to it awkwardly. Both are geometric, both carry a full weight range, both hold up at
14px in a control.

**Geist Mono** appears only where characters must align in a column — version tags,
room codes, timestamps, durations. It is not a texture for small labels, and it never
wraps Arabic, which no monospace face covers.

Scale, from a 16px base:

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 12px | 1.5 | Metadata, timestamps |
| `--text-sm` | 14px | 1.5 | Controls, secondary text |
| `--text-base` | 16px | 1.6 | Body |
| `--text-lg` | 20px | 1.4 | Section heading |
| `--text-xl` | 28px | 1.25 | Page heading |
| `--text-2xl` | 40px | 1.1 | Display |

Body copy stays under 80 characters per line.

## Space and shape

A 4px grid: `4 8 12 16 24 32 48 64`. Nothing lands between steps.

Radius is tiered, because using one value everywhere flattens the hierarchy it should be
expressing:

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Input, small control |
| `--radius-md` | 10px | Button, chip |
| `--radius-lg` | 16px | Panel, dialog, video tile |
| `--radius-full` | 9999px | Avatar, live dot, pill |

**Depth comes from surface steps and hairlines, not shadows.** A drop shadow is invisible
against a dark call UI, so the system would need two separate elevation languages. One
language that works in both is better: raise something by moving it up the surface scale
and giving it a border.

## Motion

Motion explains a change; it does not decorate. Durations are short — 150ms for a hover
or focus change, 200ms for something opening or closing — and nothing animates on page
load. Anything moving obeys `prefers-reduced-motion`, and a live indicator's pulse is the
one exception worth keeping, because its whole purpose is to be noticed.

## Quality floor

Non-negotiable, checked before any UI pull request:

- Text contrast at least 4.5:1, in both themes, including `--muted` on its own surface.
  Measured at the time of writing; the tightest pair is `--live` on `--surface` in light
  mode at 4.51:1, so darkening `--surface` or lightening `--live` needs re-checking
- A visible focus ring on every interactive element, never removed
- Touch targets at least 44×44px
- No colour-only meaning: a live indicator carries a label or an icon too
- Works at 375, 768, 1024 and 1440px with no horizontal scroll
- `prefers-reduced-motion` respected
- Verified in **both** Arabic RTL and English LTR

## What was rejected, and why

The design-intelligence search proposed an indigo `#6366F1` primary with a green accent
on a lavender ground, Outfit and Work Sans, and a marketing landing-page structure of
hero, metrics, how-it-works, CTA.

None of it survived contact with the brief. The indigo is the default SaaS accent — the
same value already removed from the wordmark for being arbitrary — and a decorative hue
would compete with the one colour that carries meaning here. Neither Outfit nor Work Sans
has any Arabic coverage, which disqualifies them outright for an Arabic-first product.
And the home screen is a launcher, not a marketing page; it has one action, not a
conversion funnel.

What the search contributed and what was kept: the accessibility priorities, the
pre-delivery checklist, the responsive breakpoints, and short subtle motion with
`prefers-reduced-motion` honoured.
