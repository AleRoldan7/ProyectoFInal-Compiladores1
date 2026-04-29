import { TablaSimbolos } from './tabla-simbolos';
import { Evaluador } from './evaluador';
import { RenderizadorComponentes } from './render-componentes';

const BREAK    = '##BREAK##';
const CONTINUE = '##CONTINUE##';

export class Principal {

  constructor(private tabla: TablaSimbolos, private evaluador: Evaluador, private renderComp: RenderizadorComponentes) {}

  
  ejecutar(nodo: any): string {
    for (const dec of (nodo.declaraciones || [])) {
      this.ejecutarDeclaracion(dec);
    }
    return this.ejecutarBloque(nodo.main || []);
  }

 
  ejecutarBloque(instrucciones: any[]): string {
    if (!Array.isArray(instrucciones)) return '';
    let html = '';
    for (const inst of instrucciones) {
      const resultado = this.ejecutarInstruccion(inst);
      if (resultado === BREAK || resultado === CONTINUE) break;
      html += resultado || '';
    }
    return html;
  }

  
  private ejecutarInstruccion(nodo: any): string {
    if (!nodo) return '';
    switch (nodo.tipo) {

      case 'invocacion':
        return this.renderComp.invocar(nodo);

      case 'declaracion':
      case 'declaracion_array':
      case 'declaracion_execute':
        this.ejecutarDeclaracion(nodo);
        return '';

      case 'asignacion':
        this.ejecutarAsignacion(nodo);
        return '';

      case 'while':
        return this.ejecutarWhile(nodo);

      case 'do_while':
        return this.ejecutarDoWhile(nodo);

      case 'for':
        return this.ejecutarFor(nodo);

      case 'if':
        return this.ejecutarIf(nodo);

      case 'switch':
        return this.ejecutarSwitch(nodo);

      case 'break':    return BREAK;
      case 'continue': return CONTINUE;

      default:
        console.warn('[Ejecutor] Instrucción desconocida:', nodo.tipo);
        return '';
    }
  }

  ejecutarDeclaracion(dec: any): void {
    if (!dec) return;

    switch (dec.tipo) {

      case 'declaracion': {
        const valor = this.evaluador.evaluar(dec.valor);
        this.tabla.set(dec.nombre, dec.tipo_dato, valor);
        break;
      }

      case 'declaracion_array': {
        let valor: any[];
        if (Array.isArray(dec.valor)) {
          valor = dec.valor.map((v: any) => this.evaluador.evaluar(v));
        } else {
          valor = new Array(dec.tamano || 0).fill(null);
        }
        this.tabla.set(dec.nombre, dec.tipo_dato + '[]', valor);
        break;
      }

      case 'declaracion_execute': {
        const consulta = (dec.consulta || '').replace(/`/g, '').trim();
        const clave    = consulta.replace('.', '_');
        const resultado = this.tabla.get(clave);
        this.tabla.set(dec.nombre, dec.tipo_dato + '[]', resultado || []);
        break;
      }

      case 'funcion': {
        this.tabla.set(dec.nombre, 'function', dec);
        break;
      }
    }
  }


  private ejecutarAsignacion(nodo: any): void {
    if (!nodo) return;
    const valor  = this.evaluador.evaluar(nodo.valor);
    const actual = this.tabla.getEntrada(nodo.nombre);
    this.tabla.set(nodo.nombre, actual?.tipo || 'auto', valor);
  }


  private ejecutarWhile(nodo: any): string {
    let html  = '';
    let guard = 0; 
    while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000) {
      html += this.ejecutarBloque(nodo.cuerpo);
    }
    if (guard >= 10000) console.warn('[Ejecutor] while posiblemente infinito');
    return html;
  }

  private ejecutarDoWhile(nodo: any): string {
    let html  = '';
    let guard = 0;
    do {
      html += this.ejecutarBloque(nodo.cuerpo);
    } while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000);
    return html;
  }

  private ejecutarFor(nodo: any): string {
    if (nodo.init) {
      this.tabla.set(
        nodo.init.nombre, 'int',
        this.evaluador.evaluar(nodo.init.valor)
      );
    }
    let html  = '';
    let guard = 0;
    while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000) {
      html += this.ejecutarBloque(nodo.cuerpo);
      if (nodo.update) {
        this.tabla.set(
          nodo.update.nombre,
          this.tabla.getEntrada(nodo.update.nombre)?.tipo || 'int',
          this.evaluador.evaluar(nodo.update.valor)
        );
      }
    }
    return html;
  }

  private ejecutarIf(nodo: any): string {
    if (this.evaluador.evaluar(nodo.condicion)) {
      return this.ejecutarBloque(nodo.entonces);
    }
    for (const rama of (nodo.ramas || [])) {
      if (rama.tipo === 'else_if' && this.evaluador.evaluar(rama.condicion)) {
        return this.ejecutarBloque(rama.cuerpo);
      }
      if (rama.tipo === 'else') {
        return this.ejecutarBloque(rama.cuerpo);
      }
    }
    return '';
  }

  private ejecutarSwitch(nodo: any): string {
    const val = this.evaluador.evaluar(nodo.expr);
    for (const caso of (nodo.casos || [])) {
      if (caso.tipo === 'default') continue;
      if (this.evaluador.evaluar(caso.valor) == val) {
        return this.ejecutarBloque(caso.cuerpo);
      }
    }
    const def = (nodo.casos || []).find((c: any) => c.tipo === 'default');
    if (def) return this.ejecutarBloque(def.cuerpo);
    return '';
  }
}