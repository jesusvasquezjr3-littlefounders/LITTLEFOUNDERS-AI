// Fallback for an unrecognized adventure.theme (COURSE_ENGINE.md §2: theme
// is a closed-but-extensible id — new content can land before the matching
// scene ships in code). ILLUSTRATION ASSET, same exemption as the named
// scenes (see scenes.css header).
export default function GradientFallbackScene() {
  return (
    <div className="lf-scene relative h-full w-full overflow-hidden bg-gradient-to-br from-primary/70 via-primary-strong/60 to-[#080f28]">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_20%,rgba(255,255,255,0.18),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(125%_105%_at_50%_28%,transparent_50%,rgba(0,0,0,0.34)_100%)]" />
    </div>
  )
}
