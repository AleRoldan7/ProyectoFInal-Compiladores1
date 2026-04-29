import { Injectable } from '@angular/core';

declare var initSqlJs: any;

@Injectable({ providedIn: 'root' })
export class SqliteService {

  private db:           any     = null;
  private dbReady:      boolean = false;
  private initPromise:  Promise<void> | null = null;


  init(): Promise<void> {
    if (this.dbReady) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = initSqlJs({
      locateFile: (file: string) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    }).then((SQL: any) => {
      this.db      = new SQL.Database();
      this.dbReady = true;
      console.log('[SQLite] Inicializado correctamente');
    });

    return this.initPromise!;
  }

  get listo(): boolean {
    return this.dbReady;
  }

  async reiniciar(): Promise<void> {
    await this.init();
    const SQL = await initSqlJs({
      locateFile: (file: string) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    });
    if (this.db) this.db.close();
    this.db      = new SQL.Database();
    this.dbReady = true;
    console.log('[SQLite] Base de datos reiniciada');
  }


  ejecutarSQL(sql: string): any[] {
    if (!this.db) throw new Error('SQLite no inicializado. Llama a init() primero.');
    console.log('[SQLite]', sql);
    const resultados: any[] = [];
    try {
      const stmts = this.db.exec(sql);
      for (const stmt of stmts) {
        const cols = stmt.columns as string[];
        const rows = stmt.values.map((row: any[]) => {
          const obj: Record<string, any> = {};
          cols.forEach((c, i) => obj[c] = row[i]);
          return obj;
        });
        resultados.push(...rows);
      }
    } catch (e: any) {
      console.error('[SQLite] Error:', e.message);
      throw e;
    }
    return resultados;
  }

  
  nodoASQL(nodo: any): string {
    if (!nodo?.tipo) return '';

    switch (nodo.tipo) {

      case 'create': {
        const cols = (nodo.columnas || [])
          .map((c: any) => `${c.nombre} ${this.tipoASQL(c.tipo)}`)
          .join(', ');
        return `CREATE TABLE IF NOT EXISTS ${nodo.tabla} ` +
               `(id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols});`;
      }

      case 'select':
        return `SELECT ${nodo.columna} FROM ${nodo.tabla};`;

      case 'insert': {
        const cols = (nodo.valores || []).map((v: any) => v.col).join(', ');
        const vals = (nodo.valores || []).map((v: any) =>
          typeof v.val === 'string' ? `'${v.val}'` : v.val
        ).join(', ');
        return `INSERT INTO ${nodo.tabla} (${cols}) VALUES (${vals});`;
      }

      case 'update': {
        const sets = (nodo.valores || []).map((v: any) =>
          `${v.col} = ${typeof v.val === 'string' ? `'${v.val}'` : v.val}`
        ).join(', ');
        return `UPDATE ${nodo.tabla} SET ${sets} WHERE id = ${nodo.id};`;
      }

      case 'delete':
        return `DELETE FROM ${nodo.tabla} WHERE id = ${nodo.id};`;

      default:
        console.warn('[SQLite] Tipo DBA desconocido:', nodo.tipo);
        return '';
    }
  }


  ejecutarNodo(nodo: any): any[] {
    const sql = this.nodoASQL(nodo);
    if (!sql) return [];
    return this.ejecutarSQL(sql);
  }


  listarTablas(): string[] {
    try {
      const r = this.ejecutarSQL(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
      );
      return r.map((row: any) => row.name);
    } catch { return []; }
  }

  verTabla(nombre: string): { columnas: string[]; filas: any[][] } {
    try {
      const stmts = this.db.exec(`SELECT * FROM ${nombre};`);
      if (!stmts.length) return { columnas: [], filas: [] };
      return { columnas: stmts[0].columns, filas: stmts[0].values };
    } catch { return { columnas: [], filas: [] }; }
  }

  verSchema(nombre: string): any[] {
    try {
      return this.ejecutarSQL(`PRAGMA table_info(${nombre});`);
    } catch { return []; }
  }


  exportarDB(): Uint8Array {
    if (!this.db) throw new Error('No hay DB activa.');
    return this.db.export();
  }

  descargarDB(nombre = 'yfera-db') {
    const data   = this.exportarDB();
    const blob   = new Blob([data.slice().buffer], { type: 'application/octet-stream' });
    const a      = document.createElement('a');
    a.href       = URL.createObjectURL(blob);
    a.download   = `${nombre}.db`;
    a.click();
    URL.revokeObjectURL(a.href);
  }


  private tipoASQL(tipo: string): string {
    const mapa: Record<string, string> = {
      int: 'INTEGER', float: 'REAL',
      string: 'TEXT', boolean: 'INTEGER', char: 'TEXT'
    };
    return mapa[tipo?.toLowerCase()] || 'TEXT';
  }
}