import { Injectable } from '@angular/core';
import { SqliteService } from '../sql/sqlite.service';
import { Principal } from '../../clases/analizador/principal';
import { RenderizadorComponentes } from '../../clases/analizador/render-componentes';
import { TablaSimbolos } from '../../clases/analizador/tabla-simbolos';
import { Evaluador } from '../../clases/analizador/evaluador';
import { AnalizadorEstilos } from '../../clases/analizador/analizador-estilos';

@Injectable({ providedIn: 'root' })
export class RenderService {

  private tabla = new TablaSimbolos();
  private evaluador = new Evaluador(this.tabla);
  private estilos = new AnalizadorEstilos(this.evaluador);
  private componentes: Map<string, any> = new Map();

  private renderComp!: RenderizadorComponentes;
  private ejecutor!: Principal;

  private onLoad: ((destino: string, esArchivo: boolean) => string) | null = null;
  private popupDocument: Document | null = null;

  constructor(private sqlite: SqliteService) { }

  setResolverContenido(_fn: (c: any) => string): void {

  }

  setOnLoad(fn: (destino: string, esArchivo: boolean) => string): void {
    this.onLoad = fn;
  }

  setPopupDocument(doc: Document): void {
    this.popupDocument = doc;
  }

  render(asts: any[]): string {
    this.reiniciar();

    for (const ast of asts) {
      if (Array.isArray(ast)) {
        this.ejecutarDBA(ast);
      }
    }

    for (const ast of asts) {
      if (!Array.isArray(ast)) continue;
      for (const nodo of ast) {
        if (nodo && (nodo.tipo === 'clase' || nodo.tipo === 'for')) {
          this.estilos.procesarAST(ast);
          break;
        }
      }
    }

    for (const ast of asts) {
      if (!Array.isArray(ast)) continue;
      for (const nodo of ast) {
        if (nodo && nodo.tipo === 'componente') {
          this.componentes.set(nodo.nombre, nodo);
        }
      }
    }

    this.renderComp = new RenderizadorComponentes(
      this.tabla, this.evaluador, this.estilos, this.componentes
    );
    this.ejecutor = new Principal(this.tabla, this.evaluador, this.renderComp);

    this.ejecutor.setSqlite(this.sqlite);
    if (this.onLoad) {
      this.ejecutor.setOnLoad(this.onLoad);
    }

    let html = '';
    for (const ast of asts) {
      if (ast && ast.tipo === 'programa') {
        html += this.ejecutor.ejecutar(ast);
        continue;
      }
      if (Array.isArray(ast)) {
        for (const nodo of ast) {
          if (nodo && nodo.tipo === 'programa') {
            html += this.ejecutor.ejecutar(nodo);
          }
        }
      }
    }

    const css = this.estilos.generarCSS();
    return '<style>' + css + '</style>' + html;
  }

  private ejecutarDBA(sentencias: any[]): void {
    for (const sentencia of sentencias) {
      if (!sentencia || !sentencia.tipo) continue;
      try {
        const sql = this.sqlite.nodoASQL(sentencia);
        if (!sql) continue;

        if (sentencia.tipo === 'select') {
          const resultado = this.sqlite.ejecutarSQL(sql);
          const clave = sentencia.tabla + '_' + sentencia.columna;
          this.tabla.set(clave, 'array', resultado.map((r: any) => r[sentencia.columna]));
          console.log('[DBA] SELECT ' + clave + ':', resultado);
        } else {
          this.sqlite.ejecutarSQL(sql);
          console.log('[DBA] ' + sentencia.tipo.toUpperCase() + ' ejecutado');
        }
      } catch (e: any) {

        console.error('[DBA] Error:', e.message, sentencia);

        if (this.popupDocument) {

          this.mostrarSwal(
            this.popupDocument,
            'Error SQL',
            e.message,
            'error'
          );

        }
      }
    }
  }


  conectarEventos(doc: Document, runtime: any): void {

    const botones = doc.querySelectorAll('[data-yf-click]');

    botones.forEach((el: any) => {

      const nuevo = el.cloneNode(true) as HTMLElement;
      el.parentNode?.replaceChild(nuevo, el);

      nuevo.addEventListener('click', async () => {

        const nombreFn = nuevo.getAttribute('data-yf-click') || '';
        const argsRaw = nuevo.getAttribute('data-yf-args') || '[]';

        if (!nombreFn) return;

        let argsAst: any[] = [];
        try {
          const argsStr = argsRaw
            .split('&quot;').join('"')
            .split('&amp;').join('&');
          argsAst = JSON.parse(argsStr);
        } catch {
          argsAst = [];
        }

        const form = nuevo.closest('form') as HTMLFormElement | null;

        const valores: any[] = [];
        for (const arg of argsAst) {

          if (arg && typeof arg === 'object' && arg.tipo === 'input_ref') {
            const nombreInput = String(arg.nombre || '');
            const input = form
              ? form.querySelector('[name="' + nombreInput + '"]') as HTMLInputElement | null
              : doc.querySelector('[name="' + nombreInput + '"]') as HTMLInputElement | null;

            if (input) {
              if (input.type === 'checkbox') {
                valores.push(input.checked);
              } else if (input.type === 'number') {
                valores.push(Number(input.value));
              } else {
                valores.push(input.value);
              }
            } else {
              valores.push(null);
            }

          } else if (arg && typeof arg === 'object' && arg.tipo === 'var') {
            valores.push(null);
          } else {
            valores.push(arg);
          }
        }

        console.log('[YFERA] Click en función:', nombreFn, 'con args:', valores);

        try {
          await runtime.llamarFuncion(nombreFn, valores);
        } catch (err: any) {
          this.mostrarSwal(doc, 'Error en SQL', err.message, 'error');

          console.error('[YFERA] Error al llamar función:', err);
        }
      });
    });

    console.log('[YFERA] Eventos conectados:', botones.length, 'botones');
  }

  private reiniciar(): void {
    this.tabla.limpiar();
    this.estilos.limpiar();
    this.componentes.clear();
  }

  private mostrarSwal(
    doc: Document,
    titulo: string,
    mensaje: string,
    icono: any = 'info'
  ): void {

    const swal = (doc.defaultView as any)?.Swal;

    if (!swal) {
      console.error('Swal no encontrado en popup');
      return;
    }

    swal.fire({
      title: titulo,
      text: mensaje,
      icon: icono
    });
  }
}