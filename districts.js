// District definitions for the Brainstorm AGI circuit city.
// Positions are on a 1200x1200 PCB board (centered at 0,0,0).

export const DISTRICTS = [
  {
    id: "spire",
    name: "The Spire",
    sub: "HQ  //  We Build AI That Works",
    coord: "00 / 00",
    pos: [0, 0, 0],
    color: 0xff2a2a,
    tall: 70,
    kind: "tower",
    info: {
      title: "THE SPIRE",
      tagline: "We Build AI That Works",
      body: [
        "Brainstorm AGI is a multi-industry AI technology company. Custom AI systems for operations, revenue, and scale. Deployed across 18 industries.",
        "Complete AI systems that ship with the architecture to run in production, not just demo well. Not science projects."
      ],
      metrics: [
        ["270+", "agents active"],
        ["18", "industries"],
        ["99.7%", "uptime"],
        ["<200ms", "latency"]
      ]
    }
  },
  {
    id: "foundry",
    name: "Agent Foundry",
    sub: "Named AI Employees  //  270+ Roster",
    coord: "+40 / -18",
    pos: [420, 0, -200],
    color: 0xff2a2a,
    tall: 44,
    kind: "plaza",
    info: {
      title: "AGENT FOUNDRY",
      tagline: "Named AI employees with voice, phone, email, and dashboard.",
      body: [
        "20+ specialist roles, 270+ preset employees, deployed in days. The AI agency model.",
        "Each one has its own voice, identity, phone number, and knowledge base. Autonomous AI that answers phones, handles email, books appointments, manages tasks, and runs workflows."
      ],
      wall: true
    }
  },
  {
    id: "voice",
    name: "Voice Grid",
    sub: "Inbound  //  Outbound  //  SMS  //  Chat",
    coord: "-42 / -22",
    pos: [-440, 0, -240],
    color: 0xff4848,
    tall: 52,
    kind: "antenna",
    info: {
      title: "VOICE GRID",
      tagline: "Conversational voice AI on every line.",
      body: [
        "Inbound and outbound calls, SMS, and chat. Caller verification, call screening, transfer directories, transcription, and recording analysis.",
        "Ultralow-latency voice, human-grade mannerisms, handoff-ready escalation. Integrates with your existing phone system."
      ],
      metrics: [
        ["<200ms", "voice latency"],
        ["24/7", "coverage"],
        ["100+", "languages"]
      ]
    }
  },
  {
    id: "ops",
    name: "Ops Tower",
    sub: "Dashboards  //  Analytics  //  Compliance",
    coord: "+15 / +40",
    pos: [170, 0, 420],
    color: 0x4ff3ff,
    tall: 48,
    kind: "tower",
    info: {
      title: "OPS TOWER",
      tagline: "See everything happening across your operation from a single screen.",
      body: [
        "Real-time dashboards, workforce analytics, compliance monitoring, call intelligence, and performance scoring.",
        "Drill-down from roll-up KPIs to individual records. Alerts, heat maps, predictive signals."
      ],
      metrics: [
        ["12,400+", "data points / day"],
        ["Real-time", "sync"],
        ["Role-based", "access"]
      ]
    }
  },
  {
    id: "revenue",
    name: "Revenue Engine",
    sub: "Speed-to-Lead  //  AR  //  Win-Back",
    coord: "-32 / +34",
    pos: [-350, 0, 360],
    color: 0xf7c843,
    tall: 40,
    kind: "vault",
    info: {
      title: "REVENUE ENGINE",
      tagline: "AI that finds money and brings it in.",
      body: [
        "Speed-to-lead response, automated proposals, collections, nurture sequences, customer win-back, database reactivation, and reputation management.",
        "Pairs with your CRM and billing system. Every touch logged, every promise tracked."
      ],
      metrics: [
        ["$2.3M", "recovered"],
        ["22%", "reactivation rate"],
        ["4x", "close-rate lift"]
      ]
    }
  },
  {
    id: "content",
    name: "Content Forge",
    sub: "AI Video  //  Imagery  //  SEO",
    coord: "+44 / +14",
    pos: [460, 0, 140],
    color: 0xff7a2a,
    tall: 38,
    kind: "chip",
    info: {
      title: "CONTENT FORGE",
      tagline: "One input becomes dozens of assets across every channel.",
      body: [
        "Reports, proposals, presentations, marketing content, AI video, image generation, and SEO.",
        "Brand-locked output. Multi-platform distribution ready. Built on top of the best image, video, and voice models available."
      ],
      metrics: [
        ["6,200+", "assets / quarter"],
        ["Multi-platform", "distribution"],
        ["Brand-locked", "output"]
      ]
    }
  },
  {
    id: "integration",
    name: "Integration Hub",
    sub: "8,000+ Apps  //  HIPAA  //  SOC 2",
    coord: "-38 / +02",
    pos: [-420, 0, 40],
    color: 0x4ff3ff,
    tall: 36,
    kind: "bridge",
    info: {
      title: "INTEGRATION HUB",
      tagline: "Connects to 8,000+ apps. Multi-tenant, white-label ready.",
      body: [
        "HIPAA and SOC 2 compliant. AWS-hosted with encryption, redundancy, and auto-scaling built in.",
        "Phone, SMS, email, web chat, calendar, and task automation ship standard. No add-ons or upsells."
      ],
      metrics: [
        ["8,000+", "apps"],
        ["HIPAA", "compliant"],
        ["SOC 2", "aligned"],
        ["AWS", "hosted"]
      ]
    }
  },
  {
    id: "contact",
    name: "Contact Pad",
    sub: "Start a Project",
    coord: "00 / -38",
    pos: [0, 0, -420],
    color: 0xff2a2a,
    tall: 18,
    kind: "pad",
    info: {
      title: "CONTACT PAD",
      tagline: "Describe your biggest operational challenge.",
      body: [
        "We will show you a working solution within 30 days. No six-month implementations. No consultants. Just results.",
        "rob@brainstormagi.com"
      ],
      metrics: [
        ["30 days", "to working solution"],
        ["Days", "to deploy"],
        ["Custom", "to your data"]
      ],
      contact: true
    }
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
