import { TablaSimbolos } from './tabla-simbolos';

export class Evaluador {

  constructor(private tabla: TablaSimbolos) {}

  // ─── Evaluar cualquier nodo del AST ──────────────────────────────────────
  evaluar(expr: any): any {
    if (expr === null || expr === undefined) return null;
    if (typeof expr === 'number')  return expr;
    if (typeof expr === 'boolean') return expr;
    if (typeof expr === 'string')  return expr;

    if (expr.op) return this.evaluarOperacion(expr);

    switch (expr.tipo) {
      case 'var':
      case 'variable':
        return this.tabla.get(expr.nombre);

      case 'ident': {
        const entrada = this.tabla.getEntrada(expr.nombre);
        return entrada !== undefined ? entrada.valor : expr.nombre;
      }

      case 'array_acc':
      case 'acceso_array': {
        const arr = this.tabla.get(expr.nombre);
        const idx = this.evaluar(expr.indice);
        return Array.isArray(arr) ? arr[idx] : null;
      }

      case 'template':
        return this.interpolarSinRegex(expr.valor);

      default:
        return expr;
    }
  }

  private evaluarOperacion(expr: any): any {
    if (expr.op === 'neg') return -this.evaluar(expr.val);
    if (expr.op === '!')   return !this.evaluar(expr.val);
    const izq = this.evaluar(expr.izq);
    const der = this.evaluar(expr.der);
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

  private esNombreVar(c: string): boolean {
    const code = c.charCodeAt(0);
    return (code >= 48 && code <= 57)  ||  // 0-9
           (code >= 65 && code <= 90)  ||  // A-Z
           (code >= 97 && code <= 122) ||  // a-z
           code === 95;                     // _
  }

  
  interpolarSinRegex(texto: string): string {
    let resultado = '';
    let i = 0;

    while (i < texto.length) {
      if (texto[i] === '`') {
        let expresion = '';
        i++; 
        while (i < texto.length && texto[i] !== '`') {
          expresion += texto[i];
          i++;
        }
        if (i < texto.length) i++; 
        const exprResuelta = this.interpolarSinRegex(expresion.trim());
        resultado += this.evaluarExprTexto(exprResuelta);
        continue;
      }

      if (texto[i] === '$') {
        let nombre = '';
        i++; 
        while (i < texto.length && this.esNombreVar(texto[i])) {
          nombre += texto[i];
          i++;
        }
        if (nombre.length > 0) {
          const val = this.tabla.get(nombre);
          resultado += (val !== null && val !== undefined) ? String(val) : '$' + nombre;
        } else {
          resultado += '$';
        }
        continue;
      }

      resultado += texto[i];
      i++;
    }

    return resultado;
  }

  
  private evaluarExprTexto(expr: string): string {
    
    try {
      let seguro = true;
      for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        const code = c.charCodeAt(0);
        const esNumero   = code >= 48 && code <= 57;
        const esOperador = c === '+' || c === '-' || c === '*' || c === '/' || c === '%';
        const esEspacio  = c === ' ' || c === '\t';
        const esPunto    = c === '.';
        const esParen    = c === '(' || c === ')';
        if (!esNumero && !esOperador && !esEspacio && !esPunto && !esParen) {
          seguro = false;
          break;
        }
      }
      if (seguro && expr.trim().length > 0) {
        const resultado = Function('"use strict"; return (' + expr + ')')();
        return String(resultado);
      }
    } catch {
    }
    return expr;
  }

  
  interpolarTexto(texto: string): string {
    return this.interpolarSinRegex(texto);
  }
}