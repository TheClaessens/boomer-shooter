// Inline every asset (logo, faces) so the build folds into one HTML file for an artifact.
// Relative base so the build also works under GitHub Pages' /boomer-shooter/ path.
export default { base: './', build: { assetsInlineLimit: () => true } };
