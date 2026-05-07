// ─────────────────────────────────────────────────────────────────────────────
// yfera-highlighter.ts
// Usa los lexers que Jison ya compiló — NO duplica gramáticas
// ─────────────────────────────────────────────────────────────────────────────
// REQUISITO: tener los parsers compilados con jison:
//   jison gramatica.y     → parser-y.js
//   jison gramatica.comp  → parser-comp.js   (mismo lexer que .y)
//   jison gramatica.styles → parser-styles.js
//   jison gramatica.dba   → parser-dba.js
//
// USO:
//   import { YferaHighlighter } from './yfera-highlighter';
//   const html = YferaHighlighter.highlight(codigo, 'archivo.y');
// ─────────────────────────────────────────────────────────────────────────────

import { parser as parserY }      from '../../analisisis-jison/analizador-lenguaje-principal.js';
import { parser as parserComp }   from '../../analisisis-jison/analizador-component.js';
import { parser as parserStyles } from '../../analisisis-jison/analizador-style.js';
import { parser as parserDba }    from '../../analisisis-jison/analizador-dba.js';

// ─── Tipos de token para el coloreado ────────────────────────────────────────

export type TokenTipo =
  | 'keyword'      // palabras reservadas → MORADO
  | 'type'         // tipos de dato       → MORADO
  | 'visual'       // FORM INPUT_TEXT …   → MORADO
  | 'prop'         // propiedades CSS     → MORADO
  | 'string'       // "texto" 'c' `sql`   → NARANJA
  | 'number'       // 42  3.14  100px  50%→ CELESTE
  | 'bool_lit'     // true false          → CELESTE
  | 'color_val'    // #rrggbb             → CELESTE
  | 'css_value'    // CENTER solid MONO   → CELESTE
  | 'var'          // $variable           → BLANCO
  | 'input_ref'    // @inputRef           → BLANCO
  | 'component'    // @Componente         → BLANCO
  | 'identifier'   // nombre genérico     → BLANCO
  | 'operator'     // + - * / == …        → VERDE
  | 'bracket'      // { } ( ) [ ] [[ ]]   → AZUL
  | 'comment'      // /* … */ # …         → GRIS
  | 'whitespace';

export interface Token {
  tipo: TokenTipo;
  valor: string;
}

// ─── Paleta según especificación del proyecto ─────────────────────────────────

const COLOR: Record<TokenTipo, string> = {
  keyword:    '#a855f7',  // morado
  type:       '#a855f7',  // morado
  visual:     '#a855f7',  // morado
  prop:       '#a855f7',  // morado
  string:     '#fb923c',  // naranja
  number:     '#67e8f9',  // celeste
  bool_lit:   '#67e8f9',  // celeste
  color_val:  '#67e8f9',  // celeste
  css_value:  '#67e8f9',  // celeste
  var:        '#ffffff',  // blanco
  input_ref:  '#ffffff',  // blanco
  component:  '#ffffff',  // blanco
  identifier: '#ffffff',  // blanco
  operator:   '#4ade80',  // verde
  bracket:    '#60a5fa',  // azul
  comment:    '#6b7280',  // gris
  whitespace: 'inherit',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAP: nombre de token Jison → TokenTipo para coloreado
// Cada objeto cubre exactamente los tokens definidos en el %lex de su gramática
// ─────────────────────────────────────────────────────────────────────────────

// ── .y / .comp ────────────────────────────────────────────────────────────────
const MAP_Y: Record<string, TokenTipo> = {
  // Tipos de dato → morado
  T_INT:          'type',
  T_FLOAT:        'type',
  T_STRING:       'type',
  T_BOOL:         'type',
  T_CHAR:         'type',
  T_FUNCTION:     'type',

  // Palabras reservadas → morado
  FOR_EACH:       'keyword',
  TO:             'keyword',
  FOR:            'keyword',
  IF:             'keyword',
  ELSE:           'keyword',
  SWITCH:         'keyword',
  CASE:           'keyword',
  DEFAULT:        'keyword',
  EMPTY:          'keyword',
  TRACK:          'keyword',

  // Elementos visuales → morado
  FORM:           'visual',
  INPUT_TEXT:     'visual',
  INPUT_NUMBER:   'visual',
  INPUT_BOOL:     'visual',
  SUBMIT:         'visual',
  IMG:            'visual',
  TEXTO:          'visual',   // token 'T' del lexer

  // Claves de input → morado (son palabras reservadas del lenguaje)
  KW_ID:          'keyword',
  KW_LABEL:       'keyword',
  KW_VALUE:       'keyword',

  // Booleanos → celeste (otros literales)
  BOOL_TRUE:      'bool_lit',
  BOOL_FALSE:     'bool_lit',

  // Literales → naranja / celeste
  STRING_LIT:     'string',
  CHAR_LIT:       'string',
  BACKTICK:       'string',   // el token ` solo; el contenido llega en yytext
  DECIMAL:        'number',
  ENTERO:         'number',

  // Variables y referencias → blanco
  VAR:            'var',
  INPUT_REF:      'input_ref',

  // Identificadores genéricos → blanco
  IDENTIFICADOR:  'identifier',

  // Operadores aritméticos y lógicos → verde
  EQ:             'operator',
  NEQ:            'operator',
  GTE:            'operator',
  LTE:            'operator',
  MAS:            'operator',
  MENOS:          'operator',
  MULT:           'operator',
  DIV:            'operator',
  MOD:            'operator',
  RANGO:          'operator',  // ..
  ANGLE_A:        'operator',  // <  (como operador de comparación)
  ANGLE_C:        'operator',  // >
  COMA:           'operator',
  PUNTO_COMA:     'operator',
  DOS_PUNTOS:     'operator',
  PUNTO:          'operator',
  IGUAL:          'operator',

  // Brackets / delimitadores → azul
  TABLA_A:        'bracket',   // [[
  TABLA_C:        'bracket',   // ]]
  SECC_A:         'bracket',   // [
  SECC_C:         'bracket',   // ]
  LLAVE_A:        'bracket',   // {
  LLAVE_C:        'bracket',   // }
  PAREN_A:        'bracket',   // (
  PAREN_C:        'bracket',   // )
};

// ── .y principal (archivo .y tiene además: import, main, execute, load) ───────
// El .comp solo tiene componentes, el .y tiene el programa completo.
// Ambos usan el mismo MAP porque comparten el mismo lexer Jison.
const MAP_Y_MAIN: Record<string, TokenTipo> = {
  ...MAP_Y,

  // Palabras reservadas adicionales del .y (no están en .comp)
  IMPORT:         'keyword',
  MAIN:           'keyword',
  EXECUTE:        'keyword',
  LOAD:           'keyword',
  WHILE:          'keyword',
  DO:             'keyword',
  BREAK:          'keyword',
  CONTINUE:       'keyword',
  FUNCTION:       'keyword',
  ELSE_IF:        'keyword',

  // Operadores adicionales
  INCREMENT:      'operator',  // ++
  GT:             'operator',  // >  (en .y se llama ANGLE_C, en .y main GT)
  LT:             'operator',  // 
  AND:            'operator',  // &&
  OR:             'operator',  // ||
  NOT:            'operator',  // !
  ARROBA:         'operator',  // @ suelto (antes de IDENTIFICADOR en invocación)

  // Literales adicionales
  BACKTICK_EXPR:  'string',    // `...contenido SQL...`
  CHAR_LIT:       'string',
};

// ── .styles ───────────────────────────────────────────────────────────────────
const MAP_STYLES: Record<string, TokenTipo> = {
  // Propiedades CSS → morado
  BACKGROUND_COLOR:     'prop',
  TEXT_ALIGN:           'prop',
  TEXT_SIZE:            'prop',
  TEXT_FONT:            'prop',
  PADDING_LEFT:         'prop',
  PADDING_RIGHT:        'prop',
  PADDING_TOP:          'prop',
  PADDING_BOTTOM:       'prop',
  PADDING:              'prop',
  MARGIN_LEFT:          'prop',
  MARGIN_TOP:           'prop',
  MARGIN_RIGHT:         'prop',
  MARGIN_BOTTOM:        'prop',
  MARGIN:               'prop',
  MIN_HEIGHT:           'prop',
  MAX_HEIGHT:           'prop',
  MIN_WIDTH:            'prop',
  MAX_WIDTH:            'prop',
  HEIGHT:               'prop',
  WIDTH:                'prop',
  BORDER_TOP_STYLE:     'prop',
  BORDER_TOP:           'prop',
  BORDER_BOTTOM_STYLE:  'prop',
  BORDER_BOTTOM:        'prop',
  BORDER_LEFT_STYLE:    'prop',
  BORDER_LEFT:          'prop',
  BORDER_RIGHT_STYLE:   'prop',
  BORDER_RIGHT:         'prop',
  BORDER_RADIUS:        'prop',
  BORDER_STYLE:         'prop',
  BORDER_WIDTH:         'prop',
  BORDER_COLOR:         'prop',
  BORDER:               'prop',
  COLOR:                'prop',

  // Palabras reservadas del lenguaje → morado
  EXTENDS:        'keyword',
  FOR:            'keyword',   // @for
  FROM:           'keyword',
  THROUGH:        'keyword',
  TO:             'keyword',

  // Valores CSS → celeste (otros literales)
  LIGHTGRAY:      'css_value',
  DOTTED:         'css_value',
  LINE:           'css_value',
  DOUBLE:         'css_value',
  SOLID:          'css_value',
  CENTER:         'css_value',
  RIGHT:          'css_value',
  LEFT:           'css_value',
  HELVETICA:      'css_value',
  SANS_SERIF:     'css_value',
  SANS:           'css_value',
  MONO:           'css_value',
  CURSIVE:        'css_value',

  // Literales numéricos → celeste
  PIXEL:          'number',
  PORCENTAJE:     'number',
  DECIMAL:        'number',
  ENTERO:         'number',

  // Color hex → celeste
  COLOR_VALUE:    'color_val',

  // Variable $contador → blanco
  CONTADOR:       'var',

  // Identificador genérico (nombre de clase) → blanco
  IDENTIFICADOR:  'identifier',

  // Operadores aritméticos → verde
  MAS:            'operator',
  MENOS:          'operator',
  MULT:           'operator',
  DIV:            'operator',
  IGUAL:          'operator',
  PUNTO_COMA:     'operator',

  // Brackets → azul
  LLAVE_A:        'bracket',
  LLAVE_C:        'bracket',
};

// ── .dba ──────────────────────────────────────────────────────────────────────
const MAP_DBA: Record<string, TokenTipo> = {
  // Palabras reservadas → morado
  TABLE:          'keyword',
  COLUMNS:        'keyword',
  DELETE:         'keyword',
  IN:             'keyword',

  // Literales → naranja / celeste
  STRING_LIT:     'string',
  DECIMAL:        'number',
  ENTERO:         'number',

  // Identificadores → blanco
  IDENTIFICADOR:  'identifier',

  // Operadores → verde
  PUNTO:          'operator',
  COMA:           'operator',
  IGUAL:          'operator',
  PUNTO_COMA:     'operator',

  // Brackets → azul
  CORCH_A:        'bracket',   // [
  CORCH_C:        'bracket',   // ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Función central: corre el lexer de Jison y mapea cada token a su color
// ─────────────────────────────────────────────────────────────────────────────

function tokenizarConLexer(
  code: string,
  parser: { lexer: any },
  map: Record<string, TokenTipo>
): Token[] {
  const tokens: Token[] = [];
  const lexer = parser.lexer;

  // El lexer de Jison necesita un manejador de errores mínimo
  // para no lanzar excepciones al encontrar tokens desconocidos
  lexer.yy = {
    manejador: {
      errorLexico: () => {},   // ignorar errores léxicos durante highlighting
    }
  };

  lexer.setInput(code);

  // Posición para reconstruir los espacios en blanco
  // (Jison los omite con \s+ pero necesitamos preservarlos para el HTML)
  let lastOffset = 0;

  while (true) {
    const tokenName = lexer.lex();

    // EOF — Jison devuelve 1 o la string 'EOF'
    if (tokenName === 1 || tokenName === 'EOF') break;

    const valor: string = lexer.yytext;
    const offset: number = lexer.offset ?? (lexer.yylloc?.range?.[0] ?? -1);

    // Si hay un hueco entre el último token y este → era whitespace
    if (offset > lastOffset && offset !== -1) {
      tokens.push({
        tipo: 'whitespace',
        valor: code.slice(lastOffset, offset),
      });
    }

    // Buscar en el mapa; si no está → 'identifier' (blanco)
    const tipo: TokenTipo = map[tokenName] ?? 'identifier';
    tokens.push({ tipo, valor });

    lastOffset = offset !== -1 ? offset + valor.length : lastOffset + valor.length;
  }

  // Whitespace final si quedó algo
  if (lastOffset < code.length) {
    tokens.push({ tipo: 'whitespace', valor: code.slice(lastOffset) });
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers HTML
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

function span(tipo: TokenTipo, valor: string): string {
  const italic = tipo === 'comment' ? 'font-style:italic;' : '';
  return `<span style="color:${COLOR[tipo]};${italic}">${esc(valor)}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

export class YferaHighlighter {

  static getLang(nombre: string): 'y' | 'comp' | 'styles' | 'dba' | null {
    if (nombre.endsWith('.y'))      return 'y';
    if (nombre.endsWith('.comp'))   return 'comp';
    if (nombre.endsWith('.styles')) return 'styles';
    if (nombre.endsWith('.dba'))    return 'dba';
    return null;
  }

  static tokenize(code: string, nombreArchivo: string): Token[] {
    const lang = this.getLang(nombreArchivo);

    if (lang === 'y')      return tokenizarConLexer(code, parserY,      MAP_Y_MAIN);
    if (lang === 'comp')   return tokenizarConLexer(code, parserComp,   MAP_Y);
    if (lang === 'styles') return tokenizarConLexer(code, parserStyles, MAP_STYLES);
    if (lang === 'dba')    return tokenizarConLexer(code, parserDba,    MAP_DBA);

    return [{ tipo: 'identifier', valor: code }];
  }

  static highlight(code: string, nombreArchivo: string): string {
    return this.tokenize(code, nombreArchivo)
      .map(tk => tk.tipo === 'whitespace' ? esc(tk.valor) : span(tk.tipo, tk.valor))
      .join('');
  }

  static readonly palette = COLOR;
}