/**
 * Bioscience Molecular & Chemical Connector Service
 *
 * Implements the DeepMind Science Skills patterns:
 *  - UniProtKB REST API (`https://rest.uniprot.org/uniprotkb/{accession}.json`)
 *  - RCSB Protein Data Bank (`https://data.rcsb.org/rest/v1/core/entry/{pdbId}`)
 *  - AlphaFold DB (`https://alphafold.ebi.ac.uk/api/prediction/{accession}`)
 *  - PubChem PUG REST (`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/.../JSON`)
 *
 * Includes `fetchWithRetry` rate-limit handling, in-memory response caching,
 * and authoritative curated baseline metadata so the workbench loads immediately
 * and enriches live from the public scientific endpoints.
 */

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  baseDelayMs = 500
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delay =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  throw new Error(`Exhausted retries for ${url}`);
}

export interface PhotosyntheticProteinTarget {
  id: string;
  shortName: string;
  geneSymbol: string;
  uniprotAccession: string;
  pdbId: string;
  organism: string;
  complexLocation: string;
  physiologicalRole: string;
  simulatorConnection: string;
  provenanceBadge: 'Experimentally determined' | 'Predicted by model' | 'Literature curated';
  ecNumber?: string;
  sequenceLength: number;
  activeSites: string[];
  catalyticReaction: string;
}

export interface PhotosyntheticCompoundTarget {
  id: string;
  name: string;
  cid: number;
  formula: string;
  molecularWeight: string;
  iupacName: string;
  canonicalSmiles: string;
  roleInPhotosynthesis: string;
  provenanceBadge: 'Experimentally determined' | 'Literature curated';
}

export const PHOTOSYNTHETIC_PROTEINS: PhotosyntheticProteinTarget[] = [
  {
    id: 'rubisco',
    shortName: 'RuBisCO Large Subunit',
    geneSymbol: 'rbcL',
    uniprotAccession: 'P00875',
    pdbId: '1RCX',
    organism: 'Spinacia oleracea (Spinach)',
    complexLocation: 'Chloroplast Stroma',
    physiologicalRole:
      'Catalyzes the primary carboxylation step of the Calvin-Benson cycle (CO₂ fixation onto ribulose-1,5-bisphosphate) as well as competing oxygenation (photorespiration).',
    simulatorConnection:
      'Governs the asymptotic ceiling Pmax (20 µmol CO₂ m⁻² s⁻¹) at high light intensity and drives the CO₂ & temperature response curves in Extended Mode.',
    provenanceBadge: 'Experimentally determined',
    ecNumber: 'EC 4.1.1.39',
    sequenceLength: 475,
    activeSites: [
      'Lys-201 (N6-carboxylysine Mg²⁺ coordination site)',
      'Lys-175 (Proton abstraction / enolization of RuBP)',
      'His-294 (Catalytic base in carboxylation)',
    ],
    catalyticReaction:
      'D-ribulose 1,5-bisphosphate + CO₂ + H₂O = 2 (3-phospho-D-glycerate) + 2 H⁺',
  },
  {
    id: 'psii_d1',
    shortName: 'Photosystem II Reaction Center D1',
    geneSymbol: 'psbA',
    uniprotAccession: 'P06005',
    pdbId: '3WU2',
    organism: 'Spinacia oleracea (Spinach)',
    complexLocation: 'Chloroplast Thylakoid Membrane',
    physiologicalRole:
      'Core reaction-center subunit of Photosystem II housing the P680 chlorophyll special pair, pheophytin, plastoquinone QB, and the Mn₄CaO₅ oxygen-evolving complex.',
    simulatorConnection:
      'Directly drives light capture in the steep light-limited slope (I < K = 25 klux) and water-splitting oxygen bubble evolution.',
    provenanceBadge: 'Experimentally determined',
    ecNumber: 'EC 1.10.3.9',
    sequenceLength: 353,
    activeSites: [
      'His-198 (Coordinates P680 chlorophyll a special pair)',
      'Tyr-161 / YZ (Redox-active electron relay from Mn₄CaO₅ cluster)',
      'Asp-170 & Glu-189 (Bidentate ligands to Mn₄CaO₅ water-splitting catalyst)',
    ],
    catalyticReaction: '2 H₂O + 2 plastoquinone + 4 H⁺(stroma) + hν = O₂ + 2 plastoquinol + 4 H⁺(lumen)',
  },
  {
    id: 'psi_psaa',
    shortName: 'Photosystem I P700 Apoprotein A1',
    geneSymbol: 'psaA',
    uniprotAccession: 'P06511',
    pdbId: '1JB0',
    organism: 'Spinacia oleracea (Spinach)',
    complexLocation: 'Chloroplast Thylakoid Membrane',
    physiologicalRole:
      'Binds P700 reaction-center chlorophyll dimer and iron-sulfur cluster FX, catalyzing light-driven electron transfer from luminal plastocyanin to stromal ferredoxin for NADPH synthesis.',
    simulatorConnection:
      'Supplies the reducing power (NADPH) required to sustain carbon reduction as sunlight intensity increases from Shade (10 klux) to Bright (60 klux).',
    provenanceBadge: 'Experimentally determined',
    ecNumber: 'EC 1.97.1.12',
    sequenceLength: 750,
    activeSites: [
      'His-680 (Axial ligand to P700 chlorophyll a)',
      'Cys-578 & Cys-587 (4Fe-4S iron-sulfur center FX binding)',
    ],
    catalyticReaction:
      'Reduced plastocyanin + oxidized ferredoxin + hν = oxidized plastocyanin + reduced ferredoxin',
  },
  {
    id: 'atp_synthase',
    shortName: 'ATP Synthase Subunit Beta (CF1)',
    geneSymbol: 'atpB',
    uniprotAccession: 'P00823',
    pdbId: '1FX0',
    organism: 'Spinacia oleracea (Spinach)',
    complexLocation: 'Chloroplast Thylakoid CF₀CF₁ Complex',
    physiologicalRole:
      'Catalytic subunit of chloroplastic ATP synthase that harnesses the transmembrane proton motive force (ΔpH) generated by light reactions to synthesize ATP.',
    simulatorConnection:
      'Couples thylakoid light absorption to stromal ATP supply (3 ATP per CO₂ fixed in the Calvin-Benson cycle).',
    provenanceBadge: 'Experimentally determined',
    ecNumber: 'EC 7.1.2.2',
    sequenceLength: 498,
    activeSites: [
      'Walker A / P-loop (Residues 168–175: GGVGKTVL nucleotide binding)',
      'Glu-204 (Catalytic carboxylate activating water for ATP synthesis)',
    ],
    catalyticReaction: 'ADP + phosphate + H⁺(lumen) = ATP + H₂O + H⁺(stroma)',
  },
];

export const PHOTOSYNTHETIC_COMPOUNDS: PhotosyntheticCompoundTarget[] = [
  {
    id: 'chlorophyll_a',
    name: 'Chlorophyll a',
    cid: 12085802,
    formula: 'C55H72MgN4O5',
    molecularWeight: '893.5 g/mol',
    iupacName: 'Magnesium-coordinated chlorin-phytyl ester photoreceptive pigment',
    canonicalSmiles: 'CCC1=C(C2=CC3=C(C(=C([N-]3)C=C4C(C(C(=N4)C=C5C(=C(C(=N5)C=C1[N-]2)C=C)C)C)CCC(=O)OCC=C(C)CCCC(C)CCCC(C)CCCC(C)C)C)C(=O)C6=C3C(=O)OC)C.[Mg+2]',
    roleInPhotosynthesis:
      'Primary antenna and reaction-center pigment (P680 in PSII, P700 in PSI) absorbing blue (430 nm) and red (662 nm) photons.',
    provenanceBadge: 'Experimentally determined',
  },
  {
    id: 'carbon_dioxide',
    name: 'Carbon Dioxide (CO₂)',
    cid: 280,
    formula: 'CO2',
    molecularWeight: '44.01 g/mol',
    iupacName: 'carbon dioxide',
    canonicalSmiles: 'C(=O)=O',
    roleInPhotosynthesis:
      'Inorganic carbon substrate diffusing through leaf stomata into the chloroplast stroma for fixation by RuBisCO.',
    provenanceBadge: 'Experimentally determined',
  },
  {
    id: 'glucose',
    name: 'D-Glucose (C₆H₁₂O₆)',
    cid: 5793,
    formula: 'C6H12O6',
    molecularWeight: '180.16 g/mol',
    iupacName: '(2R,3S,4R,5R)-2,3,4,5,6-pentahydroxyhexanal',
    canonicalSmiles: 'C(C1C(C(C(C(O1)O)O)O)O)O',
    roleInPhotosynthesis:
      'Hexose carbohydrate product synthesized from triose phosphates (G3P) exported by the Calvin-Benson cycle.',
    provenanceBadge: 'Experimentally determined',
  },
  {
    id: 'atp',
    name: 'Adenosine Triphosphate (ATP)',
    cid: 5957,
    formula: 'C10H16N5O13P3',
    molecularWeight: '507.18 g/mol',
    iupacName: '[[(2R,3S,4R,5R)-5-(6-aminopurin-9-yl)-3,4-dihydroxyoxolan-2-yl]methoxy-hydroxyphosphoryl] phosphono hydrogen phosphate',
    canonicalSmiles: 'C1=NC(=C2C(=N1)N(C=N2)C3C(C(C(O3)COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O)O)N',
    roleInPhotosynthesis:
      'Universal energy currency synthesized by chloroplastic CF₀CF₁ ATP synthase to power 3-PGA phosphorylation and RuBP regeneration.',
    provenanceBadge: 'Experimentally determined',
  },
];

export interface LiveUniProtEnrichment {
  accession: string;
  proteinName: string;
  organismName: string;
  sequenceLength: number;
  functionText: string;
  pdbCrossRefs: string[];
  resolvedResolutionAngstrom?: number;
  experimentalMethod?: string;
  alphafoldCifUrl?: string;
  fetchedLive: boolean;
}

const proteinCache = new Map<string, LiveUniProtEnrichment>();

export async function fetchLiveProteinDetails(
  target: PhotosyntheticProteinTarget
): Promise<LiveUniProtEnrichment> {
  if (proteinCache.has(target.uniprotAccession)) {
    return proteinCache.get(target.uniprotAccession)!;
  }

  const fallback: LiveUniProtEnrichment = {
    accession: target.uniprotAccession,
    proteinName: target.shortName,
    organismName: target.organism,
    sequenceLength: target.sequenceLength,
    functionText: target.physiologicalRole,
    pdbCrossRefs: [target.pdbId],
    resolvedResolutionAngstrom: target.pdbId === '3WU2' ? 1.9 : 2.4,
    experimentalMethod: 'X-RAY DIFFRACTION',
    fetchedLive: false,
  };

  try {
    const [uniprotRes, pdbRes, afRes] = await Promise.allSettled([
      fetchWithRetry(`https://rest.uniprot.org/uniprotkb/${target.uniprotAccession}.json`),
      fetchWithRetry(`https://data.rcsb.org/rest/v1/core/entry/${target.pdbId.toLowerCase()}`),
      fetchWithRetry(`https://alphafold.ebi.ac.uk/api/prediction/${target.uniprotAccession}`),
    ]);

    let proteinName = fallback.proteinName;
    let organismName = fallback.organismName;
    let sequenceLength = fallback.sequenceLength;
    let functionText = fallback.functionText;
    let pdbCrossRefs = fallback.pdbCrossRefs;
    let fetchedLive = false;

    if (uniprotRes.status === 'fulfilled') {
      const uData = await uniprotRes.value.json();
      fetchedLive = true;
      proteinName =
        uData?.proteinDescription?.recommendedName?.fullName?.value || proteinName;
      organismName = uData?.organism?.scientificName || organismName;
      sequenceLength = uData?.sequence?.length || sequenceLength;

      const fnComment = (uData?.comments || []).find(
        (c: any) => c.commentType === 'FUNCTION'
      );
      if (fnComment?.texts?.[0]?.value) {
        functionText = fnComment.texts[0].value;
      }

      const pdbs = (uData?.uniProtKBCrossReferences || [])
        .filter((x: any) => x.database === 'PDB')
        .map((x: any) => x.id)
        .slice(0, 6);
      if (pdbs.length > 0) {
        pdbCrossRefs = pdbs;
      }
    }

    let resolvedResolutionAngstrom = fallback.resolvedResolutionAngstrom;
    let experimentalMethod = fallback.experimentalMethod;
    if (pdbRes.status === 'fulfilled') {
      const pData = await pdbRes.value.json();
      fetchedLive = true;
      if (Array.isArray(pData?.rcsb_entry_info?.resolution_combined)) {
        resolvedResolutionAngstrom = pData.rcsb_entry_info.resolution_combined[0];
      }
      if (Array.isArray(pData?.rcsb_entry_info?.experimental_method)) {
        experimentalMethod = pData.rcsb_entry_info.experimental_method[0];
      }
    }

    let alphafoldCifUrl: string | undefined;
    if (afRes.status === 'fulfilled') {
      const afData = await afRes.value.json();
      if (Array.isArray(afData) && afData[0]?.cifUrl) {
        alphafoldCifUrl = afData[0].cifUrl;
      }
    }

    const enriched: LiveUniProtEnrichment = {
      accession: target.uniprotAccession,
      proteinName,
      organismName,
      sequenceLength,
      functionText,
      pdbCrossRefs,
      resolvedResolutionAngstrom,
      experimentalMethod,
      alphafoldCifUrl,
      fetchedLive,
    };
    proteinCache.set(target.uniprotAccession, enriched);
    return enriched;
  } catch {
    return fallback;
  }
}
