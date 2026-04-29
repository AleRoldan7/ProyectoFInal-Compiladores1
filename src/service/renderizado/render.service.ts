import { Injectable } from '@angular/core';
import { SqliteService } from '../sql/sqlite.service';
import { Principal } from '../../clases/analizador/principal';
import { RenderizadorComponentes } from '../../clases/analizador/render-componentes';
import { TablaSimbolos } from '../../clases/analizador/tabla-simbolos';
import { Evaluador } from '../../clases/analizador/evaluador';
import { AnalizadorEstilos } from '../../clases/analizador/analizador-estilos';

@Injectable({ providedIn: 'root' })
export class RenderService {

  private tabla      = new TablaSimbolos();
  private evaluador  = new Evaluador(this.tabla);
  private estilos    = new AnalizadorEstilos(this.evaluador);
  private componentes: Map<string, any> = new Map();

  private renderComp!: RenderizadorComponentes;
  private ejecutor!:   Principal;

  constructor(private sqlite: SqliteService) {}

 
  render(asts: any[]): string {
    this.reiniciar();

    
    for (const ast of asts) {
      if (Array.isArray(ast)) {
        this.ejecutarDBA(ast);
      }
    }

    for (const ast of asts) {
      if (Array.isArray(ast)) {
        const tieneEstilos = ast.some((n: any) => n?.tipo === 'clase' || n?.tipo === 'for');
        if (tieneEstilos) {
          this.estilos.procesarAST(ast);
        }
      }
    }

    for (const ast of asts) {
      if (Array.isArray(ast)) {
        for (const nodo of ast) {
          if (nodo?.tipo === 'componente') {
            this.componentes.set(nodo.nombre, nodo);
          }
        }
      }
    }

    this.renderComp = new RenderizadorComponentes(
      this.tabla, this.evaluador, this.estilos, this.componentes
    );
    this.ejecutor = new Principal(
      this.tabla, this.evaluador, this.renderComp
    );

    let html = '';
    for (const ast of asts) {
      if (ast?.tipo === 'programa') {
        html += this.ejecutor.ejecutar(ast);
      }
    }

    const css = this.estilos.generarCSS();
    return `<style>${css}</style>${html}`;
  }

  private ejecutarDBA(sentencias: any[]): void {
    for (const sentencia of sentencias) {
      if (!sentencia?.tipo) continue;

      try {
        const sql = this.sqlite.nodoASQL(sentencia);
        if (!sql) continue;

        if (sentencia.tipo === 'select') {
          const resultado = this.sqlite.ejecutarSQL(sql);
          const clave     = `${sentencia.tabla}_${sentencia.columna}`;
          this.tabla.set(clave, 'array',
            resultado.map((r: any) => r[sentencia.columna])
          );
          console.log(`[DBA] SELECT → ${clave}:`, resultado);
        } else {
          this.sqlite.ejecutarSQL(sql);
          console.log(`[DBA] ${sentencia.tipo.toUpperCase()} ejecutado`);
        }

      } catch (e: any) {
        console.error('[DBA] Error:', e.message, sentencia);
      }
    }
  }


  private reiniciar(): void {
    this.tabla.limpiar();
    this.estilos.limpiar();
    this.componentes.clear();
  }
}