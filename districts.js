// District definitions for the Brainstorm AGI circuit-board highway.
// Districts are arranged as checkpoints along a main north-south circuit
// trace (the Z axis) so the camera can travel down the road from one
// space-age structure to the next. Each district has a distinct building
// archetype (`kind`) used by the 3D scene's builder map.

export const DISTRICTS = [
  {
    id: "spire",
    name: "The Spire",
    sub: "HQ  //  We Build AI That Works",
    coord: "00 / 00",
    pos: [0, 0, 0],
    color: 0xff2a2a,
    tall: 160,
    kind: "spire"
  },
  {
    id: "foundry",
    name: "Agent Foundry",
    sub: "Named AI Employees  //  270+ Roster",
    coord: "+12 / -22",
    pos: [120, 0, -240],
    color: 0xff3a3a,
    tall: 70,
    kind: "foundry"
  },
  {
    id: "voice",
    name: "Voice Grid",
    sub: "Inbound  //  Outbound  //  SMS  //  Chat",
    coord: "-13 / -46",
    pos: [-130, 0, -480],
    color: 0xff5050,
    tall: 110,
    kind: "antenna"
  },
  {
    id: "ops",
    name: "Ops Tower",
    sub: "Dashboards  //  Analytics  //  Compliance",
    coord: "+13 / -70",
    pos: [130, 0, -720],
    color: 0x4ff3ff,
    tall: 120,
    kind: "ops"
  },
  {
    id: "revenue",
    name: "Revenue Engine",
    sub: "Speed-to-Lead  //  AR  //  Win-Back",
    coord: "-14 / -94",
    pos: [-140, 0, -960],
    color: 0xf7c843,
    tall: 80,
    kind: "reactor"
  },
  {
    id: "content",
    name: "Content Forge",
    sub: "AI Video  //  Imagery  //  SEO",
    coord: "+14 / -118",
    pos: [140, 0, -1200],
    color: 0xff7a2a,
    tall: 70,
    kind: "studio"
  },
  {
    id: "integration",
    name: "Integration Hub",
    sub: "8,000+ Apps  //  HIPAA  //  SOC 2",
    coord: "-13 / -142",
    pos: [-130, 0, -1440],
    color: 0x4ff3ff,
    tall: 90,
    kind: "hub"
  },
  {
    id: "contact",
    name: "Contact Pad",
    sub: "Start a Project",
    coord: "00 / -168",
    pos: [0, 0, -1700],
    color: 0xff2a2a,
    tall: 50,
    kind: "pad"
  }
];

// Agent roster sample for the Foundry wall. The ticker "270+" is preserved
// on the page; this list is a visible sample pulled from the roster.
export const AGENT_SAMPLE = [
  ["Executive Assistant","PA"],["Receptionist","Voice"],["SDR","Sales"],
  ["Collections","AR"],["Bookkeeper","Finance"],["Recruiter","HR"],
  ["Marketing Director","Mktg"],["Creative Director","Mktg"],["Ad Creative","Mktg"],
  ["Community Manager","Mktg"],["Content Writer","Content"],["Video Editor","Content"],
  ["Podcast Producer","Content"],["Music Producer","Content"],["Voiceover Artist","Content"],
  ["Food Photographer","Content"],["Real-Estate Photog","Content"],["AI Photographer","Content"],
  ["Logo Designer","Design"],["Translator","Ops"],["Meeting Summarizer","Ops"],
  ["Inventory Manager","Ops"],["Shipping Manager","Ops"],["Customer Onboarding","CX"],
  ["Win-Back Engine","Revenue"],["Reputation","Revenue"],["Proposal Gen","Revenue"],
  ["Outbound SDR","Revenue"],["Competitive Intel","Strat"],["Patent Research","Legal"],
  ["Contract Reviewer","Legal"],["Tax Prep","Finance"],["Grant Writer","Ops"],
  ["Event Planner","Ops"],["Course Creator","Content"],["Resume Writer","HR"],
  ["Data Dashboard","Analytics"],["Pet Care","Lifestyle"],["Fitness Coach","Lifestyle"],
  ["Gift Finder","Lifestyle"],["Daily Motivation","Lifestyle"],["Trivia Host","Lifestyle"],
  ["Grocery Commander","Lifestyle"]
];
