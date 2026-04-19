import { TraductorHTML } from "./traductor";

export class Interprte {

    private traductor = new TraductorHTML();
    private componentes: any = {};

    ejecutar(ast: any): string {

        // guardar componentes
        ast.declaraciones.forEach((dec: any) => {
            if (dec.tipo === 'funcion') {
                this.componentes[dec.nombre] = dec;
            }
        });

        // ejecutar main
        return this.ejecutarMain(ast.main);
    }

    private ejecutarMain(main: any): string {
        return this.recorrer(main.instrucciones);
    }

    private recorrer(lista: any[]): string {
        let html = '';

        for (const nodo of lista) {
            html += this.ejecutarNodo(nodo);
        }

        return html;
    }

    private ejecutarNodo(nodo: any): string {

        switch (nodo.tipo) {

            case 'invoke':
                return this.ejecutarComponente(nodo.nombre);

            case 'while':
                // simulación básica (solo 1 iteración)
                return this.traductor.renderWhile(
                    this.recorrer(nodo.cuerpo)
                );

            case 'if':
                return this.traductor.renderIf(
                    true,
                    this.recorrer(nodo.then),
                    nodo.ramas?.length ? this.recorrer(nodo.ramas[0].cuerpo) : ''
                );

            default:
                return '';
        }
    }

    private ejecutarComponente(nombre: string): string {

        const comp = this.componentes[nombre];

        if (!comp) return `<p>Componente ${nombre} no encontrado</p>`;

        let contenido = '';

        comp.cuerpo.forEach((inst: any) => {

            if (inst.tipo === 'execute') {
                contenido += this.traductor.renderTexto(inst.query);
            }

            if (inst.tipo === 'load') {
                contenido += `<p>Load: ${inst.target}</p>`;
            }

        });

        return this.traductor.renderComponente(nombre, contenido);
    }
}