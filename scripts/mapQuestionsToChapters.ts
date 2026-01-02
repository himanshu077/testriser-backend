import { db } from '../src/config/database';
import { questions, curriculumChapters, subjects } from '../src/models/schema';
import { eq, isNull, sql } from 'drizzle-orm';

// Topic to chapter keyword mappings for intelligent matching
const topicMappings: Record<string, string[]> = {
  // Botany mappings
  'The Living World': [
    'living world',
    'biodiversity',
    'taxonomic',
    'taxonomy',
    'species',
    'nomenclature',
  ],
  'Biological Classification': [
    'classification',
    'kingdom',
    'monera',
    'protista',
    'fungi',
    'plantae',
    'animalia',
    'virus',
    'viroids',
    'lichens',
  ],
  'Plant Kingdom': [
    'plant kingdom',
    'algae',
    'bryophytes',
    'pteridophytes',
    'gymnosperms',
    'angiosperms',
    'plant classification',
  ],
  'Morphology of Flowering Plants': [
    'morphology',
    'root',
    'stem',
    'leaf',
    'flower',
    'fruit',
    'seed',
    'inflorescence',
  ],
  'Anatomy of Flowering Plants': [
    'anatomy',
    'tissue',
    'meristem',
    'xylem',
    'phloem',
    'vascular',
    'epidermis',
  ],
  'Cell – The Unit of Life': [
    'cell',
    'cell structure',
    'organelle',
    'nucleus',
    'mitochondria',
    'chloroplast',
    'cell membrane',
    'cytoplasm',
  ],
  'Cell Cycle & Cell Division': [
    'cell cycle',
    'mitosis',
    'meiosis',
    'cell division',
    'interphase',
    'prophase',
    'metaphase',
  ],
  'Photosynthesis in Higher Plants': [
    'photosynthesis',
    'light reaction',
    'dark reaction',
    'calvin cycle',
    'c3',
    'c4',
    'cam',
  ],
  'Respiration in Plants': [
    'respiration',
    'glycolysis',
    'krebs cycle',
    'electron transport',
    'fermentation',
    'atp',
  ],
  'Plant Growth and Development': [
    'growth',
    'development',
    'auxin',
    'gibberellin',
    'cytokinin',
    'abscisic',
    'ethylene',
    'photoperiodism',
  ],
  'Sexual Reproduction in Flowering Plants': [
    'sexual reproduction',
    'pollination',
    'fertilization',
    'embryo',
    'endosperm',
    'double fertilization',
  ],
  'Principles of Inheritance and Variation': [
    'inheritance',
    'mendel',
    'genetics',
    'allele',
    'dominant',
    'recessive',
    'chromosome',
    'linkage',
  ],
  'Molecular Basis of Inheritance': [
    'dna',
    'rna',
    'replication',
    'transcription',
    'translation',
    'genetic code',
    'gene expression',
  ],
  'Organisms and Populations': [
    'population',
    'ecology',
    'population growth',
    'interaction',
    'adaptation',
  ],
  Ecosystem: [
    'ecosystem',
    'food chain',
    'food web',
    'energy flow',
    'nutrient cycling',
    'ecological pyramid',
    'succession',
  ],
  'Biodiversity and Conservation': [
    'biodiversity',
    'conservation',
    'endangered',
    'extinction',
    'hotspot',
    'wildlife',
  ],
  'Microbes in Human Welfare': [
    'microbes',
    'bacteria',
    'fermentation',
    'antibiotic',
    'biogas',
    'sewage',
  ],

  // Zoology mappings
  'Human Health and Disease': [
    'health',
    'disease',
    'pathogen',
    'immunity',
    'immunology',
    'antibody',
    'antigen',
    'vaccine',
    'aids',
    'cancer',
  ],
  'Animal Kingdom': [
    'animal kingdom',
    'phylum',
    'porifera',
    'cnidaria',
    'arthropoda',
    'mollusca',
    'chordata',
    'vertebrata',
  ],
  'Structural Organisation in Animals': [
    'tissue',
    'epithelial',
    'connective',
    'muscular',
    'nervous tissue',
    'organ system',
  ],
  'Digestion and Absorption': [
    'digestion',
    'alimentary canal',
    'stomach',
    'intestine',
    'enzyme',
    'absorption',
    'nutrition',
  ],
  'Breathing and Exchange of Gases': [
    'breathing',
    'respiration',
    'lungs',
    'alveoli',
    'oxygen',
    'carbon dioxide',
    'respiratory',
  ],
  'Body Fluids and Circulation': [
    'blood',
    'circulation',
    'heart',
    'artery',
    'vein',
    'lymph',
    'cardiac',
    'blood group',
  ],
  'Excretory Products and their Elimination': [
    'excretion',
    'kidney',
    'nephron',
    'urine',
    'dialysis',
    'osmoregulation',
  ],
  'Locomotion and Movement': [
    'locomotion',
    'movement',
    'muscle',
    'skeleton',
    'bone',
    'joint',
    'contraction',
  ],
  'Neural Control and Coordination': [
    'nervous',
    'neuron',
    'brain',
    'reflex',
    'synapse',
    'nerve impulse',
    'coordination',
  ],
  'Chemical Coordination and Integration': [
    'hormone',
    'endocrine',
    'pituitary',
    'thyroid',
    'adrenal',
    'pancreas',
    'gonad',
  ],
  'Human Reproduction': [
    'reproduction',
    'reproductive system',
    'gametogenesis',
    'menstrual',
    'fertilization',
    'pregnancy',
    'ivf',
  ],
  'Reproductive Health': [
    'reproductive health',
    'contraception',
    'std',
    'infertility',
    'amniocentesis',
  ],
  Evolution: [
    'evolution',
    'darwin',
    'natural selection',
    'adaptation',
    'speciation',
    'fossil',
    'homology',
  ],
  Biomolecules: [
    'biomolecule',
    'carbohydrate',
    'protein',
    'lipid',
    'nucleic acid',
    'enzyme',
    'biochemistry',
  ],

  // Physics mappings
  'Units and Measurement': ['units', 'measurement', 'dimension', 'error', 'significant figures'],
  'Motion in a Straight Line': [
    'motion',
    'velocity',
    'acceleration',
    'kinematics',
    'displacement',
    'speed',
  ],
  'Motion in a Plane': ['projectile', 'circular motion', 'vector', 'relative motion'],
  'Laws of Motion': ['newton', 'force', 'friction', 'momentum', 'impulse', 'inertia'],
  'Work, Energy and Power': ['work', 'energy', 'power', 'kinetic', 'potential', 'conservation'],
  'System of Particles and Rotational Motion': [
    'rotation',
    'torque',
    'angular',
    'moment of inertia',
    'centre of mass',
  ],
  Gravitation: ['gravitation', 'gravity', 'kepler', 'satellite', 'orbital', 'escape velocity'],
  'Mechanical Properties of Solids': [
    'stress',
    'strain',
    'elasticity',
    'young modulus',
    'bulk modulus',
  ],
  'Mechanical Properties of Fluids': [
    'fluid',
    'pressure',
    'viscosity',
    'surface tension',
    'bernoulli',
  ],
  'Thermal Properties of Matter': [
    'thermal',
    'heat',
    'temperature',
    'specific heat',
    'latent heat',
    'calorimetry',
  ],
  Thermodynamics: ['thermodynamics', 'entropy', 'carnot', 'heat engine', 'refrigerator'],
  'Kinetic Theory': [
    'kinetic theory',
    'gas laws',
    'ideal gas',
    'rms velocity',
    'degrees of freedom',
  ],
  Oscillations: ['oscillation', 'shm', 'simple harmonic', 'pendulum', 'spring'],
  Waves: ['wave', 'sound', 'doppler', 'standing wave', 'resonance', 'superposition'],
  'Electric Charges and Fields': [
    'electric charge',
    'coulomb',
    'electric field',
    'gauss law',
    'electrostatics',
  ],
  'Electrostatic Potential and Capacitance': [
    'potential',
    'capacitor',
    'capacitance',
    'dielectric',
  ],
  'Current Electricity': [
    'current',
    'resistance',
    'ohm',
    'kirchhoff',
    'circuit',
    'electric circuits',
  ],
  'Moving Charges and Magnetism': [
    'magnetic field',
    'biot savart',
    'ampere',
    'lorentz force',
    'magnetic force',
  ],
  'Magnetism and Matter': [
    'magnetism',
    'magnetic materials',
    'hysteresis',
    'diamagnetic',
    'paramagnetic',
  ],
  'Electromagnetic Induction': [
    'electromagnetic induction',
    'faraday',
    'lenz',
    'eddy current',
    'inductance',
  ],
  'Alternating Current': [
    'alternating current',
    'ac circuit',
    'transformer',
    'impedance',
    'reactance',
  ],
  'Electromagnetic Waves': [
    'electromagnetic wave',
    'em spectrum',
    'radio wave',
    'microwave',
    'infrared',
  ],
  'Ray Optics and Optical Instruments': [
    'ray optics',
    'reflection',
    'refraction',
    'lens',
    'mirror',
    'prism',
    'optical',
  ],
  'Wave Optics': ['wave optics', 'interference', 'diffraction', 'polarization', 'young'],
  'Dual Nature of Radiation and Matter': [
    'photoelectric',
    'photon',
    'de broglie',
    'wave particle',
    'dual nature',
  ],
  Atoms: ['atomic model', 'bohr', 'hydrogen spectrum', 'energy level'],
  Nuclei: ['nucleus', 'nuclear', 'radioactivity', 'decay', 'fission', 'fusion', 'binding energy'],
  'Semiconductor Electronics': ['semiconductor', 'diode', 'transistor', 'logic gate', 'rectifier'],

  // Chemistry mappings
  'Some Basic Concepts of Chemistry': [
    'mole',
    'stoichiometry',
    'atomic mass',
    'molecular mass',
    'empirical formula',
  ],
  'Structure of Atom': [
    'atom',
    'atomic structure',
    'orbital',
    'quantum',
    'electronic configuration',
  ],
  'Classification of Elements & Periodicity in Properties': [
    'periodic table',
    'periodicity',
    'ionization',
    'electron affinity',
    'electronegativity',
  ],
  'Chemical Bonding and Molecular Structure': [
    'chemical bond',
    'ionic bond',
    'covalent bond',
    'hybridization',
    'vsepr',
    'molecular orbital',
  ],
  Thermodynamics: ['enthalpy', 'entropy', 'gibbs', 'heat of reaction', 'hess law'],
  Equilibrium: ['equilibrium', 'le chatelier', 'ionic equilibrium', 'buffer', 'solubility product'],
  'Redox Reactions': ['redox', 'oxidation', 'reduction', 'oxidizing agent', 'reducing agent'],
  Solutions: ['solution', 'concentration', 'molarity', 'colligative', 'osmotic pressure', 'raoult'],
  Electrochemistry: [
    'electrochemistry',
    'electrode',
    'cell',
    'nernst',
    'electrolysis',
    'conductance',
  ],
  'Chemical Kinetics': ['kinetics', 'rate of reaction', 'order', 'activation energy', 'arrhenius'],
  'The d– and f–Block Elements': ['d block', 'f block', 'transition', 'lanthanide', 'actinide'],
  'Coordination Compounds': ['coordination', 'ligand', 'complex', 'isomerism', 'crystal field'],
  'Haloalkanes and Haloarenes': [
    'haloalkane',
    'haloarene',
    'alkyl halide',
    'sn1',
    'sn2',
    'elimination',
  ],
  'Alcohols, Phenols & Ethers': ['alcohol', 'phenol', 'ether', 'hydroxyl'],
  'Aldehydes, Ketones & Carboxylic Acids': ['aldehyde', 'ketone', 'carboxylic', 'carbonyl'],
  Amines: ['amine', 'amino', 'diazonium', 'basicity'],
  'Organic Chemistry – Some Basic Principles & Techniques': [
    'organic',
    'isomerism',
    'inductive',
    'resonance',
    'hyperconjugation',
  ],
  Hydrocarbons: ['hydrocarbon', 'alkane', 'alkene', 'alkyne', 'aromatic', 'benzene'],
  Biomolecules: ['biomolecule', 'carbohydrate', 'protein', 'amino acid', 'nucleotide', 'vitamin'],
  'The p-Block Elements (Part of NEET syllabus)': [
    'p block',
    'group 15',
    'group 16',
    'group 17',
    'group 18',
    'halogen',
    'noble gas',
  ],
};

// Subject name normalization
const normalizeSubject = (subject: string): string => {
  const s = subject.toLowerCase().trim();
  if (s === 'zoology' || s === 'biology') return 'zoology';
  if (s === 'botany') return 'botany';
  if (s === 'physics') return 'physics';
  if (s === 'chemistry') return 'chemistry';
  return s;
};

// Calculate match score between topic/question and chapter
function calculateMatchScore(
  topic: string,
  questionText: string,
  chapterName: string,
  keywords: string[]
): number {
  const combinedText = `${topic} ${questionText}`.toLowerCase();
  const normalizedChapter = chapterName.toLowerCase();

  let score = 0;

  // Direct chapter name match
  if (combinedText.includes(normalizedChapter)) {
    score += 50;
  }

  // Keyword matching
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  // Topic similarity
  const topicWords = topic.toLowerCase().split(/\s+/);
  const chapterWords = normalizedChapter.split(/\s+/);

  for (const tw of topicWords) {
    for (const cw of chapterWords) {
      if (tw.length > 3 && cw.length > 3 && (tw.includes(cw) || cw.includes(tw))) {
        score += 15;
      }
    }
  }

  return score;
}

async function mapQuestionsToChapters() {
  console.log('Starting chapter mapping for questions...\n');

  // Get all chapters grouped by subject
  const allChapters = await db
    .select({
      id: curriculumChapters.id,
      name: curriculumChapters.name,
      subjectId: curriculumChapters.subjectId,
    })
    .from(curriculumChapters);

  // Get all subjects
  const allSubjects = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
    })
    .from(subjects);

  // Create subject code to ID mapping
  const subjectCodeToId: Record<string, string> = {};
  const subjectIdToCode: Record<string, string> = {};
  for (const s of allSubjects) {
    subjectCodeToId[s.code.toLowerCase()] = s.id;
    subjectCodeToId[s.name.toLowerCase()] = s.id;
    subjectIdToCode[s.id] = s.code.toLowerCase();
  }

  // Group chapters by subject
  const chaptersBySubject: Record<string, typeof allChapters> = {};
  for (const chapter of allChapters) {
    const subjectCode = subjectIdToCode[chapter.subjectId] || 'unknown';
    if (!chaptersBySubject[subjectCode]) {
      chaptersBySubject[subjectCode] = [];
    }
    chaptersBySubject[subjectCode].push(chapter);
  }

  // Get questions without chapter mapping
  const unmappedQuestions = await db
    .select({
      id: questions.id,
      subject: questions.subject,
      topic: questions.topic,
      questionText: questions.questionText,
    })
    .from(questions)
    .where(isNull(questions.curriculumChapterId));

  console.log(`Found ${unmappedQuestions.length} questions without chapter mapping\n`);

  let mappedCount = 0;
  let unmappedCount = 0;

  for (const q of unmappedQuestions) {
    const normalizedSubject = normalizeSubject(q.subject);

    // Map zoology to botany chapters if needed (biology subjects share chapters)
    let subjectChapters = chaptersBySubject[normalizedSubject] || [];

    // For zoology, also check botany chapters (NEET biology)
    if (normalizedSubject === 'zoology' && subjectChapters.length === 0) {
      subjectChapters = chaptersBySubject['botany'] || [];
    }

    if (subjectChapters.length === 0) {
      console.log(`No chapters found for subject: ${q.subject}`);
      unmappedCount++;
      continue;
    }

    // Find best matching chapter
    let bestMatch: { id: string; name: string; score: number } | null = null;

    for (const chapter of subjectChapters) {
      const keywords = topicMappings[chapter.name] || [];
      const score = calculateMatchScore(
        q.topic,
        q.questionText.substring(0, 500),
        chapter.name,
        keywords
      );

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: chapter.id, name: chapter.name, score };
      }
    }

    if (bestMatch && bestMatch.score >= 10) {
      // Update the question with the chapter ID
      await db
        .update(questions)
        .set({ curriculumChapterId: bestMatch.id })
        .where(eq(questions.id, q.id));

      console.log(`Mapped: "${q.topic}" -> "${bestMatch.name}" (score: ${bestMatch.score})`);
      mappedCount++;
    } else {
      console.log(`Could not map: "${q.topic}" (subject: ${q.subject})`);
      unmappedCount++;
    }
  }

  console.log(`\n✅ Mapping complete!`);
  console.log(`   Mapped: ${mappedCount} questions`);
  console.log(`   Unmapped: ${unmappedCount} questions`);

  process.exit(0);
}

mapQuestionsToChapters().catch(console.error);
