// app/components/themeState.js
// Shared mutable theme state object.
// TrackerApp (in page.js) writes to this object on every render.
// UI components (in ui.js) read from it.
// Using an object property mutation avoids the ES module immutable-binding problem.

var themeState = {
  isThesis: true,
  isBm: false,
  isForest: false,
  isPurple: false,
  isOcean: false,
  fm: "'JetBrains Mono','SF Mono',monospace",
  fh: "'Instrument Serif',Georgia,serif",
  fb: "'DM Sans','Helvetica Neue',sans-serif",
};

export default themeState;
