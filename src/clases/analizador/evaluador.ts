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

      // Template literal: `hola $nombre`  → interpolar
      case 'template':
        return this.interpolarSinRegex(expr.valor);

      default:
        return expr;
    }
  }

  // ─── Evaluar operación ────────────────────────────────────────────────────
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

  // ─── Verificar si un char es parte de un nombre de variable ──────────────
  private esNombreVar(c: string): boolean {
    const code = c.charCodeAt(0);
    return (code >= 48 && code <= 57)  ||  // 0-9
           (code >= 65 && code <= 90)  ||  // A-Z
           (code >= 97 && code <= 122) ||  // a-z
           code === 95;                     // _
  }

  // ─── Interpolar $variables en un string SIN regex ────────────────────────
  // Maneja: "hola $nombre, tienes $edad años"
  // También maneja expresiones entre backticks dentro del string: `$x + 1`
  interpolarSinRegex(texto: string): string {
    let resultado = '';
    let i = 0;

    while (i < texto.length) {
      // Backtick: evaluar expresión aritmética entre ``
      if (texto[i] === '`') {
        let expresion = '';
        i++; // saltar el backtick de apertura
        while (i < texto.length && texto[i] !== '`') {
          expresion += texto[i];
          i++;
        }
        if (i < texto.length) i++; // saltar el backtick de cierre
        // La expresión puede contener $vars → primero resolver las variables
        const exprResuelta = this.interpolarSinRegex(expresion.trim());
        // Luego evaluar aritméticamente con Function (solo para expresiones numéricas)
        resultado += this.evaluarExprTexto(exprResuelta);
        continue;
      }

      // Variable: $nombre
      if (texto[i] === '$') {
        let nombre = '';
        i++; // saltar el $
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

  // ─── Evaluar expresión aritmética de texto ya con vars resueltas ─────────
  // Solo se usa para el caso de backtick dentro de strings
  // Ej: "25 + 10 + 0.5" → "35.5"
  private evaluarExprTexto(expr: string): string {
    // Sustitución de $vars ya hecha antes de llamar aquí
    // Usar Function solo para evaluación numérica de la expresión ya resuelta
    try {
      // Verificar que solo hay caracteres seguros: números, operadores, espacios, punto
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
      // Si falla, devolver el texto tal cual
    }
    return expr;
  }

  // ─── Compatibilidad: interpolarTexto (ahora sin regex) ───────────────────
  // Llamado desde RenderizadorComponentes.renderTexto para strings normales
  interpolarTexto(texto: string): string {
    return this.interpolarSinRegex(texto);
  }
}