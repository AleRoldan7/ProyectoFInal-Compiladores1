
import { Evaluador } from './evaluador';

export class AnalizadorEstilos {

  private estilos: Map<string, Record<string, string>> = new Map();
  private evaluador: Evaluador;

  constructor(evaluador: Evaluador) {
    this.evaluador = evaluador;
  }

  limpiar(): void {
    this.estilos.clear();
  }

  getEstilos(): Map<string, Record<string, string>> {
    return this.estilos;
  }


  procesarAST(ast: any[]): void {
    if (!Array.isArray(ast)) return;
    for (const nodo of ast) {
      if (!nodo?.tipo) continue;
      switch (nodo.tipo) {
        case 'clase': this.procesarClase(nodo); break;
        case 'for':   this.procesarFor(nodo);   break;
        default:
          console.warn('[Estilos] Nodo desconocido:', nodo.tipo);
      }
    }
  }

  
  private procesarClase(nodo: any): void {
    let props: Record<string, string> = {};

    if (nodo.extiende && this.estilos.has(nodo.extiende)) {
      props = { ...this.estilos.get(nodo.extiende)! };
    }

    for (const prop of (nodo.propiedades || [])) {
      const css = this.propiedadACSS(prop);
      Object.assign(props, css);
    }

    this.estilos.set(nodo.nombre, props);
  }

  private procesarFor(nodo: any): void {
    const inicio = this.evalNum(nodo.inicio);
    const fin    = nodo.inclusivo
      ? this.evalNum(nodo.fin)
      : this.evalNum(nodo.fin) - 1;

    for (let i = inicio; i <= fin; i++) {
      for (const claseFor of (nodo.cuerpo || [])) {
        const nombreClase = this.sustituirNombre(claseFor.nombre, nodo.var, i);

        const props: Record<string, string> = {};
        for (const prop of (claseFor.propiedades || [])) {
          const propEval = this.sustituirProp(prop, nodo.var, i);
          Object.assign(props, this.propiedadACSS(propEval));
        }

        this.estilos.set(nombreClase, props);
      }
    }
  }


  private propiedadACSS(prop: any): Record<string, string> {
    if (!prop?.propiedad) return {};
    return { [prop.propiedad]: this.resolverValor(prop.valor) };
  }

 
  resolverValor(valor: any): string {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'number') return `${valor}px`;
    if (typeof valor === 'string') return valor;

    if (typeof valor === 'object') {
      if (valor.op) {
        const resultado = this.evaluarExprNum(valor);
        return typeof resultado === 'number' ? `${resultado}px` : String(resultado);
      }
      if (valor.tipo === 'borde') {
        const ancho = this.resolverValor(valor.ancho);
        return `${ancho} ${valor.estilo || 'solid'} ${valor.color || 'black'}`;
      }
      if (valor.tipo === 'contador') {
        return String(valor.nombre);
      }
    }
    return String(valor);
  }

 
  generarCSS(): string {
    let css = '';
    for (const [clase, props] of this.estilos.entries()) {
      const reglas = Object.entries(props)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join('\n');
      css += `.${clase} {\n${reglas}\n}\n`;
    }
    return css;
  }


  private evalNum(expr: any): number {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'string') return parseFloat(expr) || 0;
    return 0;
  }


  private sustituirNombre(nombre: string, variable: string, valor: number): string {
    return nombre
      .replace(new RegExp(`-${variable}$`), `-${valor}`)
      .replace(new RegExp(`-${variable}(?=-)`, 'g'), `-${valor}`)
      .replace(variable, String(valor));
  }

  
  private sustituirProp(prop: any, variable: string, valor: number): any {
    return { ...prop, valor: this.sustituirExpr(prop.valor, variable, valor) };
  }

  private sustituirExpr(expr: any, variable: string, valor: number): any {
    if (expr === null || expr === undefined) return expr;
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'object' && expr.tipo === 'contador' && expr.nombre === variable) {
      return valor;
    }
    if (typeof expr === 'object' && expr.op) {
      return {
        op:  expr.op,
        izq: this.sustituirExpr(expr.izq, variable, valor),
        der: this.sustituirExpr(expr.der, variable, valor)
      };
    }
    return expr;
  }

  private evaluarExprNum(expr: any): any {
    if (typeof expr === 'number') return expr;
    if (!expr?.op) return expr;
    const izq = this.evaluarExprNum(expr.izq);
    const der  = this.evaluarExprNum(expr.der);
    return this.evaluador.calcular(expr.op, izq, der);
  }
}