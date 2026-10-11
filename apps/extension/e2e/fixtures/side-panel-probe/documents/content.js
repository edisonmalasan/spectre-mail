/**
 * The page-side half of the `sendMessage` arm.
 *
 * ## Why it exists
 *
 * `proposal.md` asks whether a panel-hosted document can `chrome.tabs.sendMessage` the page beside
 * it. **That question has no answer without a page that answers**, so this script is the positive
 * half and the absence of a content script on some other tab is the negative half.
 *
 * ## Why it reports its own `location`
 *
 * **Because the arm's subject is what the panel learned, not what it sent.** A reply that carried no
 * information would satisfy "the panel reached the page" and say nothing about "the panel knows
 * which page it reached" — and the second is the property M11 slice 1 turns on. The reply is
 * therefore the page reading *its own* `location`, so a panel that reached the wrong tab is visible.
 *
 * ## Why it answers an unknown message with `undefined` rather than ignoring it
 *
 * **Because an ignored message is a hang.** `sendResponse` must be called and the listener must
 * return `true`, or the caller's promise never settles and the arm is reported as a timeout rather
 * than as an answer. Every message this receives is answered, including one it does not recognise,
 * so a driver asking the wrong question gets a wrong answer rather than no answer.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    sendResponse({
      from: "content-script",
      saw: message ?? null,
      hostname: location.hostname,
      href: location.href,
    });
  })();
  return true;
});
