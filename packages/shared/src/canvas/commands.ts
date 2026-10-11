/**
 * Every step a founder can take on a research canvas — by hand or by asking
 * the assistant. The web UI and `canvas_command` share this list so a phrase
 * in chat cannot name an operation the toolbar does not implement, and a
 * toolbar button cannot do something the assistant has no verb for.
 *
 * Execution stays in the web app: this package must not import React, the API
 * client, or a live board. The ids are the contract.
 */

export const CANVAS_COMMAND_OPS = [
  'add_note',
  'add_sticky',
  'add_shape',
  'capture',
  'delete_selection',
  'duplicate',
  'copy',
  'paste',
  'select_all',
  'select_by_title',
  'undo',
  'redo',
  'align',
  'group',
  'ungroup',
  'lock',
  'unlock',
  'bring_front',
  'send_back',
  'set_style',
  'set_layer',
  'toggle_layer',
  'add_layer',
  'fit_view',
  'zoom',
  'toggle_grid',
  'toggle_snap',
  'find',
  'connect_nodes',
  'auto_layout',
  'export',
  'copy_outline',
  'link_entity',
  'convert_type',
  'add_text',
  'match_size',
  'rotate',
  'copy_style',
  'paste_style',
  'select_same',
  'set_tool',
  'collapse',
  'expand',
  'open_comments',
  'toggle_minimap',
  'toggle_rulers',
  'lock_layer',
  'bring_forward',
  'send_backward',
  'share_link',
  'tidy',
  'nudge',
  'rename',
  'hide',
  'show',
  'flip_h',
  'flip_v',
  'paste_in_place',
  'frame',
  'hug',
  'vote',
  'isolate',
  'reveal',
  'select_inverse',
  'lock_others',
  'scale',
  'radius',
  'format_text',
  'find_replace',
  'insert_link',
  'insert_citation',
  'word_count',
  'merge_notes',
  'split_notes',
  'copy_text',
  'paste_plain',
  'insert_date',
] as const;

export type CanvasCommandOp = (typeof CANVAS_COMMAND_OPS)[number];

export function isCanvasCommandOp(value: string): value is CanvasCommandOp {
  return (CANVAS_COMMAND_OPS as readonly string[]).includes(value);
}

/** Closed sets the model may fill besides `op`. */
export const CANVAS_ALIGN_MODES = ['left', 'right', 'top', 'bottom', 'h', 'v', 'center_h', 'center_v'] as const;
export const CANVAS_CAPTURE_TYPES = ['question', 'hypothesis', 'evidence', 'insight'] as const;
export const CANVAS_EXPORT_FORMATS = ['json', 'outline', 'png', 'svg', 'markdown'] as const;
export const CANVAS_ZOOM_MODES = ['in', 'out', 'reset'] as const;
export const CANVAS_LINK_TYPES = ['builder', 'readiness', 'milestones', 'idea', 'market'] as const;
export const CANVAS_LAYOUT_ALGORITHMS = [
  'dagre-tb',
  'dagre-lr',
  'dagre-bt',
  'dagre-rl',
  'grid',
  'radial',
] as const;
export const CANVAS_NUDGE_DIRS = ['left', 'right', 'up', 'down'] as const;
export const CANVAS_TIDY_AXES = ['h', 'v', 'auto'] as const;
export const CANVAS_DOC_FORMATS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'h1',
  'h2',
  'h3',
  'p',
  'quote',
  'bullet',
  'number',
  'check',
  'align_left',
  'align_center',
  'align_right',
  'justify',
  'indent',
  'outdent',
  'highlight',
  'clear',
  'hr',
  'superscript',
  'subscript',
  'uppercase',
  'lowercase',
  'code',
] as const;
export type CanvasDocFormat = (typeof CANVAS_DOC_FORMATS)[number];
