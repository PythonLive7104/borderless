"""Write approved testimonials into the frontend's static data file.

Why a build-time export rather than a public API the landing page fetches:

  * The landing page is pre-rendered. Testimonials fetched after hydration are
    invisible to crawlers and answer engines, which is most of the point of
    publishing them — Review markup in the served HTML is what can produce a
    star rating in a search result.
  * It is where paid traffic lands. A fetch on first paint is a request in the
    critical path of the page you are paying per click to show.
  * Testimonials change monthly at most. A deploy step is the right cadence.

The trade is that approving one in the admin does not publish it. The flow is:
approve -> run this -> rebuild and deploy. The command says so when it finishes.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.testimonials.models import Testimonial

# backend/apps/testimonials/management/commands/ -> repo root -> frontend/...
DEFAULT_OUT = (Path(__file__).resolve().parents[5]
               / "frontend" / "src" / "data" / "testimonials.ts")

HEADER = '''/** Published customer testimonials.
 *
 *  GENERATED FILE — do not edit by hand. Written by:
 *      python manage.py export_testimonials
 *
 *  Every entry is approved and carries recorded consent to publish the name,
 *  role and company shown. To change one, change it in the admin and re-run the
 *  command; editing here would publish words nobody reviewed and detach the
 *  quote from the consent record that justifies it being on the site at all.
 */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  country: string;
  rating: number;
}

export const TESTIMONIALS: Testimonial[] = '''

FOOTER = ''';

/** Whether there is anything to show. The landing page renders no testimonial
 *  section at all when this is false — an empty carousel, or worse a invented
 *  placeholder, is a stronger negative signal than simply not having the
 *  section yet. */
export const HAS_TESTIMONIALS = TESTIMONIALS.length > 0;

/** Mean rating, for Review/AggregateRating markup. Null when there is nothing
 *  to average: schema claiming a rating with no reviews behind it is exactly
 *  the kind of markup that earns a manual action. */
export const AVERAGE_RATING: number | null = TESTIMONIALS.length
  ? Math.round((TESTIMONIALS.reduce((a, t) => a + t.rating, 0) / TESTIMONIALS.length) * 10) / 10
  : null;
'''


class Command(BaseCommand):
    help = "Export approved, featured testimonials to frontend/src/data/testimonials.ts"

    def add_arguments(self, parser):
        parser.add_argument("--out", default=str(DEFAULT_OUT),
                            help="Path to the generated .ts file.")
        parser.add_argument("--all-approved", action="store_true",
                            help="Include approved rows that are not featured.")

    def handle(self, *args, **opts):
        qs = Testimonial.objects.filter(status=Testimonial.Status.APPROVED, consent=True)
        if not opts["all_approved"]:
            qs = qs.filter(featured=True)
        qs = qs.order_by("sort", "-created_at")

        rows = [{
            "quote": t.quote.strip(),
            "name": t.author_name.strip(),
            "role": t.author_role.strip(),
            "company": t.author_company.strip(),
            "country": t.country.strip(),
            "rating": t.rating,
        } for t in qs]

        out = Path(opts["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        body = json.dumps(rows, indent=2, ensure_ascii=False)
        out.write_text(HEADER + body + FOOTER, encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(f"Wrote {len(rows)} testimonial(s) to {out}"))
        if rows:
            self.stdout.write("Rebuild and deploy the web image to publish them.")
        else:
            self.stdout.write("Nothing approved yet — the landing page will omit the section.")
