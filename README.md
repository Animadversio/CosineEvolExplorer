# CosineEvolExplorer

Interactive, provenance-aware exploration of the Cosine Evolution dataset.

The site exposes all 309 registered thread-runs across 293 sessions. For the 272
scientifically eligible runs, it links the exact optimized objective to the
generation-wise neural population trajectory and fixed online target vector.

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
```

The exporter preserves explicit unavailable states. It does not silently mix
native objective scales, equate population-mean scores with mean per-image
scores, or substitute empirical repeat responses for the fixed online target.
