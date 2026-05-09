import { ElementRef, Injectable } from '@angular/core';

import * as parserDBA from '../../analisisis-jison/analizador-dba.js';
import { SqliteService } from '../sql/sqlite.service.js';
import { ManejoErrores } from '../../clases/manejo-errores/errores.js';

export interface LineaTerminal {
  texto: string;
  tipo: 'input' | 'output' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class TerminalService {

  terminalBody!: ElementRef<HTMLDivElement>;

  terminalLineas: LineaTerminal[] = [];
  terminalCmd: string = '';
  historialCmds: string[] = [];
  historialIdx: number = -1;

  constructor(public sqlite: SqliteService) { }


  async init() {
    await this.sqlite.init();
    this.termLog('info', 'SQLite listo. Escribe un comando DBA o SQL.');
    this.termLog('info', 'Ejemplos:');
    this.termLog('info', '  TABLE productos COLUMNS nombre=string, precio=float;');
    this.termLog('info', '  productos[nombre="Laptop", precio=999.99];');
    this.termLog('info', '  productos.nombre;');
    this.termLog('info', '  SELECT * FROM productos;');
    this.termLog('info', '  .tablas    → listar tablas');
    this.termLog('info', '  .ver TABLA → ver contenido de una tabla');
    this.termLog('info', '  .limpiar   → nueva base de datos');
  }


  keydown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historialIdx < this.historialCmds.length - 1) {
        this.historialIdx++;
        this.terminalCmd = this.historialCmds[this.historialIdx];
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historialIdx > 0) {
        this.historialIdx--;
        this.terminalCmd = this.historialCmds[this.historialIdx];
      } else {
        this.historialIdx = -1;
        this.terminalCmd = '';
      }
    }
    if (e.key === 'Enter') {
      this.ejecutar();
    }
  }

  async ejecutar() {
    const cmd = this.terminalCmd.trim();
    if (!cmd) return;

    this.historialCmds.unshift(cmd);
    this.historialIdx = -1;
    this.terminalCmd = '';

    this.termLog('input', `> ${cmd}`);
    await this.sqlite.init();

    if (cmd.startsWith('.')) {
      this.ejecutarComandoEspecial(cmd);
    } else if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|PRAGMA)/i.test(cmd)) {
      this.ejecutarSQL(cmd);
    } else {
      this.ejecutarDBA(cmd);
    }

    this.scrollAuto();
  }

  private ejecutarComandoEspecial(cmd: string) {
    const partes = cmd.split(/\s+/);

    switch (partes[0]) {
      case '.tablas': {
        if (!this.sqlite.listo) { this.termLog('error', 'SQLite no inicializado'); return; }
        const tablas = this.sqlite.listarTablas();
        if (tablas.length === 0) {
          this.termLog('info', 'No hay tablas creadas.');
        } else {
          this.termLog('info', `Tablas (${tablas.length}):`);
          tablas.forEach(t => this.termLog('output', `  • ${t}`));
        }
        break;
      }

      case '.ver': {
        const tabla = partes[1];
        if (!tabla) { this.termLog('error', 'Uso: .ver NOMBRE_TABLA'); return; }
        if (!this.sqlite.listo) { this.termLog('error', 'SQLite no inicializado'); return; }
        this.mostrarTabla(tabla);
        break;
      }

      case '.limpiar': {
        this.sqlite.reiniciar().then(() => {
          this.termLog('info', 'Base de datos reiniciada. Todas las tablas eliminadas.');
        });
        break;
      }

      case '.exportar': {
        this.sqlite.descargarDB('yfera-terminal');
        this.termLog('info', 'Base de datos exportada como yfera-terminal.db');
        break;
      }

      case '.limpiar-terminal': {
        this.terminalLineas = [];
        break;
      }

      case '.help': {
        this.termLog('info', '─── Comandos disponibles ───────────────────────');
        this.termLog('info', '  .tablas             → lista todas las tablas');
        this.termLog('info', '  .ver TABLA          → muestra el contenido de una tabla');
        this.termLog('info', '  .limpiar            → reinicia la base de datos');
        this.termLog('info', '  .exportar           → descarga la DB como archivo .db');
        this.termLog('info', '  .limpiar-terminal   → limpia la terminal');
        this.termLog('info', '─── SQL puro ───────────────────────────────────');
        this.termLog('info', '  SELECT * FROM tabla;');
        this.termLog('info', '  INSERT INTO tabla (col) VALUES (val);');
        this.termLog('info', '  UPDATE tabla SET col=val WHERE id=1;');
        this.termLog('info', '  DELETE FROM tabla WHERE id=1;');
        this.termLog('info', '─── Lenguaje DBA ───────────────────────────────');
        this.termLog('info', '  TABLE nombre COLUMNS col=tipo, col2=tipo;');
        this.termLog('info', '  nombre[col="valor", col2=123];');
        this.termLog('info', '  nombre[col="nuevo"] IN 1;');
        this.termLog('info', '  nombre DELETE 1;');
        this.termLog('info', '  nombre.columna;');
        break;
      }

      default:
        this.termLog('error', `Comando desconocido: ${partes[0]}. Escribe .help para ver los comandos.`);
    }
  }

  ejecutarSQL(sql: string) {
    try {
      const resultado = this.sqlite.ejecutarSQL(sql);

      if (resultado.length === 0) {
        this.termLog('output', 'OK — 0 filas devueltas.');
        return;
      }

      const cols = Object.keys(resultado[0]);
      const anchos = cols.map(c =>
        Math.max(c.length, ...resultado.map(r => String(r[c] ?? 'NULL').length))
      );
      const sep = anchos.map(a => '─'.repeat(a + 2)).join('┼');
      const encab = cols.map((c, i) => c.padEnd(anchos[i])).join(' │ ');

      this.termLog('output', `┌${sep.replace(/┼/g, '┬')}┐`);
      this.termLog('output', `│ ${encab} │`);
      this.termLog('output', `├${sep}┤`);

      resultado.forEach(fila => {
        const linea = cols.map((c, i) =>
          String(fila[c] ?? 'NULL').padEnd(anchos[i])
        ).join(' │ ');
        this.termLog('output', `│ ${linea} │`);
      });

      this.termLog('output', `└${sep.replace(/┼/g, '┴')}┘`);
      this.termLog('info', `${resultado.length} fila(s) encontrada(s).`);

    } catch (e: any) {
      this.termLog('error', `Error SQL: ${e.message}`);
    }
  }

  private ejecutarDBA(cmd: string) {
    try {
      const cmdConPuntoComa = cmd.endsWith(';') ? cmd : cmd + ';';

      const manejador = new ManejoErrores();
      manejador.reset();
      parserDBA.parser.yy = { manejador };
      parserDBA.parser.parseError = (str: any, hash: any) => {
        const linea = hash?.loc?.first_line ?? 0;
        const col   = hash?.loc?.first_column ?? 0;
        const lex   = hash?.token ?? '?';
        manejador.errorSintactico(lex, linea, col, str);
      };

      const resultado = parserDBA.parser.parse(cmdConPuntoComa);

      const ast = (resultado && typeof resultado === 'object' && 'ast' in resultado)
        ? resultado.ast
        : resultado;

      const todosLosErrores = [
        ...(resultado?.errores ?? []),
        ...manejador.getErrores()
      ];
      if (todosLosErrores.length > 0) {
        for (const err of todosLosErrores) {
          this.termLog('error', `[Línea ${err.linea ?? err.line ?? 0}] ${err.descripcion ?? err.description ?? err}`);
        }
      }

      const sentencias = Array.isArray(ast) ? ast : (ast ? [ast] : []);

      for (const s of sentencias) {
        if (!s?.tipo) continue;
        const sql = this.sqlite.nodoASQL(s);
        if (!sql) { this.termLog('error', `No se pudo traducir: ${JSON.stringify(s)}`); continue; }

        this.termLog('info', `SQL: ${sql}`);

        if (s.tipo === 'select') {
          this.ejecutarSQL(sql);
        } else {
          try {
            this.sqlite.ejecutarSQL(sql);
            this.termLog('output', `${s.tipo.toUpperCase()} ejecutado en "${s.tabla}"`);
          } catch (e: any) {
            this.termLog('error', `Error: ${e.message}`);
          }
        }
      }

    } catch (e: any) {
      this.termLog('error', `Error de sintaxis DBA: ${e.message}`);
      this.termLog('info', 'Intentando como SQL puro...');
      this.ejecutarSQL(cmd);
    }
  }

  private mostrarTabla(nombre: string) {
    try {
      const { columnas } = this.sqlite.verTabla(nombre);
      if (columnas.length === 0) {
        this.termLog('error', `Tabla "${nombre}" no existe o está vacía.`);
        return;
      }
      this.ejecutarSQL(`SELECT * FROM ${nombre};`);
    } catch (e: any) {
      this.termLog('error', `Error: ${e.message}`);
    }
  }

  termLog(tipo: LineaTerminal['tipo'], texto: string) {
    this.terminalLineas.push({ tipo, texto });
  }

  scrollAuto() {
    setTimeout(() => {
      const el = this.terminalBody?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}