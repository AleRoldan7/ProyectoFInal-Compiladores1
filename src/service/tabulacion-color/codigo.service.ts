import { Injectable } from '@angular/core';
import { NodoArchivo } from '../../models/nodo-archivo';

const C = {
  operadores: '#3fb950',
  variables: '#c9d1d9',
  strings: '#e6a050',
  literales: '#79c0ff',
  reservadas: '#d2a8ff',
  delimitadores: '#58a6ff',
  comentarios: '#6a737d',
  tipos: '#ffcb6b',
  visuales: '#82aaff',
  inputRef: '#e5c07b',
  componente: '#61dafb',
  otros: '#c9d1d9',
};

const KW_STYLES = [
  'extends', '@for', 'from', 'through', 'to',
  'background color', 'text align', 'text size', 'text font',
  'padding left', 'padding right', 'padding top', 'padding bottom', 'padding',
  'margin left', 'margin right', 'margin top', 'margin bottom', 'margin',
  'min-height', 'max-height', 'min-width', 'max-width', 'height', 'width',
  'border top style', 'border bottom style', 'border left style', 'border right style',
  'border top', 'border bottom', 'border left', 'border right',
  'border radius', 'border style', 'border width', 'border color', 'border',
  'color', 'CENTER', 'RIGHT', 'LEFT',
  'HELVETICA', 'SANS SERIF', 'SANS', 'MONO', 'CURSIVE',
  'DOTTED', 'LINE', 'DOUBLE', 'solid', 'lightgray',
];

const KW_COMP = [
  'for each', 'for', 'if', 'else', 'Switch', 'case', 'default', 'empty', 'track',
  'FORM', 'INPUT_TEXT', 'INPUT_NUMBER', 'INPUT_BOOL', 'SUBMIT', 'IMG', 'T',
  'int', 'float', 'string', 'boolean', 'char', 'function',
  'true', 'false', 'True', 'False',
  'id', 'label', 'value',
];

const KW_Y = [
  'import', 'int', 'float', 'string', 'boolean', 'char', 'function', 'main',
  'execute', 'load', 'while', 'do', 'for', 'if', 'else if', 'else',
  'switch', 'case', 'default', 'break', 'continue', 'True', 'False',
];

const KW_DBA = [
  'TABLE', 'COLUMNS', 'DELETE', 'IN',
];

const OPERADORES = /(\+\+|==|!=|>=|<=|&&|\|\||[+\-*\/%=<>!])/g;

const VARIABLE = /(\$[a-zA-Z_]\w*)/g;

const DELIM = /([{}()\[\]])/g;

const NUMERO = /\b(\d+\.?\d*%?)\b/g;

const CHAR_LIT = /('.')/g;

const HEX_COLOR = /(#[0-9a-fA-F]{3,8})\b/g;

@Injectable({
  providedIn: 'root',
})
export class CodigoService {

  colorear(contenido: string, extension: string): string {
    switch (extension) {
      case 'styles': return this.colorearStyles(contenido);
      case 'comp': return this.colorearComp(contenido);
      case 'y': return this.colorearY(contenido);
      case 'dba': return this.colorearDBA(contenido);
      default: return this.escaparHTML(contenido);
    }
  }


  private colorearStyles(codigo: string): string {
    return this.tokenizar(codigo, KW_STYLES);
  }


  private colorearComp(codigo: string): string {
    return this.tokenizar(codigo, KW_COMP);
  }


  private colorearY(codigo: string): string {
    return this.tokenizar(codigo, KW_Y);
  }


  private colorearDBA(codigo: string): string {
    return this.tokenizar(codigo, KW_DBA);
  }

  private tokenizar(codigo: string, keywords: string[]): string {
    let resultado = '';
    let i = 0;
    codigo = codigo.replace(/\r/g, '');
    while (i < codigo.length) {

      if (codigo.startsWith('/*', i)) {
        const fin = codigo.indexOf('*/', i + 2);
        const comentario = fin === -1
          ? codigo.slice(i)
          : codigo.slice(i, fin + 2);
        resultado += this.span(this.escaparHTML(comentario), C.comentarios);
        i += comentario.length;
        continue;
      }

      if (codigo[i] === '#') {
        const fin = codigo.indexOf('\n', i);
        const comentario = fin === -1 ? codigo.slice(i) : codigo.slice(i, fin);
        resultado += this.span(this.escaparHTML(comentario), C.comentarios);
        i += comentario.length;
        continue;
      }

      if (codigo[i] === '"') {
        const fin = this.buscarCierreString(codigo, i + 1, '"');
        const str = codigo.slice(i, fin + 1);
        resultado += this.span(this.escaparHTML(str), C.strings);
        i = fin + 1;
        continue;
      }

      if (codigo[i] === '`') {
        const fin = this.buscarCierreString(codigo, i + 1, '`');
        const str = codigo.slice(i, fin + 1);
        resultado += this.span(this.escaparHTML(str), C.strings);
        i = fin + 1;
        continue;
      }

      if (codigo[i] === "'") {
        const fin = codigo.indexOf("'", i + 1);
        if (fin !== -1 && fin - i <= 3) {
          const ch = codigo.slice(i, fin + 1);
          resultado += this.span(this.escaparHTML(ch), C.literales);
          i = fin + 1;
          continue;
        }
      }

      if (codigo[i] === '#') {
        const m = codigo.slice(i).match(/^#[0-9a-fA-F]{3,8}/);
        if (m) {
          resultado += this.span(m[0], C.literales);
          i += m[0].length;
          continue;
        }
      }

      const kwMatch = this.matchKeyword(codigo, i, keywords);
      if (kwMatch) {
        resultado += this.span(this.escaparHTML(kwMatch), C.reservadas);
        i += kwMatch.length;
        continue;
      }

      if (codigo[i] === '$') {
        const m = codigo.slice(i).match(/^\$[a-zA-Z_]\w*/);
        if (m) {
          resultado += this.span(m[0], C.variables);
          i += m[0].length;
          continue;
        }
      }

      if (codigo[i] === '@') {
        const m = codigo.slice(i).match(/^@[a-zA-Z_]\w*/);
        if (m) {
          const color = /^@[A-Z]/.test(m[0]) ? C.componente : C.inputRef;
          resultado += this.span(m[0], color);
          i += m[0].length;
          continue;
        }
      }

      if ('{}()[]'.includes(codigo[i])) {
        resultado += this.span(this.escaparHTML(codigo[i]), C.delimitadores);
        i++;
        continue;
      }

      const op2 = codigo.slice(i, i + 2);
      if (['==', '!=', '>=', '<=', '&&', '||', '++'].includes(op2)) {
        resultado += this.span(op2, C.operadores);
        i += 2;
        continue;
      }

      if ('+-*/%=<>!'.includes(codigo[i]) && codigo[i] !== '#') {
        resultado += this.span(this.escaparHTML(codigo[i]), C.operadores);
        i++;
        continue;
      }

      if (/[0-9]/.test(codigo[i])) {
        const m = codigo.slice(i).match(/^\d+\.?\d*%?/);
        if (m) {
          resultado += this.span(m[0], C.literales);
          i += m[0].length;
          continue;
        }
      }

      if (codigo[i] === '\n') {
        resultado += '\n';
        i++;
        continue;
      }

      resultado += this.escaparHTML(codigo[i]);
      i++;
    }

    return resultado;
  }

  private matchKeyword(codigo: string, pos: number, keywords: string[]): string | null {
    const sorted = [...keywords].sort((a, b) => b.length - a.length);

    for (const kw of sorted) {
      if (pos + kw.length > codigo.length) continue;

      const fragment = codigo.slice(pos, pos + kw.length);
      if (fragment.toLowerCase() !== kw.toLowerCase()) continue;

      const before = pos === 0 ? '\n' : codigo[pos - 1];
      const after = codigo[pos + kw.length];

      const beforeOk = /[\s{}()[\];,\n]/.test(before) || pos === 0;
      const afterOk = !after || /[\s{}()[\];,\n.:=]/.test(after);

      if (beforeOk && afterOk) return fragment;
    }
    return null;
  }

  private buscarCierreString(codigo: string, desde: number, cierre: string): number {
    for (let i = desde; i < codigo.length; i++) {
      if (codigo[i] === '\\') { i++; continue; } // escape
      if (codigo[i] === cierre) return i;
    }
    return codigo.length - 1;
  }

  private span(contenido: string, color: string): string {
    return `<span style="color:${color}">${contenido}</span>`;
  }

  private escaparHTML(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }



  indentar(codigo: string, extension: string): string {
    switch (extension) {
      case 'styles': return this.indentarConLlaves(codigo);
      case 'comp': return this.indentarComp(codigo);
      case 'y': return this.indentarY(codigo);
      case 'dba': return this.indentarDBA(codigo);
      default: return codigo;
    }
  }


  private indentarConLlaves(codigo: string): string {
    const INDENT = '    ';
    const lineas = codigo.split('\n');
    let nivel = 0;
    const resultado: string[] = [];

    for (let linea of lineas) {
      const trim = linea.trim();
      if (!trim) { resultado.push(''); continue; }

      const cierresInicio = (trim.match(/^[}\]]+/) || [''])[0].length;
      nivel = Math.max(0, nivel - cierresInicio);

      resultado.push(INDENT.repeat(nivel) + trim);

      const sinStrings = this.eliminarStrings(trim);
      const aperturas = (sinStrings.match(/[{[]/g) || []).length;
      const cierres = (sinStrings.match(/[}\]]/g) || []).length;
      nivel = Math.max(0, nivel + aperturas - cierres + cierresInicio);
    }

    return resultado.join('\n');
  }


  private indentarComp(codigo: string): string {
    const INDENT = '    ';
    const lineas = codigo.split('\n');
    let nivel = 0;
    const resultado: string[] = [];

    for (let linea of lineas) {
      const trim = linea.trim();
      if (!trim) { resultado.push(''); continue; }

      const sinStr = this.eliminarStrings(trim);

      const apertDoble = (sinStr.match(/\[\[/g) || []).length;
      const cierreDoble = (sinStr.match(/\]\]/g) || []).length;

      const sinDobles = sinStr.replace(/\[\[/g, '').replace(/\]\]/g, '');
      const apertSimple = (sinDobles.match(/[[{(]/g) || []).length;
      const cierreSimple = (sinDobles.match(/[\]})]/g) || []).length;

      if (/^[\]}\)]/.test(trim) || /^\]\]/.test(trim)) {
        nivel = Math.max(0, nivel - 1);
      }

      resultado.push(INDENT.repeat(nivel) + trim);

      nivel += apertDoble + apertSimple;
      nivel -= cierreDoble + cierreSimple;
      if (/^[\]}\)]/.test(trim) || /^\]\]/.test(trim)) {

      } else {

      }
      nivel = Math.max(0, nivel);
    }

    return resultado.join('\n');
  }


  private indentarY(codigo: string): string {
    const INDENT = '    ';
    const lineas = codigo.split('\n');
    let nivel = 0;
    const resultado: string[] = [];

    for (let linea of lineas) {
      const trim = linea.trim();
      if (!trim) { resultado.push(''); continue; }

      if (trim.startsWith('#') || trim.startsWith('//')) {
        resultado.push(INDENT.repeat(nivel) + trim);
        continue;
      }

      const sinStr = this.eliminarStrings(trim);

      if (/^[})]/.test(trim)) {
        nivel = Math.max(0, nivel - 1);
      }

      resultado.push(INDENT.repeat(nivel) + trim);

      const aperturas = (sinStr.match(/[{(]/g) || []).length;
      const cierres = (sinStr.match(/[})]/g) || []).length;
      nivel = Math.max(0, nivel + aperturas - cierres);

      if (/^[})]/.test(trim) && cierres > 0) {
        nivel = Math.max(0, nivel + 1);
      }
    }

    return resultado.join('\n');
  }

  private indentarDBA(codigo: string): string {

    const lineas = codigo.split('\n');
    return lineas.map(l => l.trim()).join('\n');
  }

  private eliminarStrings(linea: string): string {
    return linea
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``')
      .replace(/'[^']*'/g, "''");
  }

  validarImports(
    contenidoY: string,
    arbol: NodoArchivo[]
  ): ImportError[] {
    const errores: ImportError[] = [];
    const lineas = contenidoY.split('\n');

    lineas.forEach((linea, idx) => {
      const trim = linea.trim();

      if (trim.startsWith('//') || trim.startsWith('#') || trim.startsWith('/*')) return;

      const match = trim.match(/^import\s+"([^"]+)"\s*;/);
      if (!match) return;

      const ruta = match[1];

      if (!ruta.startsWith('./') && !ruta.startsWith('../')) {
        errores.push({
          linea: idx + 1,
          ruta,
          mensaje: `La ruta de import debe ser relativa (empezar con "./" o "../"): "${ruta}"`
        });
        return;
      }

      const ext = ruta.split('.').pop();
      if (!ext || !['comp', 'styles', 'y'].includes(ext)) {
        errores.push({
          linea: idx + 1,
          ruta,
          mensaje: `Extensión de archivo no válida en import: ".${ext}". Use .comp, .styles o .y`
        });
        return;
      }

      const existe = this.buscarRutaEnArbol(ruta, arbol);
      if (!existe) {
        errores.push({
          linea: idx + 1,
          ruta,
          mensaje: `Archivo no encontrado: "${ruta}". Verifica que el archivo existe en el proyecto.`
        });
      }
    });

    return errores;
  }

  buscarRutaEnArbol(ruta: string, arbol: NodoArchivo[]): boolean {
    const partes = ruta
      .replace(/^\.\.?\//, '')
      .split('/')
      .filter(Boolean);

    if (this.buscarRecursivo(partes, arbol)) return true;

    return this.buscarEnTodo(partes, arbol);
  }

  private buscarEnTodo(partes: string[], nodos: NodoArchivo[]): boolean {
    for (const nodo of nodos) {
      if (this.buscarRecursivo(partes, nodos)) return true;

      if (nodo.tipo === 'carpeta' && nodo.hijos) {
        if (this.buscarEnTodo(partes, nodo.hijos)) return true;
      }
    }
    return false;
  }

  private buscarRecursivo(partes: string[], nodos: NodoArchivo[]): boolean {
    if (!partes.length) return false;
    const [cabeza, ...resto] = partes;

    for (const nodo of nodos) {
      if (nodo.nombre !== cabeza) continue;

      if (resto.length === 0) {
        return nodo.tipo === 'archivo';
      }

      if (nodo.tipo === 'carpeta' && nodo.hijos) {
        return this.buscarRecursivo(resto, nodo.hijos);
      }
    }
    return false;
  }


  extraerImports(contenidoY: string): string[] {
    const rutas: string[] = [];
    const lineas = contenidoY.split('\n');
    for (const linea of lineas) {
      const match = linea.trim().match(/^import\s+"([^"]+)"\s*;/);
      if (match) rutas.push(match[1]);
    }
    return rutas;
  }
}

export interface ImportError {
  linea: number;
  ruta: string;
  mensaje: string;
}