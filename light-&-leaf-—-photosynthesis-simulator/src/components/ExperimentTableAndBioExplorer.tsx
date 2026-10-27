import React, { useEffect, useState } from 'react';
import {
  Table,
  Dna,
  Plus,
  Download,
  Trash2,
  GitCompare,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Atom,
  BookOpen,
} from 'lucide-react';
import {
  ExperimentObservation,
  exportObservationsToCsv,
} from '../model/photosynthesisModel';
import {
  PHOTOSYNTHETIC_PROTEINS,
  PHOTOSYNTHETIC_COMPOUNDS,
  PhotosyntheticProteinTarget,
  PhotosyntheticCompoundTarget,
  LiveUniProtEnrichment,
  fetchLiveProteinDetails,
} from '../services/bioscienceService';

interface ExperimentTableAndBioExplorerProps {
  observations: ExperimentObservation[];
  selectedCompareIds: string[];
  onToggleCompareId: (id: string) => void;
  onAddObservation: () => void;
  onClearObservations: () => void;
  onSwitchToComparisonGraph: () => void;
  theme: 'dark' | 'light';
}

export const ExperimentTableAndBioExplorer: React.FC<ExperimentTableAndBioExplorerProps> = ({
  observations,
  selectedCompareIds,
  onToggleCompareId,
  onAddObservation,
  onClearObservations,
  onSwitchToComparisonGraph,
  theme,
}) => {
  const [sectionTab, setSectionTab] = useState<'observations' | 'bioscience' | 'methodology'>('observations');
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // Bioscience Molecular Explorer State
  const [selectedProtein, setSelectedProtein] = useState<PhotosyntheticProteinTarget>(
    PHOTOSYNTHETIC_PROTEINS[0]
  );
  const [selectedCompound, setSelectedCompound] = useState<PhotosyntheticCompoundTarget>(
    PHOTOSYNTHETIC_COMPOUNDS[0]
  );
  const [liveEnrichment, setLiveEnrichment] = useState<LiveUniProtEnrichment | null>(null);
  const [loadingBio, setLoadingBio] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingBio(true);
    fetchLiveProteinDetails(selectedProtein)
      .then((res) => {
        if (!cancelled) {
          setLiveEnrichment(res);
          setLoadingBio(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingBio(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProtein]);

  const handleDownloadCsv = () => {
    const csv = exportObservationsToCsv(observations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'light_and_leaf_experiment_observations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute summary stats across recorded observations
  const highestRun =
    observations.length > 0
      ? observations.reduce((prev, curr) =>
          curr.predictedRate > prev.predictedRate ? curr : prev
        )
      : null;
  const lowestRun =
    observations.length > 0
      ? observations.reduce((prev, curr) =>
          curr.predictedRate < prev.predictedRate ? curr : prev
        )
      : null;

  return (
    <div
      className={`rounded-xl border flex flex-col ${
        theme === 'dark'
          ? 'bg-[#0e1f18] border-emerald-900/50 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      {/* Header Bar with Section Switcher & Table Actions */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${
          theme === 'dark' ? 'border-emerald-900/40 bg-[#0a1611]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'observations'}
            onClick={() => setSectionTab('observations')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              sectionTab === 'observations'
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-emerald-950/60'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Recorded Observations ({observations.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'bioscience'}
            onClick={() => setSectionTab('bioscience')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              sectionTab === 'bioscience'
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-emerald-950/60'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Dna className="w-3.5 h-3.5" />
            <span>Bioscience Molecular Explorer (UniProt · PDB · PubChem)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'methodology'}
            onClick={() => setSectionTab('methodology')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              sectionTab === 'methodology'
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : theme === 'dark'
                ? 'text-slate-300 hover:bg-emerald-950/60'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Model Equations & Scientific Notes</span>
          </button>
        </div>

        {/* Action Buttons for Observations */}
        {sectionTab === 'observations' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onAddObservation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Observation</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToComparisonGraph}
              disabled={observations.length < 1}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                theme === 'dark'
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                  : 'border-sky-600/30 bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Selected ({selectedCompareIds.length || observations.length})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={observations.length === 0}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                theme === 'dark'
                  ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              disabled={observations.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Before Clearing Recorded Observations */}
      {confirmClearOpen && (
        <div
          role="alertdialog"
          aria-labelledby="clear-confirm-title"
          className="mx-4 mt-3 p-3 rounded-lg border border-amber-500/50 bg-amber-950/40 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span id="clear-confirm-title">
              Are you sure you want to clear all {observations.length} recorded simulation observations? This action cannot be undone.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClearObservations();
                setConfirmClearOpen(false);
              }}
              className="px-3 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-semibold cursor-pointer"
            >
              Confirm Clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(false)}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: LIVE EXPERIMENT OBSERVATIONS TABLE */}
      {sectionTab === 'observations' && (
        <div className="p-4 space-y-3">
          {/* High / Low Summary Bar */}
          {observations.length > 0 && highestRun && lowestRun && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Peak Modeled Run:{' '}
                  <strong className="font-mono text-emerald-300">
                    {highestRun.id} ({highestRun.predictedRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹ at{' '}
                    {highestRun.lightKlux} klux)
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Minimum Modeled Run:{' '}
                  <strong className="font-mono text-amber-300">
                    {lowestRun.id} ({lowestRun.predictedRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹ at{' '}
                    {lowestRun.lightKlux} klux)
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Provenance: Simulated Model Outputs (Non-empirical)
              </span>
            </div>
          )}

          <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-lg border border-emerald-950/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={
                    theme === 'dark'
                      ? 'bg-[#091510] text-slate-300 border-b border-emerald-900/50'
                      : 'bg-slate-100 text-slate-700 border-b border-slate-200'
                  }
                >
                  <th className="py-2.5 px-3 font-semibold">Compare</th>
                  <th className="py-2.5 px-3 font-semibold">Exp ID</th>
                  <th className="py-2.5 px-3 font-semibold">Elapsed</th>
                  <th className="py-2.5 px-3 font-semibold">Model</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Light (klux)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CO₂ (ppm)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Temp (°C)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Water (%)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    Predicted Rate (µmol CO₂ m⁻² s⁻¹)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    Est. O₂ Output (µmol O₂ m⁻² s⁻¹)
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Limiting Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/30 font-mono">
                {observations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center font-sans text-slate-400">
                      No experimental conditions recorded yet. Adjust environmental controls and click{' '}
                      <strong>Record Observation</strong> to log a run.
                    </td>
                  </tr>
                ) : (
                  observations.map((obs) => {
                    const checked = selectedCompareIds.includes(obs.id);
                    return (
                      <tr
                        key={obs.id}
                        className={
                          theme === 'dark'
                            ? 'hover:bg-emerald-950/30 transition-colors'
                            : 'hover:bg-slate-50 transition-colors'
                        }
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${obs.id} for comparison`}
                            checked={checked}
                            onChange={() => onToggleCompareId(obs.id)}
                            className="rounded border-slate-600 text-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-emerald-300">{obs.id}</td>
                        <td className="py-2 px-3 text-slate-400 tabular-nums">
                          {obs.elapsedSeconds.toFixed(1)}s
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {obs.mode === 'baseline' ? 'Baseline' : 'Extended'}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-300 tabular-nums">
                          {obs.lightKlux.toFixed(0)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{obs.co2Ppm}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {obs.temperatureC.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{obs.waterPct}%</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-300 tabular-nums">
                          {obs.predictedRate.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-sky-300 tabular-nums">
                          {obs.estimatedO2Rate.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-300">
                          {obs.limitingFactorLabel}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BIOSCIENCE MOLECULAR EXPLORER (UNIPROT / PDB / PUBCHEM) */}
      {sectionTab === 'bioscience' && (
        <div className="p-4 space-y-4">
          {/* Quick-Try Example Selector Bar (Mandatory Science Skill Pattern) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-900/40">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 mr-1">
                Photosynthetic Protein Complexes:
              </span>
              {PHOTOSYNTHETIC_PROTEINS.map((prot) => (
                <button
                  key={prot.id}
                  type="button"
                  onClick={() => setSelectedProtein(prot)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedProtein.id === prot.id
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {prot.shortName} ({prot.uniprotAccession})
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">
              Data sourced via UniProtKB, RCSB PDB &amp; PubChem REST APIs (CC BY 4.0)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 7 Cols: Selected Protein Structure & UniProtKB Annotation Card */}
            <div
              className={`lg:col-span-7 rounded-xl border p-4 space-y-3 ${
                theme === 'dark'
                  ? 'bg-[#0a1510] border-emerald-900/40'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                    <span>UniProt: {selectedProtein.uniprotAccession}</span>
                    <span aria-hidden="true">·</span>
                    <span>PDB: {selectedProtein.pdbId}</span>
                    {selectedProtein.ecNumber && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{selectedProtein.ecNumber}</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-base font-bold mt-0.5">
                    {liveEnrichment?.proteinName || selectedProtein.shortName} (
                    <span className="font-mono text-emerald-300">{selectedProtein.geneSymbol}</span>)
                  </h4>
                  <p className="text-xs text-slate-400 italic">
                    Organism: {liveEnrichment?.organismName || selectedProtein.organism} ·{' '}
                    {selectedProtein.complexLocation}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-mono text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    [{selectedProtein.provenanceBadge}]
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {liveEnrichment?.functionText || selectedProtein.physiologicalRole}
              </p>

              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
                <div className="font-semibold text-emerald-300 mb-0.5">
                  Connection to Simulator Kinetics:
                </div>
                <p className="text-slate-300">{selectedProtein.simulatorConnection}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50">
                  <div className="text-[11px] text-slate-400">Catalytic Reaction</div>
                  <div className="font-mono text-[11px] text-amber-300 mt-1">
                    {selectedProtein.catalyticReaction}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50">
                  <div className="text-[11px] text-slate-400">Active &amp; Binding Sites</div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300 font-mono">
                    {selectedProtein.activeSites.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Authoritative Outbound Database Citations */}
              <div className="pt-2 border-t border-emerald-900/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-[11px] text-slate-400">
                  Length: {liveEnrichment?.sequenceLength || selectedProtein.sequenceLength} aa ·
                  Method: {liveEnrichment?.experimentalMethod || 'X-RAY DIFFRACTION'}{' '}
                  {liveEnrichment?.resolvedResolutionAngstrom
                    ? `(${liveEnrichment.resolvedResolutionAngstrom} Å)`
                    : ''}
                  {loadingBio ? ' · Syncing live API...' : ''}
                </span>

                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.uniprot.org/uniprotkb/${selectedProtein.uniprotAccession}/entry`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                  >
                    <span>UniProtKB</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.rcsb.org/structure/${selectedProtein.pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                  >
                    <span>RCSB PDB ({selectedProtein.pdbId})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://alphafold.ebi.ac.uk/entry/${selectedProtein.uniprotAccession}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                  >
                    <span>AlphaFold DB</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: PubChem Photosynthetic Small Molecules & Metabolites */}
            <div
              className={`lg:col-span-5 rounded-xl border p-4 flex flex-col justify-between gap-3 ${
                theme === 'dark'
                  ? 'bg-[#0a1510] border-emerald-900/40'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                    <Atom className="w-3.5 h-3.5" />
                    <span>PubChem Metabolite &amp; Cofactor Inspector</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    CID: {selectedCompound.cid}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {PHOTOSYNTHETIC_COMPOUNDS.map((cmp) => (
                    <button
                      key={cmp.id}
                      type="button"
                      onClick={() => setSelectedCompound(cmp)}
                      className={`px-2 py-1 rounded text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                        selectedCompound.id === cmp.id
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {cmp.name}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{selectedCompound.name}</span>
                    <span className="font-mono text-emerald-300">
                      {selectedCompound.formula} · {selectedCompound.molecularWeight}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedCompound.roleInPhotosynthesis}
                  </p>
                  <div className="pt-1">
                    <div className="text-[10px] text-slate-400 uppercase">Canonical SMILES</div>
                    <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-950/70 p-1.5 rounded mt-0.5">
                      {selectedCompound.canonicalSmiles}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-emerald-900/30">
                <span className="font-mono text-[11px] text-slate-400">
                  [{selectedCompound.provenanceBadge}]
                </span>
                <a
                  href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selectedCompound.cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <span>View on PubChem (CID {selectedCompound.cid})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCIENTIFIC MODEL EQUATIONS & TRANSPARENCY NOTES */}
      {sectionTab === 'methodology' && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
          <div className="p-3.5 rounded-lg border border-emerald-900/40 bg-[#0a1510] space-y-1.5">
            <h4 className="font-semibold text-emerald-300 text-sm">
              1. Baseline Light-Response Model
            </h4>
            <p className="text-slate-300">
              Models light-dependent carbon assimilation via the rectangular hyperbola:
            </p>
            <div className="font-mono text-amber-300 bg-slate-950/70 p-2 rounded">
              R(I) = Pmax × I / (I + K)
            </div>
            <p className="text-slate-400">
              With <span className="font-mono">Pmax = 20 µmol CO₂ m⁻² s⁻¹</span> and{' '}
              <span className="font-mono">K = 25 klux</span>. At 0 klux, R = 0; at 40 klux, R ≈
              12.31; at 100 klux, R = 16.00. The analytical slope is{' '}
              <span className="font-mono">dR/dI = Pmax·K/(I+K)²</span>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-emerald-900/40 bg-[#0a1510] space-y-1.5">
            <h4 className="font-semibold text-sky-300 text-sm">
              2. Extended Multi-Factor Model
            </h4>
            <p className="text-slate-300">
              Explicitly multiplies the baseline rate by normalized physiological response functions:
            </p>
            <div className="font-mono text-sky-300 bg-slate-950/70 p-2 rounded">
              R_ext = R(I) × f_CO2(C) × f_T(T) × f_W(W)
            </div>
            <p className="text-slate-400">
              Normalized to 1.00 at reference conditions (<span className="font-mono">400 ppm</span>
              , <span className="font-mono">25 °C</span>, <span className="font-mono">100%</span>{' '}
              water). Does not silently alter the baseline equation when Baseline Mode is active.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-emerald-900/40 bg-[#0a1510] space-y-1.5">
            <h4 className="font-semibold text-amber-300 text-sm">
              3. Stoichiometry &amp; Visual Scaling
            </h4>
            <p className="text-slate-300">
              Estimated O₂ evolution uses a 1:1 molar photosynthetic quotient teaching assumption (
              <span className="font-mono">1 µmol O₂ released per 1 µmol CO₂ fixed</span>).
            </p>
            <p className="text-slate-400">
              Animated oxygen bubbles in the botanical canvas use an illustrative scaling factor (
              <span className="font-mono">0.35 bubbles/s per µmol CO₂ m⁻² s⁻¹</span>, yielding 4.3
              bubbles/s at 40 klux) and are not direct physical gas measurements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
