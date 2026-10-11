import {
  CANVAS_ALIGN_MODES,
  CANVAS_CAPTURE_TYPES,
  CANVAS_COMMAND_OPS,
  CANVAS_EXPORT_FORMATS,
  CANVAS_LAYOUT_ALGORITHMS,
  CANVAS_LINK_TYPES,
  type CanvasCommandOp,
} from '@cofounderbay/shared';

function quotedNames(rawMessage: string): string[] {
  return [...rawMessage.matchAll(/["“'«]([^"”'»]{1,100})["”'»]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function quotedName(rawMessage: string): string | undefined {
  return quotedNames(rawMessage)[0];
}

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function includesAny(haystack: string, needles: string[]): boolean {
  const text = fold(haystack);
  return needles.some((n) => text.includes(fold(n)));
}

const CANVAS_SURFACE = [
  'canvas',
  'research board',
  'sticky note',
  'research node',
  'καμβα',
  'πινακα ερευν',
  'πινακες ερευν',
  'πινακα ερευνας',
  'σημειωση στον',
  'κομβο',
  'κομβους',
];

const CAPTURE_HINTS: Array<{ keys: string[]; nodeType: (typeof CANVAS_CAPTURE_TYPES)[number] }> = [
  { keys: ['hypothesis', 'υποθεσ'], nodeType: 'hypothesis' },
  { keys: ['evidence', 'τεκμηρ'], nodeType: 'evidence' },
  { keys: ['insight', 'ευρημα', 'ευρήμα'], nodeType: 'insight' },
  { keys: ['question', 'ερωτησ', 'ερώτησ'], nodeType: 'question' },
];

const ALIGN_HINTS: Array<{ keys: string[]; align: (typeof CANVAS_ALIGN_MODES)[number] }> = [
  { keys: ['align center', 'center horizontally', 'κεντρο οριζοντια', 'κέντρο οριζόντια'], align: 'center_h' },
  { keys: ['align middle', 'center vertically', 'κεντρο καθετα', 'κέντρο κάθετα'], align: 'center_v' },
  { keys: ['align right', 'στοιχισ δεξια', 'στοίχισε δεξιά'], align: 'right' },
  { keys: ['align left', 'στοιχισ αριστερα', 'στοίχισε αριστερά'], align: 'left' },
  { keys: ['align top', 'στοιχισ επανω', 'στοίχισε επάνω'], align: 'top' },
  { keys: ['align bottom', 'στοιχισ κατω', 'στοίχισε κάτω'], align: 'bottom' },
  { keys: ['distribute horizontally', 'κατανομη οριζοντια', 'οριζόντια'], align: 'h' },
  { keys: ['distribute vertically', 'κατανομη καθετα', 'κάθετα'], align: 'v' },
];

const LINK_HINTS: Array<{ keys: string[]; href: string; link: (typeof CANVAS_LINK_TYPES)[number] }> = [
  { keys: ['readiness', 'ετοιμοτητ'], href: '/readiness', link: 'readiness' },
  { keys: ['milestone', 'οροσημ'], href: '/milestones', link: 'milestones' },
  { keys: ['idea core', 'πυρηνα ιδεας', 'πυρήνα'], href: '/builder?tab=idea', link: 'idea' },
  { keys: ['market analysis', 'αναλυση αγορας'], href: '/builder?tab=market', link: 'market' },
  { keys: ['pitch', 'pitch deck'], href: '/builder?tab=pitch', link: 'builder' },
  { keys: ['builder'], href: '/builder', link: 'builder' },
];

function firstMatch<T extends { keys: string[] }>(message: string, rows: T[]): T | undefined {
  return rows.find((row) => includesAny(message, row.keys));
}

/**
 * Whether this phrase is a canvas step rather than a people-intro or a page open.
 *
 * "connect" alone is an intro. "connect these notes on the canvas" is not.
 * "open canvas" is navigation. "add a note on the canvas" is a write.
 */
export function namesCanvasSurface(message: string): boolean {
  return includesAny(message, CANVAS_SURFACE);
}

export function planCanvasCommandArgs(rawMessage: string): Record<string, string> | null {
  const message = fold(rawMessage.trim());
  if (!message) return null;

  const onCanvas = namesCanvasSurface(message);
  const quoted = quotedName(rawMessage);
  const args: Record<string, string> = {};
  if (quoted) args.title = quoted;

  const capture = firstMatch(message, CAPTURE_HINTS);
  const wantsAdd = includesAny(message, [
    'add a note',
    'add note',
    'add a sticky',
    'new note',
    'new sticky',
    'add a question',
    'add a hypothesis',
    'add evidence',
    'add an insight',
    'capture',
    'προσθεσε σημειωσ',
    'πρόσθεσε σημείωσ',
    'προσθεσε sticky',
    'πρόσθεσε ερώτησ',
    'προσθεσε ερωτησ',
    'πρόσθεσε υπόθεσ',
    'προσθεσε υποθεσ',
    'καταγραφ',
  ]);

  if (wantsAdd && (onCanvas || capture)) {
    if (includesAny(message, ['sticky'])) {
      args.op = 'add_sticky';
      return args;
    }
    if (capture) {
      args.op = 'capture';
      args.nodeType = capture.nodeType;
      return args;
    }
    args.op = 'add_note';
    return args;
  }

  if (!onCanvas && !capture) return null;

  const align = firstMatch(message, ALIGN_HINTS);
  const wantsTextAlign = includesAny(message, [
    'align text',
    'text left',
    'text right',
    'text center',
    'justify text',
    'justify the text',
    'στοιχισε το κειμεν',
    'στοίχισε το κείμεν',
  ]);
  if (
    align &&
    !wantsTextAlign &&
    includesAny(message, ['align', 'distribute', 'στοιχισ', 'στοίχισ', 'κατανομη', 'κατανομή'])
  ) {
    args.op = 'align';
    args.align = align.align;
    return args;
  }

  if (includesAny(message, ['connect the', 'connect these', 'connect node', 'connect notes', 'συνδεσε τους', 'σύνδεσε τους', 'συνδεσε τις', 'σύνδεσε τις'])) {
    args.op = 'connect_nodes';
    return args;
  }

  if (includesAny(message, ['duplicate', 'αντιγραφη επιλογ', 'αντιγραφή επιλογ', 'διπλασιασ'])) {
    args.op = 'duplicate';
    return args;
  }

  if (includesAny(message, ['delete selected', 'delete the selected', 'διαγραψε την επιλογ', 'διάγραψε την επιλογ', 'σβησε τους κομβ'])) {
    args.op = 'delete_selection';
    return args;
  }

  if (includesAny(message, ['select all', 'επιλογη ολων', 'επιλογή όλων'])) {
    args.op = 'select_all';
    return args;
  }

  if (includesAny(message, ['undo', 'αναιρεσ', 'αναίρεσ']) && !includesAny(message, ['redo'])) {
    args.op = 'undo';
    return args;
  }

  if (includesAny(message, ['redo', 'επανεκτελ'])) {
    args.op = 'redo';
    return args;
  }

  if (includesAny(message, ['bring to front', 'μπροστα', 'μπροστά'])) {
    args.op = 'bring_front';
    return args;
  }

  if (includesAny(message, ['send back', 'send to back', 'πισω', 'πίσω'])) {
    args.op = 'send_back';
    return args;
  }

  if (includesAny(message, ['lock']) && !includesAny(message, ['unlock', 'ξεκλειδ'])) {
    args.op = 'lock';
    return args;
  }

  if (includesAny(message, ['unlock', 'ξεκλειδ'])) {
    args.op = 'unlock';
    return args;
  }

  if (includesAny(message, ['group', 'ομαδοποιησ', 'ομαδοποίησ']) && !includesAny(message, ['ungroup', 'ξεομαδ'])) {
    args.op = 'group';
    return args;
  }

  if (includesAny(message, ['ungroup', 'ξεομαδ'])) {
    args.op = 'ungroup';
    return args;
  }

  if (includesAny(message, ['fit to', 'fit the', 'fit view', 'ταιριαξε στην οθον', 'ταίριαξε στην οθον', 'προσαρμοσε στην'])) {
    args.op = 'fit_view';
    return args;
  }

  if (includesAny(message, ['zoom in', 'μεγεθυν', 'μεγέθυν'])) {
    args.op = 'zoom';
    args.query = 'in';
    return args;
  }

  if (includesAny(message, ['zoom out', 'σμικρυν', 'σμίκρυν'])) {
    args.op = 'zoom';
    args.query = 'out';
    return args;
  }

  if (includesAny(message, ['reset view', 'reset zoom', 'επαναφορα προβολ', 'επαναφορά προβολ'])) {
    args.op = 'zoom';
    args.query = 'reset';
    return args;
  }

  if (includesAny(message, ['toggle grid', 'show grid', 'hide grid', 'πλεγμα', 'πλέγμα'])) {
    args.op = 'toggle_grid';
    return args;
  }

  if (includesAny(message, ['snap', 'μαγνητ'])) {
    args.op = 'toggle_snap';
    return args;
  }

  if (includesAny(message, ['match size', 'same size', 'ιδιο μεγεθ', 'ίδιο μέγεθ'])) {
    args.op = 'match_size';
    return args;
  }

  if (includesAny(message, ['rotate', 'περιστρεψ', 'περιστρέψ'])) {
    args.op = 'rotate';
    args.query = '90';
    return args;
  }

  if (includesAny(message, ['copy style', 'format painter', 'αντιγραφη στυλ', 'αντιγραφή στυλ'])) {
    args.op = 'copy_style';
    return args;
  }

  if (includesAny(message, ['paste style', 'επικολλησ στυλ', 'επικόλλησ στυλ'])) {
    args.op = 'paste_style';
    return args;
  }

  if (includesAny(message, ['select same', 'επιλογη ιδιου', 'επιλογή ίδιου'])) {
    args.op = 'select_same';
    return args;
  }

  if (includesAny(message, ['ruler', 'χαρακ'])) {
    args.op = 'toggle_rulers';
    return args;
  }

  if (includesAny(message, ['tidy', 'τακτοποι', 'τακτοποί'])) {
    args.op = 'tidy';
    if (includesAny(message, ['vertical', 'καθετ', 'κάθετ'])) args.query = 'v';
    else if (includesAny(message, ['horizontal', 'οριζοντ'])) args.query = 'h';
    return args;
  }

  if (includesAny(message, ['nudge', 'μετατοπισ', 'μετατόπισ', 'σπρωξ'])) {
    args.op = 'nudge';
    if (includesAny(message, ['left', 'αριστερ'])) args.query = includesAny(message, ['shift', 'large']) ? 'shift left' : 'left';
    else if (includesAny(message, ['right', 'δεξι'])) args.query = includesAny(message, ['shift', 'large']) ? 'shift right' : 'right';
    else if (includesAny(message, ['up', 'επανω', 'επάνω'])) args.query = 'up';
    else if (includesAny(message, ['down', 'κατω', 'κάτω'])) args.query = 'down';
    return args;
  }

  if (includesAny(message, ['paste in place', 'επικολλησ στη θεσ', 'επικόλλησ στη θέσ'])) {
    args.op = 'paste_in_place';
    return args;
  }

  if (includesAny(message, ['frame selection', 'frame the', 'πλαισιο επιλογ', 'πλαίσιο επιλογ'])) {
    args.op = 'frame';
    return args;
  }

  if (includesAny(message, ['hug', 'προσαρμοσε στο περιεχ', 'προσάρμοσε στο περιεχ'])) {
    args.op = 'hug';
    return args;
  }

  if (includesAny(message, ['flip horizontal', 'flip horizontally', 'οριζοντια αναστροφ', 'οριζόντια αναστροφ'])) {
    args.op = 'flip_h';
    return args;
  }

  if (includesAny(message, ['flip vertical', 'flip vertically', 'καθετη αναστροφ', 'κάθετη αναστροφ'])) {
    args.op = 'flip_v';
    return args;
  }

  if (includesAny(message, ['isolate', 'απομονωσ', 'απομόνωσ'])) {
    args.op = 'isolate';
    return args;
  }

  if (includesAny(message, ['show all', 'reveal', 'εμφανιση ολων', 'εμφάνιση όλων'])) {
    args.op = 'reveal';
    return args;
  }

  if (includesAny(message, ['hide selected', 'hide the selected', 'αποκρυψε την επιλογ', 'απόκρυψε την επιλογ'])) {
    args.op = 'hide';
    return args;
  }

  if (includesAny(message, ['vote', 'ψηφισ', 'ψήφισ', 'upvote'])) {
    args.op = 'vote';
    return args;
  }

  if (includesAny(message, ['lock others', 'κλειδωσε τους αλλ', 'κλείδωσε τους άλλ'])) {
    args.op = 'lock_others';
    return args;
  }

  if (includesAny(message, ['select inverse', 'invert selection', 'αντιστροφ επιλογ', 'αντιστροφή επιλογ'])) {
    args.op = 'select_inverse';
    return args;
  }

  if (includesAny(message, ['rename', 'μετονομασ', 'μετονόμασ']) && quoted) {
    args.op = 'rename';
    return args;
  }

  if (includesAny(message, ['scale down', 'μικρυν', 'μίκρυν'])) {
    args.op = 'scale';
    args.query = 'down';
    return args;
  }

  if (includesAny(message, ['scale up', 'scale the', 'μεγενθυν επιλογ', 'μεγένθυν'])) {
    args.op = 'scale';
    args.query = 'up';
    return args;
  }

  if (includesAny(message, ['find and replace', 'replace text', 'αντικαταστησ', 'αντικατέστησ'])) {
    args.op = 'find_replace';
    const quotes = quotedNames(rawMessage);
    if (quotes[0]) args.title = quotes[0];
    if (quotes[1]) args.query = quotes[1];
    return args;
  }

  if (includesAny(message, ['word count', 'count words', 'πληθος λεξεων', 'πλήθος λέξεων'])) {
    args.op = 'word_count';
    return args;
  }

  if (includesAny(message, ['add a citation', 'insert citation', 'cite this', 'παραπομπ', 'βιβλιογραφ'])) {
    args.op = 'insert_citation';
    return args;
  }

  if (includesAny(message, ['insert a link', 'add a hyperlink', 'προσθεσε συνδεσμο', 'πρόσθεσε σύνδεσμο']) && !includesAny(message, ['link to builder', 'link to readiness'])) {
    args.op = 'insert_link';
    const href = rawMessage.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
    if (href) args.href = href;
    return args;
  }

  if (includesAny(message, ['merge notes', 'combine notes', 'ενωσε τις σημειωσ', 'ένωσε τις σημειώσ'])) {
    args.op = 'merge_notes';
    return args;
  }

  if (includesAny(message, ['split the note', 'split into notes', 'σπασε τη σημειωσ', 'σπάσε τη σημείωσ'])) {
    args.op = 'split_notes';
    return args;
  }

  if (includesAny(message, ['copy the text', 'copy as text', 'αντιγραφη κειμεν', 'αντιγραφή κειμέν'])) {
    args.op = 'copy_text';
    return args;
  }

  if (includesAny(message, ['paste as plain', 'paste unformatted', 'επικολλησε σκετο', 'επικόλλησε σκέτο'])) {
    args.op = 'paste_plain';
    return args;
  }

  if (includesAny(message, ["insert today's date", 'insert date', 'προσθεσε ημερομην', 'πρόσθεσε ημερομην'])) {
    args.op = 'insert_date';
    return args;
  }

  const docFormat: Array<{ keys: string[]; query: string }> = [
    { keys: ['make bold', 'bold the', 'εντονα', 'έντονα'], query: 'bold' },
    { keys: ['italic', 'πλαγια', 'πλάγια'], query: 'italic' },
    { keys: ['underline the', 'υπογραμμ'], query: 'underline' },
    { keys: ['strikethrough', 'διαγραφη κειμεν', 'διαγραφή κειμέν'], query: 'strike' },
    { keys: ['heading 2', 'heading two'], query: 'h2' },
    { keys: ['heading 3', 'heading three'], query: 'h3' },
    { keys: ['heading 1', 'as a heading', 'επικεφαλιδ', 'επικεφαλίδ'], query: 'h1' },
    { keys: ['as a paragraph', 'normal text'], query: 'p' },
    { keys: ['bullet list', 'bullets', 'κουκκιδ'], query: 'bullet' },
    { keys: ['numbered list', 'αριθμημεν', 'αριθμημέν'], query: 'number' },
    { keys: ['highlight the', 'highlight text', 'επισημαν', 'επισήμαν'], query: 'highlight' },
    { keys: ['clear formatting', 'καθαρισμο μορφ', 'καθαρισμό μορφ'], query: 'clear' },
    { keys: ['justify the text', 'justify text', 'πυκνη στοιχισ', 'πυκνή στοίχισ'], query: 'justify' },
    { keys: ['align text center', 'center the text'], query: 'align_center' },
    { keys: ['align text left', 'left-align the text'], query: 'align_left' },
    { keys: ['align text right', 'right-align the text'], query: 'align_right' },
    { keys: ['blockquote', 'quote the', 'παραθεσ', 'παράθεσ'], query: 'quote' },
    { keys: ['checklist in the note', 'checkbox list'], query: 'check' },
    { keys: ['increase indent', 'indent the text', 'αυξησε εσοχ', 'αύξησε εσοχ'], query: 'indent' },
    { keys: ['decrease indent', 'outdent', 'μειωσε εσοχ', 'μείωσε εσοχ'], query: 'outdent' },
    { keys: ['horizontal rule', 'horizontal line', 'οριζοντια γραμμ', 'οριζόντια γραμμ'], query: 'hr' },
    { keys: ['superscript', 'εκθετ', 'εκθέτ'], query: 'superscript' },
    { keys: ['subscript', 'δεικτη', 'δείκτη'], query: 'subscript' },
    { keys: ['uppercase', 'all caps', 'κεφαλαια', 'κεφαλαία'], query: 'uppercase' },
    { keys: ['lowercase', 'πεζα', 'πεζά'], query: 'lowercase' },
    { keys: ['code block', 'as code', 'ως κωδικα', 'ως κώδικα'], query: 'code' },
  ];
  const doc = docFormat.find((row) => includesAny(message, row.keys));
  if (doc) {
    args.op = 'format_text';
    args.query = doc.query;
    return args;
  }


  if (includesAny(message, ['minimap', 'μικροχαρτ'])) {
    args.op = 'toggle_minimap';
    return args;
  }

  if (includesAny(message, ['export svg', 'download svg'])) {
    args.op = 'export';
    args.query = 'svg';
    return args;
  }

  if (includesAny(message, ['export markdown', 'export md'])) {
    args.op = 'export';
    args.query = 'markdown';
    return args;
  }

  if (includesAny(message, ['copy outline', 'αντιγραφη περιγραμμ', 'αντιγραφή περιγράμμ'])) {
    args.op = 'copy_outline';
    return args;
  }

  if (includesAny(message, ['export json', 'download json'])) {
    args.op = 'export';
    args.query = 'json';
    return args;
  }

  if (includesAny(message, ['export png', 'download png', 'εξαγωγη png', 'εξαγωγή png'])) {
    args.op = 'export';
    args.query = 'png';
    return args;
  }

  if (includesAny(message, ['export', 'εξαγωγ', 'εξαγωγ'])) {
    args.op = 'export';
    args.query = CANVAS_EXPORT_FORMATS.find((f) => message.includes(f)) ?? 'json';
    return args;
  }

  if (includesAny(message, ['auto layout', 'auto-layout', 'αυτοματη διαταξ', 'αυτόματη διάταξ'])) {
    args.op = 'auto_layout';
    args.query = CANVAS_LAYOUT_ALGORITHMS.find((a) => message.includes(a)) ?? 'dagre-tb';
    return args;
  }

  const link = firstMatch(message, LINK_HINTS);
  if (link && includesAny(message, ['link', 'συνδεσ', 'σύνδεσ', 'carry', 'μεταφερ'])) {
    args.op = 'link_entity';
    args.href = link.href;
    return args;
  }

  if (includesAny(message, ['find nodes', 'find on the canvas', 'search nodes', 'βρες κομβ', 'εύρεση κόμβ'])) {
    args.op = 'find';
    const q = message.replace(/.*(find|search|βρες|εύρεση)\s+(nodes?|on the canvas|κομβ\w*)\s*/i, '').trim();
    if (q) args.query = q.slice(0, 80);
    return args;
  }

  if (includesAny(message, ['paste', 'επικολλησ', 'επικόλλησ'])) {
    args.op = 'paste';
    return args;
  }

  if (includesAny(message, ['copy', 'αντιγραψ', 'αντίγραψ']) && onCanvas) {
    args.op = 'copy';
    return args;
  }

  if (CANVAS_COMMAND_OPS.includes(message as CanvasCommandOp)) {
    args.op = message;
    return args;
  }

  return null;
}
