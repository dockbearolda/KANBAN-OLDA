export const COLUMNS = [
  { id: 'demande',        label: 'DEMANDE' },
  { id: 'devis_en_cours', label: 'DEVIS EN COURS' },
  { id: 'devis_accepte',  label: 'DEVIS ACCEPTÉ' },
  { id: 'production',     label: 'PRODUCTION', sub: ['dtf', 'pressage', 'roland_uv', 'trotec', 'autres'] },
  { id: 'facturation',    label: 'FACTURATION' },
];

export const SUBCATS = {
  dtf: 'DTF',
  pressage: 'PRESSAGE',
  roland_uv: 'ROLAND UV',
  trotec: 'TROTEC',
  autres: 'AUTRES',
};

export const USERS = ['L', 'C', 'M', 'J'];

export const VIEW_ALL = 'all';
