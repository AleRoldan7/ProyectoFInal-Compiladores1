export class TraductorHTML {

    renderTexto(valor: string) {
        return `<p>${valor.replace(/"/g, '')}<p>`;
    }

    renderComponente(nombre: string, contenido: string): string {
        return `<div class="${nombre}">\n${contenido}\n</div>`;
    }

    renderInvocacion(nombre: string): string {
        return `<!-- componente ${nombre} -->`;
    }

    renderWhile(contenido: string): string {
        return contenido;
    }

    renderIf(cond: boolean, thenHTML: string, elseHTML: string = ''): string {
        return cond ? thenHTML : elseHTML;
    }
}