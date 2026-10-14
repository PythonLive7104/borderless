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

from django.core.management.base import BaseCommand, CommandError

from apps.testimonials.models import Testimonial

REL_OUT = Path("frontend") / "src" / "data" / "testimonials.ts"


def find_default_out():
    """Locate frontend/src/data/ by walking up from this file.

    Not a fixed parents[N]: on the host this file sits at
    <repo>/backend/apps/testimonials/management/commands/, but the container
    mounts ./backend at /app, so counting parents resolved to "/frontend/..." —
    a path that does not exist, which mkdir happily created inside the
    container. The command then reported success while writing to somewhere
    that vanished when the container exited.

    Returns None when no frontend tree is in sight, so the caller can say so
    instead of inventing a destination.
    """
    for parent in Path(__file__).resolve().parents:
        candidate = parent / REL_OUT
        if candidate.parent.is_dir():
            return candidate
    return None

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
        parser.add_argument("--out", default="",
                            help="Path to the generated .ts file. Defaults to the "
                                 "frontend tree next to this repo when one is visible.")
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

        out = Path(opts["out"]) if opts["out"] else find_default_out()
        if out is None:
            raise CommandError(
                "Could not find frontend/src/data/ from here. This usually means the "
                "command is running in the backend container, which does not mount the "
                "frontend. Run it on the host, or pass --out with a path that exists.")
        if not out.parent.is_dir():
            raise CommandError(
                f"{out.parent} does not exist. Refusing to create it: writing the "
                "export somewhere the frontend build will never read is how this "
                "silently does nothing.")
        body = json.dumps(rows, indent=2, ensure_ascii=False)
        out.write_text(HEADER + body + FOOTER, encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(f"Wrote {len(rows)} testimonial(s) to {out}"))
        if rows:
            self.stdout.write("Rebuild and deploy the web image to publish them.")
        else:
            self.stdout.write("Nothing approved yet — the landing page will omit the section.")
