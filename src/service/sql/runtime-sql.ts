import { SqliteService } from "./sqlite.service";
import Swal from 'sweetalert2';

export class RuntimeSql {

    private funciones = new Map<string, any>();

    constructor(
        private sql: SqliteService,
        private renderizar: () => void,
        private popup: Document
    ) { }

    registrarFuncion(funcion: any) {
        if (funcion?.nombre) {
            this.funciones.set(funcion.nombre, funcion);
            console.log('[RuntimeSql] Función registrada:', funcion.nombre);
        }
    }

    async llamarFuncion(nombre: string, argumentos: any[] = []) {
        const funcion = this.funciones.get(nombre);

        if (!funcion) {

            return;
        }

        try {
            const scope = this.crearScope(funcion.params || [], argumentos);

            for (const sentencia of (funcion.cuerpo || [])) {
                if (!sentencia) continue;
                const detener = await this.ejecutarSentencia(sentencia, scope);
                if (detener) break;
            }

            this.renderizar();

        } catch (error: any) {
            console.error('[RuntimeSql] Error en función:', error);

        }
    }

    private crearScope(params: any[], argumentos: any[]): Map<string, any> {
        const scope = new Map<string, any>();
        params.forEach((param: any, i: number) => {
            const nombre = param.nombre || ('param' + i);
            const valor = argumentos[i] !== undefined ? argumentos[i] : null;
            scope.set(nombre, valor);
        });
        return scope;
    }


    private async ejecutarSentencia(
        sentencia: any,
        scope: Map<string, any>
    ): Promise<boolean> {

        if (!sentencia?.tipo) return false;

        switch (sentencia.tipo) {


            case 'execute_fn':
            case 'execute_dba':
            case 'execute': {
                const consultaResuelta = this.resolverVariables(sentencia.consulta || '', scope);
                console.log('[RuntimeSql] Consulta resuelta:', consultaResuelta);
                const nodo = this.parsearConsultaDBA(consultaResuelta);
                if (!nodo) {
                    console.warn('[RuntimeSql] No se pudo parsear consulta DBA:', consultaResuelta);
                    this.mostrarSwalConRecargar(
                        '❌ Error: Consulta DBA inválida',
                        `No se pudo parsear la consulta DBA:\n\n<code>${this.escaparHTML(consultaResuelta)}</code>`,
                        'error'
                    );
                    return true;
                }
                try {
                    const sql = this.sql.nodoASQL(nodo);
                    if (sql) {
                        this.sql.ejecutarSQL(sql);
                        console.log('[RuntimeSql] DBA ejecutado OK:', sql);
                    }
                } catch (e: any) {
                    console.error('[RuntimeSql] Error ejecutando DBA:', e);
                    const errorMsg = e.message || 'Error desconocido en la base de datos';
                    const sqlMsg = e.toString ? e.toString() : '';
                    this.mostrarSwalConRecargar(
                        '❌ Error en la Base de Datos',
                        `<strong>Error:</strong> ${this.escaparHTML(errorMsg)}<br><br>
                         <strong>Consulta:</strong><br>
                         <code style="background: #f0f0f0; padding: 8px; display: block; margin-top: 8px; border-radius: 4px;">
                           ${this.escaparHTML(consultaResuelta)}
                         </code>`,
                        'error'
                    );
                    return true;
                }
                return false;
            }


            case 'load': {
                console.log('[RuntimeSql] load →', sentencia.destino);
                if (sentencia.esFuncion) {
                    const val = scope.get(sentencia.destino);
                    if (val) {
                        console.log('[RuntimeSql] load variable resuelto →', val);
                    }
                }
                return true;
            }

            default:
                console.warn('[RuntimeSql] Sentencia desconocida en función:', sentencia.tipo, sentencia);
                return false;
        }
    }


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
        return (code >= 48 && code <= 57) ||
            (code >= 65 && code <= 90) ||
            (code >= 97 && code <= 122) ||
            code === 95;
    }


    parsearConsultaDBA(consulta: string): any | null {
        const s = consulta.trim();

        if (!this.contiene(s, '[') &&
            !this.contieneIgnoreCase(s, 'DELETE') &&
            !this.contieneIgnoreCase(s, 'TABLE')) {
            const punto = s.indexOf('.');
            if (punto !== -1) {
                return {
                    tipo: 'select',
                    tabla: s.substring(0, punto).trim(),
                    columna: s.substring(punto + 1).trim()
                };
            }
        }
        if (this.contieneIgnoreCase(s.substring(0, 6), 'TABLE')) {
            const sinTable = s.substring(5).trim();
            const idxCols = this.indexOfIgnoreCase(sinTable, 'COLUMNS');
            if (idxCols !== -1) {
                const tabla = sinTable.substring(0, idxCols).trim();
                const colsStr = sinTable.substring(idxCols + 7).trim();
                const columnas = this.parsearColumnas(colsStr);
                return { tipo: 'create', tabla, columnas };
            }
        }

        if (this.empiezaCon(s.toUpperCase(), 'TABLE')) {
            const sinTable = s.substring(5).trim();
            const idxCols = this.indexOfIgnoreCase(sinTable, 'COLUMNS');
            if (idxCols !== -1) {
                const tabla = sinTable.substring(0, idxCols).trim();
                const colsStr = sinTable.substring(idxCols + 7).trim();
                const columnas = this.parsearColumnas(colsStr);
                return { tipo: 'create', tabla, columnas };
            }
        }

        const idxDelete = this.indexOfIgnoreCase(s, ' DELETE ');
        if (idxDelete !== -1) {
            const tabla = s.substring(0, idxDelete).trim();
            const idStr = s.substring(idxDelete + 8).trim();
            const id = parseInt(idStr);
            if (!isNaN(id)) return { tipo: 'delete', tabla, id };
        }

        const cierreCorchete = s.lastIndexOf(']');
        const abreCorchete = s.indexOf('[');
        if (abreCorchete !== -1 && cierreCorchete !== -1) {
            const tabla = s.substring(0, abreCorchete).trim();
            const asignStr = s.substring(abreCorchete + 1, cierreCorchete).trim();
            const resto = s.substring(cierreCorchete + 1).trim();
            const idxIN = this.indexOfIgnoreCase(resto, 'IN');

            if (idxIN !== -1) {
                const idStr = resto.substring(idxIN + 2).trim();
                const id = parseInt(idStr);
                if (!isNaN(id)) {
                    return {
                        tipo: 'update',
                        tabla,
                        valores: this.parsearAsignaciones(asignStr),
                        id
                    };
                }
            } else {
                return {
                    tipo: 'insert',
                    tabla,
                    valores: this.parsearAsignaciones(asignStr)
                };
            }
        }

        return null;
    }

    private parsearAsignaciones(str: string): { col: string; val: any }[] {
        const resultado: { col: string; val: any }[] = [];
        const partes = this.dividirComas(str);

        for (const parte of partes) {
            const idx = parte.indexOf('=');
            if (idx === -1) continue;
            const col = parte.substring(0, idx).trim();
            let val: any = parte.substring(idx + 1).trim();

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

    private parsearColumnas(str: string): { nombre: string; tipo: string }[] {
        return this.dividirComas(str).map(c => {
            const idx = c.indexOf('=');
            if (idx === -1) return { nombre: c.trim(), tipo: 'string' };
            return {
                nombre: c.substring(0, idx).trim(),
                tipo: c.substring(idx + 1).trim()
            };
        });
    }


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

    private dividirComas(str: string): string[] {
        const partes: string[] = [];
        let actual = '';
        let enComillas = false;
        let comillaChar = '';

        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (!enComillas && (c === '"' || c === "'")) {
                enComillas = true;
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

    private mostrarSwal(
        titulo: string,
        mensaje: string,
        icono: any = 'info'
    ): void {

        const popupSwal = Swal.mixin({
            target: this.popup.body
        });

        popupSwal.fire({
            title: titulo,
            text: mensaje,
            icon: icono
        });
    }

    private escaparHTML(texto: string): string {
        const map: any = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return texto.replace(/[&<>"']/g, (char: string) => map[char]);
    }

    private mostrarSwalConRecargar(
        titulo: string,
        mensaje: string,
        icono: any = 'info'
    ): void {
        try {
            const popupSwal = Swal.mixin({
                target: this.popup.body || document.body,
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            popupSwal.fire({
                title: titulo,
                html: `<div style="word-wrap: break-word; text-align: left;"><p>${mensaje}</p></div>`,
                icon: icono,
                confirmButtonText: '🔄 Recargar',
                confirmButtonColor: '#f38ba8'
            }).then(() => {
                if (this.popup && this.popup.defaultView) {
                    this.popup.defaultView.location.reload();
                } else {
                    window.location.reload();
                }
            });
        } catch (err: any) {
            console.error('[RuntimeSql] Error mostrando popup:', err);
            alert(titulo + '\n\n' + mensaje + '\n\nLa página se recargará al hacer clic en OK.');
            if (this.popup && this.popup.defaultView) {
                this.popup.defaultView.location.reload();
            } else {
                window.location.reload();
            }
        }
    }
}