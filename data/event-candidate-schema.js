window.SJDG_EVENT_CANDIDATE_SCHEMA_UPDATED_AT = '2026-03-09';

window.SJDG_EVENT_CANDIDATE_SCHEMA = {
  version: 'v1',
  required: [
    'candidate_id',
    'source_id',
    'source_url',
    'collected_at',
    'title',
    'location_scope',
    'review_status'
  ],
  fields: [
    {
      name: 'candidate_id',
      type: 'string',
      required: true,
      example: 'cand_20260309_0001',
      description: 'Stable internal identifier for a parsed event candidate.'
    },
    {
      name: 'source_id',
      type: 'string',
      required: true,
      example: 'official-town-facebook',
      description: 'Registry source that produced this candidate.'
    },
    {
      name: 'fetch_job_id',
      type: 'string',
      required: false,
      example: 'fetch-official-town-facebook',
      description: 'Manifest fetch job that collected the raw record.'
    },
    {
      name: 'post_id',
      type: 'string',
      required: false,
      example: '1234567890123456',
      description: 'Platform-specific post identifier used to build a direct permalink, especially for Facebook posts.'
    },
    {
      name: 'posting_url',
      type: 'string',
      required: false,
      example: 'https://www.facebook.com/.../posts/123',
      description: 'Direct public URL to the actual post or page visitors should open from the events page.'
    },
    {
      name: 'source_url',
      type: 'string',
      required: true,
      example: 'https://www.facebook.com/.../posts/123',
      description: 'Canonical public URL for the original post or article.'
    },
    {
      name: 'source_type',
      type: 'enum',
      required: false,
      example: 'facebook_post',
      description: 'Normalized raw source type such as facebook_post, website_article, flyer_image.'
    },
    {
      name: 'collected_at',
      type: 'datetime',
      required: true,
      example: '2026-03-09T08:12:00-06:00',
      description: 'When the raw source was fetched.'
    },
    {
      name: 'raw_text',
      type: 'string',
      required: false,
      example: 'Gran baile este sabado en la plaza principal...',
      description: 'Combined OCR text and visible caption text before normalization.'
    },
    {
      name: 'media_urls',
      type: 'string[]',
      required: false,
      example: '["https://.../poster.jpg"]',
      description: 'Poster or image URLs captured with the source.'
    },
    {
      name: 'title',
      type: 'string',
      required: true,
      example: 'Gran Baile en la Plaza',
      description: 'Clean event title proposed by extraction.'
    },
    {
      name: 'summary',
      type: 'string',
      required: false,
      example: 'Live music and food stalls during fiestas patronales.',
      description: 'Short normalized description for review and publishing.'
    },
    {
      name: 'category',
      type: 'enum',
      required: false,
      example: 'music',
      description: 'Event bucket such as religious, music, culture, sports, civic, market, fundraiser.'
    },
    {
      name: 'start_date',
      type: 'date',
      required: false,
      example: '2026-05-08',
      description: 'Normalized start date if extraction is confident.'
    },
    {
      name: 'end_date',
      type: 'date',
      required: false,
      example: '2026-05-10',
      description: 'Optional end date for multi-day events.'
    },
    {
      name: 'start_time_text',
      type: 'string',
      required: false,
      example: '8:00 PM',
      description: 'Human-readable time before stricter normalization.'
    },
    {
      name: 'timezone',
      type: 'string',
      required: false,
      example: 'America/Mexico_City',
      description: 'Timezone used for normalized datetimes.'
    },
    {
      name: 'venue_name',
      type: 'string',
      required: false,
      example: 'Plaza Principal',
      description: 'Named venue or organizer-described location.'
    },
    {
      name: 'venue_reference',
      type: 'string',
      required: false,
      example: 'frente al templo',
      description: 'Loose location reference when the venue is informal.'
    },
    {
      name: 'location_scope',
      type: 'enum',
      required: true,
      example: 'town',
      description: 'Town, municipality, unknown, or out_of_scope.'
    },
    {
      name: 'organizer_name',
      type: 'string',
      required: false,
      example: 'Casa de Cultura',
      description: 'Organizer or hosting entity when identifiable.'
    },
    {
      name: 'confidence_score',
      type: 'number',
      required: false,
      example: '0.86',
      description: 'Model confidence from 0 to 1.'
    },
    {
      name: 'confidence_reasons',
      type: 'string[]',
      required: false,
      example: '["matched town alias", "found explicit date"]',
      description: 'Short explanations for why the confidence landed where it did.'
    },
    {
      name: 'duplicate_fingerprint',
      type: 'string',
      required: false,
      example: 'gran-baile|2026-05-08|plaza-principal',
      description: 'Normalized key used to detect duplicates across sources.'
    },
    {
      name: 'review_status',
      type: 'enum',
      required: true,
      example: 'pending',
      description: 'pending, approved, rejected, or needs_more_info.'
    },
    {
      name: 'review_notes',
      type: 'string',
      required: false,
      example: 'Date inferred from poster headline, verify with official page.',
      description: 'Human or automation notes for moderation.'
    }
  ]
};
