# Caption evaluation

Mixed Arabic/English speech is the hardest thing LOR. does, and it is easy to make it
worse while believing you improved it. This directory exists so that every change to
`apps/web/lib/stt/` is judged by numbers instead of by a hunch.

> Arrives with `v0.1.5`. The harness and the first cases land alongside the captions
> implementation.

## What gets measured

| Metric | Meaning |
|---|---|
| **WER** | Word error rate over the whole utterance |
| **CER** | Character error rate — more forgiving of Arabic morphology |
| **Code-switch preservation** | Share of English words that stayed in Latin script rather than being transliterated into Arabic |

The third one is the metric that matters most here, and the one general benchmarks do
not report. A change that lowers WER while dropping code-switch preservation is a
regression, not an improvement.

## Layout

```
eval/captions/
├── cases/          # one JSON per utterance: audio path + reference transcript
├── audio/          # audio fixtures (gitignored; fetched by the harness)
└── run.ts          # scores every engine against every case
```

## Running

```bash
npm run eval:captions
```

## Contributing a case

Real failures are the most valuable thing you can contribute, and you do not need to
fix anything to help. Open a
[caption accuracy issue](https://github.com/Lord-shaban/lor/issues/new?template=captions_accuracy.yml)
with what was said and what the caption showed, and it becomes a case here.
