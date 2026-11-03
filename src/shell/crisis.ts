// A line that sounds like crisis gets helplines, not a command: `mood i want to die` must not be
// looked up as a place. The patterns are Healing Hive's (server/src/utils/crisis.js at 64ea30d),
// deliberately broad: showing helplines to someone who did not need them costs little, missing
// someone who did is the cost that matters. Keep the two lists in step.

const CRISIS_PATTERNS = [
  /\bsuicid/i,
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bend(ing)?\s+(my|this)\s+life\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  /\btake\s+my\s+(own\s+)?life\b/i,
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

/** Phones type a curly apostrophe, so "don’t" has to read as "don't". */
export function looksLikeCrisis(text: string): boolean {
  const plain = text.replace(/[‘’ʼ`]/g, "'");
  return CRISIS_PATTERNS.some(pattern => pattern.test(plain));
}

/** Kenyan lines, as Healing Hive lists them (checked against each organisation in October 2026); any-hour lines first. */
export const HELPLINES = [
  { phone: '999', also: '112', who: 'emergency services, if you might act on these thoughts or are in danger' },
  { phone: '1199', who: 'Kenya Red Cross: free counselling by phone, at any hour' },
  { phone: '+254 722 178 177', who: 'Befrienders Kenya: call, SMS or WhatsApp, weekdays 9am to 5pm' },
];
