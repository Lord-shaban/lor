# Caption evaluation

Mixed Arabic/English speech is the hardest thing LOR. does, and it is easy to make it
worse while believing you improved it. This directory exists so that every change to
`apps/web/lib/stt/` is judged by numbers instead of by a hunch.

## What gets measured

| Metric | Meaning |
|---|---|
| **WER** | Word error rate over the whole utterance |
| **CER** | Character error rate — more forgiving of Arabic morphology |
| **Code-switch preservation** | Share of English words that stayed in Latin script rather than being transliterated into Arabic |

The third one is the metric that matters most here, and the one general benchmarks do
not report. A change that lowers WER while dropping code-switch preservation is a
regression, not an improvement.

That is not a hypothetical. Run the harness as it stands and the first two rows say it
outright: a hypothesis that writes every English word in Arabic script scores a **better
word error rate** than one that translated the sentence outright, and **0%**
preservation. Optimising for WER alone would drive this product towards precisely the
failure it exists to avoid.

Neither number is sufficient on its own either. The translating hypothesis in
`001-deploy-logs` keeps two English words in Latin and so scores 66.7% preservation,
while being a total failure — which WER catches at 100%. Both are reported for a
reason.

## Layout

```
eval/captions/
├── cases/          # one JSON per utterance: reference, and audio or hypotheses
├── audio/          # audio fixtures (gitignored; fetched separately)
├── metrics.ts      # normalisation, WER, CER, preservation — pure and tested
└── run.ts          # scores every engine against every case
```

A case is one JSON file:

```json
{
  "reference": "عملت الـ deploy على الـ server وشوفت الـ logs",
  "audio": "001.wav",
  "notes": "why this case is here"
}
```

`audio` is optional. A case without it can still carry `hypotheses` — outputs recorded
by hand, with a name saying where each came from. That is how a known model failure
stays in the suite permanently rather than as a paragraph in a README.

### What normalisation forgives

Each of these is a claim that two spellings mean the same thing to a reader, and each
has a test in `metrics.test.ts`:

- diacritics and tatweel, which carry no sound
- `أ إ آ ٱ` → `ا`, `ى` → `ي`, `ة` → `ه` — written inconsistently by everybody
- Arabic-Indic and Latin digits: `٣` is `3`
- `؟ ، ؛` and `? , ;`
- letter case, in the one script that has it

## Running

```bash
npm run eval:captions
```

To make it a gate rather than a report, give it a threshold — it exits non-zero when one
is crossed:

```bash
npm run eval:captions -- --max-wer=0.35 --min-code-switch=0.9
```

With no cases it says so and exits cleanly, so it is safe to run on a fresh clone.

## Contributing a case

Real failures are the most valuable thing you can contribute, and you do not need to
fix anything to help. Open a
[caption accuracy issue](https://github.com/Lord-shaban/lor/issues/new?template=captions_accuracy.yml)
with what was said and what the caption showed, and it becomes a case here.
