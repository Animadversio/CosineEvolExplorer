"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThreadSummary = {
  key: string;
  ephysFN: string;
  threadId0: number;
  animal: string;
  date: string;
  objective: string;
  scoreFamily: string;
  area: string;
  generator: string;
  baselineMode: string | null;
  targetName: string;
  targetAsset: string | null;
  analysisReady: boolean;
  excluded: boolean;
  exclusionReason: string | null;
  q1bEligible: boolean;
  trajectorySuccess: boolean | null;
  trajectoryQ: number | null;
  selectedShape: string | null;
  nGenerations: number | null;
  populationAvailable: boolean;
  optimizerTargetCorrupted: boolean;
  detail: string;
};

type ExplorerIndex = {
  schemaVersion: string;
  title: string;
  summary: {
    sessions: number;
    threads: number;
    analysisReady: number;
    populationAvailable: number;
    trajectorySuccess: number;
    targetAssetsResolved: number;
  };
  threads: ThreadSummary[];
};

type TrajectoryPoint = {
  generation: number;
  block: number;
  nImages: number;
  scoreMean: number;
  scoreSem: number | null;
  fittedScore: number | null;
  linearScore: number | null;
  improvementEarlyImageSd: number | null;
  fractionToIdealCeiling: number | null;
  cosine: number | null;
  normRatio: number | null;
  normalizedDistance: number | null;
  projectionRatio: number | null;
  residualPc1: number | null;
};

type PopulationData = {
  availability: "available" | "unavailable";
  reason?: string | null;
  objectiveScoreSource?: string;
  objectiveScoreScientificallyValid?: boolean;
  optimizerTargetCorrupted?: boolean;
  optimizationValid?: boolean;
  populationActivitySource?: string;
  populationActivityCorrectlyAligned?: boolean;
  geometryFrame?: string;
  geometryExact?: boolean;
  units?: { index: number; channel: number; unitSlot: number; label: string }[];
  targetFrame?: (number | null)[];
  targetRawHz?: (number | null)[];
  referenceMeanRawHz?: (number | null)[];
  referenceStdRawHz?: (number | null)[];
  targetReferenceZ?: (number | null)[];
  meanFrame?: (number | null)[][];
  semFrame?: (number | null)[][];
  meanRawHz?: (number | null)[][];
  semRawHz?: (number | null)[][];
  meanReferenceZ?: (number | null)[][];
  semReferenceZ?: (number | null)[][];
  trajectory?: TrajectoryPoint[];
  scoreScaleEarlyImageSd?: number | null;
  objectiveIdealCeiling?: number | null;
  targetReference?: {
    score: number | null;
    cosine: number | null;
    normRatio: number | null;
    normalizedDistance: number | null;
  }[];
  referenceAvailable?: boolean;
  referenceSource?: Record<string, unknown>;
  validation?: Record<string, number>;
};

type GenerationStimulusSample = {
  role: "top" | "median" | "bottom";
  roleRank: number;
  scoreRank: number;
  objectiveScore: number;
  scoreSource?: string;
  scoreScientificallyValid?: boolean;
  withinGenerationPercentile: number;
  imageId: string;
  asset: string;
  assetBytes: number;
  assetSha256: string;
};

type GenerationStimulusGallery = {
  availability: "available" | "unavailable";
  reason?: string;
  scoreSource?: string;
  scoreScientificallyValid?: boolean;
  selectionPolicy?: { topK: number; description: string };
  generations?: {
    generation: number;
    block: number;
    nImages: number;
    samples: GenerationStimulusSample[];
  }[];
};

type ThreadDetail = {
  schemaVersion: string;
  key: string;
  metadata: {
    ephysFN: string;
    threadId0: number;
    nThreads: number;
    animal: string;
    date: string;
    objective: string;
    scoreFamily: string;
    area: string;
    generator: string;
    optimizer: string;
    baselineMode: string;
    responseWindowSeconds: [number, number];
    baselineWindowSeconds: [number, number];
    targetName: string;
    targetResponseTensor: string;
    targetAsset: string | null;
    targetAssetStatus: string;
    targetMatchBasis: string;
    targetSourceSession: string | null;
    imageSizeDegrees: number | null;
    imagePositionDegrees: [number, number];
    nObjectiveUnits: number | null;
    nCompleteGenerations: number | null;
    comments: string | null;
  };
  status: {
    analysisReady: boolean;
    excluded: boolean;
    exclusionReason: string | null;
    q1bEligible: boolean;
    q1bIneligibilityReason: string | null;
    endpointDifference: number | null;
    endpointPositive: boolean | null;
    trajectorySuccess: boolean | null;
    trajectoryQ: number | null;
    linearDetected: boolean | null;
    saturationDetected: boolean | null;
    selectedShape: string | null;
    selectedTau: number | null;
    q2Eligible: boolean;
    q2ReachedDelta0p2: boolean | null;
    q2StandardizedDeficit: number | null;
    optimizerTargetCorrupted?: boolean;
    objectiveScoreScientificallyValid?: boolean | null;
    populationActivityCorrectlyAligned?: boolean | null;
  };
  population: PopulationData;
  generationStimuli?: GenerationStimulusGallery;
};

const ANIMALS = ["All", "Alfa", "Beto", "Caos", "Diablito"];
const BEST_CASE = "Beto-02032022-005#thread000";
const GENERATION_COLORS = ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"];
const PUBLIC_BASE = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
type ActivityScale = "raw" | "reference_z" | "delta_g0";
type StimulusChoice = "top" | "median" | "bottom";

const ACTIVITY_SCALE_INFO = {
  raw: {
    button: "Raw Hz",
    title: "Raw baseline-adjusted Hz",
    formula: "r(g, unit)",
    description: "Literal evoked response after the validated baseline convention; preserves firing-rate magnitude.",
    yLabel: "baseline-adjusted response (Hz)",
  },
  reference_z: {
    button: "Selectivity z",
    title: "Selectivity/reference-image z-score",
    formula: "(r − μref) / σref",
    description: "Each unit is centered and scaled by its responses across the reference images in the selectivity experiment.",
    yLabel: "response relative to reference images (z)",
  },
  delta_g0: {
    button: "Change from g0",
    title: "Change from generation 0",
    formula: "(r(g) − r(g0)) / σref",
    description: "Shows the acquired activity change in reference-image SD units; generation 0 is exactly zero.",
    yLabel: "change from g0 (reference-image SD)",
  },
} as const;

type ActivityView = {
  target: (number | null)[];
  means: (number | null)[][];
  sems: (number | null)[][];
  targetLabel: string;
  generationLabel: string;
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** Live content-box width of an element, so a chart can re-lay-out instead of being scaled. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function number(value: number | null | undefined, digits = 2) {
  if (!finite(value)) return "—";
  const magnitude = Math.abs(value);
  if (magnitude > 999 || (magnitude > 0 && magnitude < 0.001)) return value.toExponential(2);
  return value.toFixed(digits);
}

function humanBaseline(value: string | null | undefined) {
  if (value === "blockwise") return "block-wise subtraction";
  if (value === "trialwise") return "trial-wise subtraction";
  if (value === "none") return "no subtraction";
  return value || "unresolved";
}

function downstreamAnalysisNote(
  status: ThreadDetail["status"],
  nCompleteGenerations: number | null,
) {
  if (status.optimizerTargetCorrupted) {
    return "Recorded multithread online score is corrupted. It is shown only as the historical signal seen by CMA-ES. Population panels use correctly thread-aligned recorded neural activity. This run remains excluded from Q1a/Q1b/Q2 inference.";
  }
  if (status.q1bEligible) return null;
  if (status.q1bIneligibilityReason === "fewer_than_8_generations") {
    const count = nCompleteGenerations == null ? "Fewer than 8" : `Only ${nCompleteGenerations}`;
    return `${count} complete generations were recorded; at least 8 are required. This session is shown descriptively but is not included in downstream Q1a/Q1b/Q2 inference.`;
  }
  const rawReason = status.exclusionReason || status.q1bIneligibilityReason;
  if (rawReason) {
    const reason = rawReason.replaceAll("_", " ");
    return `Not included in downstream inference: ${reason}.`;
  }
  return "Descriptive metadata are retained, but this session is not eligible for downstream inference.";
}

function generationColor(index: number, total: number) {
  if (total <= 1) return GENERATION_COLORS[3];
  const scaled = (index / (total - 1)) * (GENERATION_COLORS.length - 1);
  return GENERATION_COLORS[Math.min(GENERATION_COLORS.length - 1, Math.round(scaled))];
}

type HeatmapColorDomain = {
  low: number;
  midpoint: number;
  high: number;
  symmetric: boolean;
};

function quantile(sorted: number[], probability: number) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * probability)));
  return sorted[index];
}

function heatmapColorDomain(matrix: (number | null)[][], scale: ActivityScale): HeatmapColorDomain {
  const values = matrix.flat().filter(finite).sort((a, b) => a - b);
  if (scale === "raw") {
    let low = quantile(values, 0.02), high = quantile(values, 0.98);
    if (!finite(low) || !finite(high) || low === high) {
      low = values[0] ?? 0;
      high = values.at(-1) ?? 1;
    }
    if (low === high) high = low + 1;
    return { low, midpoint: (low + high) / 2, high, symmetric: false };
  }
  const magnitudes = values.map(Math.abs).sort((a, b) => a - b);
  const limit = quantile(magnitudes, 0.98) || 1;
  return { low: -limit, midpoint: 0, high: limit, symmetric: true };
}

function heatmapColor(value: number, domain: HeatmapColorDomain) {
  const denominator = value <= domain.midpoint
    ? domain.midpoint - domain.low
    : domain.high - domain.midpoint;
  const strength = Math.max(0, Math.min(1, Math.abs(value - domain.midpoint) / Math.max(denominator, 1e-12)));
  if (value >= domain.midpoint) {
    return `rgb(${Math.round(246 - strength * 34)},${Math.round(246 - strength * 167)},${Math.round(246 - strength * 142)})`;
  }
  return `rgb(${Math.round(246 - strength * 168)},${Math.round(246 - strength * 141)},${Math.round(246 - strength * 28)})`;
}

function publicUrl(path: string) {
  return path.startsWith("/") ? `${PUBLIC_BASE}${path}` : path;
}

function subtractVectors(values: (number | null)[], baseline: (number | null)[]) {
  return values.map((value, index) => finite(value) && finite(baseline[index]) ? value - baseline[index]! : null);
}

function activityView(population: PopulationData, scale: ActivityScale): ActivityView {
  if (scale === "raw") {
    return {
      target: population.targetRawHz || [],
      means: population.meanRawHz || [],
      sems: population.semRawHz || [],
      targetLabel: "fixed online target",
      generationLabel: "selected generation mean",
    };
  }
  const target = population.targetReferenceZ || [];
  const means = population.meanReferenceZ || [];
  const sems = population.semReferenceZ || [];
  if (scale === "reference_z") {
    return { target, means, sems, targetLabel: "fixed online target", generationLabel: "selected generation mean" };
  }
  const baseline = means[0] || [];
  const deltaSem = sems.map((row, generationIndex) => row.map((value, unitIndex) => {
    if (!finite(value) || !finite(baseline[unitIndex])) return null;
    if (generationIndex === 0) return 0;
    const baselineSem = sems[0]?.[unitIndex];
    return finite(baselineSem) ? Math.hypot(value, baselineSem) : value;
  }));
  return {
    target: subtractVectors(target, baseline),
    means: means.map((row) => subtractVectors(row, baseline)),
    sems: deltaSem,
    targetLabel: "target change from g0",
    generationLabel: "selected change from g0",
  };
}

export default function Explorer() {
  const [index, setIndex] = useState<ExplorerIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [selectedKey, setSelectedKey] = useState(BEST_CASE);
  const [selectedGeneration, setSelectedGeneration] = useState(0);
  const [search, setSearch] = useState("");
  const [animal, setAnimal] = useState("All");
  const [family, setFamily] = useState("All objectives");
  const [statusFilter, setStatusFilter] = useState("All runs");

  useEffect(() => {
    fetch(publicUrl("/data/index.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`index request failed (${response.status})`);
        return response.json();
      })
      .then((payload: ExplorerIndex) => {
        setIndex(payload);
        const requested = new URLSearchParams(window.location.search).get("thread");
        if (requested && payload.threads.some((row) => row.key === requested)) {
          setSelectedKey(requested);
        } else if (!payload.threads.some((row) => row.key === BEST_CASE)) {
          setSelectedKey(payload.threads[0]?.key || "");
        }
      })
      .catch((error) => setIndexError(String(error)));
  }, []);

  const selectedSummary = useMemo(
    () => index?.threads.find((row) => row.key === selectedKey) || null,
    [index, selectedKey],
  );

  useEffect(() => {
    if (!selectedSummary) return;
    let alive = true;
    fetch(publicUrl(selectedSummary.detail))
      .then((response) => {
        if (!response.ok) throw new Error(`thread request failed (${response.status})`);
        return response.json();
      })
      .then((payload: ThreadDetail) => {
        if (!alive) return;
        setDetail(payload);
        setSelectedGeneration(0);
        const url = new URL(window.location.href);
        url.searchParams.set("thread", payload.key);
        window.history.replaceState(null, "", url);
      })
      .catch(() => alive && setDetail(null));
    return () => { alive = false; };
  }, [selectedSummary]);

  const families = useMemo(() => {
    const values = [...new Set(index?.threads.map((row) => row.scoreFamily) || [])].sort();
    return ["All objectives", ...values];
  }, [index]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (index?.threads || []).filter((row) => {
      if (animal !== "All" && row.animal !== animal) return false;
      if (family !== "All objectives" && row.scoreFamily !== family) return false;
      if (statusFilter === "Detected" && row.trajectorySuccess !== true) return false;
      if (statusFilter === "Not detected" && row.trajectorySuccess !== false) return false;
      if (statusFilter === "Unavailable" && row.populationAvailable) return false;
      if (query && !`${row.key} ${row.targetName} ${row.objective} ${row.area}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [index, animal, family, statusFilter, search]);

  const selectThread = useCallback((key: string) => {
    setSelectedKey(key);
    if (window.innerWidth < 980) document.getElementById("thread-detail")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!detail?.population.trajectory?.length || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft") setSelectedGeneration((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setSelectedGeneration((value) => Math.min(detail.population.trajectory!.length - 1, value + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  if (indexError) return <div className="fatal">Could not load the explorer data. {indexError}</div>;
  if (!index) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div className="brand-copy">
          <h1>Cosine Evolution</h1>
          <p>Population control dataset explorer</p>
        </div>
        <div className="topbar-stats" aria-label="Dataset summary">
          <span><strong>{index.summary.sessions}</strong> sessions</span>
          <span><strong>{index.summary.threads}</strong> thread-runs</span>
          <span><strong>4</strong> animals</span>
          <span><strong>{index.summary.populationAvailable}</strong> vector trajectories</span>
        </div>
      </header>

      <section className="intro-strip">
        <div>
          <p className="eyebrow">Closed-loop neural population optimization</p>
          <h2>Did evolution move the measured response toward its target?</h2>
        </div>
        <p>
          Explore each experiment from its exact task metadata and target image through the
          optimized objective and the channel-by-channel population trajectory.
        </p>
      </section>

      <main className="workspace">
        <aside className="browser" aria-label="Experiment browser">
          <div className="browser-head">
            <div>
              <p className="eyebrow">Experiment browser</p>
              <h3>{filteredThreads.length} of {index.summary.threads} threads</h3>
            </div>
            <button className="reset-button" onClick={() => { setSearch(""); setAnimal("All"); setFamily("All objectives"); setStatusFilter("All runs"); }}>Reset</button>
          </div>
          <label className="search-box">
            <span className="sr-only">Search experiments</span>
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Session, target, objective…" />
          </label>
          <div className="filter-group">
            <span className="filter-label">Animal</span>
            <div className="pill-row">
              {ANIMALS.map((value) => <button key={value} className={animal === value ? "pill active" : "pill"} onClick={() => setAnimal(value)}>{value}</button>)}
            </div>
          </div>
          <div className="filter-grid">
            <label>
              <span className="filter-label">Objective</span>
              <select value={family} onChange={(event) => setFamily(event.target.value)}>
                {families.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span className="filter-label">Trajectory call</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {['All runs', 'Detected', 'Not detected', 'Unavailable'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="thread-list">
            {filteredThreads.map((row) => (
              <ThreadCard key={row.key} row={row} selected={row.key === selectedKey} onSelect={selectThread} />
            ))}
            {!filteredThreads.length && <div className="empty-list">No experiments match these filters.</div>}
          </div>
        </aside>

        <section id="thread-detail" className="detail-column">
          {!detail || detail.key !== selectedKey ? <DetailSkeleton /> : (
            <ThreadView key={detail.key} detail={detail} selectedGeneration={selectedGeneration} setSelectedGeneration={setSelectedGeneration} />
          )}
        </section>
      </main>

      <footer>
        <span>Cosine Evolution Dataset Explorer</span>
        <span>Exact objectives · explicit baselines · provenance-linked caches</span>
      </footer>
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen" role="status"><div className="brand-mark large"><span /><span /><span /></div><p>Loading 309 experiment records…</p></div>;
}

function DetailSkeleton() {
  return <div className="detail-skeleton" aria-label="Loading selected experiment"><div /><div /><div /></div>;
}

function ThreadCard({ row, selected, onSelect }: { row: ThreadSummary; selected: boolean; onSelect: (key: string) => void }) {
  const callClass = row.optimizerTargetCorrupted
    ? "warning"
    : row.trajectorySuccess === true ? "success" : row.trajectorySuccess === false ? "neutral" : "missing";
  const callTitle = row.optimizerTargetCorrupted
    ? "descriptive population available; recorded online score is corrupted"
    : row.trajectorySuccess === true ? "trajectory detected" : row.trajectorySuccess === false ? "not detected" : "not eligible for downstream analysis";
  return (
    <button className={selected ? "thread-card selected" : "thread-card"} onClick={() => onSelect(row.key)} aria-pressed={selected}>
      <TargetThumb src={row.targetAsset} name={row.targetName} />
      <span className="thread-card-copy">
        <span className="thread-id">{row.ephysFN}{row.threadId0 ? ` · T${row.threadId0}` : ""}</span>
        <span className="thread-target">{row.targetName}</span>
        <span className="thread-meta">{row.objective} · {row.generator} · {row.nGenerations == null ? "— gen" : `${row.nGenerations} complete gen`}</span>
      </span>
      <span className={`call-dot ${callClass}`} title={callTitle} />
    </button>
  );
}

function TargetThumb({ src, name, large = false }: { src: string | null; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img className={large ? "target-image" : "target-thumb"} src={publicUrl(src)} alt={`Target image: ${name}`} loading={large ? "eager" : "lazy"} onError={() => setFailed(true)} />;
  return <span className={large ? "target-placeholder large" : "target-placeholder"} aria-label={`Target image unavailable: ${name}`}><span>{name.slice(0, 2).toUpperCase()}</span></span>;
}

function ThreadView({ detail, selectedGeneration, setSelectedGeneration }: { detail: ThreadDetail; selectedGeneration: number; setSelectedGeneration: (value: number) => void }) {
  const { metadata: meta, status, population } = detail;
  const [activityScale, setActivityScale] = useState<ActivityScale>("reference_z");
  const [stimulusChoice, setStimulusChoice] = useState<StimulusChoice>("top");
  const [topRank, setTopRank] = useState(1);
  const trajectory = population.trajectory || [];
  const corruptOnlineScore = Boolean(status.optimizerTargetCorrupted || population.optimizerTargetCorrupted);
  const selected = trajectory[selectedGeneration] || null;
  const nCompleteGenerations = meta.nCompleteGenerations ?? (trajectory.length || null);
  const analysisNote = downstreamAnalysisNote(status, nCompleteGenerations);
  const stimulusGeneration = detail.generationStimuli?.generations?.find(
    (row) => row.generation === selected?.generation,
  );
  const selectedStimulus = stimulusGeneration?.samples.find(
    (row) => row.role === stimulusChoice && (row.role !== "top" || row.roleRank === topRank),
  ) || null;
  useEffect(() => {
    const galleries = detail.generationStimuli?.generations;
    if (!galleries?.length) return;
    for (const index of [selectedGeneration - 1, selectedGeneration + 1]) {
      const row = galleries[index];
      const sample = row?.samples.find(
        (item) => item.role === stimulusChoice && (item.role !== "top" || item.roleRank === topRank),
      );
      if (sample) new Image().src = publicUrl(sample.asset);
    }
  }, [detail.generationStimuli, selectedGeneration, stimulusChoice, topRank]);
  return (
    <>
      <div className="thread-heading">
        <div>
          <div className="breadcrumb"><span>{meta.animal}</span><span>/</span><span>{meta.date}</span><span>/</span><span>thread {String(meta.threadId0).padStart(3, "0")}</span></div>
          <h2>{meta.ephysFN}</h2>
          <p>{meta.objective} · {meta.nObjectiveUnits ?? "—"} objective-relevant units · {nCompleteGenerations ?? "—"} complete generations</p>
          {analysisNote && (
            <p className={corruptOnlineScore ? "analysis-note critical-warning" : "analysis-note"}>
              {corruptOnlineScore && <strong>WARNING</strong>}
              <span>{analysisNote}</span>
            </p>
          )}
        </div>
        <div className="status-cluster">
          {corruptOnlineScore ? (
            <span className="status-badge warning"><i />online score corrupted</span>
          ) : (
            <StatusBadge success={status.trajectorySuccess} label={status.trajectorySuccess ? "trajectory detected" : status.q1bEligible ? "not detected" : "not eligible"} />
          )}
          <span className="method-badge">{corruptOnlineScore ? "descriptive only" : status.selectedShape || "no fit"}</span>
        </div>
      </div>

      {population.availability === "available" && selected && (
        <div className="generation-control">
          <button onClick={() => setSelectedGeneration(Math.max(0, selectedGeneration - 1))} disabled={selectedGeneration === 0} aria-label="Previous generation">←</button>
          <div><span>Selected generation</span><strong>g{selected.generation}</strong><em>{selected.nImages} images · {corruptOnlineScore ? "online signal" : "score"} {number(selected.scoreMean, 3)}{corruptOnlineScore ? " (corrupted)" : ""}</em></div>
          <input aria-label="Selected generation" type="range" min={0} max={trajectory.length - 1} value={selectedGeneration} onChange={(event) => setSelectedGeneration(Number(event.target.value))} />
          <button onClick={() => setSelectedGeneration(Math.min(trajectory.length - 1, selectedGeneration + 1))} disabled={selectedGeneration === trajectory.length - 1} aria-label="Next generation">→</button>
        </div>
      )}

      <div className="hero-grid">
        <div className="stimulus-pair">
          <section className="card target-card">
            <div className="card-label">Fixed target image</div>
            <TargetThumb src={meta.targetAsset} name={meta.targetName} large />
            <div className="target-name"><strong>{meta.targetName}</strong><span>{meta.targetAsset ? "Exact archived stimulus" : meta.targetAssetStatus}</span></div>
            <dl className="meta-list">
              <MetaRow label="Objective" value={meta.objective} />
              <MetaRow label="Area" value={meta.area} />
              <MetaRow label="Generator" value={meta.generator} />
              <MetaRow label="Baseline" value={humanBaseline(meta.baselineMode)} />
              <MetaRow label="Evoked window" value={`${meta.responseWindowSeconds[0] * 1000}–${meta.responseWindowSeconds[1] * 1000} ms`} />
              <MetaRow label="Image aperture" value={finite(meta.imageSizeDegrees) ? `${meta.imageSizeDegrees}°` : "—"} />
              <MetaRow label="Reference session" value={meta.targetSourceSession || "not image-resolved"} />
            </dl>
          </section>

          <GeneratedStimulusCard
            gallery={detail.generationStimuli}
            generation={stimulusGeneration}
            sample={selectedStimulus}
            choice={stimulusChoice}
            topRank={topRank}
            onChoice={setStimulusChoice}
            onTopRank={setTopRank}
          />
        </div>

        <section className="card objective-card">
          <div className="card-title-row"><div><div className="panel-letter">A</div><div><h3>{corruptOnlineScore ? "Recorded online optimizer signal" : "Optimized objective"}</h3><p>{corruptOnlineScore ? "What CMA-ES saw; corrupted and not a valid per-thread scientific objective" : "Exact per-image score, summarized by generation"}</p></div></div>{corruptOnlineScore ? <span className="status-badge warning compact"><i />not scientifically valid</span> : <StatusBadge success={status.trajectorySuccess} label={`composite q ${number(status.trajectoryQ, 3)}`} compact />}</div>
          {population.availability === "available" ? (
            <ObjectiveChart population={population} selected={selectedGeneration} onSelect={setSelectedGeneration} />
          ) : <Unavailable reason={population.reason} />}
        </section>
      </div>

      {population.availability === "available" && selected && (
        <ActivityScaleControl value={activityScale} onChange={setActivityScale} />
      )}

      {population.availability === "available" ? (
        <>
          <section className="card profile-card">
            <PanelTitle letter="E" title={`Activity profile at g${selected?.generation ?? 0}`} subtitle={`${corruptOnlineScore ? "Correctly thread-aligned recorded neural activity" : "Generation mean compared with target"} · ${ACTIVITY_SCALE_INFO[activityScale].title}`} />
            <ProfileChart population={population} scale={activityScale} selected={selectedGeneration} />
          </section>
          <section className="card heatmap-card">
            <PanelTitle letter="B" title="Population activity" subtitle={`${corruptOnlineScore ? "Correctly thread-aligned recorded neural activity" : "Fixed target and generation means"} · ${ACTIVITY_SCALE_INFO[activityScale].title}`} />
            <PopulationHeatmap population={population} scale={activityScale} selected={selectedGeneration} onSelect={setSelectedGeneration} />
          </section>
          <div className="two-column-grid lower-grid">
            <section className="card geometry-card">
              <PanelTitle letter="C" title="Distance to target" subtitle="Pattern alignment, gain, and residual error" />
              <GeometryTraces trajectory={trajectory} selected={selectedGeneration} onSelect={setSelectedGeneration} />
            </section>
            <section className="card path-card">
              <PanelTitle letter="D" title="Population-vector path" subtitle="Target projection × dominant residual axis" />
              <VectorPath trajectory={trajectory} selected={selectedGeneration} onSelect={setSelectedGeneration} />
            </section>
          </div>
        </>
      ) : (
        <section className="card unavailable-card"><PanelTitle letter="B–E" title="Population trajectory unavailable" subtitle="The run remains in the registry" /><Unavailable reason={population.reason || status.q1bIneligibilityReason} /></section>
      )}

      <section className="card provenance-card">
        <div><p className="eyebrow">Interpretation guardrails</p><h3>What these panels mean</h3></div>
        <div className="guardrail-grid">
          <p><strong>Black points</strong> {corruptOnlineScore ? "are means of the recorded online optimizer signal. That multithread signal is corrupted and is not a valid per-thread scientific objective." : "are means of exact per-image objective scores. They are not the score of the generation-mean vector."}</p>
          {corruptOnlineScore && <p><strong>Generated images</strong> are ranked by that same recorded online signal, documenting the images CMA-ES treated as best, typical, and lowest—not their true scientific rank.</p>}
          <p><strong>Fixed target</strong> is the population vector used online. Empirical repeat trials, when present, are a separate reference.</p>
          <p><strong>Population frame</strong> uses {corruptOnlineScore ? "actual recorded neural activity correctly aligned to this thread" : population.geometryExact ? "the exact objective operand frame" : "a descriptive common frame"}; baseline handling is {humanBaseline(meta.baselineMode)}.</p>
        </div>
        {meta.comments && <details><summary>Operator notes from the experimental registry</summary><p>{meta.comments}</p></details>}
      </section>
    </>
  );
}

function GeneratedStimulusCard({ gallery, generation, sample, choice, topRank, onChoice, onTopRank }: {
  gallery?: GenerationStimulusGallery;
  generation?: NonNullable<GenerationStimulusGallery["generations"]>[number];
  sample: GenerationStimulusSample | null;
  choice: StimulusChoice;
  topRank: number;
  onChoice: (choice: StimulusChoice) => void;
  onTopRank: (rank: number) => void;
}) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const available = gallery?.availability === "available" && generation && sample;
  const corruptOnlineScore = gallery?.scoreScientificallyValid === false || sample?.scoreScientificallyValid === false;
  const roleLabel = choice === "top" ? `Best ${topRank} of 3` : choice === "median" ? "Typical" : "Lowest";
  return (
    <section className="card stimulus-card">
      <div className="card-label">Generated image {generation ? `· g${generation.generation}` : ""}</div>
      {available && failedAsset !== sample.asset ? (
        <img
          key={sample.asset}
          className="generated-image"
          src={publicUrl(sample.asset)}
          alt={`${roleLabel} generated stimulus from generation ${generation.generation}`}
          loading="eager"
          onError={() => setFailedAsset(sample.asset)}
        />
      ) : (
        <div className="generated-placeholder"><span>{gallery?.availability === "unavailable" ? "∅" : "…"}</span></div>
      )}
      <div className="stimulus-choice" role="group" aria-label="Representative image selection">
        {(["top", "median", "bottom"] as StimulusChoice[]).map((item) => (
          <button key={item} className={choice === item ? "active" : ""} onClick={() => onChoice(item)} disabled={gallery?.availability !== "available"}>
            {item === "top" ? "Best" : item === "median" ? "Typical" : "Lowest"}
          </button>
        ))}
      </div>
      {choice === "top" && (
        <div className="top-rank-control" aria-label="Choose one of the top three images">
          <span>Top image</span>
          {[1, 2, 3].map((rank) => <button key={rank} className={rank === topRank ? "active" : ""} onClick={() => onTopRank(rank)}>{rank}</button>)}
        </div>
      )}
      {available ? (
        <div className="stimulus-caption">
          <div><strong>{roleLabel}</strong><span>rank {sample.scoreRank} of {generation.nImages}</span></div>
          <div><span>{corruptOnlineScore ? "Online signal (corrupted)" : "Exact score"}</span><strong>{number(sample.objectiveScore, 3)}</strong></div>
          <div><span>Within generation</span><strong>{number(sample.withinGenerationPercentile, 0)}th percentile</strong></div>
        </div>
      ) : (
        <p className="stimulus-unavailable">{gallery?.reason || "Representative generated images have not been attached to this data bundle."}</p>
      )}
      {corruptOnlineScore && <p className="stimulus-warning">Image rank records what CMA-ES saw online; it is not a valid scientific per-thread ranking.</p>}
    </section>
  );
}

function StatusBadge({ success, label, compact = false }: { success: boolean | null; label: string; compact?: boolean }) {
  return <span className={`status-badge ${success === true ? "success" : success === false ? "neutral" : "missing"} ${compact ? "compact" : ""}`}><i />{label}</span>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function PanelTitle({ letter, title, subtitle }: { letter: string; title: string; subtitle: string }) {
  return <div className="panel-title"><div className="panel-letter">{letter}</div><div><h3>{title}</h3><p>{subtitle}</p></div></div>;
}

function Unavailable({ reason }: { reason?: string | null }) {
  return <div className="unavailable"><span>∅</span><div><strong>No validated data for this panel</strong><p>{reason || "This run was not eligible for the current scientific cache."}</p></div></div>;
}

function ActivityScaleControl({ value, onChange }: { value: ActivityScale; onChange: (value: ActivityScale) => void }) {
  const info = ACTIVITY_SCALE_INFO[value];
  return (
    <section className="activity-scale-control" aria-label="Population activity normalization">
      <div className="activity-scale-heading"><span>Activity scale</span><strong>{info.title}</strong></div>
      <div className="activity-scale-buttons" role="group" aria-label="Choose activity scale">
        {(Object.keys(ACTIVITY_SCALE_INFO) as ActivityScale[]).map((scale) => (
          <button key={scale} className={value === scale ? "active" : ""} aria-pressed={value === scale} onClick={() => onChange(scale)}>{ACTIVITY_SCALE_INFO[scale].button}</button>
        ))}
      </div>
      <div className="activity-scale-explanation"><code>{info.formula}</code><span>{info.description}</span></div>
    </section>
  );
}

function ObjectiveChart({ population, selected, onSelect }: { population: PopulationData; selected: number; onSelect: (value: number) => void }) {
  const [mode, setMode] = useState<"native" | "standardized" | "ceiling">("native");
  const trajectory = population.trajectory || [];
  const modes = [
    { id: "native" as const, label: "Native score", available: true },
    { id: "standardized" as const, label: "From g0 (early image SD)", available: finite(population.scoreScaleEarlyImageSd) },
    { id: "ceiling" as const, label: "Fraction to ideal", available: trajectory.some((row) => finite(row.fractionToIdealCeiling)) },
  ];
  // The chart re-lays-out at 1:1 CSS pixels rather than being uniformly scaled: narrowing the
  // panel compresses the generation axis while label and marker sizes stay legible. Height is
  // damped against width so the aspect ratio changes instead of the whole figure shrinking.
  const [wrapRef, measuredWidth] = useElementWidth<HTMLDivElement>();
  const width = Math.max(340, Math.round(measuredWidth) || 820);
  const height = Math.round(Math.min(330, Math.max(248, width * 0.38)));
  const left = 60, right = 16, top = 20, bottom = 50;
  const values = trajectory.map((point) => mode === "native" ? point.scoreMean : mode === "standardized" ? point.improvementEarlyImageSd : point.fractionToIdealCeiling);
  const sems = trajectory.map((point) => mode === "native" ? point.scoreSem : mode === "standardized" && finite(point.scoreSem) && finite(population.scoreScaleEarlyImageSd) ? point.scoreSem / population.scoreScaleEarlyImageSd : null);
  const fitted = trajectory.map((point) => mode === "native" ? point.fittedScore : mode === "standardized" && finite(point.fittedScore) && finite(population.scoreScaleEarlyImageSd) ? (point.fittedScore - trajectory[0].scoreMean) / population.scoreScaleEarlyImageSd : mode === "ceiling" ? null : null);
  const linear = trajectory.map((point) => mode === "native" ? point.linearScore : mode === "standardized" && finite(point.linearScore) && finite(population.scoreScaleEarlyImageSd) ? (point.linearScore - trajectory[0].scoreMean) / population.scoreScaleEarlyImageSd : null);
  const rangeValues = [...values, ...values.map((value, index) => finite(value) && finite(sems[index]) ? value + sems[index]! : null), ...values.map((value, index) => finite(value) && finite(sems[index]) ? value - sems[index]! : null), ...fitted, ...linear].filter(finite);
  let yMin = Math.min(...rangeValues), yMax = Math.max(...rangeValues);
  if (!Number.isFinite(yMin) || yMin === yMax) { yMin = -1; yMax = 1; }
  const pad = (yMax - yMin) * 0.12;
  yMin -= pad; yMax += pad;
  const maxGen = Math.max(...trajectory.map((point) => point.generation), 1);
  const x = (generation: number) => left + (generation / maxGen) * (width - left - right);
  const y = (value: number) => top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
  const path = (series: (number | null)[]) => series.map((value, index) => finite(value) ? `${index ? "L" : "M"}${x(trajectory[index].generation).toFixed(1)},${y(value).toFixed(1)}` : "").join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + (index / 4) * (yMax - yMin));
  const xTickCount = Math.max(3, Math.min(6, Math.floor(width / 130)));
  const xTicks = [...new Set(Array.from({ length: xTickCount },
    (_, index) => Math.round((index / (xTickCount - 1)) * maxGen)))];
  const yLabel = mode === "native"
    ? population.optimizerTargetCorrupted ? "recorded online signal (corrupted)" : "exact objective score"
    : mode === "standardized" ? "improvement / early image SD" : "fraction from g0 to ideal";
  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div className="segmented-control" aria-label="Objective scale">{modes.map((item) => <button key={item.id} disabled={!item.available} className={mode === item.id ? "active" : ""} onClick={() => item.available && setMode(item.id)}>{item.label}</button>)}</div>
      <svg className="objective-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Objective trajectory in ${yLabel}`}>
        {yTicks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="gridline" /><text x={left - 10} y={y(tick) + 4} textAnchor="end" className="axis-label">{number(tick, 2)}</text></g>)}
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} className="axis" />
        <line x1={left} x2={left} y1={top} y2={height - bottom} className="axis" />
        {fitted.some(finite) && <path d={path(fitted)} className="fit-line" />}
        {linear.some(finite) && <path d={path(linear)} className="linear-line" />}
        {trajectory.map((point, index) => finite(values[index]) && <g key={point.generation} className="data-point" onClick={() => onSelect(index)} tabIndex={0} role="button" aria-label={`Generation ${point.generation}, score ${number(values[index], 3)}`} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onSelect(index)}>
          {finite(sems[index]) && <line x1={x(point.generation)} x2={x(point.generation)} y1={y(values[index]! - sems[index]!)} y2={y(values[index]! + sems[index]!)} className="errorbar" />}
          <circle cx={x(point.generation)} cy={y(values[index]!)} r={index === selected ? 6.5 : 3.7} className={index === selected ? "raw-point selected" : "raw-point"} />
        </g>)}
        {xTicks.map((tick) => <text key={tick} x={x(tick)} y={height - bottom + 22} textAnchor="middle" className="axis-label">{tick}</text>)}
        <text x={(left + width - right) / 2} y={height - 8} textAnchor="middle" className="axis-title">CMA-ES generation</text>
        <text transform={`translate(15 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{yLabel}</text>
      </svg>
      <div className="chart-legend"><span><i className="dot black" />generation mean ± SEM</span>{fitted.some(finite) && <span><i className="line indigo" />selected saturation fit</span>}{linear.some(finite) && <span><i className="line amber" />canonical linear fit</span>}</div>
    </div>
  );
}

function PopulationHeatmap({ population, scale, selected, onSelect }: { population: PopulationData; scale: ActivityScale; selected: number; onSelect: (value: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const view = useMemo(() => activityView(population, scale), [population, scale]);
  const matrix = useMemo(() => [view.target, ...view.means], [view]);
  const scaleInfo = ACTIVITY_SCALE_INFO[scale];
  const colorDomain = useMemo(() => heatmapColorDomain(matrix, scale), [matrix, scale]);
  const rows = population.units?.length || 0, cols = matrix.length;
  const height = Math.max(220, Math.min(430, rows * 10));
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows || !cols) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    const cellWidth = rect.width / cols, cellHeight = height / rows;
    matrix.forEach((column, col) => column.forEach((value, row) => {
      if (!finite(value)) {
        context.fillStyle = "#273138";
        context.fillRect(col * cellWidth, row * cellHeight, Math.ceil(cellWidth) + 0.5, Math.ceil(cellHeight) + 0.5);
        return;
      }
      context.fillStyle = heatmapColor(value, colorDomain);
      context.fillRect(col * cellWidth, row * cellHeight, Math.ceil(cellWidth) + 0.5, Math.ceil(cellHeight) + 0.5);
    }));
    context.strokeStyle = "#08131c";
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(cellWidth, 0); context.lineTo(cellWidth, height); context.stroke();
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.lineWidth = 2;
    context.strokeRect((selected + 1) * cellWidth + 1, 1, Math.max(1, cellWidth - 2), height - 2);
  }, [matrix, rows, cols, height, colorDomain, selected]);
  useEffect(() => { draw(); window.addEventListener("resize", draw); return () => window.removeEventListener("resize", draw); }, [draw]);
  const locate = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { col: Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols))), row: Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows))) };
  };
  const hoverValue = hover ? matrix[hover.col]?.[hover.row] : null;
  const hoverUnit = hover ? population.units?.[hover.row] : null;
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-labels"><span>{scale === "delta_g0" ? "target − g0" : "fixed target"}</span><span>{scale === "delta_g0" ? "generation change from g0 →" : "generation means →"}</span></div>
      <canvas ref={canvasRef} style={{ height }} onMouseMove={(event) => setHover(locate(event.clientX, event.clientY))} onMouseLeave={() => setHover(null)} onClick={(event) => { const point = locate(event.clientX, event.clientY); if (point.col > 0) onSelect(point.col - 1); }} aria-label={`${scaleInfo.title} population heatmap with ${rows} units and ${cols - 1} generations`} role="img" />
      <div className="heatmap-footer"><div className="color-key"><span>{number(colorDomain.low, 1)}</span><i /><span>{number(colorDomain.midpoint, 1)}</span><b /><span>{number(colorDomain.high, 1)}</span><em title="Reference SD unavailable">n/a</em></div><div className="heatmap-readout">{hover && hoverUnit ? `${hoverUnit.label} · ${hover.col === 0 ? "target" : `g${hover.col - 1}`} · ${number(hoverValue, 3)}` : `${scaleInfo.yLabel} · ${colorDomain.symmetric ? "zero-centered symmetric 98% color range" : "2–98% activation range; white = range midpoint"}`}</div></div>
    </div>
  );
}

function GeometryTraces({ trajectory, selected, onSelect }: { trajectory: TrajectoryPoint[]; selected: number; onSelect: (value: number) => void }) {
  const traces = [
    { key: "cosine" as const, label: "pattern cosine", target: 1, color: "#28b7a2" },
    { key: "normRatio" as const, label: "norm / target norm", target: 1, color: "#f2a65a" },
    { key: "normalizedDistance" as const, label: "normalized distance", target: 0, color: "#d97b93" },
    { key: "projectionRatio" as const, label: "target projection", target: 1, color: "#8fa8ff" },
  ];
  return <div className="mini-trace-grid">{traces.map((trace) => <MiniTrace key={trace.key} trajectory={trajectory} field={trace.key} label={trace.label} target={trace.target} color={trace.color} selected={selected} onSelect={onSelect} />)}</div>;
}

function MiniTrace({ trajectory, field, label, target, color, selected, onSelect }: { trajectory: TrajectoryPoint[]; field: "cosine" | "normRatio" | "normalizedDistance" | "projectionRatio"; label: string; target: number; color: string; selected: number; onSelect: (value: number) => void }) {
  const width = 340, height = 142, pad = 24;
  const values = trajectory.map((row) => row[field]);
  const valid = [...values.filter(finite), target];
  let min = Math.min(...valid), max = Math.max(...valid);
  const extra = Math.max((max - min) * .12, .05); min -= extra; max += extra;
  const x = (index: number) => pad + index / Math.max(1, trajectory.length - 1) * (width - pad * 2);
  const y = (value: number) => pad + (max - value) / (max - min) * (height - pad * 2);
  const d = values.map((value, index) => finite(value) ? `${index ? "L" : "M"}${x(index)},${y(value)}` : "").join(" ");
  return <div className="mini-trace"><div><span>{label}</span><strong>{number(values[selected], 2)}</strong></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} over generations`}><line x1={pad} x2={width - pad} y1={y(target)} y2={y(target)} className="target-line" /><path d={d} fill="none" stroke={color} strokeWidth="3" />{values.map((value, index) => finite(value) && <circle key={index} cx={x(index)} cy={y(value)} r={index === selected ? 5 : 2.2} fill={index === selected ? "#fff" : color} stroke={color} strokeWidth={index === selected ? 2 : 0} onClick={() => onSelect(index)} />)}</svg></div>;
}

function VectorPath({ trajectory, selected, onSelect }: { trajectory: TrajectoryPoint[]; selected: number; onSelect: (value: number) => void }) {
  const width = 600, height = 350, left = 58, right = 22, top = 22, bottom = 52;
  const xs = trajectory.map((row) => row.projectionRatio).filter(finite), ys = trajectory.map((row) => row.residualPc1).filter(finite);
  let xMin = Math.min(...xs, 1), xMax = Math.max(...xs, 1), yMin = Math.min(...ys, 0), yMax = Math.max(...ys, 0);
  const xp = Math.max((xMax - xMin) * .12, .08), yp = Math.max((yMax - yMin) * .12, .08); xMin -= xp; xMax += xp; yMin -= yp; yMax += yp;
  const x = (value: number) => left + (value - xMin) / (xMax - xMin) * (width - left - right);
  const y = (value: number) => top + (yMax - value) / (yMax - yMin) * (height - top - bottom);
  const path = trajectory.map((row, index) => finite(row.projectionRatio) && finite(row.residualPc1) ? `${index ? "L" : "M"}${x(row.projectionRatio)},${y(row.residualPc1)}` : "").join(" ");
  return <div className="path-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Population vector path toward target"><line x1={x(1)} x2={x(1)} y1={top} y2={height - bottom} className="target-line" /><line x1={left} x2={width - right} y1={y(0)} y2={y(0)} className="target-line" /><path d={path} className="path-line" />{trajectory.map((row, index) => finite(row.projectionRatio) && finite(row.residualPc1) && <circle key={index} cx={x(row.projectionRatio)} cy={y(row.residualPc1)} r={index === selected ? 7 : 4} fill={generationColor(index, trajectory.length)} className={index === selected ? "path-point selected" : "path-point"} onClick={() => onSelect(index)}><title>{`g${row.generation}: projection ${number(row.projectionRatio)}, residual ${number(row.residualPc1)}`}</title></circle>)}<text x={x(1)} y={y(0) + 5} textAnchor="middle" className="target-star">★</text><text x={(left + width - right) / 2} y={height - 10} textAnchor="middle" className="axis-title">target projection ratio → 1</text><text transform={`translate(16 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">residual principal coordinate</text></svg><div className="path-caption"><span><i className="generation-gradient" /> early → late generation</span><span>★ fixed target at (1, 0)</span></div></div>;
}

function ProfileChart({ population, scale, selected }: { population: PopulationData; scale: ActivityScale; selected: number }) {
  const view = activityView(population, scale);
  const target = view.target, generation = view.means[selected] || [], sem = view.sems[selected] || [], units = population.units || [];
  const scaleInfo = ACTIVITY_SCALE_INFO[scale];
  const generationNumber = population.trajectory?.[selected]?.generation ?? selected;
  const width = 660, height = 350, left = 52, right = 16, top = 20, bottom = 58;
  const valid = [...target, ...generation, ...generation.map((value, index) => finite(value) && finite(sem[index]) ? value + sem[index]! : null), ...generation.map((value, index) => finite(value) && finite(sem[index]) ? value - sem[index]! : null)].filter(finite);
  let min = Math.min(...valid, 0), max = Math.max(...valid, scale === "raw" ? 1 : .1);
  const pad = Math.max((max - min) * .1, scale === "raw" ? 1 : .1); min -= pad; max += pad;
  const x = (index: number) => left + index / Math.max(1, units.length - 1) * (width - left - right);
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const path = (series: (number | null)[]) => {
    let drawing = false;
    return series.map((value, index) => {
      if (!finite(value)) { drawing = false; return ""; }
      const command = drawing ? "L" : "M"; drawing = true;
      return `${command}${x(index)},${y(value)}`;
    }).join(" ");
  };
  const yTicks = Array.from({ length: 5 }, (_, index) => min + (index / 4) * (max - min));
  const xStep = Math.max(1, Math.ceil(units.length / 9));
  return <div className="profile-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Channel-by-channel population profile in ${scaleInfo.title}`}>
    {yTicks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="gridline" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" className="axis-label">{number(tick, 1)}</text></g>)}
    <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} className="target-line" />
    <path d={path(target)} className="profile-target" /><path d={path(generation)} className="profile-generation" />
    {generation.map((value, index) => finite(value) && <g key={index}>{finite(sem[index]) && <><line x1={x(index)} x2={x(index)} y1={y(value - sem[index]!)} y2={y(value + sem[index]!)} className="profile-errorbar" /><line x1={x(index) - 2.5} x2={x(index) + 2.5} y1={y(value - sem[index]!)} y2={y(value - sem[index]!)} className="profile-errorbar" /><line x1={x(index) - 2.5} x2={x(index) + 2.5} y1={y(value + sem[index]!)} y2={y(value + sem[index]!)} className="profile-errorbar" /></>}<circle cx={x(index)} cy={y(value)} r="2.5" className="profile-point"><title>{`${units[index]?.label}: g${generationNumber} ${number(value)}, target ${number(target[index])}, SEM ${number(sem[index])}`}</title></circle></g>)}
    {units.map((unit, index) => ({ unit, index })).filter(({ index }) => index % xStep === 0).map(({ unit, index }) => <text key={unit.index} x={x(index)} y={height - bottom + 22} transform={`rotate(45 ${x(index)} ${height - bottom + 22})`} className="axis-label">{unit.label}</text>)}
    <text transform={`translate(15 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{scaleInfo.yLabel}</text>
  </svg><div className="chart-legend"><span><i className="line black" />{view.targetLabel}</span><span><i className="line teal" />{view.generationLabel} ± SEM</span></div></div>;
}
