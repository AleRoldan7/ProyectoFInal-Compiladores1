import { Injectable } from '@angular/core';

import * as parserStyle     from '../../analisisis-jison/analizador-style.js';
import * as parserComponent from '../../analisisis-jison/analizador-component.js';
import * as parserPrincipal from '../../analisisis-jison/analizador-lenguaje-principal.js';
import * as parserDBA       from '../../analisisis-jison/analizador-dba.js';

import { NodoArchivo }   from '../../models/nodo-archivo.js';
import { ErrorReporte }  from '../../pages/page-principal/page-principal/page-principal.js';
import { RenderService } from '../renderizado/render.service.js';
import { SqliteService } from '../sql/sqlite.service.js';
import { ManejoErrores } from '../../clases/manejo-errores/errores.js';
import Swal              from 'sweetalert2';
import { CodigoService } from '../tabulacion-color/codigo.service.js';

export interface ResultadoCompilacion {
  exito: boolean;
  errores: ErrorReporte[];
  consolaLines: string[];
  consolaMode: 'console' | 'errors';
}

@Injectable({ providedIn: 'root' })
export class CodigoCompiladoService {

  errores: ErrorReporte[] = [];
  consolaLines: string[] = [
    '<span style="color:#45475a;">Cuando se ejecute aparece aca</span>'
  ];
  htmlCompilado: string = '';

  // Guardamos el árbol de archivos para poder reutilizarlo en load
  private arbolActual: NodoArchivo[] = [];

  constructor(
    private render: RenderService,
    private sqlite: SqliteService,
    private highlighter: CodigoService
  ) {}

  getParser(nombre: string): any {
    if (nombre.endsWith('.styles')) return parserStyle;
    if (nombre.endsWith('.comp'))   return parserComponent;
    if (nombre.endsWith('.dba'))    return parserDBA;
    if (nombre.endsWith('.y'))      return parserPrincipal;
    return null;
  }

  // ─── Mapeo tokens → símbolos legibles ────────────────────────────────────
  private mapeoTokenos: Record<string, string> = {
    'LLAVE_A': '{', 'LLAVE_C': '}',
    'PAREN_A': '(', 'PAREN_C': ')',
    'CORCH_A': '[', 'CORCH_C': ']',
    'TABLA_A': '[', 'TABLA_C': ']',
    'PUNTO_COMA': ';', 'COMA': ',', 'DOS_PUNTOS': ':',
    'PUNTO': '.', 'ARROBA': '@',
    'MAS': '+', 'MENOS': '-', 'MULT': '*', 'DIV': '/', 'MOD': '%',
    'IGUAL': '=', 'EQ': '==', 'NEQ': '!=',
    'GT': '>', 'LT': '<', 'GTE': '>=', 'LTE': '<=',
    'AND': '&&', 'OR': '||', 'NOT': '!', 'INCREMENT': '++',
    'IF': 'if', 'ELSE': 'else', 'ELSE_IF': 'else if',
    'WHILE': 'while', 'FOR': 'for', 'FOR_EACH': 'for each',
    'DO': 'do', 'FUNCTION': 'function', 'MAIN': 'main',
    'SWITCH': 'switch', 'CASE': 'case', 'DEFAULT': 'default',
    'BREAK': 'break', 'CONTINUE': 'continue', 'RETURN': 'return',
    'T_INT': 'int', 'T_FLOAT': 'float', 'T_STRING': 'string',
    'T_BOOL': 'boolean', 'T_CHAR': 'char',
    'IMPORT': 'import', 'EXECUTE': 'execute', 'LOAD': 'load'
  };

  private traducirTokens(texto: string): string {
    let resultado = texto;
    for (const [token, simbolo] of Object.entries(this.mapeoTokenos)) {
      resultado = resultado.replace(new RegExp(`'${token}'`, 'g'), `'${simbolo}'`);
      resultado = resultado.replace(new RegExp(`got\\s+'${token}'`, 'g'), `got '${simbolo}'`);
      resultado = resultado.replace(new RegExp(`${token},`, 'g'), `${simbolo},`);
      resultado = resultado.replace(new RegExp(`${token}$`, 'g'), simbolo);
      resultado = resultado.replace(new RegExp(`\\s${token}\\s`, 'g'), ` ${simbolo} `);
    }
    return resultado;
  }

  private limpiarMensajeError(mensaje: string): string {
    const marcaParseError = 'Parse error on line ';
    const idxParse = mensaje.indexOf(marcaParseError);
    if (idxParse !== -1) {
      const idxSalto = mensaje.indexOf('\n', idxParse);
      mensaje = idxSalto !== -1 ? mensaje.substring(idxSalto + 1) : '';
    }
    const lineas = mensaje.split('\n');
    const lineasLimpias: string[] = [];
    for (const linea of lineas) {
      const recortada = linea.trim();
      if (!recortada) continue;
      let soloMarcadores = true;
      for (let i = 0; i < recortada.length; i++) {
        if (recortada[i] !== '-' && recortada[i] !== '^' && recortada[i] !== ' ') {
          soloMarcadores = false; break;
        }
      }
      if (soloMarcadores) continue;
      lineasLimpias.push(recortada);
    }
    let resultado = lineasLimpias.join(' ').trim();
    const marcaExpecting = 'Expecting';
    const idxExpecting = resultado.indexOf(marcaExpecting);
    if (idxExpecting !== -1) {
      const desde = idxExpecting + marcaExpecting.length;
      let hasta = resultado.length;
      for (let i = desde; i < resultado.length; i++) {
        if (resultado[i] === ',' || resultado[i] === '.') { hasta = i; break; }
      }
      resultado = 'Expecting' + resultado.substring(desde, hasta).trim();
    }
    resultado = this.traducirTokens(resultado);
    return resultado.length > 0 ? resultado : 'Error sintáctico desconocido';
  }

  resolverContenidoTexto(contenido: any): string {
    if (typeof contenido === 'string') return contenido;
    if (typeof contenido === 'number' || typeof contenido === 'boolean') return String(contenido);
    if (typeof contenido === 'object' && contenido !== null) return this.evaluarNodoExpresion(contenido);
    return '';
  }

  private evaluarNodoExpresion(nodo: any): string {
    if (nodo === null || nodo === undefined) return '';
    if (nodo.tipo === 'var')   return '$' + nodo.nombre;
    if (nodo.tipo === 'ident') return nodo.nombre;
    if (nodo.tipo === 'array_acc') {
      return '$' + nodo.nombre + '[' + this.evaluarNodoExpresion(nodo.indice) + ']';
    }
    if (nodo.op !== undefined && nodo.izq !== undefined && nodo.der !== undefined) {
      const izq = this.evaluarNodoExpresion(nodo.izq);
      const der = this.evaluarNodoExpresion(nodo.der);
      if (nodo.op === '+') return izq + der;
      const ni = Number(izq), nd = Number(der);
      if (!isNaN(ni) && !isNaN(nd)) {
        if (nodo.op === '-') return String(ni - nd);
        if (nodo.op === '*') return String(ni * nd);
        if (nodo.op === '/') return nd !== 0 ? String(ni / nd) : 'DIV/0';
        if (nodo.op === '%') return String(ni % nd);
      }
      return izq + ' ' + nodo.op + ' ' + der;
    }
    if (nodo.op === 'neg') return '-' + this.evaluarNodoExpresion(nodo.val);
    return '';
  }

  private inicializarParserConManejador(parser: any, manejador: ManejoErrores) {
    parser.parser.yy = { manejador };
    const limpiarMensaje = (msg: string) => this.limpiarMensajeError(msg);
    parser.parser.parseError = function(str: any, hash: any) {
      const line  = (hash?.loc?.first_line)   || hash?.line   || 0;
      const col   = (hash?.loc?.first_column) || hash?.column || 0;
      const token = hash?.token || hash?.text || '';
      manejador.errorSintactico(token, line, col, limpiarMensaje(String(str)));
    };
  }

  private extraerAST(resultado: any): any {
    if (resultado && typeof resultado === 'object' && 'ast' in resultado) {
      return resultado.ast;
    }
    return resultado;
  }

  private extraerErroresParser(resultado: any, nombreArchivo: string): ErrorReporte[] {
    const errores: ErrorReporte[] = [];
    if (resultado && typeof resultado === 'object' && Array.isArray(resultado.errores)) {
      for (const err of resultado.errores) {
        errores.push({
          lexema:      err.lexema      ?? err.text        ?? '?',
          linea:       err.linea       ?? err.line        ?? 0,
          columna:     err.columna     ?? err.column      ?? 0,
          tipo:        err.tipo        ?? err.type        ?? 'Sintáctico',
          descripcion: '[' + nombreArchivo + '] ' + (err.descripcion ?? err.description ?? 'Error desconocido')
        });
      }
    }
    return errores;
  }

  // ─── Ejecución principal ──────────────────────────────────────────────────
  async ejecutar(arbol: NodoArchivo[]): Promise<'console' | 'errors'> {
    this.arbolActual = arbol;   // guardar para re-uso en load

    const manejador = new ManejoErrores();
    manejador.reset();
    this.errores = [];
    const now = new Date().toLocaleTimeString();
    await this.sqlite.init();

    // Validar imports
    const archivos  = this.obtenerTodosLosArchivos(arbol);
    const archivosY = archivos.filter(a => a.nombre.endsWith('.y'));
    for (const archivoY of archivosY) {
      const erroresImport = this.highlighter.validarImports(archivoY.contenido || '', arbol);
      for (const ei of erroresImport) {
        this.errores.push({
          lexema: ei.ruta, linea: ei.linea, columna: 1,
          tipo: 'Semántico',
          descripcion: '[' + archivoY.nombre + '] ' + ei.mensaje
        });
      }
    }

    if (this.errores.length > 0) {
      this.consolaLines = [
        '<span style="color:#f38ba8;">Errores de import encontrados. Corrígelos antes de ejecutar.</span>'
      ];
      return 'errors';
    }

    try {
      const astsDBA:   any[] = [];
      const astsOtros: any[] = [];

      const recorrer = (nodos: NodoArchivo[]) => {
        for (const nodo of nodos) {
          if (nodo.tipo === 'archivo') {
            const parser = this.getParser(nodo.nombre);
            if (!parser || !nodo.contenido?.trim()) continue;
            try {
              this.inicializarParserConManejador(parser, manejador);
              const resultado = parser.parser.parse(nodo.contenido);
              const ast       = this.extraerAST(resultado);
              this.errores.push(...this.extraerErroresParser(resultado, nodo.nombre));
              if (nodo.nombre.endsWith('.dba')) astsDBA.push(ast);
              else astsOtros.push(ast);
            } catch (e: any) {
              this.errores.push({
                lexema:      e.hash?.text || '?',
                linea:       e.hash?.line || 0,
                columna:     e.hash?.loc?.first_column || 0,
                tipo:        e.hash ? 'Sintáctico' : 'Léxico',
                descripcion: '[' + nodo.nombre + '] ' + e.message
              });
            }
          } else if (nodo.hijos) {
            recorrer(nodo.hijos);
          }
        }
      };
      recorrer(arbol);

      // Errores del manejador global
      for (const err of manejador.getErrores()) {
        this.errores.push({
          lexema:      err.lexema,
          linea:       err.line,
          columna:     err.column,
          tipo:        err.type,
          descripcion: err.description
        });
      }

      if (this.errores.length > 0) return 'errors';

      // ── Ejecutar DBA del .dba ──
      const logDBA: string[] = [];
      for (const ast of astsDBA) {
        const sentencias = Array.isArray(ast) ? ast : [ast];
        for (const s of sentencias) {
          const sql = this.sqlite.nodoASQL(s);
          if (!sql) continue;
          try {
            const resultado = this.sqlite.ejecutarSQL(sql);
            if (s.tipo === 'select') {
              logDBA.push('SELECT ' + s.columna + ' FROM ' + s.tabla + ' → ' + resultado.length + ' fila(s)');
            } else {
              logDBA.push(s.tipo.toUpperCase() + ' ' + s.tabla + ' OK');
            }
          } catch (e: any) {
            logDBA.push('ERROR en ' + s.tipo + ': ' + e.message);
          }
        }
      }

      // ── Registrar handler de load en RenderService ──
      // Cuando el Principal encuentra `load "archivo.y"` llama este callback
      this.render.setOnLoad((destino: string, esArchivo: boolean) => {
        return this.manejarLoad(destino, esArchivo);
      });

      this.render.setResolverContenido((c: any) => this.resolverContenidoTexto(c));

      const todosLosAsts = [...astsDBA, ...astsOtros];
      const html = this.render.render(todosLosAsts);
      this.htmlCompilado = html;

      this.consolaLines = [
        '<span style="color:#45475a;">[' + now + ']</span> Compilando...',
        ...logDBA.map(l => '<span style="color:#94e2d5;">🗄 ' + l + '</span>'),
        '<span style="color:#a6e3a1;">✔ Compilación exitosa.</span>',
        '<span style="color:#89dceb;">✔ HTML generado correctamente.</span>'
      ];

      const ventana = window.open();
      ventana?.document.write(
        '<!doctype html><html>' +
        '<head><meta charset="utf-8">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">' +
        '</head>' +
        '<body>' + html +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"><\/script>' +
        '</body></html>'
      );

      return 'console';

    } catch (error: any) {
      this.consolaLines = ['<span style="color:#f38ba8;">✖ ' + error.message + '</span>'];
      this.errores.push({
        lexema:      error.hash?.text || '?',
        linea:       error.hash?.line || 0,
        columna:     error.hash?.loc?.first_column || 0,
        tipo:        error.hash ? 'Sintáctico' : 'Léxico',
        descripcion: error.message
      });
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      return 'errors';
    }
  }

  // ─── Manejar load "archivo.y" o load goTo ────────────────────────────────
  // Cuando se hace load de un archivo .y → re-parsea y re-ejecuta ese archivo
  // Cuando se hace load de un archivo .comp/.styles → re-registra sus componentes/estilos
  // Cuando se hace load de una variable → el Principal ya la resolvió antes de llamar aquí
  private manejarLoad(destino: string, esArchivo: boolean): string {
    // Buscar el archivo en el árbol actual
    const archivos = this.obtenerTodosLosArchivos(this.arbolActual);

    // Normalizar: quitar ./ del inicio si existe
    let nombreBuscado = destino;
    if (nombreBuscado.startsWith('./')) nombreBuscado = nombreBuscado.substring(2);

    const archivoDestino = archivos.find(a =>
      a.nombre === nombreBuscado ||
      a.nombre.endsWith('/' + nombreBuscado) ||
      a.nombre === destino
    );

    if (!archivoDestino) {
      console.warn('[load] Archivo no encontrado:', destino);
      Swal.fire({
        icon: 'warning',
        title: 'load: archivo no encontrado',
        text: 'No se encontró el archivo: ' + destino
      });
      return '';
    }

    if (!archivoDestino.contenido?.trim()) return '';

    try {
      const manejador = new ManejoErrores();
      manejador.reset();
      const parser = this.getParser(archivoDestino.nombre);
      if (!parser) return '';

      this.inicializarParserConManejador(parser, manejador);
      const resultado = parser.parser.parse(archivoDestino.contenido);
      const ast       = this.extraerAST(resultado);

      // Si es un .y → re-ejecutar con el render actual (misma tabla de símbolos)
      // Esto produce HTML nuevo que reemplaza/agrega al flujo actual
      if (archivoDestino.nombre.endsWith('.y') && ast && ast.tipo === 'programa') {
        // Re-renderizar solo este archivo con el estado actual
        return this.render.render([ast]);
      }

      // Si es .comp → los componentes se registran en el próximo render
      // Si es .styles → los estilos se procesan en el próximo render
      // En ambos casos, para un load en tiempo de ejecución simplemente retornamos ''
      // y el efecto se verá en la próxima ejecución completa
      return '';

    } catch (e: any) {
      console.error('[load] Error al cargar:', destino, e.message);
      Swal.fire({ icon: 'error', title: 'Error en load', text: e.message });
      return '';
    }
  }

  private obtenerTodosLosArchivos(nodos: NodoArchivo[]): NodoArchivo[] {
    let archivos: NodoArchivo[] = [];
    for (const nodo of nodos) {
      if (nodo.tipo === 'archivo') archivos.push(nodo);
      if (nodo.tipo === 'carpeta' && nodo.hijos)
        archivos = archivos.concat(this.obtenerTodosLosArchivos(nodo.hijos));
    }
    return archivos;
  }
}