/* One-shot import of the 89-client list.
 * Run: node server/scripts/seed-clients.js
 * Targets http://localhost:5173 (Vite proxy → server) by default.
 * Skips rows whose SOCIÉTÉ already exists. */

const BASE = process.env.API_BASE || 'http://localhost:5173';

const RAW = [
  ['VOILA SXM',                 'GRAND CASE',                'Clara',           '0690377241', ''],
  ['SEA YOU',                   'GRAND CASE',                'Iris',            '0690552585', ''],
  ['BREAD N BUTTER',            'OYSTER POND',               'Sandra / Sylvain','0690333519', ''],
  ['JOA',                       'BAIE ORIENTALE',            'Alexandre',       '0630010339', ''],
  ['BEACHLIFE',                 'BAIE ORIENTALE',            'Jenni',           '0690652190', ''],
  ['LA PLAYA',                  'BAIE ORIENTALE',            'Caty',            '0690279131', ''],
  ['ORIENT BEACH HOTEL',        'BAIE ORIENTALE',            'Myriam',          '0690629097', ''],
  ['PIOU',                      'HOPE ESTATE',               'Clara / Iris',    '',           ''],
  ['NSEA STEM',                 'SAINT-BARTHELEMY',          'Andréa',          '0659318963', ''],
  ['IGUANA FITNESS',            'GRAND CASE',                'Jérôme',          '0690662400', ''],
  ['IGUANA FITNESS',            'GRAND CASE',                'Pascualine',      '0677029350', ''],
  ['3SP',                       '',                          'Fabien',          '0690382769', ''],
  ['ART FOR SCIENCES',          'HOPE ESTATE',               'Mélanie',         '0609531482', ''],
  ['LA QUINTESSENCE',           'GRAND CASE',                'Olivier',         '0690711502', ''],
  ['INTERIOR DESIGN',           'HOPE ESTATE',               'Joris',           '0690485741', ''],
  ['TI PALM',                   'BAIE ORIENTALE',            'Sophie',          '0690733700', ''],
  ['BILLIE',                    'MARIGOT',                   'Peal',            '0690595343', ''],
  ['ICON',                      'MARIGOT',                   'Peal',            '0690595343', ''],
  ['FRIENDLY PADEL CLUB',       'GRAND CASE',                'Camille',         '0690661498', 'friendlypadelclub@gmail.com'],
  ['FRIENDLY PADEL CLUB',       'GRAND CASE',                'Camille',         '0690661498', ''],
  ['LE TEMPS DES CERISES',      'GRAND CASE',                'Cédric',          '0690613009', ''],
  ['LE TEMPS DES CERISES',      'GRAND CASE',                'Lucas',           '0646784546', ''],
  ['SIMA',                      'HOPE ESTATE',               'Anaïs',           '0690534369', ''],
  ['SIMA',                      'HOPE ESTATE',               'Vincent',         '0690543498', ''],
  ['PHARMACIE HOPE ESTATE',     'HOPE ESTATE',               'Julien',          '0690777248', ''],
  ['LA GAGNE BRASERO',          '',                          'Antoine',         '0618631726', ''],
  ['ONE LOVE',                  'HOPE ESTATE',               'Karine',          '0690754191', ''],
  ['KARIBUNI HOTEL',            'CUL DE SAC',                'Manon',           '0690643858', ''],
  ['KARIBUNI RESTAURANT',       'PINEL',                     'Marion',          '0690613851', ''],
  ['KARIBUNI RESTAURANT',       'PINEL',                     'Emy',             '0690707862', ''],
  ['EDEIS',                     'GRAND CASE',                'Virginie',        '0690221235', ''],
  ['GO & SEA',                  'ANSE MARCEL',               'Franck',          '0690669869', ''],
  ['KALATUA WATERSPORTS',       'MULLET BAY',                'Cyril',           '0690554266', ''],
  ['LES PETITES AIGUILLES',     'MARIGOT',                   'Mathilde',        '0683922788', ''],
  ['SUN LOCATION',              'MARIGOT',                   '',                '0690231511', ''],
  ['A DOM CARAIBES',            'HOPE ESTATE',               'Ophélie',         '0690221221', 'ophelie.e@adom-caraibes.fr'],
  ['LA TERRASSE',               'MARIGOT',                   'Dylan',           '0690669999', ''],
  ['CARIBBEAN LUXURY VACATION', 'MARIGOT',                   'Vuta',            '0786053934', ''],
  ['CARIBBEAN LUXURY VACATION', 'MARIGOT',                   'Thomas',          '0667682648', ''],
  ['YKG BRUNO',                 'SAINT-BARTHELEMY',          'Bruno',           '0690533358', ''],
  ['PATES ATRA',                'HOPE ESTATE',               'Mathilde',        '0690705106', ''],
  ['POLO LE BOUCHER',           'HOPE ESTATE',               'Jessica',         '0690222046', ''],
  ['DREAM OF TRAIL',            '',                          'Quentin',         '0690751104', ''],
  ['KALATUA RESTAURANT',        'MULLET BAY',                'Emmanuelle',      '0783652392', ''],
  ['INNOVATION MEDICAL CARAIBES','',                         '',                '0690485844', ''],
  ['SOLEA STUDIO',              '',                          'Adèle',           '0690437940', ''],
  ['MOOD',                      'HOPE ESTATE',               'Schmidt',         '0620102980', ''],
  ['ANNE MODE CONCEPT (KALATUA)','MULLET BAY',               'Anne',            '0690298858', ''],
  ['OLDA STD',                  '',                          '',                '',           ''],
  ['DFR (BUZZ)',                'HOPE ESTATE',               'Thomas',          '0690351641', ''],
  ['OFFICE DU TOURISME',        'MARIGOT',                   'Lou',             '0690420505', ''],
  ['FARWOOD',                   'LA SAVANE',                 'Margo',           '0690096600', ''],
  ['SOUALIGA HOMES',            'GRAND CASE',                'Christine',       '0690889786', ''],
  ['C CLIM',                    '',                          'Bertrand',        '0690595018', ''],
  ['HAPPY SCHOOL',              'GRAND CASE',                'Hélène',          '0661506224', ''],
  ['LE RADEAU BLEU',            'ANSE MARCEL',               '',                '0691282309', ''],
  ['VILLA PRIVILEGE',           'ANSE MARCEL',               'Alisson',         '0690348999', ''],
  ['OUALICHI GOURMET',          'CUL DE SAC',                'Alain',           '0690172732', ''],
  ['WEST INDIES ISLANDER',      'MARIGOT',                   'Fred',            '0690445588', ''],
  ['CLEAN FOSSES',              '',                          'Eric',            '0690398812', ''],
  ['HOTEL JM (KOHO)',           'GRAND CASE',                'Mathis',          '0622361122', ''],
  ['JC BAR COMPANY',            'CONCORDIA',                 'Jordan',          '0690219000', ''],
  ['LIGUE DE FOOTBALL SM',      'MARIGOT',                   'Ladislas',        '0690374600', ''],
  ['CAPTAIN JO',                'ANSE MARCEL',               'Julie',           '0690379173', ''],
  ['GRAND CASE BEACH CLUB',     'GRAND CASE',                'Alexandra',       '0690610515', ''],
  ['LE CARPACCIO',              'GRAND CASE',                'Kévin',           '0690505441', ''],
  ['100% VILLAS',               'BAIE NETTLE',               'Vinciane',        '0642266949', ''],
  ['LA SAMANNA',                'BAIE LONGUE',               'Eleonore',        '12645846212',''],
  ['SOLUTION RESINE',           '',                          'Guillaume',       '0690297282', ''],
  ['BOIS ATTITUDE',             'MONT VERNON 1',             'Basile',          '0690669424', ''],
  ['BOIS ATTITUDE',             'MONT VERNON 1',             'David',           '0690246474', ''],
  ['COOL SXM',                  'BAIE ORIENTALE',            'Patrick',         '0699291969', ''],
  ['LOVE BOAT',                 'ANSE MARCEL',               'Chris',           '0690183337', ''],
  ['TROPICAL RIDE',             'BAIE ORIENTALE',            'Lila',            '0690371349', ''],
  ['KEN BROKER',                'GRAND CASE',                'Ken',             '0690888333', ''],
  ['CSTL',                      '',                          'Max',             '0690522588', ''],
  ['LE MARTIN',                 'CUL DE SAC',                'Marion',          '0690565376', 'info@lemartinhotel.com'],
  ['LE MARTIN',                 'CUL DE SAC',                'Emmanuel',        '0690358528', 'info@lemartinhotel.com'],
  ['LLPM',                      '',                          'Chelsee',         '0690633449', ''],
  ['CREOL ROCK WATERSPORTS',    'GRAND CASE',                'Jérôme',          '0690565056', ''],
  ['CANONICA',                  'Aéroport Princesse Juliana','',                '',           ''],
  ['BLUE MARTINI',              'GRAND CASE',                'Victor',          '',           ''],
  ['BLUE MARTINI',              'GRAND CASE',                'Martin',          '',           ''],
  ['SOUALIGA ELEVATOR',         '',                          'Benoît',          '',           ''],
  ['TWENTY TWO',                '',                          'Héla',            '',           ''],
  ['ATELIER AGENCEMENT',        'HOPE ESTATE',               'Gaétan',          '',           ''],
  ['ATELIER AGENCEMENT',        'HOPE ESTATE',               'Gaylord',         '',           ''],
  ['LA CIGALE',                 'BAIE NETTLE',               '',                '',           'restaurantlacigale@gmail.com'],
  ['ARAWAK CHARTER BOAT',       'ANSE MARCEL',               '',                '0690502521', 'contact@arawakcharters.com'],
];

function titleCase(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/(\s+|[-\/])/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '-' || part === '/') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function cleanPhone(p) {
  if (!p) return '';
  return p.replace(/\s+/g, '');
}

function normalize([company, city, name, phone, email]) {
  return {
    company: (company || '').trim().toUpperCase(),
    city:    titleCase((city || '').trim()),
    name:    titleCase((name || '').trim()),
    phone:   cleanPhone(phone),
    email:   (email || '').trim().toLowerCase(),
  };
}

async function main() {
  const existing = await fetch(`${BASE}/api/clients`).then((r) => r.json());
  const existingKeys = new Set(
    existing.map((c) => `${(c.company || '').toUpperCase()}|${(c.name || '').toLowerCase()}`)
  );

  let created = 0;
  let skipped = 0;
  for (const row of RAW) {
    const c = normalize(row);
    const key = `${c.company}|${c.name.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const res = await fetch(`${BASE}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      console.error('Failed:', c.company, c.name, res.status);
      continue;
    }
    existingKeys.add(key);
    created++;
  }
  console.log(`done — created: ${created}, skipped (existing): ${skipped}, total in source: ${RAW.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
