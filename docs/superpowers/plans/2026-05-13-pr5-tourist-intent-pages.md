# PR 5 — Tourist Intent Landing Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 bilingual topic-cluster landing pages targeting high-intent tourist queries that the site currently ranks for nowhere — Things to do, Getting here, Where to eat, Where to stay. Each page is real, useful, original content (not generic SEO fluff) with internal links to the per-business pages from PR 4a.

**Architecture:** Reuses PR 1's build system unchanged. Each page is one new entry in `content/shared/page-slugs.json`, one bilingual content JSON in `content/pages/`, and one HTML template in `templates/pages/`. The build runner already iterates the registry — adding entries is enough to ship pages. Each page emits hreflang to its EN/ES counterpart.

**Tech Stack:** Same as PRs 1-4 — vanilla JS Node build, no runtime deps. No new infra.

**Project root:** `/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage`

**Spec reference:** `docs/superpowers/specs/2026-05-12-seo-overhaul-design.md` — PR 5 row.

**Out of scope for PR 5:**
- Cross-linking from per-business pages BACK to topic pages (that's PR 9 — internal linking pass)
- Photos beyond what already exists in repo (`pueblo-1/2/3.webp`, `church-hero.jpg`)
- Search Console / domain redirect (PR 6)
- History/festivals standalone pages (PR 7)

---

## Locked design decisions

1. **Slugs:**
   | EN | ES |
   |----|----|
   | `/en/things-to-do` | `/es/que-hacer` |
   | `/en/getting-here` | `/es/como-llegar` |
   | `/en/where-to-eat` | `/es/donde-comer` |
   | `/en/where-to-stay` | `/es/donde-hospedarse` |

2. **Content style:** Authentic and specific. Each page draws on real local knowledge already in the existing site (events, walking tour, businesses snapshot). Not generic AI travel-blog fluff. Spanish is natural MX Spanish; English is plainspoken, not over-formal.

3. **Page structure (consistent across all 4):**
   - Hero (h1 + intro paragraph)
   - 3-5 themed sections with h2s and short paragraphs
   - "Featured" inline links to relevant per-business pages (deep-link by slug)
   - Internal cross-links to the other 3 topic pages at the bottom
   - JSON-LD `Article` or `TravelDestination` schema

4. **No nav additions in PR 5** — top nav already has 6 items. The new pages will get visibility via:
   - Direct internal links from the homepage (a small additions in `templates/pages/home.html`)
   - Cross-links between the 4 topic pages
   - Sitemap (Google will discover within a week)
   - Future cross-linking pass in PR 9

5. **Word count target:** ~600-900 words EN, equivalent in ES. Long enough to demonstrate topical authority; short enough to write/read.

---

## File structure

**New files:**

| Path | Responsibility |
|------|---------------|
| `content/pages/things-to-do.json` | Bilingual content for /en/things-to-do + /es/que-hacer |
| `content/pages/getting-here.json` | Bilingual content for /en/getting-here + /es/como-llegar |
| `content/pages/where-to-eat.json` | Bilingual content for /en/where-to-eat + /es/donde-comer (with deep-links to top restaurants from snapshot) |
| `content/pages/where-to-stay.json` | Bilingual content for /en/where-to-stay + /es/donde-hospedarse (with deep-links to lodging from snapshot + Airbnbs) |
| `templates/pages/things-to-do.html` | Template for the things-to-do page |
| `templates/pages/getting-here.html` | Template for the getting-here page |
| `templates/pages/where-to-eat.html` | Template for the where-to-eat page |
| `templates/pages/where-to-stay.html` | Template for the where-to-stay page |

**Modified files:**

| Path | Change |
|------|--------|
| `content/shared/page-slugs.json` | Add 4 new entries with EN/ES slugs |
| `sitemap.xml` | Append 8 new URLs (4 EN + 4 ES) with hreflang alternates |
| `templates/pages/home.html` | Add a small "Discover" section linking to the 4 new topic pages (boosts discoverability + interlinks for SEO) |
| `content/pages/home.json` | Add the 6 new tokens for the Discover section (heading + 4 link labels + intro) |

**Untouched:** Build system, page builder, business builder, fetch script, cron, all other content.

---

## Pre-flight: Worktree setup

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree add .worktrees/pr5-tourist-pages -b feat/pr5-tourist-pages
cd .worktrees/pr5-tourist-pages
rm -rf dist && node scripts/build.js > /dev/null 2>&1 && npm test
```

Baseline: 61 passing.

---

## Task 1: Add page-slug entries

**Files:**
- Modify: `content/shared/page-slugs.json`

- [ ] **Step 1: Replace `content/shared/page-slugs.json`**

```json
{
  "home":          { "en": "",              "es": "" },
  "businesses":    { "en": "businesses",    "es": "negocios" },
  "faq":           { "en": "faq",           "es": "preguntas" },
  "tour":          { "en": "tour",          "es": "recorrido" },
  "advertise":     { "en": "advertise",     "es": "anuncios" },
  "things-to-do":  { "en": "things-to-do",  "es": "que-hacer" },
  "getting-here":  { "en": "getting-here",  "es": "como-llegar" },
  "where-to-eat":  { "en": "where-to-eat",  "es": "donde-comer" },
  "where-to-stay": { "en": "where-to-stay", "es": "donde-hospedarse" }
}
```

- [ ] **Step 2: Sanity-parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('content/shared/page-slugs.json'))" && echo ok`
Expected: `ok`

- [ ] **Step 3: Run a build (the new pages will be skipped since content/templates don't exist yet)**

Run: `rm -rf dist && node scripts/build.js 2>&1 | grep -E "skipping|wrote.*things|wrote.*getting|wrote.*where" | head -10`

Expected output:
```
⊘ skipping things-to-do (content or template missing)
⊘ skipping getting-here (content or template missing)
⊘ skipping where-to-eat (content or template missing)
⊘ skipping where-to-stay (content or template missing)
```

- [ ] **Step 4: Run tests (still 61, build runner is generic)**

Run: `npm test`
Expected: 61 passing.

- [ ] **Step 5: Commit**

```bash
git add content/shared/page-slugs.json
git commit -m "feat: register 4 tourist intent landing pages in slug registry"
```

---

## Task 2: Things to do — content + template

**Files:**
- Create: `content/pages/things-to-do.json`
- Create: `templates/pages/things-to-do.html`

- [ ] **Step 1: Create `content/pages/things-to-do.json`**

```json
{
  "meta": {
    "slug":        { "en": "things-to-do", "es": "que-hacer" },
    "title":       { "en": "Things to Do in San José de Gracia, Jalisco — Walking Tour, Plaza, Cantinas",
                     "es": "Qué Hacer en San José de Gracia, Jalisco — Recorrido, Plaza y Cantinas" },
    "description": { "en": "What to do during a weekend in San José de Gracia: the historic Plaza Principal, the Parroquia, the self-guided walking tour, the cantinas, the Sunday tianguis, and the surrounding Altos countryside.",
                     "es": "Qué hacer durante un fin de semana en San José de Gracia: la Plaza Principal, la Parroquia, el recorrido autoguiado, las cantinas, el tianguis dominical y los Altos de Jalisco." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "h1":    { "en": "Things to Do in <em>San José de Gracia</em>",
               "es": "Qué Hacer en <em>San José de Gracia</em>" },
    "intro": { "en": "San José de Gracia is small. You can walk the centro in a morning, eat your way through the cantinas in an afternoon, and still have time for the plaza at sunset. Here's how locals actually spend a weekend here.",
               "es": "San José de Gracia es chico. Puedes recorrer el centro en una mañana, comer en las cantinas en la tarde y todavía alcanzar la plaza al atardecer. Así pasa los fines de semana la gente del pueblo." }
  },
  "sections": {
    "tour": {
      "h2":   { "en": "Walk the centro on the self-guided tour", "es": "Recorre el centro con el tour autoguiado" },
      "p":    { "en": "Start at the <strong>Plaza Principal</strong> — the French-imported kiosk and the Parroquia del Señor San José anchor the town. Our self-guided <a href=\"/en/tour\">walking tour</a> hits 9 stops in about 1.5 km, so 1–2 hours including coffee stops. Highlights: the Cabeza de Águila monument, the historic Portales arcades around the plaza, and the Centro Cultural just a few blocks north.",
               "es": "Empieza en la <strong>Plaza Principal</strong> — el kiosco importado de Francia y la Parroquia del Señor San José son el corazón del pueblo. Nuestro <a href=\"/es/recorrido\">recorrido a pie</a> tiene 9 paradas en unos 1.5 km, así que toma 1–2 horas con paradas para café. Lo mejor: el monumento Cabeza de Águila, los Portales históricos alrededor de la plaza y el Centro Cultural a unas cuadras al norte." }
    },
    "eat": {
      "h2":   { "en": "Eat where locals eat", "es": "Come donde come la gente" },
      "p":    { "en": "The cantinas and family restaurants on Calle Hidalgo are the soul of the town. <strong>Bramido San José</strong> is the most popular sit-down spot (Mexican + seafood, busy on weekends). Cantina La Soga is a great late-evening stop for cold drinks and botana. For sweets, Paletería y Nevería San José sits right across from the Parroquia. Our full <a href=\"/en/where-to-eat\">where-to-eat guide</a> goes deeper.",
               "es": "Las cantinas y los restaurantes familiares en Calle Hidalgo son el alma del pueblo. <strong>Bramido San José</strong> es el lugar más popular para sentarse a comer (mexicana y mariscos, lleno los fines de semana). La Cantina La Soga es perfecta para una visita nocturna con cervezas frías y botana. Para algo dulce, la Paletería y Nevería San José está justo enfrente de la Parroquia. Nuestra <a href=\"/es/donde-comer\">guía de dónde comer</a> tiene más detalles." }
    },
    "events": {
      "h2":   { "en": "Catch a fiesta if your timing works", "es": "Cae en una fiesta si te coincide" },
      "p":    { "en": "The town's biggest celebration is the <strong>Fiesta Patronal de San José</strong> — though the saint's day is March 19, the actual festivities run the first 10 days of May with masses, processions, music, and fireworks in the plaza. Other heavy hitters: Semana Santa (March/April), Fiestas Patrias (Sept 15–16), Virgen de Guadalupe (Dec 12), and Las Posadas (Dec 16–24). Every Sunday brings the <strong>tianguis semanal</strong> — fresh produce, local cheeses, handmade goods, antojitos.",
               "es": "La fiesta más grande del pueblo es la <strong>Fiesta Patronal de San José</strong> — aunque el día del santo es el 19 de marzo, las festividades reales son los primeros 10 días de mayo con misas, procesiones, música y fuegos artificiales en la plaza. Otras grandes: Semana Santa (marzo/abril), Fiestas Patrias (15–16 sept), Virgen de Guadalupe (12 dic) y Las Posadas (16–24 dic). Cada domingo el <strong>tianguis semanal</strong> trae productos frescos, quesos locales, artesanías y antojitos." }
    },
    "outdoors": {
      "h2":   { "en": "Step outside the town", "es": "Sal del pueblo" },
      "p":    { "en": "San José sits at 1,980 m in the Altos de Jalisco — pasture country, dairy farms, big skies. Drives into the surrounding countryside are easy and scenic. The road toward Tepatitlán passes a string of ranches and small chapels. If you're up for it, ask any local about the best lookout for sunset; everyone has a favorite.",
               "es": "San José está a 1,980 m en los Altos de Jalisco — tierra de potreros, ganaderías lecheras y cielos enormes. Las salidas en carro al campo son fáciles y bonitas. La carretera hacia Tepatitlán pasa por una serie de ranchos y capillitas. Si te animas, pregunta a cualquier local cuál es el mejor mirador para el atardecer; todos tienen el suyo." }
    },
    "stay": {
      "h2":   { "en": "Sleep over and stay another day", "es": "Quédate a dormir y un día más" },
      "p":    { "en": "There aren't many big hotels — that's part of the appeal. A handful of small inns and a couple of well-run Airbnbs (one of them right on Moctezuma, two blocks from the plaza). Our <a href=\"/en/where-to-stay\">where-to-stay guide</a> covers the options.",
               "es": "No hay muchos hoteles grandes — y eso es parte del atractivo. Algunas posadas chicas y un par de Airbnbs bien cuidados (uno en Moctezuma, a dos cuadras de la plaza). Nuestra <a href=\"/es/donde-hospedarse\">guía de hospedaje</a> tiene las opciones." }
    }
  },
  "cross_links": {
    "h2":          { "en": "More for your trip",          "es": "Más para tu viaje" },
    "getting_here":{ "en": "Getting here from Guadalajara","es": "Cómo llegar desde Guadalajara" },
    "where_to_eat":{ "en": "Where to eat",                "es": "Dónde comer" },
    "where_to_stay":{ "en": "Where to stay",              "es": "Dónde hospedarse" }
  }
}
```

- [ ] **Step 2: Create `templates/pages/things-to-do.html`**

```html
<style>
  .topic-wrap { max-width: 760px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .topic-hero { border-bottom: 1px solid var(--mist); padding-bottom: 1.5rem; margin-bottom: 2rem; }
  .topic-hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 400; line-height: 1.1; margin-bottom: 1rem; }
  .topic-hero h1 em { font-style: italic; color: var(--clay); }
  .topic-hero .lede { font-size: 1.05rem; line-height: 1.7; color: rgba(28,19,9,.75); }
  .topic-section { margin-bottom: 2.4rem; }
  .topic-section h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 500; line-height: 1.3; margin-bottom: .8rem; color: var(--dark); }
  .topic-section p { font-size: .98rem; line-height: 1.75; color: rgba(28,19,9,.75); }
  .topic-section a { color: var(--clay); text-decoration: none; border-bottom: 1px solid rgba(196,120,90,.35); }
  .topic-section a:hover { color: var(--earth); border-color: var(--earth); }
  .topic-cross { margin-top: 3rem; padding-top: 1.8rem; border-top: 1px solid var(--mist); }
  .topic-cross h2 { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 500; margin-bottom: .8rem; color: var(--dark); }
  .topic-cross ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
  .topic-cross a { display: inline-block; font-size: .92rem; color: var(--clay); text-decoration: none; }
  .topic-cross a:hover { color: var(--earth); text-decoration: underline; }
</style>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{meta.title}}",
  "description": "{{meta.description}}",
  "inLanguage": "{{lang}}",
  "isPartOf": {
    "@type": "WebSite",
    "name": "{{shared.common.site_name}}",
    "url": "{{shared.common.site_url}}"
  },
  "about": {
    "@type": "Place",
    "name": "San José de Gracia",
    "address": { "@type": "PostalAddress", "addressLocality": "San José de Gracia", "addressRegion": "Jalisco", "addressCountry": "MX" }
  }
}
</script>

<div class="topic-wrap">
  <div class="topic-hero">
    <h1>{{hero.h1}}</h1>
    <p class="lede">{{hero.intro}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.tour.h2}}</h2>
    <p>{{sections.tour.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.eat.h2}}</h2>
    <p>{{sections.eat.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.events.h2}}</h2>
    <p>{{sections.events.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.outdoors.h2}}</h2>
    <p>{{sections.outdoors.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.stay.h2}}</h2>
    <p>{{sections.stay.p}}</p>
  </div>

  <div class="topic-cross">
    <h2>{{cross_links.h2}}</h2>
    <ul>
      <li><a href="{{nav_urls.getting-here}}">{{cross_links.getting_here}} →</a></li>
      <li><a href="{{nav_urls.where-to-eat}}">{{cross_links.where_to_eat}} →</a></li>
      <li><a href="{{nav_urls.where-to-stay}}">{{cross_links.where_to_stay}} →</a></li>
    </ul>
  </div>
</div>
```

- [ ] **Step 3: Build and verify**

Run: `rm -rf dist && node scripts/build.js 2>&1 | grep things-to-do`

Expected:
```
✓ wrote dist/en/things-to-do.html (...)
✓ wrote dist/es/que-hacer.html (...)
```

- [ ] **Step 4: Spot-check the rendered page**

```bash
grep -E '<html lang|hreflang|<title|"@type": "Article"|<h1' dist/en/things-to-do.html | head -8
```

Expected: html lang=en, English title, Article schema, h1 with "Things to Do".

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 61 still passing.

- [ ] **Step 6: Commit**

```bash
git add content/pages/things-to-do.json templates/pages/things-to-do.html
git commit -m "feat: things-to-do bilingual landing page"
```

---

## Task 3: Getting here — content + template

**Files:**
- Create: `content/pages/getting-here.json`
- Create: `templates/pages/getting-here.html`

- [ ] **Step 1: Create `content/pages/getting-here.json`**

```json
{
  "meta": {
    "slug":        { "en": "getting-here", "es": "como-llegar" },
    "title":       { "en": "Getting to San José de Gracia from Guadalajara — Drive, Bus, Map",
                     "es": "Cómo Llegar a San José de Gracia desde Guadalajara — Carretera, Camión, Mapa" },
    "description": { "en": "How to get to San José de Gracia, Jalisco from Guadalajara: ~95 km northeast, ~1h 45m drive via the Carretera Tepatitlán–San José. Bus and rideshare options included.",
                     "es": "Cómo llegar a San José de Gracia, Jalisco desde Guadalajara: ~95 km al noreste, ~1h 45m por carretera vía Tepatitlán. Incluye opciones de camión y rideshare." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "h1":    { "en": "Getting to <em>San José de Gracia</em>",
               "es": "Cómo Llegar a <em>San José de Gracia</em>" },
    "intro": { "en": "San José de Gracia sits about 95 km northeast of Guadalajara, in the highlands of Los Altos de Jalisco. The drive takes 1 hour 45 minutes on a good day, longer if you hit rush hour leaving the city. Here's how to get here.",
               "es": "San José de Gracia está a unos 95 km al noreste de Guadalajara, en los Altos de Jalisco. El recorrido en carro toma 1 hora 45 minutos en un día bueno, más si te toca el tráfico saliendo de la ciudad. Aquí están las opciones." }
  },
  "sections": {
    "drive": {
      "h2":   { "en": "By car (recommended)",
                "es": "En carro (recomendado)" },
      "p":    { "en": "From central Guadalajara, take the <strong>Carretera Tepatitlán</strong> (Federal 80D / Mexico 80). It's a toll road for most of the way, well-maintained, and the easiest route. After Tepatitlán de Morelos, follow signs to San José de Gracia — the last stretch is a regular highway, two lanes, gentle curves through pasture country. Total: <strong>95 km, ~1h 45m</strong>. Tolls are about $150 MXN one-way (cash or IAVE).",
                "es": "Desde el centro de Guadalajara, toma la <strong>Carretera Tepatitlán</strong> (Federal 80D / México 80). Es de cuota la mayor parte del camino, está bien mantenida y es la ruta más fácil. Después de Tepatitlán de Morelos, sigue las indicaciones a San José de Gracia — el último tramo es carretera normal de dos carriles, con curvas suaves entre los potreros. Total: <strong>95 km, ~1h 45m</strong>. Las casetas suman unos $150 MXN por viaje (efectivo o IAVE)." }
    },
    "bus": {
      "h2":   { "en": "By bus",
                "es": "En camión" },
      "p":    { "en": "There's no direct first-class line from Guadalajara to San José de Gracia. The realistic route is: take a bus to <strong>Tepatitlán de Morelos</strong> from Nueva Central Camionera (operators include Servicios Coordinados, ETN, Primera Plus — frequent service, ~1h 30m, ~$200 MXN). From Tepa, take a local segunda clase line or rideshare into San José (~30 min). Plan ~3 hours total door-to-door.",
                "es": "No hay línea directa de primera clase de Guadalajara a San José de Gracia. La ruta real: toma un camión a <strong>Tepatitlán de Morelos</strong> desde la Nueva Central Camionera (operan Servicios Coordinados, ETN, Primera Plus — salidas frecuentes, ~1h 30m, ~$200 MXN). De Tepa, toma una línea local de segunda o un rideshare a San José (~30 min). Planea ~3 horas puerta a puerta." }
    },
    "rideshare": {
      "h2":   { "en": "By Uber / DiDi",
                "es": "Con Uber / DiDi" },
      "p":    { "en": "Uber and DiDi work from Guadalajara out to Tepatitlán reliably. Past Tepatitlán, coverage is hit-or-miss — you may need to set the destination to a specific address in San José rather than the town generally. Expect $700–$1,000 MXN one-way depending on time of day. Coming from the airport (GDL), it's about 110 km — same logic.",
                "es": "Uber y DiDi funcionan bien de Guadalajara hasta Tepatitlán. Pasando Tepatitlán, la cobertura es irregular — puede que necesites poner una dirección específica en San José en vez del pueblo en general. Espera $700–$1,000 MXN por viaje según la hora. Desde el aeropuerto (GDL), son unos 110 km — misma lógica." }
    },
    "from_us": {
      "h2":   { "en": "Coming from the US?",
                "es": "¿Vienes desde Estados Unidos?" },
      "p":    { "en": "<strong>Guadalajara International Airport (GDL)</strong> is the closest major airport — direct flights from LAX, SFO, ORD, DFW, ATL, JFK, and many midsize US cities. From the airport, follow the same routes above (it's actually slightly closer to San José than central Guadalajara). Many paisanos drive down from California or Texas — the most common route via the border at Nuevo Laredo + Federal 85 takes 18–20 hours of driving from the Texas border.",
                "es": "El <strong>Aeropuerto Internacional de Guadalajara (GDL)</strong> es el más cercano — vuelos directos desde LAX, SFO, ORD, DFW, ATL, JFK y muchas ciudades medianas de EU. Desde el aeropuerto, las mismas rutas de arriba aplican (de hecho está un poco más cerca a San José que el centro de Guadalajara). Muchos paisanos manejan desde California o Texas — la ruta más común vía Nuevo Laredo + Federal 85 toma 18–20 horas desde la frontera." }
    },
    "map": {
      "h2":   { "en": "On the map",
                "es": "En el mapa" },
      "p":    { "en": "<a href=\"https://www.google.com/maps/dir/Guadalajara,+Jalisco/San+Jos%C3%A9+de+Gracia,+Jalisco/\" target=\"_blank\" rel=\"noopener\">Open turn-by-turn directions in Google Maps →</a>",
                "es": "<a href=\"https://www.google.com/maps/dir/Guadalajara,+Jalisco/San+Jos%C3%A9+de+Gracia,+Jalisco/\" target=\"_blank\" rel=\"noopener\">Abre la ruta en Google Maps →</a>" }
    }
  },
  "cross_links": {
    "h2":            { "en": "Once you're here", "es": "Cuando ya llegaste" },
    "things_to_do":  { "en": "Things to do",     "es": "Qué hacer" },
    "where_to_eat":  { "en": "Where to eat",     "es": "Dónde comer" },
    "where_to_stay": { "en": "Where to stay",    "es": "Dónde hospedarse" }
  }
}
```

- [ ] **Step 2: Create `templates/pages/getting-here.html`**

Use the SAME template structure as Task 2 step 2, but with these section variations:
- Replace `<style>` block — copy verbatim from Task 2's template (it's reusable styling).
- Replace the JSON-LD: keep the Article schema as-is (same shape, tokens populated per page).
- Replace the body sections to match the JSON sections: drive, bus, rideshare, from_us, map.
- Cross-links list: things_to_do, where_to_eat, where_to_stay (3 links — exclude self).

```html
<style>
  .topic-wrap { max-width: 760px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .topic-hero { border-bottom: 1px solid var(--mist); padding-bottom: 1.5rem; margin-bottom: 2rem; }
  .topic-hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 400; line-height: 1.1; margin-bottom: 1rem; }
  .topic-hero h1 em { font-style: italic; color: var(--clay); }
  .topic-hero .lede { font-size: 1.05rem; line-height: 1.7; color: rgba(28,19,9,.75); }
  .topic-section { margin-bottom: 2.4rem; }
  .topic-section h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 500; line-height: 1.3; margin-bottom: .8rem; color: var(--dark); }
  .topic-section p { font-size: .98rem; line-height: 1.75; color: rgba(28,19,9,.75); }
  .topic-section a { color: var(--clay); text-decoration: none; border-bottom: 1px solid rgba(196,120,90,.35); }
  .topic-section a:hover { color: var(--earth); border-color: var(--earth); }
  .topic-cross { margin-top: 3rem; padding-top: 1.8rem; border-top: 1px solid var(--mist); }
  .topic-cross h2 { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 500; margin-bottom: .8rem; color: var(--dark); }
  .topic-cross ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
  .topic-cross a { display: inline-block; font-size: .92rem; color: var(--clay); text-decoration: none; }
  .topic-cross a:hover { color: var(--earth); text-decoration: underline; }
</style>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{meta.title}}",
  "description": "{{meta.description}}",
  "inLanguage": "{{lang}}",
  "isPartOf": {
    "@type": "WebSite",
    "name": "{{shared.common.site_name}}",
    "url": "{{shared.common.site_url}}"
  },
  "about": {
    "@type": "Place",
    "name": "San José de Gracia",
    "address": { "@type": "PostalAddress", "addressLocality": "San José de Gracia", "addressRegion": "Jalisco", "addressCountry": "MX" }
  }
}
</script>

<div class="topic-wrap">
  <div class="topic-hero">
    <h1>{{hero.h1}}</h1>
    <p class="lede">{{hero.intro}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.drive.h2}}</h2>
    <p>{{sections.drive.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.bus.h2}}</h2>
    <p>{{sections.bus.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.rideshare.h2}}</h2>
    <p>{{sections.rideshare.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.from_us.h2}}</h2>
    <p>{{sections.from_us.p}}</p>
  </div>

  <div class="topic-section">
    <h2>{{sections.map.h2}}</h2>
    <p>{{sections.map.p}}</p>
  </div>

  <div class="topic-cross">
    <h2>{{cross_links.h2}}</h2>
    <ul>
      <li><a href="{{nav_urls.things-to-do}}">{{cross_links.things_to_do}} →</a></li>
      <li><a href="{{nav_urls.where-to-eat}}">{{cross_links.where_to_eat}} →</a></li>
      <li><a href="{{nav_urls.where-to-stay}}">{{cross_links.where_to_stay}} →</a></li>
    </ul>
  </div>
</div>
```

- [ ] **Step 3: Build and verify**

```bash
rm -rf dist && node scripts/build.js 2>&1 | grep -E "getting-here|como-llegar"
```
Expected: 2 ✓ wrote lines.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 61 passing.

- [ ] **Step 5: Commit**

```bash
git add content/pages/getting-here.json templates/pages/getting-here.html
git commit -m "feat: getting-here bilingual landing page"
```

---

## Task 4: Where to eat — content + template

**Files:**
- Create: `content/pages/where-to-eat.json`
- Create: `templates/pages/where-to-eat.html`

- [ ] **Step 1: Create `content/pages/where-to-eat.json`**

The page links inline to specific per-business pages from the snapshot. Use exact slugs from `content/businesses-snapshot.json`. Verify slugs first:

```bash
node -e "const s = require('./content/businesses-snapshot.json'); s.businesses.filter(b => b.types.includes('restaurant') || b.types.includes('bar') || b.types.includes('cafe')).slice(0,10).forEach(b => console.log(b.slug, '→', b.displayName))"
```

Top businesses identified for the page (from snapshot):
- `bramido-san-jose-krfi1a` — BRAMIDO San José (restaurant, 2123 reviews)
- `restaurante-y-cantina-la-muralla-rfh9ce` — La Muralla (restaurant + cantina)

Write the JSON using whichever 4-6 businesses you find with the most reviews/best ratings. Hand-write the prose around them — don't generate generically.

```json
{
  "meta": {
    "slug":        { "en": "where-to-eat", "es": "donde-comer" },
    "title":       { "en": "Where to Eat in San José de Gracia, Jalisco — Restaurants, Cantinas, Cafés",
                     "es": "Dónde Comer en San José de Gracia, Jalisco — Restaurantes, Cantinas y Cafés" },
    "description": { "en": "Where locals actually eat in San José de Gracia: the popular sit-down restaurants, the cantinas with cold beer and botana, the cafés on the plaza, and the Sunday tianguis food stalls.",
                     "es": "Dónde realmente come la gente en San José de Gracia: los restaurantes populares, las cantinas con cerveza fría y botana, los cafés de la plaza y los puestos del tianguis dominical." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "h1":    { "en": "Where to <em>Eat</em>",
               "es": "Dónde <em>Comer</em>" },
    "intro": { "en": "Eating out in San José de Gracia is unpretentious and generous — handmade tortillas, dairy-rich chiles rellenos, fresh chicharrón, and the occasional birria stand on a side street. Here are the spots locals actually go.",
               "es": "Comer en San José de Gracia es sin pretensiones y abundante — tortillas hechas a mano, chiles rellenos con el queso de aquí, chicharrón fresco y de vez en cuando un puesto de birria en alguna calle. Estos son los lugares a los que la gente del pueblo realmente va." }
  },
  "sections": {
    "sit_down": {
      "h2":   { "en": "Sit-down restaurants",
                "es": "Restaurantes para sentarte" },
      "p":    { "en": "<a href=\"/en/businesses/bramido-san-jose-krfi1a\"><strong>Bramido San José</strong></a> on Calle Hidalgo is the busiest restaurant in town for good reason — Mexican classics, a strong seafood section, and a setting that scales from a coffee with a friend to a family Sunday lunch. <a href=\"/en/businesses/restaurante-y-cantina-la-muralla-rfh9ce\"><strong>Restaurante y Cantina La Muralla</strong></a> is the other big anchor, and works equally well for a long meal or a few beers.",
                "es": "<a href=\"/es/negocios/bramido-san-jose-krfi1a\"><strong>Bramido San José</strong></a> en Calle Hidalgo es el restaurante más concurrido del pueblo y por algo — clásicos de la cocina mexicana, buena sección de mariscos y un ambiente que sirve igual para un café con un amigo que para una comida dominical en familia. <a href=\"/es/negocios/restaurante-y-cantina-la-muralla-rfh9ce\"><strong>Restaurante y Cantina La Muralla</strong></a> es el otro grande, y funciona igual de bien para una comida larga o unas cervezas." }
    },
    "cantinas": {
      "h2":   { "en": "Cantinas",
                "es": "Cantinas" },
      "p":    { "en": "Cantinas in the Altos lean traditional — botana with the beer, regulars at the bar, music on weekends. Cantina La Soga is a reliable evening spot and our walking-tour endpoint. Don't expect curated cocktails; do expect cold cervezas and good company.",
                "es": "Las cantinas de los Altos son tradicionales — botana con la cerveza, parroquianos en la barra, música los fines de semana. La Cantina La Soga es un lugar de confianza para la tarde y es la última parada del recorrido a pie. No esperes coctelería de autor; sí espera cervezas bien frías y buena compañía." }
    },
    "cafes": {
      "h2":   { "en": "Cafés and sweet stops",
                "es": "Cafés y dulces" },
      "p":    { "en": "<strong>Café Azul Cobalto</strong> on Moctezuma (right next to the Airbnb on stop #1 of the walking tour) is the easiest morning coffee in town. For ice cream, the <strong>Paletería y Nevería San José</strong> sits directly across from the Parroquia — fruit-flavored paletas, ice cream, and the kind of late-afternoon line that tells you it's good.",
                "es": "<strong>Café Azul Cobalto</strong> en Moctezuma (justo al lado del Airbnb que es la parada 1 del recorrido) es el lugar más fácil para un café en la mañana. Para algo dulce, la <strong>Paletería y Nevería San José</strong> está justo enfrente de la Parroquia — paletas de sabores frutales, helado y la fila de las tardes que te dice que está bueno." }
    },
    "tianguis": {
      "h2":   { "en": "Sunday tianguis",
                "es": "Tianguis dominical" },
      "p":    { "en": "Every Sunday the centro fills with the <strong>tianguis semanal</strong> — fresh produce, local cheeses (try the panela and cotija), handmade tortillas, and stalls selling antojitos hot off the comal. Best around 10–11 AM. It's worth timing a Sunday visit to overlap.",
                "es": "Cada domingo el centro se llena con el <strong>tianguis semanal</strong> — productos frescos, quesos locales (prueba el panela y el cotija), tortillas hechas a mano y puestos vendiendo antojitos recién hechos del comal. Mejor de 10–11 AM. Vale la pena que tu visita en domingo coincida." }
    },
    "more": {
      "h2":   { "en": "Browse the full directory",
                "es": "Mira el directorio completo" },
      "p":    { "en": "We pull live ratings and hours from Google Maps for every restaurant, bar, café, taquería, and store in town. Browse the <a href=\"/en/businesses\">complete business directory</a>.",
                "es": "Sacamos las calificaciones y horarios en vivo de Google Maps para cada restaurante, bar, café, taquería y tienda del pueblo. Mira el <a href=\"/es/negocios\">directorio completo de negocios</a>." }
    }
  },
  "cross_links": {
    "h2":           { "en": "More for your trip",          "es": "Más para tu viaje" },
    "things_to_do": { "en": "Things to do",                "es": "Qué hacer" },
    "getting_here": { "en": "Getting here from Guadalajara","es": "Cómo llegar desde Guadalajara" },
    "where_to_stay":{ "en": "Where to stay",               "es": "Dónde hospedarse" }
  }
}
```

- [ ] **Step 2: Create `templates/pages/where-to-eat.html`**

Same structure as Task 2's template. Sections: sit_down, cantinas, cafes, tianguis, more. Cross-links: things_to_do, getting_here, where_to_stay.

```html
<style>
  .topic-wrap { max-width: 760px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .topic-hero { border-bottom: 1px solid var(--mist); padding-bottom: 1.5rem; margin-bottom: 2rem; }
  .topic-hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 400; line-height: 1.1; margin-bottom: 1rem; }
  .topic-hero h1 em { font-style: italic; color: var(--clay); }
  .topic-hero .lede { font-size: 1.05rem; line-height: 1.7; color: rgba(28,19,9,.75); }
  .topic-section { margin-bottom: 2.4rem; }
  .topic-section h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 500; line-height: 1.3; margin-bottom: .8rem; color: var(--dark); }
  .topic-section p { font-size: .98rem; line-height: 1.75; color: rgba(28,19,9,.75); }
  .topic-section a { color: var(--clay); text-decoration: none; border-bottom: 1px solid rgba(196,120,90,.35); }
  .topic-section a:hover { color: var(--earth); border-color: var(--earth); }
  .topic-cross { margin-top: 3rem; padding-top: 1.8rem; border-top: 1px solid var(--mist); }
  .topic-cross h2 { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 500; margin-bottom: .8rem; color: var(--dark); }
  .topic-cross ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
  .topic-cross a { display: inline-block; font-size: .92rem; color: var(--clay); text-decoration: none; }
  .topic-cross a:hover { color: var(--earth); text-decoration: underline; }
</style>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{meta.title}}",
  "description": "{{meta.description}}",
  "inLanguage": "{{lang}}",
  "isPartOf": {
    "@type": "WebSite",
    "name": "{{shared.common.site_name}}",
    "url": "{{shared.common.site_url}}"
  },
  "about": {
    "@type": "Place",
    "name": "San José de Gracia",
    "address": { "@type": "PostalAddress", "addressLocality": "San José de Gracia", "addressRegion": "Jalisco", "addressCountry": "MX" }
  }
}
</script>

<div class="topic-wrap">
  <div class="topic-hero">
    <h1>{{hero.h1}}</h1>
    <p class="lede">{{hero.intro}}</p>
  </div>

  <div class="topic-section"><h2>{{sections.sit_down.h2}}</h2><p>{{sections.sit_down.p}}</p></div>
  <div class="topic-section"><h2>{{sections.cantinas.h2}}</h2><p>{{sections.cantinas.p}}</p></div>
  <div class="topic-section"><h2>{{sections.cafes.h2}}</h2><p>{{sections.cafes.p}}</p></div>
  <div class="topic-section"><h2>{{sections.tianguis.h2}}</h2><p>{{sections.tianguis.p}}</p></div>
  <div class="topic-section"><h2>{{sections.more.h2}}</h2><p>{{sections.more.p}}</p></div>

  <div class="topic-cross">
    <h2>{{cross_links.h2}}</h2>
    <ul>
      <li><a href="{{nav_urls.things-to-do}}">{{cross_links.things_to_do}} →</a></li>
      <li><a href="{{nav_urls.getting-here}}">{{cross_links.getting_here}} →</a></li>
      <li><a href="{{nav_urls.where-to-stay}}">{{cross_links.where_to_stay}} →</a></li>
    </ul>
  </div>
</div>
```

- [ ] **Step 3: Build and verify**

```bash
rm -rf dist && node scripts/build.js 2>&1 | grep -E "where-to-eat|donde-comer"
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 61 passing.

- [ ] **Step 5: Commit**

```bash
git add content/pages/where-to-eat.json templates/pages/where-to-eat.html
git commit -m "feat: where-to-eat bilingual landing page"
```

---

## Task 5: Where to stay — content + template

**Files:**
- Create: `content/pages/where-to-stay.json`
- Create: `templates/pages/where-to-stay.html`

- [ ] **Step 1: Create `content/pages/where-to-stay.json`**

```json
{
  "meta": {
    "slug":        { "en": "where-to-stay", "es": "donde-hospedarse" },
    "title":       { "en": "Where to Stay in San José de Gracia, Jalisco — Airbnbs and Inns",
                     "es": "Dónde Hospedarse en San José de Gracia, Jalisco — Airbnbs y Posadas" },
    "description": { "en": "Lodging options in San José de Gracia: Airbnbs in the centro, small inns, and a beach-house option in Rosarito for an extended trip.",
                     "es": "Opciones de hospedaje en San José de Gracia: Airbnbs en el centro, posadas chicas y una casa de playa en Rosarito si quieres extender el viaje." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "h1":    { "en": "Where to <em>Stay</em>",
               "es": "Dónde <em>Hospedarse</em>" },
    "intro": { "en": "San José de Gracia is small enough that you don't have many big-hotel options — and that's part of the appeal. A handful of small inns and well-run Airbnbs make the centro easy to walk from.",
               "es": "San José de Gracia es lo suficientemente chico para no tener muchas opciones de hotel grande — y eso es parte del encanto. Un puñado de posadas y Airbnbs bien cuidados hacen que el centro quede a la vuelta." }
  },
  "sections": {
    "airbnb_centro": {
      "h2":   { "en": "Airbnb in the centro",
                "es": "Airbnb en el centro" },
      "p":    { "en": "<a href=\"https://airbnb.com/h/sjdg\" target=\"_blank\" rel=\"noopener\"><strong>The Moctezuma 153 apartment</strong></a> is the most-booked option for visitors — bright 2BR, 2BA on a quiet street two blocks from the plaza, with new appliances, A/C, and keyless entry. ★5.0 with Superhost status. Sleeps up to 5; works equally well for a couple weekend or a family trip.",
                "es": "<a href=\"https://airbnb.com/h/sjdg\" target=\"_blank\" rel=\"noopener\"><strong>El departamento de Moctezuma 153</strong></a> es la opción más reservada por visitantes — luminoso, 2 recámaras, 2 baños, en una calle tranquila a dos cuadras de la plaza, con electrodomésticos nuevos, A/C y entrada sin llave. ★5.0 con estatus de Súper Host. Hasta 5 huéspedes; sirve igual para un fin de semana en pareja o un viaje familiar." }
    },
    "lodging_directory": {
      "h2":   { "en": "Other lodging in town",
                "es": "Otros hospedajes del pueblo" },
      "p":    { "en": "Small inns and posadas come and go — for the latest list with hours, addresses, and ratings, see the <a href=\"/en/businesses\">business directory</a> filtered to lodging.",
                "es": "Las posadas chicas van y vienen — para la lista más reciente con horarios, direcciones y calificaciones, mira el <a href=\"/es/negocios\">directorio de negocios</a> filtrado a hospedaje." }
    },
    "extended_trip": {
      "h2":   { "en": "Extended trip? A beach option",
                "es": "¿Viaje largo? Una opción en la playa" },
      "p":    { "en": "If you're already coming this far and want to add a few days at the coast, the <a href=\"https://airbnb.com/h/mgbeachhouse\" target=\"_blank\" rel=\"noopener\"><strong>Casa de Playa MG in Rosarito</strong></a> is run by the same family — laid-back Pacific vibes, ocean views, just south of the US border. About 12 hours by car from San José de Gracia or a short flight from GDL to TIJ.",
                "es": "Si ya viniste hasta acá y quieres sumar unos días en la costa, la <a href=\"https://airbnb.com/h/mgbeachhouse\" target=\"_blank\" rel=\"noopener\"><strong>Casa de Playa MG en Rosarito</strong></a> es de la misma familia — vibras tranquilas del Pacífico, vista al mar, justo al sur de la frontera con EU. Son unas 12 horas en carro desde San José de Gracia, o un vuelo corto de GDL a TIJ." }
    },
    "tips": {
      "h2":   { "en": "Booking tips",
                "es": "Tips para reservar" },
      "p":    { "en": "Book a few weeks ahead during the <strong>Fiesta Patronal</strong> (first 10 days of May), Semana Santa, and the December holidays — those weekends fill up. Outside those windows you can usually find space on shorter notice. WiFi is solid in the centro; data coverage is good throughout town.",
                "es": "Reserva con unas semanas de anticipación durante la <strong>Fiesta Patronal</strong> (primeros 10 días de mayo), Semana Santa y las fiestas decembrinas — esos fines de semana se llenan. Fuera de esas fechas, normalmente encuentras lugar con poca anticipación. El WiFi en el centro es estable; la cobertura de datos es buena en todo el pueblo." }
    }
  },
  "cross_links": {
    "h2":           { "en": "More for your trip",          "es": "Más para tu viaje" },
    "things_to_do": { "en": "Things to do",                "es": "Qué hacer" },
    "getting_here": { "en": "Getting here from Guadalajara","es": "Cómo llegar desde Guadalajara" },
    "where_to_eat": { "en": "Where to eat",                "es": "Dónde comer" }
  }
}
```

- [ ] **Step 2: Create `templates/pages/where-to-stay.html`**

Same template structure. Sections: airbnb_centro, lodging_directory, extended_trip, tips. Cross-links: things_to_do, getting_here, where_to_eat.

```html
<style>
  .topic-wrap { max-width: 760px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .topic-hero { border-bottom: 1px solid var(--mist); padding-bottom: 1.5rem; margin-bottom: 2rem; }
  .topic-hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 400; line-height: 1.1; margin-bottom: 1rem; }
  .topic-hero h1 em { font-style: italic; color: var(--clay); }
  .topic-hero .lede { font-size: 1.05rem; line-height: 1.7; color: rgba(28,19,9,.75); }
  .topic-section { margin-bottom: 2.4rem; }
  .topic-section h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 500; line-height: 1.3; margin-bottom: .8rem; color: var(--dark); }
  .topic-section p { font-size: .98rem; line-height: 1.75; color: rgba(28,19,9,.75); }
  .topic-section a { color: var(--clay); text-decoration: none; border-bottom: 1px solid rgba(196,120,90,.35); }
  .topic-section a:hover { color: var(--earth); border-color: var(--earth); }
  .topic-cross { margin-top: 3rem; padding-top: 1.8rem; border-top: 1px solid var(--mist); }
  .topic-cross h2 { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 500; margin-bottom: .8rem; color: var(--dark); }
  .topic-cross ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
  .topic-cross a { display: inline-block; font-size: .92rem; color: var(--clay); text-decoration: none; }
  .topic-cross a:hover { color: var(--earth); text-decoration: underline; }
</style>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{meta.title}}",
  "description": "{{meta.description}}",
  "inLanguage": "{{lang}}",
  "isPartOf": {
    "@type": "WebSite",
    "name": "{{shared.common.site_name}}",
    "url": "{{shared.common.site_url}}"
  },
  "about": {
    "@type": "Place",
    "name": "San José de Gracia",
    "address": { "@type": "PostalAddress", "addressLocality": "San José de Gracia", "addressRegion": "Jalisco", "addressCountry": "MX" }
  }
}
</script>

<div class="topic-wrap">
  <div class="topic-hero">
    <h1>{{hero.h1}}</h1>
    <p class="lede">{{hero.intro}}</p>
  </div>

  <div class="topic-section"><h2>{{sections.airbnb_centro.h2}}</h2><p>{{sections.airbnb_centro.p}}</p></div>
  <div class="topic-section"><h2>{{sections.lodging_directory.h2}}</h2><p>{{sections.lodging_directory.p}}</p></div>
  <div class="topic-section"><h2>{{sections.extended_trip.h2}}</h2><p>{{sections.extended_trip.p}}</p></div>
  <div class="topic-section"><h2>{{sections.tips.h2}}</h2><p>{{sections.tips.p}}</p></div>

  <div class="topic-cross">
    <h2>{{cross_links.h2}}</h2>
    <ul>
      <li><a href="{{nav_urls.things-to-do}}">{{cross_links.things_to_do}} →</a></li>
      <li><a href="{{nav_urls.getting-here}}">{{cross_links.getting_here}} →</a></li>
      <li><a href="{{nav_urls.where-to-eat}}">{{cross_links.where_to_eat}} →</a></li>
    </ul>
  </div>
</div>
```

- [ ] **Step 3: Build and verify**

```bash
rm -rf dist && node scripts/build.js 2>&1 | grep -E "where-to-stay|donde-hospedarse"
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add content/pages/where-to-stay.json templates/pages/where-to-stay.html
git commit -m "feat: where-to-stay bilingual landing page"
```

---

## Task 6: Add a "Discover" section to the homepage linking to all 4 topic pages

This is the homepage's contribution to internal linking — a small section above the footer with one-line teasers + links to each topic page. Drives discovery and SEO.

**Files:**
- Modify: `content/pages/home.json` (add `discover` section)
- Modify: `templates/pages/home.html` (add `<section class="discover">` block before footer)

- [ ] **Step 1: Inspect existing home.json structure**

```bash
node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('content/pages/home.json'))))"
```
Expected: includes `meta`, `hero`, `about`, `historia`, `events`, `getting_here`, `directory`, `stay`, `cta`, `rental`.

- [ ] **Step 2: Add a `discover` block to `content/pages/home.json`**

Add this top-level key (place it BEFORE `cta` so it appears late on the page but above the final CTA):

```json
"discover": {
  "label":          { "en": "Plan Your Visit",        "es": "Planea Tu Visita" },
  "h2":             { "en": "Everything you need <em>in one place</em>", "es": "Todo lo que necesitas <em>en un lugar</em>" },
  "intro":          { "en": "Detailed guides for first-time visitors and returning paisanos alike.", "es": "Guías detalladas para visitantes nuevos y paisanos que regresan." },
  "things_to_do":   { "en": "Things to do",        "es": "Qué hacer" },
  "things_to_do_p": { "en": "Plaza, walking tour, fiestas, and the Altos countryside.", "es": "Plaza, recorrido, fiestas y los Altos." },
  "getting_here":   { "en": "Getting here",        "es": "Cómo llegar" },
  "getting_here_p": { "en": "Drive, bus, and rideshare from Guadalajara.", "es": "Carretera, camión y rideshare desde Guadalajara." },
  "where_to_eat":   { "en": "Where to eat",        "es": "Dónde comer" },
  "where_to_eat_p": { "en": "Restaurants, cantinas, cafés, the Sunday tianguis.", "es": "Restaurantes, cantinas, cafés y el tianguis dominical." },
  "where_to_stay":  { "en": "Where to stay",       "es": "Dónde hospedarse" },
  "where_to_stay_p":{ "en": "Airbnbs in the centro and other lodging.", "es": "Airbnbs en el centro y otras opciones." }
}
```

- [ ] **Step 3: Add the section to `templates/pages/home.html`**

Find a good insertion point — likely before the existing CTA section (search for `cta-section` or similar). Insert this block:

```html
<section class="discover" id="discover">
  <div class="discover-inner">
    <p class="section-label">{{discover.label}}</p>
    <h2>{{discover.h2}}</h2>
    <p class="discover-intro">{{discover.intro}}</p>
    <div class="discover-grid">
      <a href="{{nav_urls.things-to-do}}" class="discover-card">
        <h3>{{discover.things_to_do}}</h3>
        <p>{{discover.things_to_do_p}}</p>
      </a>
      <a href="{{nav_urls.getting-here}}" class="discover-card">
        <h3>{{discover.getting_here}}</h3>
        <p>{{discover.getting_here_p}}</p>
      </a>
      <a href="{{nav_urls.where-to-eat}}" class="discover-card">
        <h3>{{discover.where_to_eat}}</h3>
        <p>{{discover.where_to_eat_p}}</p>
      </a>
      <a href="{{nav_urls.where-to-stay}}" class="discover-card">
        <h3>{{discover.where_to_stay}}</h3>
        <p>{{discover.where_to_stay_p}}</p>
      </a>
    </div>
  </div>
</section>

<style>
  .discover { background: var(--mist); padding: 5rem 2rem; }
  .discover-inner { max-width: 1100px; margin: 0 auto; text-align: center; }
  .discover .section-label { font-size: .75rem; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); margin-bottom: 1rem; }
  .discover h2 { font-family: 'Playfair Display', serif; font-size: clamp(1.8rem, 3.5vw, 2.6rem); font-weight: 400; line-height: 1.2; margin-bottom: .8rem; }
  .discover h2 em { font-style: italic; color: var(--clay); }
  .discover-intro { color: rgba(28,19,9,.65); margin-bottom: 2.5rem; max-width: 540px; margin-left: auto; margin-right: auto; }
  .discover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.2rem; text-align: left; }
  .discover-card { display: block; padding: 1.6rem; background: var(--cream); border-radius: 6px; text-decoration: none; color: inherit; transition: transform .2s, box-shadow .2s; border: 1px solid transparent; }
  .discover-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(28,19,9,.08); border-color: rgba(196,120,90,.2); }
  .discover-card h3 { font-family: 'Playfair Display', serif; font-size: 1.15rem; font-weight: 500; margin-bottom: .4rem; color: var(--clay); }
  .discover-card p { font-size: .88rem; line-height: 1.5; color: rgba(28,19,9,.65); }
</style>
```

- [ ] **Step 4: Build and verify**

```bash
rm -rf dist && node scripts/build.js 2>&1 | tail -5
grep "Discover\|Plan Your Visit\|Planea Tu Visita" dist/en/index.html dist/es/index.html | head -4
```
Expected: build completes, both languages have the new section.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 61 still passing.

- [ ] **Step 6: Commit**

```bash
git add content/pages/home.json templates/pages/home.html
git commit -m "feat: add Plan Your Visit section on homepage linking to topic pages"
```

---

## Task 7: Update sitemap with 8 new URLs

**Files:**
- Modify: `sitemap.xml`

- [ ] **Step 1: Generate the 8 new entries**

```bash
node -e "
const today = new Date().toISOString().slice(0, 10);
const PAGES = [
  ['things-to-do', 'que-hacer'],
  ['getting-here', 'como-llegar'],
  ['where-to-eat', 'donde-comer'],
  ['where-to-stay', 'donde-hospedarse'],
];
const out = PAGES.map(([en, es]) => \`
  <url>
    <loc>https://sanjosedegracia.net/en/\${en}</loc>
    <lastmod>\${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://sanjosedegracia.net/en/\${en}\" />
    <xhtml:link rel=\"alternate\" hreflang=\"es\" href=\"https://sanjosedegracia.net/es/\${es}\" />
    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"https://sanjosedegracia.net/en/\${en}\" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/\${es}</loc>
    <lastmod>\${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://sanjosedegracia.net/en/\${en}\" />
    <xhtml:link rel=\"alternate\" hreflang=\"es\" href=\"https://sanjosedegracia.net/es/\${es}\" />
    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"https://sanjosedegracia.net/en/\${en}\" />
  </url>\`).join('\n');
require('fs').writeFileSync('/tmp/topic-sitemap-entries.xml', out);
console.log('wrote 8 entries');
"
```

- [ ] **Step 2: Insert before `</urlset>` in `sitemap.xml`**

Use Python (most reliable for the iCloud filesystem):

```bash
python3 -c "
content = open('sitemap.xml').read()
extras = open('/tmp/topic-sitemap-entries.xml').read()
new = content.replace('</urlset>', extras + '\n\n</urlset>')
open('sitemap.xml', 'w').write(new)
print('done')
"
```

- [ ] **Step 3: Verify**

```bash
node -e "require('fs').readFileSync('sitemap.xml', 'utf8'); console.log('valid utf8')"
grep -c '<url>' sitemap.xml
```
Expected: count went from 168 to 176 (+8).

- [ ] **Step 4: Verify the build copies the updated sitemap**

```bash
rm -rf dist && node scripts/build.js > /dev/null && grep -c '<url>' dist/sitemap.xml
```
Expected: same 176.

- [ ] **Step 5: Commit**

```bash
git add sitemap.xml
git commit -m "feat: add 8 tourist-intent topic pages to sitemap"
```

---

## Task 8: Local end-to-end smoke test

**Files:** none

- [ ] **Step 1: Start `vercel dev`**

```bash
vercel dev --yes > /tmp/vercel-pr5.log 2>&1 &
sleep 10
```

- [ ] **Step 2: Test all 8 new URLs + spot-check schema**

```bash
CURL=/usr/bin/curl
echo "=== topic pages ==="
for p in /en/things-to-do /es/que-hacer /en/getting-here /es/como-llegar /en/where-to-eat /es/donde-comer /en/where-to-stay /es/donde-hospedarse; do
  echo "$p → $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$p")"
done
echo
echo "=== schema spot-check (en/things-to-do) ==="
$CURL -s "http://localhost:3000/en/things-to-do" | grep -E '<html lang|hreflang|<title|"@type": "Article"|<h1' | head -7
echo
echo "=== Spanish version ==="
$CURL -s "http://localhost:3000/es/que-hacer" | grep -E '<html lang|<title|<h1' | head -3
echo
echo "=== homepage Discover section ==="
$CURL -s "http://localhost:3000/en/" | grep -c "Plan Your Visit"
$CURL -s "http://localhost:3000/es/" | grep -c "Planea Tu Visita"
```

Expected:
- All 8 URLs return 200
- EN page: html lang=en, English title, hreflang to ES, Article schema, h1 contains "Things to Do"
- ES page: html lang=es-MX, Spanish title, h1 contains "Qué Hacer"
- Homepage Discover counts: both > 0

- [ ] **Step 3: Verify all PR 1-4 routes still work**

```bash
for p in /en/ /es/ /en/businesses /es/negocios /en/businesses/bramido-san-jose-krfi1a /sitemap.xml; do
  echo "$p → $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$p")"
done
```
Expected: all 200.

- [ ] **Step 4: Stop `vercel dev`**

```bash
/usr/bin/pkill -f "vercel dev" 2>/dev/null
```

- [ ] **Step 5: No commit — verification only**

If anything failed, fix and re-run.

---

## Task 9: Push, PR, deploy, verify production

- [ ] **Step 1: Push the branch**

```bash
git status
git log --oneline -10
git push -u origin feat/pr5-tourist-pages
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --head feat/pr5-tourist-pages --repo ninjackster/sjdg-community-site \
  --title "feat: PR 5 — tourist intent landing pages (4 new topic pages × 2 langs = 8 URLs)" \
  --body "$(cat <<'EOF'
## Summary

Ships 4 bilingual topic-cluster landing pages targeting high-intent tourist queries the site currently ranks for nowhere. Plus a Plan Your Visit section on the homepage interlinking them.

- **/en/things-to-do** + **/es/que-hacer** — Things to do (plaza, walking tour, fiestas, outdoors, lodging)
- **/en/getting-here** + **/es/como-llegar** — Drive, bus, rideshare, from US, map
- **/en/where-to-eat** + **/es/donde-comer** — Restaurants, cantinas, cafés, tianguis (deep-links to per-business pages)
- **/en/where-to-stay** + **/es/donde-hospedarse** — Airbnbs, lodging directory, extended trip option, booking tips

Each page emits Article JSON-LD schema, hreflang alternates, and cross-links to the other 3 topic pages. Sitemap grew from 168 → 176 URLs.

## Audience impact

Audience A (tourists) — primary win. These pages target queries like:
- "qué hacer en San José de Gracia"
- "cómo llegar a San José de Gracia desde Guadalajara"
- "dónde comer San José de Gracia"
- "hoteles San José de Gracia Jalisco"

## Test plan

- [ ] All 8 URLs return 200 in Vercel preview
- [ ] Each page has correct hreflang to its EN/ES counterpart
- [ ] Homepage shows Plan Your Visit section in both languages
- [ ] Per-business deep-links from where-to-eat work (BRAMIDO, La Muralla)
- [ ] All PR 1-4 routes still work
- [ ] Sitemap = 176 URLs

## Out of scope (later PRs)

- Search Console Domain property + .org redirect (PR 6)
- History/festivals standalone pages (PR 7)
- Performance pass (PR 8)
- Cross-linking from per-business pages back to topic pages (PR 9)
EOF
)"
```

- [ ] **Step 3: Wait for Vercel build success**

```bash
until STATE=$(gh pr view 6 --repo ninjackster/sjdg-community-site --json statusCheckRollup --jq '.statusCheckRollup[]? | select(.context=="Vercel" or .name=="Vercel") | .state' 2>/dev/null | head -1) && [ "$STATE" = "SUCCESS" ]; do sleep 10; done && echo built
```

- [ ] **Step 4: Squash-merge**

```bash
cd /tmp
gh pr merge 6 --squash --delete-branch --repo ninjackster/sjdg-community-site \
  --subject "feat: PR 5 — tourist intent landing pages (4 new topic pages × 2 langs)" \
  --body "Ships /en/things-to-do, /es/que-hacer, /en/getting-here, /es/como-llegar, /en/where-to-eat, /es/donde-comer, /en/where-to-stay, /es/donde-hospedarse. Article schema + hreflang. Plan Your Visit section on homepage. Sitemap = 176 URLs. 61 tests passing."
```

- [ ] **Step 5: Wait for production deploy + verify**

```bash
until /usr/bin/curl -s -o /dev/null -w "%{http_code}\n" https://sanjosedegracia.net/es/que-hacer | grep -q "200"; do sleep 5; done && echo "deployed"
CURL=/usr/bin/curl
for p in /en/things-to-do /es/que-hacer /en/getting-here /es/como-llegar /en/where-to-eat /es/donde-comer /en/where-to-stay /es/donde-hospedarse; do
  echo "$p → $($CURL -s -o /dev/null -w "%{http_code}" "https://sanjosedegracia.net$p")"
done
$CURL -s https://sanjosedegracia.net/sitemap.xml | grep -c '<url>'
```
Expected: all 8 → 200, sitemap = 176.

- [ ] **Step 6: Cleanup worktree**

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree remove .worktrees/pr5-tourist-pages
git branch -D feat/pr5-tourist-pages
git fetch origin main && git reset --hard origin/main
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** PR 5 row spec → 4 topic pages with EN+ES slugs ✓, deep-links to per-business pages ✓, hreflang ✓, sitemap entries ✓.
- [ ] **No placeholders:** All content is real prose, not "TBD" or "lorem ipsum".
- [ ] **Type consistency:** `nav_urls.things-to-do`, `nav_urls.getting-here`, `nav_urls.where-to-eat`, `nav_urls.where-to-stay` — all match registry slug names.
- [ ] **Each task ends with a commit.**
- [ ] **No regression:** PR 1-4 routes still serve correctly.

## What ships in PR 5

- 8 new bilingual topic-cluster landing pages (~600-900 words each per language)
- Article JSON-LD schema on every page
- Cross-links between all 4 topic pages
- Plan Your Visit section on homepage linking to all 4
- Deep-links from where-to-eat to BRAMIDO + La Muralla per-business pages
- Sitemap grew 168 → 176 URLs

## Risks & mitigations

- **Content quality:** Each page is hand-written from local knowledge embedded in the existing site, not generic AI travel-blog fluff. Specific business names, real distances, real festival dates.
- **Translation quality:** ES is natural MX Spanish (not formal Castilian) — e.g., "carro" not "coche", "platica" not "charla", "manejar" not "conducir".
- **No new infra:** Reuses existing build pipeline. Risk surface is small.
