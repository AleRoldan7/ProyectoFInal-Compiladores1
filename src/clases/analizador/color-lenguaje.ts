// ─────────────────────────────────────────────────────────────────────────────
// yfera-highlighter.ts
// Syntax highlighter para los 3 lenguajes YFERA, extraído directamente
// de las gramáticas Jison: .y/.comp  |  .styles  |  .dba
// ─────────────────────────────────────────────────────────────────────────────
// USO EN ArbolService / PestanasService:
//   import { YferaHighlighter } from './yfera-highlighter';
//   const html = YferaHighlighter.highlight(codigo, nombreArchivo);
// ─────────────────────────────────────────────────────────────────────────────

export interface Token {
  tipo: TokenTipo;
  valor: string;
}

export type TokenTipo =
  | 'keyword'      // palabras reservadas del lenguaje
  | 'type'         // tipos de datos: int float string boolean char
  | 'visual'       // elementos visuales: FORM INPUT_TEXT IMG T …
  | 'prop'         // propiedades CSS en .styles
  | 'css_value'    // valores CSS: CENTER solid MONO …
  | 'string'       // "literal" y 'char'
  | 'number'       // enteros, decimales, píxeles, porcentajes
  | 'color'        // #rrggbb
  | 'var'          // $variable
  | 'input_ref'    // @inputRef  (en .y)
  | 'component'    // @Componente (invocación)
  | 'identifier'   // nombre genérico
  | 'operator'     // == != >= <= + - * / % = . , ; : .
  | 'bracket'      // { } ( ) [ ] [[ ]]
  | 'comment'      // /* … */  y  # …
  | 'import_path'  // ruta en import "…"
  | 'backtick'     // `expresión SQL`
  | 'whitespace';

// ─── Paleta de colores (CSS variables compatibles con el IDE oscuro) ──────────
// Ajusta estos valores en tu CSS global si quieres cambiar el tema.
const COLOR: Record<TokenTipo, string> = {
  keyword:     '#c792ea',   // violeta  — for if else switch import main function
  type:        '#ffcb6b',   // ámbar    — int float string boolean char
  visual:      '#82aaff',   // azul     — FORM INPUT_TEXT IMG T SUBMIT
  prop:        '#89ddff',   // celeste  — background color height width …
  css_value:   '#c3e88d',   // verde    — CENTER solid MONO HELVETICA
  string:      '#c3e88d',   // verde    — "texto"
  number:      '#f78c6c',   // naranja  — 42  3.14  100px  50%
  color:       '#f78c6c',   // naranja  — #ff0000
  var:         '#e06c75',   // rojo suave — $variable
  input_ref:   '#e5c07b',   // dorado   — @inputRef
  component:   '#61dafb',   // cyan     — @ComponentName
  identifier:  '#c8d0e0',   // blanco grisáceo
  operator:    '#89ddff',   // celeste
  bracket:     '#abb2bf',   // gris
  comment:     '#546e7a',   // gris azulado — itálica
  import_path: '#98c379',   // verde claro
  backtick:    '#d19a66',   // naranja tierra
  whitespace:  'inherit',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function span(tipo: TokenTipo, valor: string): string {
  const italic = tipo === 'comment' ? 'font-style:italic;' : '';
  return `<span style="color:${COLOR[tipo]};${italic}">${esc(valor)}</span>`;
}

// ─── Tokenizador para .y / .comp ─────────────────────────────────────────────

const Y_KEYWORDS = new Set([
  'for each','for','if','else if','else','Switch','case','default',
  'empty','track','import','main','execute','load','while','do',
  'switch','break','continue','function',
]);

const Y_TYPES = new Set(['int','float','string','boolean','char']);

const Y_VISUALS = new Set([
  'FORM','INPUT_TEXT','INPUT_NUMBER','INPUT_BOOL','SUBMIT','IMG','T',
]);

const Y_BOOL = new Set(['true','false','True','False']);

function tokenizeY(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comentario bloque
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      tokens.push({ tipo: 'comment', valor: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // Comentario línea #
    if (code[i] === '#') {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      tokens.push({ tipo: 'comment', valor: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // Backtick
    if (code[i] === '`') {
      const end = code.indexOf('`', i + 1);
      const stop = end === -1 ? code.length : end + 1;
      tokens.push({ tipo: 'backtick', valor: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // String doble
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j++;
      tokens.push({ tipo: 'string', valor: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Char simple
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") j++;
      tokens.push({ tipo: 'string', valor: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // [[ y ]]
    if (code.startsWith('[[', i)) { tokens.push({ tipo: 'bracket', valor: '[[' }); i += 2; continue; }
    if (code.startsWith(']]', i)) { tokens.push({ tipo: 'bracket', valor: ']]' }); i += 2; continue; }
    // Operadores 2 chars
    const op2 = code.slice(i, i + 2);
    if (['==','!=','>=','<=','&&','||','++'].includes(op2)) {
      tokens.push({ tipo: 'operator', valor: op2 }); i += 2; continue;
    }
    // @ — ref o componente
    if (code[i] === '@') {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      // Si empieza con mayúscula → invocación componente, si no → input_ref
      const tipo: TokenTipo = /^@[A-Z]/.test(word) ? 'component' : 'input_ref';
      tokens.push({ tipo, valor: word });
      i = j;
      continue;
    }
    // $variable
    if (code[i] === '$') {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      tokens.push({ tipo: 'var', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // Número
    if (/[0-9]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ tipo: 'number', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // Identificador / keyword
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_\-]/.test(code[j])) j++;
      const word = code.slice(i, j);

      // "for each" especial
      if (word === 'for' && code.slice(j).match(/^\s+each\b/)) {
        const m = code.slice(j).match(/^(\s+each)/);
        const full = 'for' + (m ? m[1] : ' each');
        tokens.push({ tipo: 'keyword', valor: full });
        i = j + (m ? m[1].length : 5);
        continue;
      }
      // "else if" especial
      if (word === 'else' && code.slice(j).match(/^\s+if\b/)) {
        const m = code.slice(j).match(/^(\s+if)/);
        const full = 'else' + (m ? m[1] : ' if');
        tokens.push({ tipo: 'keyword', valor: full });
        i = j + (m ? m[1].length : 3);
        continue;
      }

      if (Y_KEYWORDS.has(word))   tokens.push({ tipo: 'keyword',    valor: word });
      else if (Y_TYPES.has(word)) tokens.push({ tipo: 'type',       valor: word });
      else if (Y_VISUALS.has(word))tokens.push({ tipo: 'visual',    valor: word });
      else if (Y_BOOL.has(word))  tokens.push({ tipo: 'keyword',    valor: word });
      else                        tokens.push({ tipo: 'identifier', valor: word });
      i = j;
      continue;
    }
    // Brackets
    if ('{}()[]'.includes(code[i])) {
      tokens.push({ tipo: 'bracket', valor: code[i] }); i++; continue;
    }
    // Whitespace
    if (/\s/.test(code[i])) {
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      tokens.push({ tipo: 'whitespace', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // Operador / puntuación
    tokens.push({ tipo: 'operator', valor: code[i] }); i++;
  }
  return tokens;
}

// ─── Tokenizador para .styles ─────────────────────────────────────────────────

// Propiedades CSS del lenguaje .styles (palabras clave multi-token)
const STYLES_PROPS = [
  'background color','text align','text size','text font',
  'padding left','padding right','padding top','padding bottom','padding',
  'margin left','margin top','margin right','margin bottom','margin',
  'min-height','max-height','min-width','max-width','height','width',
  'border top style','border top','border bottom style','border bottom',
  'border left style','border left','border right style','border right',
  'border radius','border style','border width','border color','border',
  'color',
].sort((a, b) => b.length - a.length); // más largos primero

const STYLES_KEYWORDS = new Set([
  'extends','@for','from','through','to',
]);

const STYLES_VALUES = new Set([
  'lightgray','DOTTED','LINE','DOUBLE','solid',
  'CENTER','RIGHT','LEFT',
  'HELVETICA','SANS SERIF','SANS','MONO','CURSIVE',
]);

function tokenizeStyles(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comentario bloque
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      tokens.push({ tipo: 'comment', valor: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // Color hex
    if (code[i] === '#') {
      let j = i + 1;
      while (j < code.length && /[0-9a-fA-F]/.test(code[j])) j++;
      tokens.push({ tipo: 'color', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // $contador
    if (code[i] === '$') {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      tokens.push({ tipo: 'var', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // Número con px o %
    if (/[0-9]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      if (code.slice(j, j + 2) === 'px') {
        tokens.push({ tipo: 'number', valor: code.slice(i, j + 2) }); i = j + 2;
      } else if (code[j] === '%') {
        tokens.push({ tipo: 'number', valor: code.slice(i, j + 1) }); i = j + 1;
      } else {
        tokens.push({ tipo: 'number', valor: code.slice(i, j) }); i = j;
      }
      continue;
    }
    // Identificadores / keywords / props
    if (/[a-zA-Z@_]/.test(code[i])) {
      // Intentar prop multi-palabra (case-sensitive según grammar)
      let matched = false;
      for (const prop of STYLES_PROPS) {
        if (code.slice(i, i + prop.length).toLowerCase() === prop.toLowerCase()
          && (i + prop.length >= code.length || !/[a-zA-Z0-9_\-]/.test(code[i + prop.length]))) {
          tokens.push({ tipo: 'prop', valor: code.slice(i, i + prop.length) });
          i += prop.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Identificador normal
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_@\-]/.test(code[j])) j++;
      const word = code.slice(i, j);

      if (STYLES_KEYWORDS.has(word)) tokens.push({ tipo: 'keyword',   valor: word });
      else if (STYLES_VALUES.has(word)) tokens.push({ tipo: 'css_value', valor: word });
      else tokens.push({ tipo: 'identifier', valor: word });
      i = j;
      continue;
    }
    // Whitespace
    if (/\s/.test(code[i])) {
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      tokens.push({ tipo: 'whitespace', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    if ('{}();=+-*/'.includes(code[i])) {
      tokens.push({ tipo: 'operator', valor: code[i] }); i++; continue;
    }
    tokens.push({ tipo: 'identifier', valor: code[i] }); i++;
  }
  return tokens;
}

// ─── Tokenizador para .dba ───────────────────────────────────────────────────

const DBA_KEYWORDS = new Set(['TABLE','COLUMNS','DELETE','IN']);

function tokenizeDba(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comentario
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      tokens.push({ tipo: 'comment', valor: code.slice(i, stop) });
      i = stop;
      continue;
    }
    // String
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') j++;
      tokens.push({ tipo: 'string', valor: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Número
    if (/[0-9]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ tipo: 'number', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    // Identificador / keyword
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      tokens.push({ tipo: DBA_KEYWORDS.has(word) ? 'keyword' : 'identifier', valor: word });
      i = j;
      continue;
    }
    // Whitespace
    if (/\s/.test(code[i])) {
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      tokens.push({ tipo: 'whitespace', valor: code.slice(i, j) });
      i = j;
      continue;
    }
    if ('[].,=;'.includes(code[i])) {
      tokens.push({ tipo: 'operator', valor: code[i] }); i++; continue;
    }
    tokens.push({ tipo: 'identifier', valor: code[i] }); i++;
  }
  return tokens;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export class YferaHighlighter {

  /** Devuelve el tipo de lenguaje según extensión */
  static getLang(nombre: string): 'y' | 'styles' | 'dba' | 'comp' | null {
    if (nombre.endsWith('.y'))      return 'y';
    if (nombre.endsWith('.comp'))   return 'comp';
    if (nombre.endsWith('.styles')) return 'styles';
    if (nombre.endsWith('.dba'))    return 'dba';
    return null;
  }

  /** Tokeniza el código según el tipo de archivo */
  static tokenize(code: string, nombreArchivo: string): Token[] {
    const lang = this.getLang(nombreArchivo);
    if (lang === 'y' || lang === 'comp') return tokenizeY(code);
    if (lang === 'styles')               return tokenizeStyles(code);
    if (lang === 'dba')                  return tokenizeDba(code);
    // fallback: sin colorear
    return [{ tipo: 'identifier', valor: code }];
  }

  /**
   * Devuelve HTML listo para innerHTML en la capa de resaltado.
   * Mantiene saltos de línea y espacios intactos.
   */
  static highlight(code: string, nombreArchivo: string): string {
    const tokens = this.tokenize(code, nombreArchivo);
    return tokens.map(tk => {
      if (tk.tipo === 'whitespace') return esc(tk.valor);
      return span(tk.tipo, tk.valor);
    }).join('');
  }

  /** Paleta completa por si quieres mostrar una leyenda en el IDE */
  static readonly palette = COLOR;
}