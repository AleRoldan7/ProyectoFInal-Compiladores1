import { Injectable } from '@angular/core';
import { SqliteService } from '../sql/sqlite.service';
import { Principal } from '../../clases/analizador/principal';
import { RenderizadorComponentes } from '../../clases/analizador/render-componentes';
import { TablaSimbolos } from '../../clases/analizador/tabla-simbolos';
import { Evaluador } from '../../clases/analizador/evaluador';
import { AnalizadorEstilos } from '../../clases/analizador/analizador-estilos';

@Injectable({ providedIn: 'root' })
export class RenderService {

  private tabla       = new TablaSimbolos();
  private evaluador   = new Evaluador(this.tabla);
  private estilos     = new AnalizadorEstilos(this.evaluador);
  private componentes: Map<string, any> = new Map();

  private renderComp!: RenderizadorComponentes;
  private ejecutor!:   Principal;

  constructor(private sqlite: SqliteService) {}

  // ─── Método que pide CodigoCompiladoService ───────────────────────────
  // No hace falta guardarlo: RenderizadorComponentes ya resuelve
  // contenido internamente. Lo dejamos vacío para no romper la llamada.
  setResolverContenido(_fn: (c: any) => string): void {
    // La resolución de contenido ya está dentro de RenderizadorComponentes.
    // Este método existe solo para mantener compatibilidad con CodigoCompiladoService.
  }

  // ─── Render principal ─────────────────────────────────────────────────
  render(asts: any[]): string {
    this.reiniciar();

    // 1. Ejecutar sentencias DBA primero (llenan la tabla de símbolos)
    for (const ast of asts) {
      if (Array.isArray(ast)) {
        this.ejecutarDBA(ast);
      }
    }

    // 2. Procesar estilos (.styles → nodos tipo 'clase' o 'for')
    for (const ast of asts) {
      if (!Array.isArray(ast)) continue;
      for (const nodo of ast) {
        if (nodo && (nodo.tipo === 'clase' || nodo.tipo === 'for')) {
          this.estilos.procesarAST(ast);
          break; // procesarAST ya recorre todo el array, no repetir
        }
      }
    }

    // 3. Registrar componentes (.comp → nodos tipo 'componente')
    for (const ast of asts) {
      if (!Array.isArray(ast)) continue;
      for (const nodo of ast) {
        if (nodo && nodo.tipo === 'componente') {
          this.componentes.set(nodo.nombre, nodo);
        }
      }
    }

    // 4. Construir renderizadores con todo ya cargado
    this.renderComp = new RenderizadorComponentes(
      this.tabla, this.evaluador, this.estilos, this.componentes
    );
    this.ejecutor = new Principal(
      this.tabla, this.evaluador, this.renderComp
    );

    // 5. Ejecutar el programa principal (.y → nodo tipo 'programa')
    let html = '';
    for (const ast of asts) {
      // El parser del .y devuelve un objeto con tipo:'programa',
      // pero también puede devolver un array con un nodo 'programa' adentro
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

  // ─── Ejecutar sentencias DBA ──────────────────────────────────────────
  private ejecutarDBA(sentencias: any[]): void {
    for (const sentencia of sentencias) {
      if (!sentencia || !sentencia.tipo) continue;

      try {
        const sql = this.sqlite.nodoASQL(sentencia);
        if (!sql) continue;

        if (sentencia.tipo === 'select') {
          const resultado = this.sqlite.ejecutarSQL(sql);
          // La clave en tabla de símbolos es tabla_columna
          const clave = sentencia.tabla + '_' + sentencia.columna;
          this.tabla.set(
            clave,
            'array',
            resultado.map((r: any) => r[sentencia.columna])
          );
          console.log('[DBA] SELECT ' + clave + ':', resultado);
        } else {
          this.sqlite.ejecutarSQL(sql);
          console.log('[DBA] ' + sentencia.tipo.toUpperCase() + ' ejecutado');
        }

      } catch (e: any) {
        console.error('[DBA] Error:', e.message, sentencia);
      }
    }
  }

  // ─── Limpiar estado entre ejecuciones ────────────────────────────────
  private reiniciar(): void {
    this.tabla.limpiar();
    this.estilos.limpiar();
    this.componentes.clear();
  }
}