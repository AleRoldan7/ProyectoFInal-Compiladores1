import { TablaSimbolos } from './tabla-simbolos';

export class Evaluador {

  constructor(private tabla: TablaSimbolos) {}

 
  evaluar(expr: any): any {
    if (expr === null || expr === undefined) return null;
    if (typeof expr === 'number')  return expr;
    if (typeof expr === 'boolean') return expr;
    if (typeof expr === 'string')  return expr;

   
    if (expr.op) {
      return this.evaluarOperacion(expr);
    }

    switch (expr.tipo) {

      case 'var':
      case 'variable':
        return this.tabla.get(expr.nombre);

      case 'ident': {
        const val = this.tabla.getEntrada(expr.nombre);
        return val !== undefined ? val.valor : expr.nombre;
      }

      case 'array_acc':
      case 'acceso_array': {
        const arr = this.tabla.get(expr.nombre);
        const idx = this.evaluar(expr.indice);
        return Array.isArray(arr) ? arr[idx] : null;
      }

      default:
        return expr;
    }
  }

 
  private evaluarOperacion(expr: any): any {
    if (expr.op === 'neg') return -this.evaluar(expr.val);
    if (expr.op === '!')   return !this.evaluar(expr.val);

    const izq = this.evaluar(expr.izq);
    const der  = this.evaluar(expr.der);
    return this.calcular(expr.op, izq, der);
  }

  
  calcular(op: string, izq: any, der: any): any {
    switch (op) {
      case '+':  return izq + der;
      case '-':  return izq - der;
      case '*':  return izq * der;
      case '/':  return der !== 0 ? izq / der : 0;
      case '%':  return izq % der;
      case '>':  return izq > der;
      case '>=': return izq >= der;
      case '<':  return izq < der;
      case '<=': return izq <= der;
      case '==': return izq == der;
      case '!=': return izq != der;
      case '&&': return izq && der;
      case '||': return izq || der;
      default:
        console.warn('[Evaluador] Operador desconocido:', op);
        return null;
    }
  }

 
  interpolarTexto(texto: string): string {
    texto = texto.replace(/`([^`]+)`/g, (_, expr) => {
      try {
        return String(this.evaluarExprTexto(expr.trim()));
      } catch {
        return expr;
      }
    });

    texto = texto.replace(/\$([a-zA-Z_]\w*)/g, (_, nombre) => {
      const val = this.tabla.get(nombre);
      return val !== null ? String(val) : `$${nombre}`;
    });

    return texto;
  }

 
  private evaluarExprTexto(expr: string): any {
    const sustituido = expr.replace(/\$([a-zA-Z_]\w*)/g, (_, nombre) => {
      const val = this.tabla.get(nombre);
      return val !== null ? JSON.stringify(val) : '0';
    });
    try {
      return Function('"use strict"; return (' + sustituido + ')')();
    } catch {
      return expr;
    }
  }
}