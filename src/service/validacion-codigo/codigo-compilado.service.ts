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
import { AnalizadorSemantico } from '../../clases/manejo-errores/analizador-semantico.js';
import { RuntimeSql } from '../sql/runtime-sql.js';
import Swal from 'sweetalert2';
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
  erroresBD: string[] = [];
  consolaLines: string[] = [
    '<span style="color:#45475a;">Cuando se ejecute aparece aca</span>'
  ];
  htmlCompilado: string = '';

  /* 09-05-2026 HORA 04:58 YA NO DOY MAS PERO DI TODO MI ESFUERZO ACA VIENE EL CODIGO YA PARA HACERLO HTML */
  private arbolActual: NodoArchivo[] = [];
  private astsDBAGlobales: any[] = [];

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

  private limpiarMensajeError(mensaje: string): string {
    if (!mensaje) return 'Error desconocido';
    const marca = 'Parse error on line ';
    let inicio = 0;
    let idx = 0;
    while (idx <= mensaje.length - marca.length) {
      let ok = true;
      for (let k = 0; k < marca.length; k++) {
        if (mensaje[idx + k] !== marca[k]) { ok = false; break; }
      }
      if (ok) {
        let fin = idx + marca.length;
        while (fin < mensaje.length && mensaje[fin] !== '\n') fin++;
        inicio = fin + 1;
        break;
      }
      idx++;
    }
    const resultado: string[] = [];
    let linea = '';
    for (let i = inicio; i <= mensaje.length; i++) {
      const ch = i < mensaje.length ? mensaje[i] : '\n';
      if (ch === '\n') {
        const l = linea.trim();
        linea = '';
        if (!l) continue;
        let solo = true;
        for (let j = 0; j < l.length; j++) {
          if (l[j] !== '-' && l[j] !== '^' && l[j] !== ' ') { solo = false; break; }
        }
        if (!solo) resultado.push(l);
      } else {
        linea += ch;
      }
    }
    return resultado.length > 0 ? resultado.join(' ') : 'Error sintáctico';
  }

  private inicializarParser(parser: any, manejador: ManejoErrores) {
    parser.parser.yy = { manejador };
    const limpiar = (msg: string) => this.limpiarMensajeError(msg);
    parser.parser.parseError = function (str: any, hash: any) {
      const linea = hash?.loc?.first_line ?? hash?.line ?? 0;
      const col = hash?.loc?.first_column ?? hash?.column ?? 0;
      const lexema = hash?.token ?? hash?.text ?? '?';
      manejador.errorSintactico(lexema, linea, col, limpiar(String(str)));
    };
  }

  private extraerAST(resultado: any): any {
    if (resultado && typeof resultado === 'object' && 'ast' in resultado) {
      return resultado.ast;
    }
    return resultado;
  }

  private erroresParserAReporte(resultado: any, archivo: string): ErrorReporte[] {
    const lista: ErrorReporte[] = [];
    if (!resultado || !Array.isArray(resultado.errores)) return lista;
    for (const err of resultado.errores) {
      lista.push({
        lexema: err.lexema ?? '?',
        linea: err.linea ?? 0,
        columna: err.columna ?? 0,
        tipo: err.tipo ?? 'Sintáctico',
        descripcion: '[' + archivo + '] ' + (err.descripcion ?? 'Error desconocido'),
      });
    }
    return lista;
  }

  private erroresSemanticosAReporte(manejador: ManejoErrores, archivo: string): ErrorReporte[] {
    return manejador.getErrores().map(err => ({
      lexema: err.lexema ?? '?',
      linea: err.line ?? 0,
      columna: err.column ?? 0,
      tipo: err.type ?? 'Semántico',
      descripcion: '[' + archivo + '] ' + (err.description ?? 'Error semántico'),
    }));
  }

  private extraerComponentes(
    ast: any,
    archivo: string
  ): { nombre: string; params: { tipo: string; nombre: string }[] }[] {
    const lista: any[] = [];
    if (!ast) return lista;
    const nodos = Array.isArray(ast) ? ast : (ast.componentes ?? []);
    for (const nodo of nodos) {
      if (nodo?.tipo !== 'componente') continue;
      let dup = false;
      for (const c of lista) {
        if (c.nombre === nodo.nombre) {
          this.errores.push({
            lexema: nodo.nombre,
            linea: nodo.linea ?? 0,
            columna: nodo.columna ?? 0,
            tipo: 'Semántico',
            descripcion: 'En ' + c.archivo + ': el componente ' + nodo.nombre + ' está duplicado'
          });
          dup = true; break;
        }
      }
      if (dup) continue;
      lista.push({
        nombre: nodo.nombre,
        linea: nodo.linea ?? 0,
        columna: nodo.columna ?? 0,
        archivo,
        params: (nodo.params ?? []).map((p: any) => ({
          tipo: p.tipo ?? 'error',
          nombre: p.nombre ?? ''
        }))
      });
    }
    return lista;
  }

  resolverContenidoTexto(contenido: any): string {
    if (typeof contenido === 'string') return contenido;
    if (typeof contenido === 'number') return String(contenido);
    if (typeof contenido === 'boolean') return String(contenido);
    if (typeof contenido === 'object' && contenido !== null) {
      return this.evaluarExpresion(contenido);
    }
    return '';
  }

  private evaluarExpresion(nodo: any): string {
    if (!nodo) return '';
    if (nodo.tipo === 'var') return '$' + nodo.nombre;
    if (nodo.tipo === 'ident') return nodo.nombre;
    if (nodo.tipo === 'array_acc') return '$' + nodo.nombre + '[' + this.evaluarExpresion(nodo.indice) + ']';
    if (nodo.op === 'neg') return '-' + this.evaluarExpresion(nodo.val);
    if (nodo.op && nodo.izq !== undefined && nodo.der !== undefined) {
      const izq = this.evaluarExpresion(nodo.izq);
      const der = this.evaluarExpresion(nodo.der);
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
    return '';
  }

  async ejecutar(arbol: NodoArchivo[]): Promise<'console' | 'errors'> {
    this.arbolActual = arbol;
    this.errores = [];
    this.erroresBD = [];
    const now = new Date().toLocaleTimeString();

    await this.sqlite.init();

    const archivos = this.obtenerTodosLosArchivos(arbol);
    const archivosY = archivos.filter(a => a.nombre.endsWith('.y'));
    for (const archivoY of archivosY) {
      const erroresImport = this.highlighter.validarImports(archivoY.contenido || '', arbol);
      for (const ei of erroresImport) {
        this.errores.push({
          lexema: ei.ruta,
          linea: ei.linea,
          columna: 1,
          tipo: 'Semántico',
          descripcion: '[' + archivoY.nombre + '] ' + ei.mensaje,
        });
      }
    }
    if (this.errores.length > 0) {
      this.consolaLines = ['<span style="color:#f38ba8;">Errores de import. Corrígelos antes de ejecutar.</span>'];
      return 'errors';
    }

    try {
      const astsDBA: any[] = [];
      const astsOtros: any[] = [];
      const componentesRegistrados: any[] = [];

      const recorrer = (nodos: NodoArchivo[]) => {
        for (const nodo of nodos) {
          if (nodo.tipo === 'archivo') {
            const parser = this.getParser(nodo.nombre);
            if (!parser || !nodo.contenido?.trim()) continue;
            const manejador = new ManejoErrores();
            manejador.reset();
            try {
              this.inicializarParser(parser, manejador);
              const resultado = parser.parser.parse(nodo.contenido);
              const ast = this.extraerAST(resultado);
              this.errores.push(...this.erroresParserAReporte(resultado, nodo.nombre));
              if (nodo.nombre.endsWith('.dba')) {
                astsDBA.push({ ast, archivo: nodo.nombre });
              } else {
                astsOtros.push({ ast, archivo: nodo.nombre });
                if (nodo.nombre.endsWith('.comp')) {
                  componentesRegistrados.push(...this.extraerComponentes(ast, nodo.nombre));
                }
              }
            } catch (e: any) {
              this.errores.push({
                lexema: e.hash?.text ?? '?',
                linea: e.hash?.line ?? 0,
                columna: e.hash?.loc?.first_column ?? 0,
                tipo: e.hash ? 'Sintáctico' : 'Léxico',
                descripcion: '[' + nodo.nombre + '] ' + e.message,
              });
            }
          } else if (nodo.hijos) {
            recorrer(nodo.hijos);
          }
        }
      };
      recorrer(arbol);

      for (const { ast, archivo } of astsOtros) {
        if (!archivo.endsWith('.y') || !ast || ast.tipo !== 'programa') continue;
        const manejadorSem = new ManejoErrores();
        manejadorSem.reset();
        const semantico = new AnalizadorSemantico(manejadorSem);
        for (const comp of componentesRegistrados) {
          semantico.registrarComponente(comp.nombre, comp.params);
        }
        semantico.analizar(ast, []);
        this.errores.push(...this.erroresSemanticosAReporte(manejadorSem, archivo));
      }

      if (this.errores.length > 0) return 'errors';

      const logDBA: string[] = [];
      for (const { ast } of astsDBA) {
        const sentencias = Array.isArray(ast) ? ast : [ast];
        for (const s of sentencias) {
          if (!s) continue;
          const sql = this.sqlite.nodoASQL(s);
          if (!sql) continue;
          try {
            const res = this.sqlite.ejecutarSQL(sql);
            if (s.tipo === 'select') {
              logDBA.push('SELECT ' + s.columna + ' FROM ' + s.tabla + ' => ' + res.length + ' fila(s)');
            } else {
              logDBA.push(s.tipo.toUpperCase() + ' ' + s.tabla + ' OK');
            }
          } catch (e: any) {
            const errorMsg = 'ERROR en ' + s.tipo + ': ' + e.message;
            logDBA.push(errorMsg);
            this.erroresBD.push(errorMsg);
          }
        }
      }

      const todosLosAsts = [
        ...astsDBA.map((x: any) => x.ast),
        ...astsOtros.map((x: any) => x.ast),
      ];

      this.astsDBAGlobales = astsDBA.map((x: any) => x.ast);

      const ventana = window.open('', '_blank');
      if (!ventana) {
        Swal.fire({ icon: 'warning', title: 'Popup bloqueado', text: 'Permite popups para ver el resultado' });
        return 'errors';
      }
      this.render.setPopupDocument(ventana.document);


      const runtime = new RuntimeSql(
        this.sqlite,
        () => {
          const nuevoHtml = this.render.render(todosLosAsts);

          if (ventana && !ventana.closed) {
            const body = ventana.document.getElementById('yfera-body');

            if (body) {
              body.innerHTML = nuevoHtml;
            } else {
              ventana.document.body.innerHTML = nuevoHtml;
            }

            this.render.conectarEventos(ventana.document, runtime);
          }
        },
        ventana.document
      );


      for (const { ast } of astsOtros) {
        if (!ast) continue;
        const declaraciones = ast.declaraciones || [];
        for (const dec of declaraciones) {
          if (dec && dec.tipo === 'funcion') {
            runtime.registrarFuncion(dec);
          }
        }
      }

      this.render.setOnLoad((destino: string, esArchivo: boolean) => {
        return this.manejarLoad(destino, esArchivo);
      });
      this.render.setResolverContenido((c: any) => this.resolverContenidoTexto(c));

      const html = this.render.render(todosLosAsts);
      this.htmlCompilado = html;

      this.consolaLines = [
        '<span style="color:#45475a;">[' + now + ']</span> Compilando...',
        ...logDBA.map(l => '<span style="color:#94e2d5;">' + l + '</span>'),
        '<span style="color:#a6e3a1;">Compilación exitosa.</span>',
        '<span style="color:#89dceb;">HTML generado correctamente.</span>',
      ];

      let htmlFinal = html;
      if (this.erroresBD.length > 0) {
        const erroresBDhtml = this.erroresBD.map(e => `<li>${e}</li>`).join('');
        const popupScript = `
<script>
  window.addEventListener('load', () => {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = '<div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;"><div style="background: #1e1e2e; color: #cdd6f4; padding: 20px; border-radius: 8px; border: 2px solid #f38ba8; max-width: 500px;"><h3 style="color: #f38ba8; margin-top: 0;">⚠️ Error en la Base de Datos</h3><ul style="color: #f38ba8;">${erroresBDhtml}</ul><button onclick="location.reload();" style="background: #f38ba8; color: #1e1e2e; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Recargar</button></div></div>';
    document.body.insertAdjacentHTML('beforeend', errorDiv.innerHTML);
  });
</script>
        `;
        htmlFinal = html + popupScript;
      }

      ventana.document.open();
      ventana.document.write(
        '<!doctype html><html>' +
        '<head>' +
        '<meta charset="utf-8">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">' +
        '</head>' +
        '<body id="yfera-body">' +
        htmlFinal +
        '</body></html>'
      );
      ventana.document.close();


      const conectar = () => {
        if (!ventana || ventana.closed) return;
        console.log('[YFERA] Conectando eventos, readyState:', ventana.document.readyState);
        this.render.conectarEventos(ventana.document, runtime);
      };

      if (ventana.document.readyState === 'complete' ||
        ventana.document.readyState === 'interactive') {

        conectar();
      } else {
        ventana.addEventListener('load', conectar, { once: true });
      }


      setTimeout(() => conectar(), 500);

      return 'console';

    } catch (error: any) {
      this.consolaLines = ['<span style="color:#f38ba8;">' + error.message + '</span>'];
      this.errores.push({
        lexema: error.hash?.text ?? '?',
        linea: error.hash?.line ?? 0,
        columna: error.hash?.loc?.first_column ?? 0,
        tipo: error.hash ? 'Sintáctico' : 'Léxico',
        descripcion: error.message,
      });
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      return 'errors';
    }
  }

  private manejarLoad(destino: string, _esArchivo: boolean): string {
    const archivos = this.obtenerTodosLosArchivos(this.arbolActual);
    let nombre = destino;
    if (nombre.startsWith('./')) nombre = nombre.substring(2);
    const archivo = archivos.find(a =>
      a.nombre === nombre ||
      a.nombre.endsWith('/' + nombre) ||
      a.nombre === destino
    );
    if (!archivo) {
      Swal.fire({ icon: 'warning', title: 'load: archivo no encontrado', text: destino });
      return '';
    }
    if (!archivo.contenido?.trim()) return '';
    try {
      const manejador = new ManejoErrores();
      manejador.reset();
      const parser = this.getParser(archivo.nombre);
      if (!parser) return '';
      this.inicializarParser(parser, manejador);
      const resultado = parser.parser.parse(archivo.contenido);
      const ast = this.extraerAST(resultado);
      if (archivo.nombre.endsWith('.y') && ast?.tipo === 'programa') {
        return this.render.render([ast]);

      }
      return '';
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error en load', text: e.message });
      return '';
    }
  }

  private obtenerTodosLosArchivos(nodos: NodoArchivo[]): NodoArchivo[] {
    let archivos: NodoArchivo[] = [];
    for (const nodo of nodos) {
      if (nodo.tipo === 'archivo') archivos.push(nodo);
      if (nodo.tipo === 'carpeta' && nodo.hijos) {
        archivos = archivos.concat(this.obtenerTodosLosArchivos(nodo.hijos));
      }
    }
    return archivos;
  }
}