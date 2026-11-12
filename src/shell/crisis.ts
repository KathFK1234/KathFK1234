// A line that sounds like crisis gets helplines, not a command: `mood i want to die` must not be
// looked up as a place. The patterns are Healing Hive's (server/src/utils/crisis.js at f37b0a0),
// deliberately broad: showing helplines to someone who did not need them costs little, missing
// someone who did is the cost that matters. Keep the two lists in step.
//
// Healing Hive's DANGER_PATTERNS are copied too: someone hit, raped or threatened by another person
// gets the violence lines (GBV 1195, Child 116), as Healing Hive's DANGER_REPLY gives them.

const CRISIS_PATTERNS = [
  /\bsuicid/i,
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bend(ing)?\s+(my|this)\s+life\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  /\b(take|taking|took)\s+my\s+(own\s+)?life\b/i,
  /\b(want|wish|going|ready)\s+to\s+die\b/i,
  /\b(wanna|gonna)\s+die\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
  /\bno\s+point\s+(in|to)\s+(living|live|going\s+on|go\s+on)\b/i,
  /\bnothing\s+to\s+live\s+for\b/i,
  /\bcan(no|')?t\s+go\s+on\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|be\s+here)\b/i,
  /\b(hurt|harm|cut)(ing|ting)?\s+my\s?self\b/i,
  /\bself[-\s]?harm/i,
  /\boverdos/i,
  /\bunalive\b/i,
  /\b(gonna|wanna|going\s+to|want\s+to|should|might|just)\s+kms\b/i,
  /\bnot\s+worth\s+living\b/i,
  /\bcan(no|')?t\s+(take|do)\s+(it|this)\s+any\s?more\b/i,
  /\b(hope|wish|want|pray)\b.{0,20}\bnever\s+wake\s+up\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+wake\s+up\b/i,
  /\bdisappear\s+forever\b/i,
  // Ways and means: these are among the most urgent things someone can say
  /\bhang(ing)?\s+my\s?self\b/i,
  /\bjump(ing)?\s+(off|from|in\s+front\s+of)\s+(a|an|the|this|that)?\s*(bridge|building|roof|balcony|cliff|train|car|bus|lorry|truck|matatu)\b/i,
  /\b(took|take|taking|swallow(ed|ing)?)\s+too\s+many\s+(pills|tablets|meds)\b/i,
  /\b(took|swallow(ed|ing)?)\s+all\s+(my|the|of\s+my)\s+(pills|tablets|meds|medicine)\b/i,
  /\b(drink|drinking|drank|swallow(ed|ing)?|take|taking|took)\s+(poison|jik|bleach|rat\s+poison|dawa\s+ya\s+panya)\b/i,
  /\b(have|got|bought)\s+(a|the)\s+rope\b/i,
  // Wishing not to be alive, and saying goodbye
  /\bend(ing)?\s+(things|everything)\b(?!\s+with\b)/i,
  /\b(won'?t|will\s+not)\s+be\s+(here|around|alive)\s+(tomorrow|much\s+longer|any\s?more)\b/i,
  /\bthis\s+is\s+(my\s+)?goodbye\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+exist\b/i,
  /\bstop\s+existing\b/i,
  /\b(is\s*n'?t|is\s+not)\s+worth\s+living\b/i,
  /\btired\s+of\s+(living|being\s+alive|life)\b/i,
  /\bdone\s+with\s+(life|living)\b/i,
  /\bfeel\s+like\s+dying\b/i,
  /\b(nobody|no\s+one)\s+would\s+(miss|notice|care)\b.{0,25}\b(gone|dead|die|died)\b/i,
  /\ba\s+burden\s+to\s+(everyone|everybody|my\s+family|them|all)\b/i,
  /\b(natamani|ningependa|heri|afadhali)\s+(ni)?(kufa|nife)\b/i,
  /\b(ku|ni|nita|nime|ta)?kunywa\s+sumu\b/i,
  /\bmaisha\s+(haina|hayana)\s+maana\b/i,
  /\b(najihisi|nahisi|naskia|najiskia)\s+(kama\s+)?kufa\b/i,
  /\b(ku|ni|na|nita|ta)jiua\b/i,
  /\bnijiue\b/i,
  /\bkujitoa\s+uhai\b/i,
  /\b(ku|ni|nita)jimaliza\b/i,
  /\bnijimalize\b/i,
  /\bnimechoka\s+(na\s+maisha|kuishi)\b/i,
  /\bsina\s+sababu\s+ya\s+kuishi\b/i,
  /\bni?jinyonge\b/i,
  /\bkujinyonga\b/i,
  /\bkujidhuru\b/i,
  /\bnataka\s+kufa\b/i,
  /\bbora\s+nife\b/i,
  /\bsitaki\s+kuishi\b/i,
];

// Being hurt or threatened by another person (Healing Hive's DANGER_PATTERNS, same order).
const DANGER_PATTERNS = [
  /\b(he|she|they|my\s+\w+)\s+(beats?|hits?|chokes?|strangles?|kicks?|slaps?)\s+me\b(?!\s+(up|at|to|in)\b)/i,
  /\b(he|she|they|my\s+\w+)\s+(raped|rapes|molested|molests|forced\s+himself|forced\s+herself)\b/i,
  /\bi\s+(was|got|have\s+been|am\s+being|'?ve\s+been)\s+(raped|molested|sexually\s+(assaulted|abused)|abused|beaten)\b/i,
  /\b(uncle|father|dad|stepfather|stepdad|teacher|pastor|boss|brother|cousin|husband|boyfriend|he)\s+(touches|touched|keeps\s+touching)\s+me\b/i,
  /\b(scared|afraid|terrified)\s+(he|she|they)('ll|\s+will|\s+is\s+going\s+to|\s+are\s+going\s+to|\s+might)\s+(kill|hurt|beat)\s+me\b/i,
  /\bthreaten(ed|s|ing)?\s+to\s+(kill|hurt|beat)\s+me\b/i,
  /\b(not|don'?t\s+feel)\s+safe\s+at\s+home\b/i,
  /\b(a|ali|ame|hu)(na)?nipiga\b/i,
  /\b(a|ali|ame)(na)?nibaka\b/i,
  /\b(a|ali|ame)(na)?nitishia\b/i,
];

/** Phones type a curly apostrophe, so "don’t" has to read as "don't". */
const plainText = (text: string) => text.replace(/[‘’ʼ`]/g, "'");

export type Helpline = Readonly<{ phone: string; also?: string; who: string }>;
export type SafetyReply = Readonly<{ kind: 'crisis' | 'danger'; lines: readonly Helpline[] }>;

// Frozen: every reply shares these, so nothing that receives one can change a number for the next.
const line = (helpline: Helpline): Helpline => Object.freeze(helpline);
const list = (...lines: Helpline[]): readonly Helpline[] => Object.freeze(lines);

// Kenyan lines, as Healing Hive lists them (checked against each organisation in October 2026).
const EMERGENCY_CRISIS = line({ phone: '999', also: '112', who: 'emergency services, if you might act on these thoughts or are in danger' });
const EMERGENCY_DANGER = line({ phone: '999', also: '112', who: 'emergency services, if you are in danger right now' });
const RED_CROSS = line({ phone: '1199', who: 'Kenya Red Cross: free counselling by phone, at any hour' });
const GBV = line({ phone: '1195', who: 'GBV helpline: free, at any hour, for anyone facing sexual or gender-based violence' });
const CHILD = line({ phone: '116', who: 'Child helpline: free, at any hour, if you are under 18' });
const BEFRIENDERS = line({ phone: '+254 722 178 177', who: 'Befrienders Kenya: call, SMS or WhatsApp, weekdays 9am to 5pm' });

/** Thoughts of dying; any-hour lines first. */
const HELPLINES = list(EMERGENCY_CRISIS, RED_CROSS, BEFRIENDERS);
/** Being hurt or threatened, in the order of Healing Hive's DANGER_REPLY. */
const DANGER_HELPLINES = list(EMERGENCY_DANGER, GBV, CHILD, RED_CROSS);
/** Both at once: the crisis reply, with the violence lines added so neither set is lost. */
const BOTH_HELPLINES = list(EMERGENCY_CRISIS, RED_CROSS, GBV, CHILD, BEFRIENDERS);

/**
 * The reply a line needs, or null. Thoughts of dying come first, as in Healing Hive; when the line
 * also says someone is hurting them, the GBV and Child lines are added rather than dropped.
 */
export function safetyReplyFor(text: string): SafetyReply | null {
  const plain = plainText(text);
  const crisis = CRISIS_PATTERNS.some(pattern => pattern.test(plain));
  const danger = DANGER_PATTERNS.some(pattern => pattern.test(plain));
  if (crisis) return { kind: 'crisis', lines: danger ? BOTH_HELPLINES : HELPLINES };
  if (danger) return { kind: 'danger', lines: DANGER_HELPLINES };
  return null;
}

/** Any line that gets helplines instead of running: it is never sent anywhere or saved. */
export function looksLikeCrisis(text: string): boolean {
  return safetyReplyFor(text) !== null;
}
