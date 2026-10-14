import { Link, useParams } from "react-router-dom";
import { useSeo } from "../../lib/seo";
import { useCta } from "../../lib/useCta";
import Button from "../../components/ui/Button";
import { Section } from "../../components/ui/Section";
import { postBySlug, postsByDate, type Block } from "../../data/posts";
import { IArrow } from "../../components/ui/icons";

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

/** Renders one content block. Kept exhaustive over Block so adding a block kind
 *  to posts.ts without handling it here is a TypeScript error, not a page that
 *  silently drops a paragraph. */
function Blk({ b }: { b: Block }) {
  switch (b.kind) {
    case "h2":
      return <h2 className="mt-12 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{b.text}</h2>;
    case "h3":
      return <h3 className="mt-8 text-lg font-bold text-fg">{b.text}</h3>;
    case "p":
      return <p className="mt-5 text-[17px] leading-[1.75] text-fg-muted">{b.text}</p>;
    case "ul":
      return (
        <ul className="mt-5 space-y-2.5">
          {b.items.map((i) => (
            <li key={i} className="flex gap-3 text-[17px] leading-[1.7] text-fg-muted">
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-5 space-y-2.5">
          {b.items.map((i, n) => (
            <li key={i} className="flex gap-3 text-[17px] leading-[1.7] text-fg-muted">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                {n + 1}
              </span>
              <span>{i}</span>
            </li>
          ))}
        </ol>
      );
    case "note":
      return (
        <aside className="mt-7 rounded-xl border-l-4 border-brand bg-brand/5 px-5 py-4">
          <p className="text-[15px] leading-relaxed text-fg">{b.text}</p>
        </aside>
      );
    case "code":
      return (
        <pre className="mt-7 overflow-x-auto rounded-xl bg-navy-900 p-5 text-[13px] leading-relaxed text-slate-200">
          <code>{b.code}</code>
        </pre>
      );
    case "table":
      return (
        <div className="mt-7 overflow-x-auto rounded-xl border border-line bg-white shadow-soft">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-fg-dim">
                <th scope="col" className="px-5 py-3 font-semibold">{b.head[0]}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{b.head[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {b.rows.map((r) => (
                <tr key={r[0]}>
                  <th scope="row" className="px-5 py-3.5 align-top font-semibold text-fg">{r[0]}</th>
                  <td className="px-5 py-3.5 align-top text-fg-muted">{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function BlogPost() {
  const { slug = "" } = useParams();
  const post = postBySlug(slug);
  const cta = useCta();

  useSeo(
    post ? post.title : "Post not found",
    post ? post.description : "That post does not exist. See all TryNoBot articles.",
  );

  if (!post) {
    return (
      <Section>
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Post not found</h1>
          <p className="mt-3 text-fg-muted">We don't have an article at that address.</p>
          <Button to="/blog" className="mt-6">See all articles</Button>
        </div>
      </Section>
    );
  }

  const more = postsByDate().filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <article className="container-page py-14">
        <div className="mx-auto max-w-2xl">
          <Link to="/blog" className="text-sm font-semibold text-brand hover:underline">
            ← All articles
          </Link>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <span>{post.tag}</span>
            <span className="text-fg-dim">·</span>
            <span className="font-medium normal-case tracking-normal text-fg-dim">
              {post.readMinutes} min read
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-[2.6rem] sm:leading-[1.12]">
            {post.title}
          </h1>
          <time dateTime={post.date} className="mt-4 block text-sm text-fg-dim">{fmt(post.date)}</time>

          <div className="mt-2">
            {post.blocks.map((b, i) => <Blk key={i} b={b} />)}
          </div>

          {post.related && post.related.length > 0 && (
            <div className="mt-12 rounded-2xl border border-line bg-bg-soft p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-fg-dim">Read next</h2>
              <ul className="mt-3 space-y-2">
                {post.related.map((r) => (
                  <li key={r.to}>
                    <Link to={r.to} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                      {r.label} <IArrow width={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* In-article conversion. The free check is the ask, not the trial:
              a reader who arrived from an informational search is not ready to
              create an account, but will scan their own domain. */}
          <div className="mt-8 rounded-2xl border border-brand/30 bg-brand/5 p-7 text-center">
            <h2 className="text-lg font-bold">See this on your own site</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
              The free exposure check reads only publicly visible information and takes about ten
              seconds. No signup.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button to="/bot-check" size="lg">Run a free check</Button>
              <Button to={cta.signupHref} variant="outline" size="lg">{cta.label("Start free trial")}</Button>
            </div>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <Section className="bg-bg-soft rounded-none !py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-bold">More from the blog</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {more.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`}
                  className="card card-hover shadow-soft group p-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand">{p.tag}</div>
                  <h3 className="mt-2 font-bold leading-snug transition-colors group-hover:text-brand">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
