import { Injectable } from '@angular/core';

import * as parserStyle from '../../analisisis-jison/analizador-style.js';
import * as parserComponent from '../../analisisis-jison/analizador-component.js';
import * as parserPrincipal from '../../analisisis-jison/analizador-lenguaje-principal.js';
import * as parserDBA from '../../analisisis-jison/analizador-dba.js';

import { NodoArchivo } from '../../models/nodo-archivo.js';
import { ErrorReporte } from '../../pages/page-principal/page-principal/page-principal.js';
import { RenderService } from '../renderizado/render.service.js';
import { SqliteService } from '../sql/sqlite.service.js';
import { ManejoErrores } from '../../clases/manejo-errores/errores.js';
import Swal from 'sweetalert2';
import { CodigoService } from '../tabulacion-color/codigo.service.js';

export interface ResultadoCompilacion {
  exito: boolean;
  errores: ErrorReporte[];
  consolaLines: string[];
  consolaMode: 'console' | 'errors';
}

@Injectable({
  providedIn: 'root',
})
export class CodigoCompiladoService {

  errores: ErrorReporte[] = [];
  consolaLines: string[] = [
    '<span style="color:#45475a;">// Salida del compilador aparecerá aquí...</span>'
  ];
  htmlCompilado: string = '';

  constructor(
    private render: RenderService,
    private sqlite: SqliteService,
    private highlighter: CodigoService
  ) { }

  getParser(nombre: string): any {
    if (nombre.endsWith('.styles')) return parserStyle;
    if (nombre.endsWith('.comp'))   return parserComponent;
    if (nombre.endsWith('.dba'))    return parserDBA;
    if (nombre.endsWith('.y'))      return parserPrincipal;
    return null;
  }

  // ─── Limpia el mensaje de error SIN regex ────────────────────────────────
  private limpiarMensajeError(mensaje: string): string {
    // 1. Quitar todo lo que esté antes y en la misma línea de "Parse error on line"
    const marcaParseError = 'Parse error on line ';
    const idxParse = mensaje.indexOf(marcaParseError);
    if (idxParse !== -1) {
      // Avanzar hasta el siguiente salto de línea para descartar esa línea
      const idxSalto = mensaje.indexOf('\n', idxParse);
      mensaje = idxSalto !== -1 ? mensaje.substring(idxSalto + 1) : '';
    }

    // 2. Quitar líneas que son solo guiones o circunflejos (ej: "-----^^^^^")
    const lineas = mensaje.split('\n');
    const lineasLimpias: string[] = [];
    for (const linea of lineas) {
      const recortada = linea.trim();
      if (recortada.length === 0) continue;

      // Detectar si la línea es SOLO guiones/circunflejos (línea de subrayado)
      let soloMarcadores = true;
      for (let i = 0; i < recortada.length; i++) {
        const c = recortada[i];
        if (c !== '-' && c !== '^' && c !== ' ') {
          soloMarcadores = false;
          break;
        }
      }
      if (soloMarcadores) continue;

      lineasLimpias.push(recortada);
    }

    const resultado = lineasLimpias.join(' ').trim();

    // 3. Extraer desde "Expecting" hasta el primer punto o coma SIN regex
    const marcaExpecting = 'Expecting';
    const idxExpecting = resultado.indexOf(marcaExpecting);
    if (idxExpecting !== -1) {
      const desde = idxExpecting + marcaExpecting.length;
      let hasta = resultado.length;
      for (let i = desde; i < resultado.length; i++) {
        if (resultado[i] === ',' || resultado[i] === '.') {
          hasta = i;
          break;
        }
      }
      return 'Expecting' + resultado.substring(desde, hasta).trim();
    }

    return resultado.length > 0 ? resultado : 'Error sintáctico desconocido';
  }

  // ─── Resuelve el contenido de un nodo texto a string seguro ──────────────
  // El parser puede devolver: string puro, número, booleano u objeto expresión
  resolverContenidoTexto(contenido: any): string {
    // Caso 1: ya es string (STRING_LIT ya procesado por la gramática)
    if (typeof contenido === 'string') {
      return contenido;
    }

    // Caso 2: número o booleano — convertir directo
    if (typeof contenido === 'number' || typeof contenido === 'boolean') {
      return String(contenido);
    }

    // Caso 3: es un nodo de expresión (objeto del AST)
    if (typeof contenido === 'object' && contenido !== null) {
      return this.evaluarNodoExpresion(contenido);
    }

    return '';
  }

  // ─── Evalúa nodos de expresión del AST a string ──────────────────────────
  private evaluarNodoExpresion(nodo: any): string {
    if (nodo === null || nodo === undefined) return '';

    // Variable: { tipo:'var', nombre:'x' }
    if (nodo.tipo === 'var') {
      return '$' + nodo.nombre;
    }

    // Identificador: { tipo:'ident', nombre:'x' }
    if (nodo.tipo === 'ident') {
      return nodo.nombre;
    }

    // Acceso a array: { tipo:'array_acc', nombre:'arr', indice: expr }
    if (nodo.tipo === 'array_acc') {
      const idx = this.evaluarNodoExpresion(nodo.indice);
      return '$' + nodo.nombre + '[' + idx + ']';
    }

    // Operación binaria: { op: '+', izq: ..., der: ... }
    if (nodo.op !== undefined && nodo.izq !== undefined && nodo.der !== undefined) {
      const izq = this.evaluarNodoExpresion(nodo.izq);
      const der = this.evaluarNodoExpresion(nodo.der);

      // Concatenación: si alguno es string, concatenar como texto
      if (nodo.op === '+') {
        return izq + der;
      }
      // Operaciones numéricas: intentar evaluar, si no, devolver como texto
      const numIzq = Number(izq);
      const numDer = Number(der);
      if (!isNaN(numIzq) && !isNaN(numDer)) {
        if (nodo.op === '-') return String(numIzq - numDer);
        if (nodo.op === '*') return String(numIzq * numDer);
        if (nodo.op === '/') return numDer !== 0 ? String(numIzq / numDer) : 'DIV/0';
        if (nodo.op === '%') return String(numIzq % numDer);
      }
      return izq + ' ' + nodo.op + ' ' + der;
    }

    // Negación unaria: { op: 'neg', val: ... }
    if (nodo.op === 'neg' && nodo.val !== undefined) {
      return '-' + this.evaluarNodoExpresion(nodo.val);
    }

    // Primitivos que llegaron como objeto (no debería ocurrir, pero por si acaso)
    if (typeof nodo === 'string') return nodo;
    if (typeof nodo === 'number') return String(nodo);
    if (typeof nodo === 'boolean') return String(nodo);

    return '';
  }

  // ─── Inicializar parser con manejador de errores ──────────────────────────
  private inicializarParserConManejador(parser: any, manejador: ManejoErrores) {
    parser.parser.yy = { manejador };

    const limpiarMensaje = (msg: string) => this.limpiarMensajeError(msg);
    parser.parser.parseError = function(str: any, hash: any) {
      const line   = (hash && hash.loc && hash.loc.first_line)   || (hash && hash.line)   || 0;
      const col    = (hash && hash.loc && hash.loc.first_column) || (hash && hash.column) || 0;
      const token  = (hash && hash.token) || (hash && hash.text) || '';
      const mensajeLimpio = limpiarMensaje(String(str));
      manejador.errorSintactico(token, line, col, mensajeLimpio);
    };
  }

  // ─── Ejecución principal ──────────────────────────────────────────────────
  async ejecutar(arbol: NodoArchivo[]): Promise<'console' | 'errors'> {
    const manejador = new ManejoErrores();
    manejador.reset();
    this.errores = [];
    const now = new Date().toLocaleTimeString();
    await this.sqlite.init();

    const archivos = this.obtenerTodosLosArchivos(arbol);
    const archivosY = archivos.filter(a => a.nombre.endsWith('.y'));

    // Validar imports antes de compilar
    for (const archivoY of archivosY) {
      const erroresImport = this.highlighter.validarImports(
        archivoY.contenido || '', arbol
      );
      for (const ei of erroresImport) {
        this.errores.push({
          lexema: ei.ruta,
          linea: ei.linea,
          columna: 1,
          tipo: 'Semántico',
          descripcion: '[' + archivoY.nombre + '] ' + ei.mensaje
        });
      }
    }

    if (this.errores.length > 0) {
      this.consolaLines = [
        '<span style="color:#f38ba8;">✖ Errores de import encontrados. Corrígelos antes de ejecutar.</span>'
      ];
      return 'errors';
    }

    try {
      const astsDBA: any[]   = [];
      const astsOtros: any[] = [];

      const recorrer = (nodos: NodoArchivo[]) => {
        for (const nodo of nodos) {
          if (nodo.tipo === 'archivo') {
            const parser = this.getParser(nodo.nombre);
            if (!parser || !nodo.contenido?.trim()) continue;
            try {
              this.inicializarParserConManejador(parser, manejador);
              const ast = parser.parser.parse(nodo.contenido);
              if (nodo.nombre.endsWith('.dba')) astsDBA.push(ast);
              else astsOtros.push(ast);
            } catch (e: any) {
              this.errores.push({
                lexema: e.hash?.text || '?',
                linea: e.hash?.line || 0,
                columna: e.hash?.loc?.first_column || 0,
                tipo: e.hash ? 'Sintáctico' : 'Léxico',
                descripcion: '[' + nodo.nombre + '] ' + e.message
              });
            }
          } else if (nodo.hijos) {
            recorrer(nodo.hijos);
          }
        }
      };
      recorrer(arbol);

      // Recolectar errores del manejador
      const erroresManejoErrores = manejador.getErrores();
      for (const err of erroresManejoErrores) {
        this.errores.push({
          lexema: err.lexema,
          linea: err.line,
          columna: err.column,
          tipo: err.type,
          descripcion: err.description
        });
      }

      if (this.errores.length > 0) return 'errors';

      // Ejecutar sentencias DBA
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

      // Pasar el resolvedor de contenido al RenderService antes de renderizar
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
        '<head>' +
        '<meta charset="utf-8">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">' +
        '</head>' +
        '<body>' + html +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>' +
        '</body>' +
        '</html>'
      );

      return 'console';

    } catch (error: any) {
      this.consolaLines = [
        '<span style="color:#f38ba8;">✖ ' + error.message + '</span>'
      ];
      this.errores.push({
        lexema: error.hash?.text || '?',
        linea: error.hash?.line || 0,
        columna: error.hash?.loc?.first_column || 0,
        tipo: error.hash ? 'Sintáctico' : 'Léxico',
        descripcion: error.message
      });
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      return 'errors';
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