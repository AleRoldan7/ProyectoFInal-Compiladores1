import { parser as parserY } from '../../analisisis-jison/analizador-lenguaje-principal.js';
import { parser as parserComp } from '../../analisisis-jison/analizador-component.js';
import { parser as parserStyles } from '../../analisisis-jison/analizador-style.js';
import { parser as parserDba } from '../../analisisis-jison/analizador-dba.js';


export type TokenTipo =
  | 'keyword'
  | 'type'
  | 'visual'
  | 'prop'
  | 'string'
  | 'number'
  | 'bool_lit'
  | 'color_val'
  | 'css_value'
  | 'var'
  | 'input_ref'
  | 'component'
  | 'identifier'
  | 'operator'
  | 'bracket'
  | 'comment'
  | 'whitespace';

export interface Token {
  tipo: TokenTipo;
  valor: string;
}


const COLOR: Record<TokenTipo, string> = {
  keyword: '#a855f7',
  type: '#a855f7',
  visual: '#a855f7',
  prop: '#a855f7',
  string: '#fb923c',
  number: '#67e8f9',
  bool_lit: '#67e8f9',
  color_val: '#67e8f9',
  css_value: '#67e8f9',
  var: '#ffffff',
  input_ref: '#ffffff',
  component: '#ffffff',
  identifier: '#ffffff',
  operator: '#4ade80',
  bracket: '#60a5fa',
  comment: '#6b7280',
  whitespace: 'inherit',
};

const MAP_Y: Record<string, TokenTipo> = {
  T_INT: 'type',
  T_FLOAT: 'type',
  T_STRING: 'type',
  T_BOOL: 'type',
  T_CHAR: 'type',
  T_FUNCTION: 'type',

  FOR_EACH: 'keyword',
  TO: 'keyword',
  FOR: 'keyword',
  IF: 'keyword',
  ELSE: 'keyword',
  SWITCH: 'keyword',
  CASE: 'keyword',
  DEFAULT: 'keyword',
  EMPTY: 'keyword',
  TRACK: 'keyword',

  FORM: 'visual',
  INPUT_TEXT: 'visual',
  INPUT_NUMBER: 'visual',
  INPUT_BOOL: 'visual',
  SUBMIT: 'visual',
  IMG: 'visual',
  TEXTO: 'visual',

  KW_ID: 'keyword',
  KW_LABEL: 'keyword',
  KW_VALUE: 'keyword',

  BOOL_TRUE: 'bool_lit',
  BOOL_FALSE: 'bool_lit',

  STRING_LIT: 'string',
  CHAR_LIT: 'string',
  BACKTICK: 'string',
  DECIMAL: 'number',
  ENTERO: 'number',

  VAR: 'var',
  INPUT_REF: 'input_ref',

  IDENTIFICADOR: 'identifier',

  EQ: 'operator',
  NEQ: 'operator',
  GTE: 'operator',
  LTE: 'operator',
  MAS: 'operator',
  MENOS: 'operator',
  MULT: 'operator',
  DIV: 'operator',
  MOD: 'operator',
  RANGO: 'operator',
  ANGLE_A: 'operator',
  ANGLE_C: 'operator',
  COMA: 'operator',
  PUNTO_COMA: 'operator',
  DOS_PUNTOS: 'operator',
  PUNTO: 'operator',
  IGUAL: 'operator',

  TABLA_A: 'bracket',
  TABLA_C: 'bracket',
  SECC_A: 'bracket',
  SECC_C: 'bracket',
  LLAVE_A: 'bracket',
  LLAVE_C: 'bracket',
  PAREN_A: 'bracket',
  PAREN_C: 'bracket',
};


const MAP_Y_MAIN: Record<string, TokenTipo> = {
  ...MAP_Y,

  IMPORT: 'keyword',
  MAIN: 'keyword',
  EXECUTE: 'keyword',
  LOAD: 'keyword',
  WHILE: 'keyword',
  DO: 'keyword',
  BREAK: 'keyword',
  CONTINUE: 'keyword',
  FUNCTION: 'keyword',
  ELSE_IF: 'keyword',

  INCREMENT: 'operator',
  GT: 'operator',
  LT: 'operator',
  AND: 'operator',
  OR: 'operator',
  NOT: 'operator',
  ARROBA: 'operator',

  BACKTICK_EXPR: 'string',
  CHAR_LIT: 'string',
};

const MAP_STYLES: Record<string, TokenTipo> = {
  BACKGROUND_COLOR: 'prop',
  TEXT_ALIGN: 'prop',
  TEXT_SIZE: 'prop',
  TEXT_FONT: 'prop',
  PADDING_LEFT: 'prop',
  PADDING_RIGHT: 'prop',
  PADDING_TOP: 'prop',
  PADDING_BOTTOM: 'prop',
  PADDING: 'prop',
  MARGIN_LEFT: 'prop',
  MARGIN_TOP: 'prop',
  MARGIN_RIGHT: 'prop',
  MARGIN_BOTTOM: 'prop',
  MARGIN: 'prop',
  MIN_HEIGHT: 'prop',
  MAX_HEIGHT: 'prop',
  MIN_WIDTH: 'prop',
  MAX_WIDTH: 'prop',
  HEIGHT: 'prop',
  WIDTH: 'prop',
  BORDER_TOP_STYLE: 'prop',
  BORDER_TOP: 'prop',
  BORDER_BOTTOM_STYLE: 'prop',
  BORDER_BOTTOM: 'prop',
  BORDER_LEFT_STYLE: 'prop',
  BORDER_LEFT: 'prop',
  BORDER_RIGHT_STYLE: 'prop',
  BORDER_RIGHT: 'prop',
  BORDER_RADIUS: 'prop',
  BORDER_STYLE: 'prop',
  BORDER_WIDTH: 'prop',
  BORDER_COLOR: 'prop',
  BORDER: 'prop',
  COLOR: 'prop',

  EXTENDS: 'keyword',
  FOR: 'keyword',
  FROM: 'keyword',
  THROUGH: 'keyword',
  TO: 'keyword',

  LIGHTGRAY: 'css_value',
  DOTTED: 'css_value',
  LINE: 'css_value',
  DOUBLE: 'css_value',
  SOLID: 'css_value',
  CENTER: 'css_value',
  RIGHT: 'css_value',
  LEFT: 'css_value',
  HELVETICA: 'css_value',
  SANS_SERIF: 'css_value',
  SANS: 'css_value',
  MONO: 'css_value',
  CURSIVE: 'css_value',

  PIXEL: 'number',
  PORCENTAJE: 'number',
  DECIMAL: 'number',
  ENTERO: 'number',

  COLOR_VALUE: 'color_val',

  CONTADOR: 'var',

  IDENTIFICADOR: 'identifier',

  MAS: 'operator',
  MENOS: 'operator',
  MULT: 'operator',
  DIV: 'operator',
  IGUAL: 'operator',
  PUNTO_COMA: 'operator',

  LLAVE_A: 'bracket',
  LLAVE_C: 'bracket',
};

const MAP_DBA: Record<string, TokenTipo> = {
  TABLE: 'keyword',
  COLUMNS: 'keyword',
  DELETE: 'keyword',
  IN: 'keyword',

  STRING_LIT: 'string',
  DECIMAL: 'number',
  ENTERO: 'number',

  IDENTIFICADOR: 'identifier',

  PUNTO: 'operator',
  COMA: 'operator',
  IGUAL: 'operator',
  PUNTO_COMA: 'operator',

  CORCH_A: 'bracket',
  CORCH_C: 'bracket',
};

function tokenizarConLexer(
  code: string,
  parser: { lexer: any },
  map: Record<string, TokenTipo>
): Token[] {
  const tokens: Token[] = [];
  const lexer = parser.lexer;
  lexer.yy = {
    manejador: {
      errorLexico: () => { },
    }
  };

  lexer.setInput(code);
  let lastOffset = 0;

  while (true) {
    const tokenName = lexer.lex();

    if (tokenName === 1 || tokenName === 'EOF') break;

    const valor: string = lexer.yytext;
    const offset: number = lexer.offset ?? (lexer.yylloc?.range?.[0] ?? -1);

    if (offset > lastOffset && offset !== -1) {
      tokens.push({
        tipo: 'whitespace',
        valor: code.slice(lastOffset, offset),
      });
    }

    const tipo: TokenTipo = map[tokenName] ?? 'identifier';
    tokens.push({ tipo, valor });

    lastOffset = offset !== -1 ? offset + valor.length : lastOffset + valor.length;
  }

  if (lastOffset < code.length) {
    tokens.push({ tipo: 'whitespace', valor: code.slice(lastOffset) });
  }

  return tokens;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function span(tipo: TokenTipo, valor: string): string {
  const italic = tipo === 'comment' ? 'font-style:italic;' : '';
  return `<span style="color:${COLOR[tipo]};${italic}">${esc(valor)}</span>`;
}

export class YferaHighlighter {

  static getLang(nombre: string): 'y' | 'comp' | 'styles' | 'dba' | null {
    if (nombre.endsWith('.y')) return 'y';
    if (nombre.endsWith('.comp')) return 'comp';
    if (nombre.endsWith('.styles')) return 'styles';
    if (nombre.endsWith('.dba')) return 'dba';
    return null;
  }

  static tokenize(code: string, nombreArchivo: string): Token[] {
    const lang = this.getLang(nombreArchivo);

    if (lang === 'y') return tokenizarConLexer(code, parserY, MAP_Y_MAIN);
    if (lang === 'comp') return tokenizarConLexer(code, parserComp, MAP_Y);
    if (lang === 'styles') return tokenizarConLexer(code, parserStyles, MAP_STYLES);
    if (lang === 'dba') return tokenizarConLexer(code, parserDba, MAP_DBA);

    return [{ tipo: 'identifier', valor: code }];
  }

  static highlight(code: string, nombreArchivo: string): string {
    return this.tokenize(code, nombreArchivo)
      .map(tk => tk.tipo === 'whitespace' ? esc(tk.valor) : span(tk.tipo, tk.valor))
      .join('');
  }

  static readonly palette = COLOR;
}