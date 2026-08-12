# CosineEvolExplorer

Interactive, provenance-aware exploration of the Cosine Evolution dataset.

The site exposes all 309 registered thread-runs across 293 sessions. For the 272
scientifically eligible runs, it links the exact optimized objective to the
generation-wise neural population trajectory and fixed online target vector. Each validated
generation also exposes five archived generated stimuli: the three highest exact objective
scores, the score-nearest median image, and the lowest score. The website assets are 256 px
WebP at quality 75; selection ranks and source/asset hashes remain in the published manifests.

## Local development

```bash
npm install
npm run dev
npm test
```

The versioned web bundle lives under `public/data/`. It is generated from the
analysis repository with:

```bash
python -m scripts.web.build_explorer_dataset \
  CosineEvolExplorer/public/data \
  --target-source-root /path/to/resolved/target/images \
  --target-asset-output CosineEvolExplorer/public/targets

python -m scripts.web.attach_generation_stimuli \
  CosineEvolExplorer/public/data \
  outputs/generation_stimuli_v1/generation_stimulus_selection.parquet \
  outputs/generation_stimuli_v1/full_q75/generation_stimulus_assets.parquet
```

The exporter preserves explicit unavailable states. It does not silently mix
native objective scales, equate population-mean scores with mean per-image
scores, or substitute empirical repeat responses for the fixed online target.
