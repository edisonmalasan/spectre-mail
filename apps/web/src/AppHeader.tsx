/**
 * The dark header bar. The reference carries store badges and premium links here;
 * SpectreMail has neither, and a dead control is worse than no control, so the two
 * sides carry only product facts. No provider name is advertised: SpectreMail is
 * one product, and attribution lives where it is operationally required (the
 * footer/docs), not as a header badge for a single provider. The brand stays centred.
 *
 * @module
 */

import { Wordmark } from "./Wordmark";

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__side">
        <span className="app-header__pill">No account</span>
        <span className="app-header__pill">No server</span>
      </div>
      <Wordmark />
      <div className="app-header__side app-header__side--end">
        <span className="app-header__pill">Disposable</span>
        <span className="app-header__pill">No account required</span>
      </div>
    </header>
  );
}
