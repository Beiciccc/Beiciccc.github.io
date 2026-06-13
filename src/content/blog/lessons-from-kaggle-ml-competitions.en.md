---
title: "What Many Kaggle Competitions Taught Me About Doing ML Honestly"
description: "Reflections on reproducible experiment logs, baselines before cleverness, validation discipline, and learning across very different domains."
pubDate: 2026-06-08
lang: en
tags: ["kaggle", "machine-learning", "reproducibility", "reflection", "experiments"]
draft: false
---

# What Many Kaggle Competitions Taught Me About Doing ML Honestly

I keep a lot of competition repositories on GitHub, and most of them are not trophies. They are experiment logs: notes, score tables, leaderboard snapshots, and sanitized submission traces. Over time these have ranged across some genuinely unrelated worlds — bird audio in [BirdCLEF+ 2026](https://github.com/Beiciccc/birdclef-2026-experiments), abstract reasoning grids in the [ARC Prize](https://github.com/Beiciccc/arc-prize-2026-arc-agi-2-experiments), legal citation retrieval in [Swiss legal IR](https://github.com/Beiciccc/swiss-legal-ir-experiments), vehicle detection, F1 pit stops, stellar classification, even text-to-sign generation. Hopping between domains like this taught me less about any single field and more about how to *work*. A few lessons keep repeating.

## Write the log as if someone else will read it

The single most useful habit I picked up is treating each repo as a record, not a workspace. When I name a repo "experiments" or "experiment-log," I'm making a promise to my future self: every submission should be traceable back to the code and the configuration that produced it. The version of me three weeks later has forgotten *everything*. A score in a table is useless if I can't answer "what did I change to get this?"

This is unglamorous. But it is the difference between learning from a competition and merely participating in one.

## Baselines before cleverness

Almost every time I rushed to a complicated model first, I regretted it. The pattern that actually works:

- Get *something* end-to-end submitting on day one, however dumb.
- Establish a number you can beat.
- Only then add the clever part — and measure whether it actually helped.

A working baseline is also a debugging tool. When a fancy idea scores *worse* than the simple one, that gap is information, not failure. It usually means a leak, a broken split, or a mismatch between how I trained and how the competition scores.

## Validation discipline is the whole game

The leaderboard lies, or at least it's a small, noisy sample. The competitions where I felt most in control were the ones where I trusted my local validation more than the public score. The recurring failure mode is the opposite: tuning a threshold or a blend until the public leaderboard looks great, then watching it collapse on private data.

So now I'm stubborn about a few things — keep the validation split honest, be suspicious of any score that's "too good," and assume a leak until I've proven there isn't one. Different domains punish you differently for ignoring this, but they all punish you.

## Crossing domains is the actual education

Working on audio, images, tabular signals, and reasoning grids in close succession does something subtle: it strips away the domain-specific lore and leaves the transferable parts. Calibration, ranking metrics, careful cross-validation, reproducible inference — these show up everywhere, just wearing different clothes. A trick I learned tuning a tabular pipeline turned out to map cleanly onto a detection problem; a habit from a vision contest saved me on a text task.

None of this requires medals. The honest reward is a slowly compounding sense of judgment — knowing which idea is worth trying next, and being able to prove, later, exactly what I did. That's the part I actually keep.
