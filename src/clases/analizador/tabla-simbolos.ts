import { SimboloEntrada } from "../../models/simbolo-entrada";


export class TablaSimbolos {

    private tabla: Map<string, SimboloEntrada> = new Map();

    set(nombre: string, tipo: string, valor: any): void {
        this.tabla.set(nombre, { tipo, valor });
    }

    get(nombre: string): any {
        return this.tabla.get(nombre)?.valor ?? null;
    }

    getEntrada(nombre: string): SimboloEntrada | undefined {
        return this.tabla.get(nombre);
    }

    existe(nombre: string): boolean {
        return this.tabla.has(nombre);
    }

    eliminar(nombre: string): void {
        this.tabla.delete(nombre);
    }

    limpiar(): void {
        this.tabla.clear();
    }

    clonar(): Map<string, SimboloEntrada> {
        return new Map(this.tabla);
    }

    restaurar(copia: Map<string, SimboloEntrada>): void {
        this.tabla = copia;
    }

    debug(): void {
        console.table(Object.fromEntries(this.tabla));
    }
}