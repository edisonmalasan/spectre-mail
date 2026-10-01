/**
 * Website client root component.
 *
 * M1 (monorepo foundation) renders a plain factual status page and nothing more.
 * There is deliberately **no styling, no design token, and no product UI** here.
 *
 * Visual work starts at M7 under the approved Spectral Swiss Utility direction.
 * Building an interface now would produce markup and CSS that M7 rewrites, and
 * would spend a foundation milestone on polish the roadmap explicitly defers.
 * The approved design skills are not applied at this milestone.
 *
 * This component also deliberately shows no mailbox UI. Mailbox behaviour is
 * M2 (domain model) and M3 (provider layer); neither exists yet, and a mock
 * mailbox here would be fake product UI that reads as working software.
 */
export function App() {
  return (
    <main>
      <h1>SpectreMail</h1>
      <p>Temporary email for the web and the browser.</p>
      <p>
        This is the M1 monorepo foundation. The website client builds, type checks, lints, and
        serves. It has no mailbox feature yet.
      </p>
      <p>
        No backend is involved. SpectreMail operates no server and never proxies a provider API.
      </p>
    </main>
  );
}
