import { resolveLang } from './content.js';
import { buildPage } from './build-page.js';

const TYPE_FALLBACK = 'default';
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pickTypeLabel(business, typeLabels, lang) {
  const candidates = [business.primaryType, ...(business.types || [])];
  for (const t of candidates) {
    if (typeLabels[t] && typeLabels[t][lang]) return typeLabels[t][lang];
  }
  return typeLabels[TYPE_FALLBACK][lang];
}

function ratingLine(business, labels) {
  if (!business.rating) return '';
  const stars = '★'.repeat(Math.round(business.rating));
  const count = business.userRatingCount ?? 0;
  return `<span class="stars">${stars}</span> ${business.rating.toFixed(1)} · ${count} ${labels.reviews}`;
}

function phoneLine(business, labels) {
  if (!business.internationalPhoneNumber) return labels.no_phone;
  const safe = business.internationalPhoneNumber.replace(/\s+/g, '');
  return `<a href="tel:${safe}">${business.internationalPhoneNumber}</a>`;
}

function formatTime(hour, minute) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const m = String(minute ?? 0).padStart(2, '0');
  return `${h12}:${m} ${ampm}`;
}

function hoursHtml(business, weekdayLabels, labels, lang) {
  const periods = business.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) {
    return `<p>${labels.no_hours}</p>`;
  }
  const byDay = new Map();
  for (const p of periods) {
    if (!p.open) continue;
    const day = p.open.day;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  }
  const rows = [];
  for (let d = 0; d < 7; d++) {
    const dayLabel = weekdayLabels[String(d)][lang];
    const ranges = byDay.get(d);
    if (!ranges || ranges.length === 0) {
      rows.push(`<dt>${dayLabel}</dt><dd>${labels.closed}</dd>`);
    } else {
      const text = ranges.map(r => {
        const opens = formatTime(r.open.hour, r.open.minute);
        const closes = r.close ? formatTime(r.close.hour, r.close.minute) : '?';
        return `${opens} – ${closes}`;
      }).join(', ');
      rows.push(`<dt>${dayLabel}</dt><dd>${text}</dd>`);
    }
  }
  return `<dl class="biz-hours">${rows.join('')}</dl>`;
}

function buildSchema(business, siteUrl, lang) {
  const langPath = lang === 'en' ? 'businesses' : 'negocios';
  const url = `${siteUrl}/${lang}/${langPath}/${business.slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    url,
    name: business.displayName,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.formattedAddress?.split(',')[0] ?? '',
      addressLocality: 'San José de Gracia',
      addressRegion: 'Jalisco',
      addressCountry: 'MX',
    },
  };
  if (business.location) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: business.location.latitude,
      longitude: business.location.longitude,
    };
  }
  if (business.internationalPhoneNumber) {
    schema.telephone = business.internationalPhoneNumber;
  }
  if (business.rating && business.userRatingCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: business.rating,
      reviewCount: business.userRatingCount,
    };
  }
  const periods = business.regularOpeningHours?.periods;
  if (periods && periods.length > 0) {
    schema.openingHoursSpecification = periods.filter(p => p.open).map(p => {
      const spec = {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAYS[p.open.day],
        opens: `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute ?? 0).padStart(2, '0')}`,
      };
      if (p.close) {
        spec.closes = `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute ?? 0).padStart(2, '0')}`;
      }
      return spec;
    });
  }
  return schema;
}

export function renderBusinessPage({ business, lang, layout, pageTemplate, detailContent, shared, pageSlugs, siteUrl }) {
  const localized = resolveLang(detailContent, lang);

  const perBizContent = {
    meta: {
      slug: { en: `businesses/${business.slug}`, es: `negocios/${business.slug}` },
      title: {
        en: `${business.displayName} — San José de Gracia`,
        es: `${business.displayName} — San José de Gracia`,
      },
      description: {
        en: `${business.displayName} in San José de Gracia, Jalisco — ${business.formattedAddress || ''}`.trim(),
        es: `${business.displayName} en San José de Gracia, Jalisco — ${business.formattedAddress || ''}`.trim(),
      },
      og_locale_primary: detailContent.meta.og_locale_primary,
      og_locale_alternate: detailContent.meta.og_locale_alternate,
    },
    labels: localized.labels,
    rental: localized.rental,
    business: {
      placeId: business.placeId,
      displayName: business.displayName,
      formattedAddress: business.formattedAddress || '',
      typeLabel: pickTypeLabel(business, detailContent.type_labels, lang),
      ratingLine: ratingLine(business, localized.labels),
      phoneLine: phoneLine(business, localized.labels),
      hoursHtml: hoursHtml(business, detailContent.weekday_labels, localized.labels, lang),
    },
    schema_jsonld: JSON.stringify(buildSchema(business, siteUrl, lang), null, 2),
  };

  return buildPage({
    lang,
    layout,
    pageTemplate,
    content: perBizContent,
    shared,
    siteUrl,
    pageSlugs,
  });
}
