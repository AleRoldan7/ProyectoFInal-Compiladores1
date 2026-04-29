import { TablaSimbolos } from './tabla-simbolos';
import { Evaluador } from './evaluador';
import { AnalizadorEstilos } from './analizador-estilos';

export class RenderizadorComponentes {

    constructor(
        private tabla: TablaSimbolos,
        private evaluador: Evaluador,
        private estilosProcesador: AnalizadorEstilos,
        private componentes: Map<string, any>
    ) { }


    invocar(nodo: any): string {
        const comp = this.componentes.get(nodo.nombre);
        if (!comp) {
            console.warn('[Render] Componente no encontrado:', nodo.nombre);
            return `<!-- componente no encontrado: ${nodo.nombre} -->`;
        }

        const scopeAnterior = this.tabla.clonar();

        const params: any[] = comp.params || [];
        const args: any[] = nodo.args || [];
        params.forEach((param: any, i: number) => {
            const valorArg = args[i] !== undefined
                ? this.evaluador.evaluar(args[i])
                : null;
            this.tabla.set(param.nombre, param.tipo, valorArg);
        });

        const html = this.renderElementos(comp.elementos || []);

        this.tabla.restaurar(scopeAnterior);

        return `<div class="comp-${nodo.nombre}">${html}</div>`;
    }


    renderElementos(elementos: any[]): string {
        if (!Array.isArray(elementos)) return '';
        return elementos.map(e => this.renderElemento(e)).join('');
    }


    private renderElemento(nodo: any): string {
        if (!nodo) return '';
        switch (nodo.tipo) {
            case 'seccion': return this.renderSeccion(nodo);
            case 'tabla': return this.renderTabla(nodo);
            case 'texto': return this.renderTexto(nodo);
            case 'imagen': return this.renderImagen(nodo);
            case 'form': return this.renderForm(nodo);
            case 'for_each':
            case 'for': return this.renderFor(nodo);
            case 'if': return this.renderIf(nodo);
            case 'switch': return this.renderSwitch(nodo);
            default:
                console.warn('[Render] Elemento desconocido:', nodo.tipo);
                return '';
        }
    }



    private renderSeccion(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const hijos = this.renderElementos(nodo.hijos || []);
        return `<div${clases ? ` class="${clases}"` : ''}>${hijos}</div>`;
    }



    private renderTabla(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const filasHTML = (nodo.filas || []).map((fila: any) => {
            const celdasHTML = (fila.celdas || []).map((celda: any) =>
                `<td style="border:1px solid #ccc;padding:6px;">
          ${this.renderElementos(celda.contenido || [])}
        </td>`
            ).join('');
            return `<tr>${celdasHTML}</tr>`;
        }).join('');
        return `<table${clases ? ` class="${clases}"` : ''}
      style="border-collapse:collapse;width:100%">${filasHTML}</table>`;
    }



    private renderTexto(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const texto = this.evaluador.interpolarTexto(nodo.contenido || '');
        return `<p${clases ? ` class="${clases}"` : ''}>${texto}</p>`;
    }

    private renderImagen(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const urls = this.resolverUrls(nodo.urls || []);

        if (urls.length === 1) {
            return `<img src="${urls[0]}"${clases ? ` class="${clases}"` : ''}
        style="max-width:100%" />`;
        }

        const id = `car-${Math.random().toString(36).slice(2, 8)}`;
        const items = urls.map((url, i) => `
      <div class="carousel-item${i === 0 ? ' active' : ''}">
        <img src="${url}" style="width:100%;max-height:400px;object-fit:cover" />
      </div>`).join('');

        return `
      <div id="${id}" class="carousel slide${clases ? ' ' + clases : ''}"
        data-bs-ride="carousel">
        <div class="carousel-inner">${items}</div>
        <button class="carousel-control-prev" type="button"
          data-bs-target="#${id}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon"></span>
        </button>
        <button class="carousel-control-next" type="button"
          data-bs-target="#${id}" data-bs-slide="next">
          <span class="carousel-control-next-icon"></span>
        </button>
      </div>`;
    }


    private renderForm(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const inputs = (nodo.inputs || []).map((i: any) => this.renderInput(i)).join('');
        const submit = nodo.submit ? this.renderSubmit(nodo.submit) : '';
        return `<form${clases ? ` class="${clases}"` : ''} onsubmit="return false">
      ${inputs}${submit}
    </form>`;
    }

    private renderInput(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const props = nodo.props || {};
        const id = String(props.id || '').replace(/"/g, '');
        const label = String(props.label || '').replace(/"/g, '');
        const value = this.evaluador.interpolarTexto(
            String(props.value ?? '').replace(/"/g, '')
        );

        switch (nodo.tipo) {
            case 'input_text':
                return `<div class="mb-2">
          <label for="${id}">${label}</label>
          <input type="text" id="${id}" name="${id}" value="${value}"
            class="form-control${clases ? ' ' + clases : ''}" />
        </div>`;

            case 'input_number':
                return `<div class="mb-2">
          <label for="${id}">${label}</label>
          <input type="number" id="${id}" name="${id}" value="${value}"
            class="form-control${clases ? ' ' + clases : ''}" />
        </div>`;

            case 'input_bool':
                return `<div class="mb-2 form-check">
          <input type="checkbox" id="${id}" name="${id}"
            class="form-check-input${clases ? ' ' + clases : ''}"
            ${value === 'true' ? 'checked' : ''} />
          <label class="form-check-label" for="${id}">${label}</label>
        </div>`;

            default: return '';
        }
    }

    private renderSubmit(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const label = nodo.props?.label || 'Enviar';
        return `<button type="submit"
      class="btn btn-primary${clases ? ' ' + clases : ''}">${label}</button>`;
    }


    private renderFor(nodo: any): string {
        const nombreArray = (nodo.array || nodo.arrays?.[0] || '').replace('$', '');
        const array = this.tabla.get(nombreArray);

        if (!Array.isArray(array) || array.length === 0) {
            return nodo.vacio ? this.renderElementos(nodo.vacio) : '';
        }

        let html = '';
        array.forEach((item: any, index: number) => {
            const itemKey = (nodo.item || nodo.items?.[0] || '$item').replace('$', '');
            this.tabla.set(itemKey, 'auto', item);

            if (nodo.track) {
                this.tabla.set(nodo.track.replace('$', ''), 'int', index);
            }

            html += this.renderElementos(nodo.cuerpo || []);
        });
        return html;
    }

    private renderIf(nodo: any): string {
        if (this.evaluador.evaluar(nodo.cond)) {
            return this.renderElementos(nodo.then || []);
        }

        for (const rama of (nodo.ramas || [])) {
            if (rama.tipo === 'else_if' && this.evaluador.evaluar(rama.cond)) {
                return this.renderElementos(rama.cuerpo || []);
            }
            if (rama.tipo === 'else') {
                return this.renderElementos(rama.cuerpo || []);
            }
        }
        return '';
    }



    private renderSwitch(nodo: any): string {
        const val = this.evaluador.evaluar(nodo.expr);

        for (const caso of (nodo.casos || [])) {
            if (caso.valor === 'default') continue;
            if (caso.valor == val) return this.renderElementos(caso.cuerpo || []);
        }

        const def = (nodo.casos || []).find((c: any) => c.valor === 'default');
        if (def) return this.renderElementos(def.cuerpo || []);
        return '';
    }


    private resolverClases(estilos: any): string {
        if (!Array.isArray(estilos)) return '';
        return estilos.join(' ');
    }


    private resolverUrls(urls: any[]): string[] {
        return urls.map((u: any) => {
            if (typeof u === 'string') return u.replace(/"/g, '');
            if (u.tipo === 'var') {
                return String(this.tabla.get(u.nombre) ?? '').replace(/"/g, '');
            }
            if (u.tipo === 'array_acc') {
                const arr = this.tabla.get(u.nombre);
                const idx = this.evaluador.evaluar(u.indice);
                return Array.isArray(arr) ? String(arr[idx] ?? '').replace(/"/g, '') : '';
            }
            return '';
        }).filter(Boolean);
    }
}