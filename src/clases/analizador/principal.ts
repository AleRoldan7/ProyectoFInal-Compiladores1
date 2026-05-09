import { TablaSimbolos } from './tabla-simbolos';
import { Evaluador } from './evaluador';
import { RenderizadorComponentes } from './render-componentes';

const BREAK    = '##BREAK##';
const CONTINUE = '##CONTINUE##';
const LOAD     = '##LOAD##';  

export class Principal {

  
  private sqlite: any = null;
  private onLoad: ((destino: string, esArchivo: boolean) => string) | null = null;

  constructor(
    private tabla: TablaSimbolos,
    private evaluador: Evaluador,
    private renderComp: RenderizadorComponentes
  ) {}

  setSqlite(sqlite: any): void {
    this.sqlite = sqlite;
  }

  setOnLoad(fn: (destino: string, esArchivo: boolean) => string): void {
    this.onLoad = fn;
  }
  

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
      if (resultado === BREAK || resultado === CONTINUE || resultado === LOAD) break;
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
      case 'asignacion_array':
        this.ejecutarAsignacion(nodo);
        return '';

      case 'execute_dba':
        return this.ejecutarDBA(nodo.consulta);

      case 'llamada_funcion':
        return this.ejecutarLlamadaFuncion(nodo);

      case 'load':
        return this.ejecutarLoad(nodo);

      case 'while':      return this.ejecutarWhile(nodo);
      case 'do_while':   return this.ejecutarDoWhile(nodo);
      case 'for':        return this.ejecutarFor(nodo);
      case 'if':         return this.ejecutarIf(nodo);
      case 'switch':     return this.ejecutarSwitch(nodo);

      case 'break':      return BREAK;
      case 'continue':   return CONTINUE;

      default:
        console.warn('[Principal] Instrucción desconocida:', nodo.tipo);
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
        const resultado = this.ejecutarSelectConsulta(dec.consulta);
        if (dec.subtipo === 'select_scalar') {
          const primero = Array.isArray(resultado) ? (resultado[0] ?? null) : resultado;
          this.tabla.set(dec.nombre, dec.tipo_dato, primero);
        } else {
          this.tabla.set(dec.nombre, dec.tipo_dato + '[]', Array.isArray(resultado) ? resultado : []);
        }
        break;
      }

      case 'funcion': {
        this.tabla.set(dec.nombre, 'function', dec);
        break;
      }
    }
  }

  
  private ejecutarSelectConsulta(consulta: string): any[] {
  if (!this.sqlite) {
    console.warn('[Principal] SqliteService no disponible para execute SELECT');
    return [];
  }

  const consultaResuelta = this
    .resolverVariablesEnConsulta(consulta)
    .replace(/`/g, '')
    .trim();

  try {

    const partesSelect = consultaResuelta.split('.');

    if (partesSelect.length === 2) {

      const tabla   = partesSelect[0].trim();
      const columna = partesSelect[1].trim();

      const sql = `SELECT ${columna} FROM ${tabla};`;

      const filas = this.sqlite.ejecutarSQL(sql);

      const clave = tabla + '_' + columna;

      const valores = filas.map((f: any) => f[columna]);

      this.tabla.set(clave, 'array', valores);

      return valores;
    }

  } catch (e: any) {

    console.error(
      '[Principal] Error en execute SELECT:',
      e.message,
      consulta
    );

    this.mostrarAlertaError('Error en execute: ' + e.message);
  }

  return [];
}


  private ejecutarDBA(consulta: string): string {
    if (!this.sqlite) {
      console.warn('[Principal] SqliteService no disponible para execute DBA');
      return '';
    }

    const consultaResuelta = this.resolverVariablesEnConsulta(consulta);

    try {
      const nodo = this.parsearConsultaDBA(consultaResuelta);
      if (!nodo) {
        console.warn('[Principal] No se pudo parsear la consulta DBA:', consultaResuelta);
        return '';
      }

      const sql = this.sqlite.nodoASQL(nodo);
      if (!sql) return '';

      if (nodo.tipo === 'select') {
        const filas  = this.sqlite.ejecutarSQL(sql);
        const clave  = nodo.tabla + '_' + nodo.columna;
        const valores = filas.map((f: any) => f[nodo.columna]);
        this.tabla.set(clave, 'array', valores);
      } else {
        this.sqlite.ejecutarSQL(sql);
      }

    } catch (e: any) {
      console.error('[Principal] Error en execute DBA:', e.message, consulta);
      this.mostrarAlertaError('Error en execute: ' + e.message);
    }

    return '';
  }

  private parsearConsultaDBA(consulta: string): any | null {
    const s = consulta.trim();

    if (!s.includes('[') && !s.toUpperCase().includes('DELETE') && !s.toUpperCase().includes('TABLE')) {
      const partes = s.split('.');
      if (partes.length === 2) {
        return { tipo: 'select', tabla: partes[0].trim(), columna: partes[1].trim() };
      }
    }

    if (s.toUpperCase().startsWith('TABLE')) {
      const sinTable = s.substring(5).trim();
      const idxCols  = sinTable.toUpperCase().indexOf('COLUMNS');
      if (idxCols !== -1) {
        const tabla    = sinTable.substring(0, idxCols).trim();
        const colsStr  = sinTable.substring(idxCols + 7).trim();
        const columnas = colsStr.split(',').map(c => {
          const p = c.trim().split('=');
          return { nombre: p[0].trim(), tipo: (p[1] || 'string').trim() };
        });
        return { tipo: 'create', tabla, columnas };
      }
    }

    const matchDelete = s.match(/^(\w+)\s+DELETE\s+(\d+)$/i);
    if (matchDelete) {
      return { tipo: 'delete', tabla: matchDelete[1], id: parseInt(matchDelete[2]) };
    }

    const matchUpdate = s.match(/^(\w+)\[(.+)\]\s+IN\s+(\d+)$/i);
    if (matchUpdate) {
      return {
        tipo:   'update',
        tabla:  matchUpdate[1],
        valores: this.parsearAsignaciones(matchUpdate[2]),
        id:     parseInt(matchUpdate[3])
      };
    }

    const matchInsert = s.match(/^(\w+)\[(.+)\]$/);
    if (matchInsert) {
      return {
        tipo:    'insert',
        tabla:   matchInsert[1],
        valores: this.parsearAsignaciones(matchInsert[2])
      };
    }

    return null;
  }

  private parsearAsignaciones(str: string): { col: string; val: any }[] {
    return str.split(',').map(par => {
      const idx = par.indexOf('=');
      if (idx === -1) return { col: par.trim(), val: null };
      const col = par.substring(0, idx).trim();
      let   val: any = par.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (!isNaN(Number(val))) {
        val = Number(val);
      }
      return { col, val };
    });
  }

  private resolverVariablesEnConsulta(consulta: string): string {
    let resultado = '';
    let i = 0;
    while (i < consulta.length) {
      if (consulta[i] === '$') {
        let nombre = '';
        i++;
        while (i < consulta.length && /[a-zA-Z0-9_]/.test(consulta[i])) {
          nombre += consulta[i];
          i++;
        }
        const val = this.tabla.get(nombre);
        resultado += (val !== null && val !== undefined) ? String(val) : '$' + nombre;
      } else {
        resultado += consulta[i];
        i++;
      }
    }
    return resultado;
  }

  private ejecutarLlamadaFuncion(nodo: any): string {
    const fnDec = this.tabla.get(nodo.nombre);
    if (!fnDec || fnDec.tipo !== 'function') {
      console.warn('[Principal] Función no encontrada:', nodo.nombre);
      return '';
    }

    const fn: any = this.tabla.getEntrada(nodo.nombre)?.valor;
    if (!fn) return '';

    const scopeAnterior = this.tabla.clonar();

    const params: any[] = fn.params || [];
    const args:   any[] = nodo.args  || [];
    params.forEach((param: any, i: number) => {
      const valorArg = args[i] !== undefined ? this.evaluador.evaluar(args[i]) : null;
      this.tabla.set(param.nombre, param.tipo, valorArg);
    });

    let html = '';
    for (const inst of (fn.cuerpo || [])) {
      const res = this.ejecutarInstruccion(inst);
      if (res === LOAD) {
        this.tabla.restaurar(scopeAnterior);
        return LOAD;
      }
      html += res || '';
    }

    this.tabla.restaurar(scopeAnterior);
    return html;
  }


  private ejecutarLoad(nodo: any): string {
    let destino = nodo.destino;

    if (nodo.esVar || !nodo.esArchivo) {
      const val = this.tabla.get(destino);
      if (val !== null && val !== undefined) {
        destino = String(val);
      }
    }

    if (this.onLoad) {
      return this.onLoad(destino, nodo.esArchivo || destino.includes('.'));
    }

    console.warn('[Principal] load sin handler registrado:', destino);
    return '';
  }

  private mostrarAlertaError(mensaje: string): void {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Error de ejecución:\n' + mensaje);
    }
  }

  private ejecutarAsignacion(nodo: any): void {
    if (!nodo) return;

    if (nodo.tipo === 'asignacion_array') {
      const arr = this.tabla.get(nodo.nombre);
      const idx = this.evaluador.evaluar(nodo.indice);
      if (Array.isArray(arr) && idx !== undefined) {
        arr[idx] = this.evaluador.evaluar(nodo.valor);
        this.tabla.set(nodo.nombre, this.tabla.getEntrada(nodo.nombre)?.tipo || 'auto', arr);
      }
      return;
    }

    const valor  = this.evaluador.evaluar(nodo.valor);
    const actual = this.tabla.getEntrada(nodo.nombre);
    this.tabla.set(nodo.nombre, actual?.tipo || 'auto', valor);
  }

  private ejecutarWhile(nodo: any): string {
    let html  = '';
    let guard = 0;
    while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000) {
      const res = this.ejecutarBloque(nodo.cuerpo);
      if (res === BREAK || res === LOAD) break;
      html += res;
    }
    if (guard >= 10000) console.warn('[Principal] while posiblemente infinito');
    return html;
  }

  private ejecutarDoWhile(nodo: any): string {
    let html  = '';
    let guard = 0;
    do {
      const res = this.ejecutarBloque(nodo.cuerpo);
      if (res === BREAK || res === LOAD) break;
      html += res;
    } while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000);
    return html;
  }

  private ejecutarFor(nodo: any): string {
    if (nodo.init) {
      this.tabla.set(nodo.init.nombre, 'int', this.evaluador.evaluar(nodo.init.valor));
    }
    let html  = '';
    let guard = 0;
    while (this.evaluador.evaluar(nodo.condicion) && guard++ < 10000) {
      const res = this.ejecutarBloque(nodo.cuerpo);
      if (res === BREAK || res === LOAD) break;
      html += res;
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