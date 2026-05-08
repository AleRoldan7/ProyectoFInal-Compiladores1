import Swal from "sweetalert2";
import { SqliteService } from "./sqlite.service";

export class RuntimeSql {

    private funciones = new Map<string, any>();

    constructor(
        private sql: SqliteService,
        private renderizar: () => void
    ) {}

    registrarFuncion(funcion: any) {
        if (funcion?.nombre) {
            this.funciones.set(funcion.nombre, funcion);
            console.log('[RuntimeSql] Función registrada:', funcion.nombre);
        }
    }

    async llamarFuncion(nombre: string, argumentos: any[] = []) {
        const funcion = this.funciones.get(nombre);

        if (!funcion) {
            Swal.fire({
                icon: 'error',
                title: 'Función no encontrada',
                text: 'La función "' + nombre + '" no está registrada'
            });
            return;
        }

        try {
            const scope = this.crearScope(funcion.params || [], argumentos);

            for (const sentencia of (funcion.cuerpo || [])) {
                if (!sentencia) continue;
                const detener = await this.ejecutarSentencia(sentencia, scope);
                if (detener) break;
            }

            // Re-renderizar la vista con los datos actualizados
            this.renderizar();

        } catch (error: any) {
            console.error('[RuntimeSql] Error en función:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en función "' + nombre + '"',
                text: error.message || 'Error desconocido'
            });
        }
    }

    private crearScope(params: any[], argumentos: any[]): Map<string, any> {
        const scope = new Map<string, any>();
        params.forEach((param: any, i: number) => {
            const nombre = param.nombre || ('param' + i);
            const valor  = argumentos[i] !== undefined ? argumentos[i] : null;
            scope.set(nombre, valor);
        });
        return scope;
    }

    // ─── Ejecutar sentencia del cuerpo de función ─────────────────────────
    // Devuelve true si se debe detener la ejecución (load de archivo)
    private async ejecutarSentencia(
        sentencia: any,
        scope: Map<string, any>
    ): Promise<boolean> {

        if (!sentencia?.tipo) return false;

        switch (sentencia.tipo) {

            // execute `tabla[col=$val] IN $id` — viene del parser .y
            case 'execute_dba': {
                const consultaResuelta = this.resolverVariables(sentencia.consulta || '', scope);
                const nodo = this.parsearConsultaDBA(consultaResuelta);
                if (!nodo) {
                    console.warn('[RuntimeSql] No se pudo parsear:', consultaResuelta);
                    return false;
                }
                try {
                    const sql = this.sql.nodoASQL(nodo);
                    if (sql) {
                        this.sql.ejecutarSQL(sql);
                        console.log('[RuntimeSql] DBA ejecutado:', sql);
                    }
                } catch (e: any) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error SQL',
                        text: e.message
                    });
                    return true; // detener ejecución
                }
                return false;
            }

            // load goTo / load "archivo.y"
            case 'load': {
                console.log('[RuntimeSql] load →', sentencia.destino);
                // load en función: simplemente re-renderizar
                // El archivo ya está cargado en memoria
                return true; // detener el resto de la función, renderizar al salir
            }

            default:
                console.warn('[RuntimeSql] Sentencia desconocida:', sentencia.tipo);
                return false;
        }
    }

    // ─── Resolver $variables del scope en el string de consulta ──────────
    // SIN regex — recorre carácter por carácter
    resolverVariables(consulta: string, scope: Map<string, any>): string {
        let resultado = '';
        let i = 0;

        while (i < consulta.length) {
            if (consulta[i] === '$') {
                let nombre = '';
                i++;
                while (i < consulta.length && this.esNombreVar(consulta[i])) {
                    nombre += consulta[i];
                    i++;
                }
                if (nombre.length > 0) {
                    const val = scope.get(nombre);
                    if (val !== null && val !== undefined) {
                        resultado += String(val);
                    } else {
                        resultado += '$' + nombre;
                    }
                } else {
                    resultado += '$';
                }
            } else {
                resultado += consulta[i];
                i++;
            }
        }

        return resultado;
    }

    private esNombreVar(c: string): boolean {
        const code = c.charCodeAt(0);
        return (code >= 48 && code <= 57)  ||
               (code >= 65 && code <= 90)  ||
               (code >= 97 && code <= 122) ||
               code === 95;
    }

    // ─── Parsear consulta DBA desde string → nodo para nodoASQL ──────────
    // Igual que en Principal.ts pero aquí usamos el scope del runtime
    parsearConsultaDBA(consulta: string): any | null {
        const s = consulta.trim();

        // SELECT: tabla.columna
        if (!this.contiene(s, '[') &&
            !this.contieneIgnoreCase(s, 'DELETE') &&
            !this.contieneIgnoreCase(s, 'TABLE')) {
            const punto = s.indexOf('.');
            if (punto !== -1) {
                return {
                    tipo:    'select',
                    tabla:   s.substring(0, punto).trim(),
                    columna: s.substring(punto + 1).trim()
                };
            }
        }

        // CREATE: TABLE nombre COLUMNS ...
        if (this.empiezaCon(s.toUpperCase(), 'TABLE')) {
            const sinTable = s.substring(5).trim();
            const idxCols  = this.indexOfIgnoreCase(sinTable, 'COLUMNS');
            if (idxCols !== -1) {
                const tabla   = sinTable.substring(0, idxCols).trim();
                const colsStr = sinTable.substring(idxCols + 7).trim();
                const columnas = this.parsearColumnas(colsStr);
                return { tipo: 'create', tabla, columnas };
            }
        }

        // DELETE: tabla DELETE id
        const idxDelete = this.indexOfIgnoreCase(s, ' DELETE ');
        if (idxDelete !== -1) {
            const tabla = s.substring(0, idxDelete).trim();
            const idStr = s.substring(idxDelete + 8).trim();
            const id    = parseInt(idStr);
            if (!isNaN(id)) return { tipo: 'delete', tabla, id };
        }

        // UPDATE: tabla[col=val, ...] IN id
        const cierreCorchete = s.lastIndexOf(']');
        const abreCorchete   = s.indexOf('[');
        if (abreCorchete !== -1 && cierreCorchete !== -1) {
            const tabla     = s.substring(0, abreCorchete).trim();
            const asignStr  = s.substring(abreCorchete + 1, cierreCorchete).trim();
            const resto     = s.substring(cierreCorchete + 1).trim();
            const idxIN     = this.indexOfIgnoreCase(resto, 'IN');

            if (idxIN !== -1) {
                // UPDATE
                const idStr  = resto.substring(idxIN + 2).trim();
                const id     = parseInt(idStr);
                if (!isNaN(id)) {
                    return {
                        tipo:    'update',
                        tabla,
                        valores: this.parsearAsignaciones(asignStr),
                        id
                    };
                }
            } else {
                // INSERT
                return {
                    tipo:    'insert',
                    tabla,
                    valores: this.parsearAsignaciones(asignStr)
                };
            }
        }

        return null;
    }

    // ─── Parsear "col=val, col2=val2" → [{ col, val }] ───────────────────
    private parsearAsignaciones(str: string): { col: string; val: any }[] {
        const resultado: { col: string; val: any }[] = [];
        const partes = this.dividirComas(str);

        for (const parte of partes) {
            const idx = parte.indexOf('=');
            if (idx === -1) continue;
            const col  = parte.substring(0, idx).trim();
            let   val: any = parte.substring(idx + 1).trim();

            // Quitar comillas si es string
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            } else if (val.length > 0 && !isNaN(Number(val))) {
                val = Number(val);
            }

            resultado.push({ col, val });
        }

        return resultado;
    }

    // Parsear columnas "col=tipo, col2=tipo2"
    private parsearColumnas(str: string): { nombre: string; tipo: string }[] {
        return this.dividirComas(str).map(c => {
            const idx = c.indexOf('=');
            if (idx === -1) return { nombre: c.trim(), tipo: 'string' };
            return {
                nombre: c.substring(0, idx).trim(),
                tipo:   c.substring(idx + 1).trim()
            };
        });
    }

    // ─── Helpers de string SIN regex ─────────────────────────────────────

    private contiene(s: string, sub: string): boolean {
        return s.indexOf(sub) !== -1;
    }

    private contieneIgnoreCase(s: string, sub: string): boolean {
        return s.toUpperCase().indexOf(sub.toUpperCase()) !== -1;
    }

    private empiezaCon(s: string, prefix: string): boolean {
        if (s.length < prefix.length) return false;
        for (let i = 0; i < prefix.length; i++) {
            if (s[i] !== prefix[i]) return false;
        }
        return true;
    }

    private indexOfIgnoreCase(s: string, sub: string): number {
        return s.toUpperCase().indexOf(sub.toUpperCase());
    }

    // Dividir por comas respetando comillas
    private dividirComas(str: string): string[] {
        const partes: string[] = [];
        let actual = '';
        let enComillas = false;
        let comillaChar = '';

        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (!enComillas && (c === '"' || c === "'")) {
                enComillas  = true;
                comillaChar = c;
                actual += c;
            } else if (enComillas && c === comillaChar) {
                enComillas = false;
                actual += c;
            } else if (!enComillas && c === ',') {
                partes.push(actual.trim());
                actual = '';
            } else {
                actual += c;
            }
        }
        if (actual.trim()) partes.push(actual.trim());
        return partes;
    }
}