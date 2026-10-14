/** Published customer testimonials.
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

export const TESTIMONIALS: Testimonial[] = [];

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
