/**
 * What a document hosted in a side panel can see about the page beside it.
 *
 * ## What it is for
 *
 * This is the only file in the repository that can answer M11's first question, because **the
 * panel is not observable from Playwright**. `chrome.sidePanel.open()` resolves, `getPanelState()`
 * reports, and neither of those is the same fact as *the panel ran and learned something*. The
 * panel's own report is the only reading that is about the panel rather than about a call.
 *
 * ## Why every read is attempted and recorded, including the ones that throw
 *
 * Because the interesting arms are the ones that fail, and a read wrapped in a try/catch that
 * swallows its cause would report "nothing" for an extension with `tabs` and for one without it.
 * **Each observation carries both its value and whether it threw**, and `driver` prints both.
 *
 * ## Why the report carries a sequence number and a reason
 *
 * **D5's whole claim is about the difference between "the panel is still there" and "the panel
 * re-evaluated", and a report with no sequence cannot tell them apart.** A panel that loaded once
 * and reported once looks identical, through a single read, to a panel that is following the tab.
 *
 * The reason is the sharper half. `chrome.tabs.onActivated` is reachable without the `tabs`
 * permission, so a panel **can** register a listener and re-report on its own - and that would make
 * a naive second read look like a success for a design that relies on an explicit re-report. The
 * driver therefore reads three times: after load, after a driven tab switch with nothing asked of
 * the panel, and after an explicit ask. Those three answers are three different branches and D5
 * names them separately, so they are recorded separately.
 *
 * **The reason is the action's own name**, so `load`, `activated`, `reread`, `messageActiveTab` and
 * `reachProvider` are all tellable apart by a reader who does not know which call the driver made.
 */

/** Must match `probe.js`'s key. Spelled here rather than imported, because a fixture is not built. */
const PANEL_REPORT_KEY = "__spectreSidePanelPanelReport";

/** The message the driver uses to ask the panel to look again, without changing the tab. */
const REREAD_MESSAGE = "__spectreSidePanelReread";

/** The previous report, if any, so a re-report can be told from the first one. */
async function previousReport() {
  const held = await chrome.storage.local.get(PANEL_REPORT_KEY);
  return held[PANEL_REPORT_KEY] ?? null;
}

/**
 * Ask the active tab's questions, one at a time, and keep every answer.
 *
 * **Read separately rather than as one batch**, because the arms are independent: a `tabs.query`
 * that throws says nothing about `tab.url`, and collapsing them would let one failure stand in for
 * the permission question the whole run exists to measure.
 */
async function whatIPanelCanSee() {
  const observations = {
    // **`chrome.windows.getCurrent()` is the cheapest possible first read** and is included because
    // it needs no permission at all, so it is the reading that distinguishes "the panel exists and
    // is running" from "the panel could not get anywhere" - the two failures that look alike.
    window: { value: null, threw: null },
    // `getCurrent()` in a panel context is a real question and not a formality: a panel is not a
    // tab, so this is expected to be `undefined`, and an implementation that assumed a tab is
    // "current" here would be assuming something the platform may contradict.
    currentTab: { value: null, threw: null },
    queriedTabs: { value: null, threw: null, count: null },
    activeTabId: { value: null, threw: null },
    // **The permission question.** `tab.url` is withheld without `tabs` or a matching host
    // permission, and it comes back `undefined` rather than throwing - which is why `host` is read
    // as its own field rather than derived from `url`.
    activeTabUrl: { value: null, threw: null, withheld: null },
    activeTabHostname: { value: null, threw: null, withheld: null },
    activeTabTitle: { value: null, threw: null, withheld: null },
    // Whether `url` was absent because the permission is missing or because the tab genuinely has
    // none. These are different answers and the run must not merge them.
    activeTabPendingUrl: { value: null, threw: null },
  };

  try {
    const current = await chrome.windows.getCurrent();
    observations.window.value = current
      ? { id: current.id, type: current.type, focused: current.focused, state: current.state }
      : null;
  } catch (cause) {
    observations.window.threw = String(cause);
  }

  try {
    // **`getCurrent` is called without a callback and read as a promise**, which is the MV3 form.
    // A panel-hosted document is a document in a window, so this either resolves to a tab object
    // or resolves to `undefined`; either way it is recorded rather than assumed.
    const current = await chrome.tabs.getCurrent();
    observations.currentTab.value = current ? { id: current.id, windowId: current.windowId } : null;
  } catch (cause) {
    observations.currentTab.threw = String(cause);
  }

  let active = null;
  try {
    const found = await chrome.tabs.query({ active: true, currentWindow: true });
    observations.queriedTabs.value = found.map((tab) => ({ id: tab.id, windowId: tab.windowId }));
    observations.queriedTabs.count = found.length;
    active = found[0] ?? null;
    observations.activeTabId.value = active ? active.id : null;
  } catch (cause) {
    observations.queriedTabs.threw = String(cause);
  }

  if (active) {
    observations.activeTabUrl.value = active.url ?? null;
    observations.activeTabUrl.withheld = active.url === undefined;
    observations.activeTabTitle.value = active.title ?? null;
    observations.activeTabTitle.withheld = active.title === undefined;
    observations.activeTabPendingUrl.value = active.pendingUrl ?? null;

    // **`URL` is used rather than a bare `new URL(...)` in a try**, and the throw is recorded as its
    // own observation: a page served from `about:blank` has no hostname and the run must report
    // that as "no hostname" rather than as a permission failure.
    try {
      observations.activeTabHostname.value = active.url ? new URL(active.url).hostname : null;
    } catch (cause) {
      observations.activeTabHostname.threw = String(cause);
    }
  }

  return observations;
}

/**
 * Write one report, attributed to why it was written.
 *
 * **`reason` is what makes the three reads in D5 distinguishable**, and the sequence number is what
 * makes a re-report distinguishable from the first read at all. Both are written before the async
 * reads complete, because a report that arrived out of order would be indistinguishable from one
 * that never arrived.
 */
async function report(reason) {
  const previous = await previousReport();
  const sequence = (previous?.sequence ?? 0) + 1;

  const record = {
    sequence,
    reason,
    // **The panel's own identity is recorded**, because "is this even a panel?" is the question
    // every other reading depends on. A document opened as a tab reports this origin too, which is
    // exactly why the driver labels that arm a substitute rather than a panel.
    panelOrigin: self.location.origin,
    panelHref: self.location.href,
    isExtensionDocument: self.location.protocol === "chrome-extension:",
    startedAt: new Date().toISOString(),
    // **Recorded on every report, not once at load**, because a report whose own `reason` is
    // `activated` is evidence the listener fired and a report that lacks the capability is
    // evidence it could not have. Recording it once and assuming it still holds would let a later
    // report be read as autonomous when it was not.
    canHearTabActivation: onActivatedAvailable,
    observations: await whatIPanelCanSee(),
  };

  await chrome.storage.local.set({ [PANEL_REPORT_KEY]: record });
  return record;
}

/**
 * Report on activation, when the platform offers the event.
 *
 * **The listener's availability is itself recorded**, because route (c) has three branches and one of
 * them is "the panel cannot hear about a tab switch at all". That branch is only visible if the
 * fixture asked and says whether it could.
 */
let onActivatedAvailable = false;
if (chrome.tabs?.onActivated?.addListener) {
  onActivatedAvailable = true;
  chrome.tabs.onActivated.addListener(() => {
    void report("activated");
  });
}

/**
 * Ask one tab a question, from this context.
 *
 * **The two failure shapes are recorded separately and neither is folded into the other.** A tab
 * with no content script rejects with `Could not establish connection`, while a tab whose content
 * script never answers would leave the promise unsettled - and an unsettled promise is reported as a
 * timeout, which is a fact about the driver rather than about the platform. **The rejection is the
 * answer D4's no-content-script arm exists to capture**, so it is read rather than caught-and-forgot.
 */
async function messageTab(tabId, probeMessage) {
  if (tabId === null || tabId === undefined) {
    return { attempted: false, reached: false, reply: null, threw: null, reason: "no tab id" };
  }

  try {
    const reply = await chrome.tabs.sendMessage(tabId, probeMessage);
    return { attempted: true, reached: true, reply: reply ?? null, threw: null, reason: null };
  } catch (cause) {
    // **`chrome.runtime.lastError` is read first, because it carries the platform's own wording**,
    // and a bare `String(cause)` from a rejected extension call is sometimes empty. Recording only
    // one would report "refused" for a call the platform refused and for a bug in this file.
    //
    // **The field is named `reached` and not `delivered`,** and that is a repair rather than a style:
    // the worker's `askPanel` wrapper already has a `delivered` meaning *"the panel answered the
    // worker"*, and both objects land in one payload. A reader comparing `negative.delivered` with
    // `negative.answer.delivered` on one line of output would be comparing two different questions,
    // and the first version of this file had exactly that collision.
    const lastError = chrome.runtime.lastError;
    return {
      attempted: true,
      reached: false,
      reply: null,
      threw: lastError ? null : String(cause),
      reason: lastError?.message ?? String(cause),
    };
  }
}

/**
 * Reach a provider origin directly from an extension-hosted document.
 *
 * **This is the panel half of the question §4.4 answered for a content script**, and the two answers
 * are allowed to differ: a content script's `fetch` obeys the *page's* CORS policy while the
 * extension's `host_permissions` do not reach it, whereas this document's `fetch` is made with the
 * extension's own origin. **The request is issued and the outcome recorded whether or not it
 * succeeds**, because "the network refused it" and "the platform refused to let us ask" are
 * different findings and only one of them is a permission question.
 *
 * **No provider is contacted in this repository's other tiers** and this arm does not change that: a
 * request that reaches the network is a finding about reachability, not a live dependency, and the
 * URL is recorded so a reader can see which one it was.
 */
async function reachProvider() {
  const url = "https://api.guerrillamail.com/ajax.php?f=check_email&seq=0";
  const started = self.performance.now();

  try {
    const response = await fetch(url, { method: "GET" });
    return {
      attempted: true,
      url,
      ok: response.ok,
      status: response.status,
      elapsedMs: Math.round(self.performance.now() - started),
      threw: null,
      // **Only the shape of the answer, never its content.** The arm asks whether the request was
      // *allowed*, and a body read here would be the first live provider traffic in the repository.
      bodyRead: false,
    };
  } catch (cause) {
    return {
      attempted: true,
      url,
      ok: false,
      status: null,
      elapsedMs: Math.round(self.performance.now() - started),
      threw: String(cause),
      bodyRead: false,
    };
  }
}

/** Everything an explicit ask can make this document do, keyed by action name. */
const ACTIONS = {
  reread: () => Promise.resolve({ reread: true }),
  messageActiveTab: (payload) =>
    whatIPanelCanSee().then(async (observations) => {
      const tabId = observations.activeTabId.value;
      return {
        tabId,
        ...(await messageTab(tabId, payload?.probeMessage ?? { type: "__spectreSidePanelProbe" })),
      };
    }),
  reachProvider,
};

/**
 * Report when the worker asks, through the same channel every other extension message uses.
 *
 * **This exists so the driver can distinguish a panel that follows on its own from one that has to
 * be told.** Without it, a re-report after a tab switch could only have come from the listener, and
 * M11 could not tell whether it needs to register one.
 *
 * **An unknown action is answered rather than ignored**, for the reason `content.js` gives: an
 * unanswered message leaves the caller's promise unsettled, and an unsettled promise is reported as a
 * timeout - a fact about the driver wearing the costume of a fact about the platform.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const requested = message?.type === REREAD_MESSAGE ? "reread" : message?.action;
  const action = typeof requested === "string" ? ACTIONS[requested] : undefined;

  if (!action) {
    sendResponse({ ok: false, reason: `no action named ${JSON.stringify(requested)}` });
    return false;
  }

  void action(message.payload)
    .then((extra) =>
      report(requested).then((record) => ({ ok: true, sequence: record.sequence, ...extra })),
    )
    .then(sendResponse, (cause) => sendResponse({ ok: false, reason: String(cause) }));
  return true;
});

// **The load report is written from a module script, which runs after the document parses.** The
// sequence number it carries is what makes the driver's later reads distinguishable from this one.
void report("load");
