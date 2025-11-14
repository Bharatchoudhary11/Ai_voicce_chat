const listeners = new Map();

const state = {
  requests: [],
  selectedRequestId: null,
  knowledgeBase: [],
  activityLog: [],
  isSaving: false,
  appReady: false,
  requestFilter: "all",
  requestSearch: "",
  activeChatRequestId: null,
  kbViewMode: "selection", // 'selection' | 'all'
  kbSearch: "",
};

export function getState() {
  return clone(state);
}

export function setState(partial) {
  Object.assign(state, partial);
  broadcast();
}

function broadcast() {
  listeners.forEach((cb) => {
    cb(getState());
  });
}

export function subscribe(key, cb) {
  listeners.set(key, cb);
  cb(getState());
  return () => listeners.delete(key);
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
