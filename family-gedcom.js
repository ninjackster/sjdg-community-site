// Export the family tree to GEDCOM 5.5.1 (the universal genealogy interchange format).
// Pure & dependency-free; imported by family-tree.js (browser) and the Node tests.
// Covers names, sex, birth/death dates, notes (story + sourcing), and family links
// (HUSB/WIFE/CHIL + FAMS/FAMC). Photos are not exported (they live as repo files).

const MAXLEN = 200; // keep well under the GEDCOM 255-char line limit

export function toGedcom(tree) {
  const lines = [];
  const xref = (id) => '@' + id + '@';

  lines.push('0 HEAD');
  lines.push('1 SOUR sanjosedegracia.net');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // FAMS (as spouse) and FAMC (as child) links
  const fams = new Map();
  const famc = new Map();
  for (const f of (tree.families || [])) {
    for (const p of [f.husband, f.wife]) if (p) (fams.get(p) || fams.set(p, []).get(p)).push(f.id);
    for (const c of (f.children || [])) if (!famc.has(c)) famc.set(c, f.id);
  }

  // Emit a possibly-long, possibly-multiline text value across CONT (newlines) + CONC (length).
  const emitText = (tag, text) => {
    const parts = String(text).split(/\r?\n/);
    parts.forEach((part, pi) => {
      let rest = part, first = true;
      do {
        const chunk = rest.slice(0, MAXLEN);
        rest = rest.slice(MAXLEN);
        const prefix = first ? (pi === 0 ? '1 ' + tag + ' ' : '2 CONT ') : '2 CONC ';
        lines.push(prefix + chunk);
        first = false;
      } while (rest.length);
    });
  };

  for (const ind of (tree.individuals || [])) {
    lines.push('0 ' + xref(ind.id) + ' INDI');
    const given = (ind.names && ind.names.given) || '';
    const sur = ((ind.names && ind.names.surnames) || []).join(' ');
    lines.push('1 NAME ' + given + ' /' + sur + '/');
    if (ind.sex === 'M' || ind.sex === 'F') lines.push('1 SEX ' + ind.sex);
    if (ind.birth && ind.birth.date) { lines.push('1 BIRT'); lines.push('2 DATE ' + ind.birth.date); }
    if (ind.death && ind.death.date) { lines.push('1 DEAT'); lines.push('2 DATE ' + ind.death.date); }
    const story = ind.story && (ind.story.en || ind.story.es);
    const note = ind.notes && (ind.notes.en || ind.notes.es);
    if (story) emitText('NOTE', story);
    if (note) emitText('NOTE', note);
    for (const fid of (fams.get(ind.id) || [])) lines.push('1 FAMS ' + xref(fid));
    if (famc.has(ind.id)) lines.push('1 FAMC ' + xref(famc.get(ind.id)));
  }

  for (const f of (tree.families || [])) {
    lines.push('0 ' + xref(f.id) + ' FAM');
    if (f.husband) lines.push('1 HUSB ' + xref(f.husband));
    if (f.wife) lines.push('1 WIFE ' + xref(f.wife));
    for (const c of (f.children || [])) lines.push('1 CHIL ' + xref(c));
  }

  lines.push('0 TRLR');
  return lines.join('\n') + '\n';
}
