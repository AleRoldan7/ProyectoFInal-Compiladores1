import { Injectable } from '@angular/core';

import * as parserStyle from '../../analisisis-jison/analizador-style.js';
import * as parserComponent from '../../analisisis-jison/analizador-component.js';
import * as parserPrincipal from '../../analisisis-jison/analizador-lenguaje-principal.js';
import * as parserDBA from '../../analisisis-jison/analizador-dba.js';

import { NodoArchivo } from '../../models/nodo-archivo.js';
import { ErrorReporte } from '../../pages/page-principal/page-principal/page-principal.js';
import { RenderService } from '../renderizado/render.service.js';
import { SqliteService } from '../sql/sqlite.service.js';
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

  constructor(
    private render: RenderService,
    private sqlite: SqliteService,
    private highlighter: CodigoService
  ) { }


  getParser(nombre: string): any {
    if (nombre.endsWith('.styles')) return parserStyle;
    if (nombre.endsWith('.comp')) return parserComponent;
    if (nombre.endsWith('.dba')) return parserDBA;
    if (nombre.endsWith('.y')) return parserPrincipal;
    return null;
  }


  async ejecutar(arbol: NodoArchivo[]): Promise<'console' | 'errors'> {
    this.errores = [];
    const now = new Date().toLocaleTimeString();
    await this.sqlite.init();

    const archivos = this.obtenerTodosLosArchivos(arbol);
    const archivosY = archivos.filter(a => a.nombre.endsWith('.y'));

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
          descripcion: `[${archivoY.nombre}] ${ei.mensaje}`
        });
      }
    }

    if (this.errores.length > 0) {
      this.consolaLines = [
        `<span style="color:#f38ba8;">✖ Errores de import encontrados. Corrígelos antes de ejecutar.</span>`
      ];
      return 'errors';
    }

    try {
      const astsDBA: any[] = [];
      const astsOtros: any[] = [];

      const recorrer = (nodos: NodoArchivo[]) => {
        for (const nodo of nodos) {
          if (nodo.tipo === 'archivo') {
            const parser = this.getParser(nodo.nombre);
            if (!parser || !nodo.contenido?.trim()) continue;
            try {
              const ast = parser.parser.parse(nodo.contenido);
              if (nodo.nombre.endsWith('.dba')) astsDBA.push(ast);
              else astsOtros.push(ast);
            } catch (e: any) {
              this.errores.push({
                lexema: e.hash?.text || '?',
                linea: e.hash?.line || 0,
                columna: e.hash?.loc?.first_column || 0,
                tipo: e.hash ? 'Sintáctico' : 'Léxico',
                descripcion: `[${nodo.nombre}] ${e.message}`
              });
            }
          } else if (nodo.hijos) {
            recorrer(nodo.hijos);
          }
        }
      };
      recorrer(arbol);

      if (this.errores.length > 0) return 'errors';

      const logDBA: string[] = [];
      for (const ast of astsDBA) {
        const sentencias = Array.isArray(ast) ? ast : [ast];
        for (const s of sentencias) {
          const sql = this.sqlite.nodoASQL(s);
          if (!sql) continue;
          try {
            const resultado = this.sqlite.ejecutarSQL(sql);
            if (s.tipo === 'select') {
              logDBA.push(`SELECT ${s.columna} FROM ${s.tabla} → ${resultado.length} fila(s)`);
            } else {
              logDBA.push(`${s.tipo.toUpperCase()} ${s.tabla} OK`);
            }
          } catch (e: any) {
            logDBA.push(`ERROR en ${s.tipo}: ${e.message}`);
          }
        }
      }

      const todosLosAsts = [...astsDBA, ...astsOtros];
      const html = this.render.render(todosLosAsts);

      this.consolaLines = [
        `<span style="color:#45475a;">[${now}]</span> Compilando...`,
        ...logDBA.map(l => `<span style="color:#94e2d5;">🗄 ${l}</span>`),
        `<span style="color:#a6e3a1;">✔ Compilación exitosa.</span>`,
        `<span style="color:#89dceb;">✔ HTML generado correctamente.</span>`
      ];

      const ventana = window.open();
      ventana?.document.write(`<!doctype html><html>
        <head>
          <meta charset="utf-8">
          <link rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
        </head>
        <body>${html}
          <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
      </html>`);

      return 'console';

    } catch (error: any) {
      this.consolaLines = [`<span style="color:#f38ba8;">✖ ${error.message}</span>`];
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
