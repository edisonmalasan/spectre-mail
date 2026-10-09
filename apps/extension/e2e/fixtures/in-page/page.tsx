import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * The in-page fixture: a real page with real frameworks' own state, published to the DOM.
 *
 * ## Everything here is published through the document, and that is forced
 *
 * **Measured, in `docs/PROVIDERS.md` §4.2: a content script runs in the isolated world, so its
 * `globalThis` is not the page's.** A variable the page assigned is invisible from the content
 * script no matter when it was assigned. The probe that discovered this read a page global and
 * got `null` for every arm — including one read *before* any insertion, which should have been
 * the empty string — and drew the exact inverse conclusion.
 *
 * So React's state is **rendered into the document**, and the page's own listeners **append to
 * the document**. The DOM is the one channel a content script and a page genuinely share, and
 * it is also how a user could observe the same thing: a framework that thinks a field is empty
 * will overwrite the address on its next render, and that is visible without any instrumentation.
 *
 * ## Not `StrictMode`
 *
 * The probe measured each dispatched event arriving **twice**, which is `StrictMode`
 * double-invoking effects in development. That is a fact about the fixture, not about the
 * extension, and using `StrictMode` here would make the browser tier assert a doubled list that
 * has nothing to do with the product. It is deliberately absent.
 */

/**
 * Renders the value React's own state holds, so the extension's insertion can be observed.
 *
 * **The `name` and `autocomplete` are parameters because the page needs to say three different
 * things about its own fields, and a fixture that can only say one of them makes every
 * recognition assertion vacuous.** The email field is what the address affordance has to find;
 * the declared code field is what a fill has to find; and the discount field is the one that must
 * *not* be found — a page carrying a `discountCode` next to the field under test is what makes
 * "exactly one field qualified" a measurement rather than an accident of a page with nothing else
 * on it.
 */
function Controlled({
  id,
  label,
  name = "email",
  type = "email",
  autoComplete,
}: {
  id: string;
  label: string;
  readonly name?: string;
  readonly type?: string;
  readonly autoComplete?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...(autoComplete === undefined ? {} : { autoComplete })}
      />
      <output data-readback={label}>{value}</output>
    </>
  );
}

/**
 * A plain input whose own listeners report into the document.
 *
 * **Attached in an effect, not at module scope.** Reading the element before `createRoot`
 * commits returns null, so a module-scope listener is never attached and the page appears to
 * ignore the events entirely — which is what the first version of the probe did.
 */
function PlainWithListeners() {
  useEffect(() => {
    const element = document.getElementById("plain-input");
    const log = document.getElementById("plain-events");
    const note = (kind: string) => {
      const item = document.createElement("li");
      item.textContent = kind;
      log?.append(item);
    };
    element?.addEventListener("input", () => note("input"));
    element?.addEventListener("change", () => note("change"));
  }, []);
  return <input id="plain-input" type="email" name="email" />;
}

function App() {
  return (
    <>
      <h1>SpectreMail in-page fixture</h1>

      <label htmlFor="react-input">React-controlled</label>
      <Controlled id="react-input" label="react-input" />

      <label htmlFor="plain-input">Plain</label>
      <PlainWithListeners />

      <label htmlFor="autocomplete-input">autocomplete</label>
      <input id="autocomplete-input" type="text" autoComplete="email" />

      <label htmlFor="named-email">named</label>
      <input id="named-email" type="text" name="emailAddress" />

      <label htmlFor="username-input">not an email field</label>
      <input id="username-input" type="text" name="username" />

      <label htmlFor="prefilled-input">prefilled</label>
      <input id="prefilled-input" type="email" name="email" value="already@typed.example" />

      <button id="not-an-input" type="button">
        not a field
      </button>

      <form
        id="the-form"
        onSubmit={(event) => {
          event.preventDefault();
          document.documentElement.setAttribute("data-form-submitted", "true");
        }}
      >
        <label htmlFor="in-form">inside a form</label>
        <input id="in-form" type="email" name="email" />

        {/**
         * **Inside the form, and that is what makes the refusal observable.**
         *
         * A fill writes a value and announces it. A fill that also submitted would set this
         * form's own `onSubmit`, and a real signup form does not stop at the first field - so
         * `in-page-fill.spec.ts` reads this attribute to prove nothing was submitted, on the same
         * page the delivery was staged on.
         */}
        <label htmlFor="code-input">one-time code</label>
        <Controlled
          id="code-input"
          label="code-input"
          name="otp"
          type="text"
          autoComplete="one-time-code"
        />

        {/**
         * **A field the recogniser must refuse, and it is here rather than in a separate page.**
         *
         * `discountCode` contains the word `code` as a whole word, so a recogniser that stopped at
         * "the name contains a code word" would fill a verification code into a checkout field.
         * Having it on the same page as the one under test is what makes "one field qualified" a
         * claim about the recogniser instead of a claim about how many fields exist.
         */}
        <label htmlFor="discount-input">discount</label>
        <Controlled id="discount-input" label="discount-input" name="discountCode" type="text" />

        <button id="form-submit" type="submit">
          send
        </button>
      </form>

      <ul id="plain-events" />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
