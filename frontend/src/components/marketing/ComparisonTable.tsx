import { COMPARISON_CHECKED, COMPETITORS } from "../../data/competitors";

/** Entry tier against the entry tiers buyers actually shortlist.
 *
 *  Deliberately plain: list prices as each vendor publishes them, units named
 *  rather than flattened, and a link to every source so anyone can check.
 *
 *  The last column is the one we lose, and it is in the table on purpose. Ten
 *  sites at a lower price than everyone else's one site is true, but a table in
 *  which we sweep every row reads as an advert and gets discounted wholesale —
 *  the generous number ends up undermining the credible ones. Showing the
 *  capability they have and we don't is what makes the rest of the row
 *  believable, and it is the first thing a serious buyer checks anyway.
 */
export default function ComparisonTable() {
  const rows = [
    {
      name: "TryNoBot Basic", price: 69, volume: "10,000 ad clicks", sites: "10",
      adsExclusions: false, us: true, url: "",
    },
    ...COMPETITORS.map((c) => ({ ...c, us: false, promo: c.promo })),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-fg-dim">
              <th scope="col" className="px-5 py-3 font-semibold">Entry plan</th>
              <th scope="col" className="px-5 py-3 font-semibold">Per month</th>
              <th scope="col" className="px-5 py-3 font-semibold">Included</th>
              <th scope="col" className="px-5 py-3 font-semibold">Sites</th>
              <th scope="col" className="px-5 py-3 font-semibold">Auto IP exclusions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r: any) => (
              <tr key={r.name} className={r.us ? "bg-brand/5" : ""}>
                <td className="px-5 py-4 font-semibold">
                  {r.us ? <span className="text-brand">{r.name}</span> : (
                    <a href={r.url} target="_blank" rel="noopener noreferrer nofollow"
                       className="hover:text-brand">{r.name}</a>
                  )}
                </td>
                <td className="px-5 py-4 font-semibold">
                  ${r.price}
                  {r.promo && <span className="ml-1 font-normal text-fg-dim">(${r.promo} intro)</span>}
                </td>
                <td className="px-5 py-4 text-fg-muted">{r.volume}</td>
                <td className="px-5 py-4 text-fg-muted">{r.sites}</td>
                <td className="px-5 py-4">
                  {r.adsExclusions
                    ? <span className="font-semibold text-emerald-700">Yes</span>
                    : <span className="text-fg-dim">Not yet</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-fg-dim">
        List prices read from each vendor's own pricing page on {COMPARISON_CHECKED}; introductory
        discounts and annual rates may differ, so check theirs before deciding. Units are quoted as
        each vendor states them — Fraud Blocker and ClickPatrol meter ad clicks, ClickCease meters
        all site visits, which is a tighter cap than the same number of ad clicks, not a looser one.
      </p>
      <p className="mt-3 text-xs text-fg-dim">
        <b className="text-fg-muted">Two honest notes on that table.</b> Auto IP exclusions means the
        tool writes blocked addresses back into your Google Ads account through the API, so you stop
        paying for those clicks at the source. Theirs do; ours doesn't yet, and if that is the main
        thing you want then one of theirs is the better buy today. And ten sites costs us no more to
        run than one — a visit is scored by a small Go service reading from memory, so the site count
        is a fairness limit rather than something we have to charge for. It is cheap because of how
        it is built, not because of what it leaves out.
      </p>
    </div>
  );
}
