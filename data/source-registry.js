window.SJDG_SOURCE_REGISTRY_UPDATED_AT = '2026-03-09';

window.SJDG_SOURCE_REGISTRY = [
  {
    id: 'manual-admin',
    name: 'Manual Admin Entry',
    platform: 'manual',
    category: 'community',
    kind: 'internal_entry',
    url: '/admin',
    priority: 1,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'manual_entry',
    cadence: 'manual',
    geoScope: 'town',
    parserHint: 'admin-form-entry',
    coverage: {
      en: 'Manual events created or corrected from the admin console.',
      es: 'Eventos creados o corregidos manualmente desde la consola admin.'
    },
    notes: {
      en: 'Fallback source for direct admin edits and one-off entries.',
      es: 'Fuente de respaldo para ediciones directas y eventos cargados manualmente.'
    },
    tags: ['manual', 'admin', 'override']
  },
  {
    id: 'official-town-facebook',
    name: 'Official Town Facebook',
    platform: 'facebook',
    category: 'government',
    kind: 'public_page',
    url: 'https://www.facebook.com/profile.php?id=100064799226675',
    priority: 1,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'browser_capture',
    cadence: '4x/day',
    geoScope: 'town',
    parserHint: 'facebook-page-posts-and-flyers',
    coverage: {
      en: 'Town announcements, plaza activities, civic notices, and broad community events.',
      es: 'Avisos del pueblo, actividades en la plaza, avisos civicos y eventos comunitarios amplios.'
    },
    notes: {
      en: 'Best broad source for what is happening in town. Likely to include poster images and short event captions.',
      es: 'La mejor fuente amplia para saber que esta pasando en el pueblo. Probablemente incluya carteles y captions cortos.'
    },
    tags: ['official', 'town', 'announcements', 'events']
  },
  {
    id: 'fiestas-patronales-facebook',
    name: 'Fiestas Patronales',
    platform: 'facebook',
    category: 'festival',
    kind: 'public_page',
    url: 'https://www.facebook.com/profile.php?id=61583626465539',
    priority: 1,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'browser_capture',
    cadence: '4x/day',
    geoScope: 'town',
    parserHint: 'facebook-page-posts-and-flyers',
    coverage: {
      en: 'Annual fiesta programming, music nights, processions, poster schedules, and vendor activity.',
      es: 'Programacion anual de las fiestas, noches de musica, procesiones, carteles de horarios y actividad de vendedores.'
    },
    notes: {
      en: 'Critical seasonal source. This is where the richest May event content is likely to appear first.',
      es: 'Fuente estacional clave. Aqui es donde probablemente aparezca primero el contenido mas rico de mayo.'
    },
    tags: ['festival', 'may', 'religious', 'music', 'seasonal']
  },
  {
    id: 'casa-cultura-facebook',
    name: 'Casa de Cultura del Pueblo',
    platform: 'facebook',
    category: 'culture',
    kind: 'public_page',
    url: 'https://www.facebook.com/casadelacultura.d.sanjosedegracia',
    priority: 1,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'browser_capture',
    cadence: '2x/day',
    geoScope: 'town',
    parserHint: 'facebook-page-posts-and-flyers',
    coverage: {
      en: 'Classes, dance, music, workshops, youth programs, exhibitions, and recurring cultural events.',
      es: 'Clases, danza, musica, talleres, programas para jovenes, exposiciones y eventos culturales recurrentes.'
    },
    notes: {
      en: 'High-value source for recurring local events that may never make it onto official websites.',
      es: 'Fuente de alto valor para eventos locales recurrentes que tal vez nunca lleguen a sitios oficiales.'
    },
    tags: ['culture', 'classes', 'recurring', 'youth']
  },
  {
    id: 'mayor-facebook',
    name: 'Mayor Page',
    platform: 'facebook',
    category: 'government',
    kind: 'public_page',
    url: 'https://www.facebook.com/profile.php?id=61572577994207',
    priority: 2,
    trust: 'medium',
    reviewLevel: 'strict',
    automation: 'browser_capture',
    cadence: '4x/day',
    geoScope: 'municipality',
    parserHint: 'facebook-page-posts-and-flyers',
    coverage: {
      en: 'Mayor announcements, municipal appearances, inaugurations, and event promotion that may mention the town.',
      es: 'Anuncios del alcalde, apariciones municipales, inauguraciones y promocion de eventos que pueden mencionar al pueblo.'
    },
    notes: {
      en: 'Good discovery source because he posts often, but it needs stronger location filtering so municipality-wide posts do not leak into the town feed.',
      es: 'Buena fuente de descubrimiento porque publica seguido, pero necesita mejor filtro de ubicacion para que no entren posts de todo el municipio.'
    },
    tags: ['official', 'mayor', 'municipal', 'discovery']
  },
  {
    id: 'tepatitlan-arte-cultura',
    name: 'Tepatitlan Arte y Cultura',
    platform: 'website',
    category: 'culture',
    kind: 'public_site',
    url: 'https://www.tepatitlan.gob.mx/arteycultura/',
    priority: 2,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'html_scrape',
    cadence: 'daily',
    geoScope: 'municipality',
    parserHint: 'website-articles-and-calendar-blocks',
    coverage: {
      en: 'Municipal culture announcements and official confirmations for programs linked to delegations.',
      es: 'Anuncios culturales municipales y confirmaciones oficiales de programas ligados a delegaciones.'
    },
    notes: {
      en: 'Lower scraping risk than Facebook and useful for confirmation when a cultural event is real but details are thin.',
      es: 'Menor riesgo de scraping que Facebook y util para confirmar cuando un evento cultural es real pero tiene pocos detalles.'
    },
    tags: ['official', 'culture', 'municipal', 'verification']
  },
  {
    id: 'tepatitlan-turismo',
    name: 'Tepatitlan Turismo',
    platform: 'website',
    category: 'government',
    kind: 'public_site',
    url: 'https://www.tepatitlan.gob.mx/turismo/',
    priority: 2,
    trust: 'high',
    reviewLevel: 'normal',
    automation: 'html_scrape',
    cadence: 'weekly',
    geoScope: 'municipality',
    parserHint: 'website-landing-pages-and-event-posts',
    coverage: {
      en: 'Tourism pages, annual festival references, and destination highlights that can verify recurring events.',
      es: 'Paginas de turismo, referencias a fiestas anuales y puntos destacados que pueden verificar eventos recurrentes.'
    },
    notes: {
      en: 'Strong backup source for annual celebrations even if it is not updated as frequently as social posts.',
      es: 'Fuente de respaldo fuerte para celebraciones anuales aunque no se actualice tan seguido como los posts sociales.'
    },
    tags: ['official', 'tourism', 'annual', 'verification']
  },
  {
    id: 'cruz-roja-facebook',
    name: 'Cruz Roja San Jose de Gracia',
    platform: 'facebook',
    category: 'health',
    kind: 'public_page',
    url: 'https://www.facebook.com/CRMSanJoseDeGracia',
    priority: 3,
    trust: 'medium',
    reviewLevel: 'normal',
    automation: 'browser_capture',
    cadence: '2x/day',
    geoScope: 'town',
    parserHint: 'facebook-page-posts-and-flyers',
    coverage: {
      en: 'Fundraisers, trainings, blood drives, emergency notices, and health-related community activity.',
      es: 'Recaudaciones, capacitaciones, donaciones, avisos de emergencia y actividad comunitaria relacionada con salud.'
    },
    notes: {
      en: 'Lower volume but high impact. Worth ingesting once the core pipeline is stable.',
      es: 'Menor volumen pero alto impacto. Vale la pena ingerirla cuando el pipeline base ya este estable.'
    },
    tags: ['health', 'fundraiser', 'training', 'community-service']
  },
  {
    id: 'ayuntamiento-tepatitlan',
    name: 'Ayuntamiento de Tepatitlan',
    platform: 'website',
    category: 'government',
    kind: 'public_site',
    url: 'https://www.tepatitlan.gob.mx/',
    priority: 3,
    trust: 'high',
    reviewLevel: 'strict',
    automation: 'html_scrape',
    cadence: 'daily',
    geoScope: 'municipality',
    parserHint: 'website-news-and-bulletins',
    coverage: {
      en: 'Municipal bulletins, broad official notices, and occasional delegation updates.',
      es: 'Boletines municipales, avisos oficiales amplios y actualizaciones ocasionales de delegaciones.'
    },
    notes: {
      en: 'Useful for verification, but the location filter has to be strict because most posts are not town-specific.',
      es: 'Util para verificacion, pero el filtro de ubicacion tiene que ser estricto porque la mayoria de los posts no son del pueblo.'
    },
    tags: ['official', 'municipal', 'verification', 'broad-scope']
  },
  {
    id: 'for-sale-group',
    name: 'Buy / Sell Community Group',
    platform: 'facebook',
    category: 'community',
    kind: 'public_group',
    url: 'https://www.facebook.com/groups/315972362846384',
    priority: 4,
    trust: 'low',
    reviewLevel: 'strict',
    automation: 'browser_capture',
    cadence: '2x/day',
    geoScope: 'town',
    parserHint: 'facebook-group-posts',
    coverage: {
      en: 'Pop-up food sales, rodeos, local happenings, informal ads, and last-minute announcements.',
      es: 'Ventas de comida, rodeos, avisos locales, anuncios informales y eventos de ultimo minuto.'
    },
    notes: {
      en: 'High-noise discovery source. Good for finding things other sources miss, but not safe for blind publishing.',
      es: 'Fuente de descubrimiento con mucho ruido. Buena para encontrar cosas que otras fuentes se pierden, pero no es segura para publicar a ciegas.'
    },
    tags: ['community', 'informal', 'high-noise', 'discovery']
  }
];
