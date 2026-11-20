/**
 * The dark header bar. The reference carries store badges and premium links here;
 * SpectreMail has neither, and a dead control is worse than no control, so the two
 * sides carry the two facts that are true — no account, and the one provider this
 * client reaches. The brand stays centred, as in the reference.
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
        <span className="app-header__pill app-header__pill--provider">Guerrilla Mail</span>
      </div>
    </header>
  );
}
