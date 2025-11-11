const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestSeeds = [
  {
    id: "REQ-001",
    customerName: "Alex Chen",
    channel: "phone",
    question: "Do you offer balayage for short hair?",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    escalatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    history: [
      { timestamp: Date.now() - 1000 * 60 * 12, message: "Caller asked about balayage." },
      { timestamp: Date.now() - 1000 * 60 * 11, message: "AI unsure, escalated to supervisor." },
    ],
  },
  {
    id: "REQ-002",
    customerName: "Priya Patel",
    channel: "sms",
    question: "Are you open on Thanksgiving?",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    escalatedAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    history: [
      { timestamp: Date.now() - 1000 * 60 * 40, message: "SMS: Are you open on Thanksgiving?" },
      { timestamp: Date.now() - 1000 * 60 * 39, message: "AI: I'll check with my supervisor." },
    ],
  },
];

const knowledgeSeed = [
  {
    id: "KB-1001",
    topic: "Hours",
    question: "What are the weekend hours?",
    answer: "We are open 9am-6pm on Saturdays and 10am-4pm on Sundays.",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    sourceRequestId: "REQ-1000",
  },
];

let requests = structuredClone(requestSeeds);
let knowledgeBase = structuredClone(knowledgeSeed);

export async function fetchRequests() {
  await sleep(200);
  return structuredClone(requests);
}

export async function fetchKnowledgeBase() {
  await sleep(150);
  return structuredClone(knowledgeBase);
}

export async function submitResponse(requestId, payload) {
  await sleep(300);
  requests = requests.map((req) => {
    if (req.id !== requestId) return req;
    const resolvedAt = new Date().toISOString();
    const updated = {
      ...req,
      status: payload.unresolved ? "unresolved" : "resolved",
      resolvedAt,
      answer: payload.answer,
      resolutionNotes: payload.unresolved ? payload.notes : payload.answer,
      history: [
        ...req.history,
        { timestamp: Date.now(), message: `Supervisor responded: ${payload.answer}` },
      ],
    };
    if (!payload.unresolved) {
      const kbEntry = {
        id: `KB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        topic: payload.topic || "General",
        question: req.question,
        answer: payload.answer,
        updatedAt: resolvedAt,
        sourceRequestId: req.id,
      };
      knowledgeBase = [kbEntry, ...knowledgeBase];
    }
    return updated;
  });
  return requests.find((r) => r.id === requestId);
}

export async function markTimeout(requestId) {
  await sleep(200);
  requests = requests.map((req) =>
    req.id === requestId
      ? {
          ...req,
          status: "unresolved",
          resolvedAt: new Date().toISOString(),
          history: [
            ...req.history,
            { timestamp: Date.now(), message: "Marked unresolved after timeout." },
          ],
        }
      : req
  );
  return requests.find((r) => r.id === requestId);
}
