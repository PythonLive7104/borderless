/** Renders a JSON-LD graph into the markup.
 *
 *  In the markup, not injected from an effect: the prerender step serialises
 *  what React renders, so a script written here ends up in the static HTML that
 *  crawlers and answer engines actually read. One injected from useEffect would
 *  only ever exist in a hydrated browser, which is nobody we're optimising for.
 */
export default function JsonLd({ data }: { data: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: data }} />;
}
