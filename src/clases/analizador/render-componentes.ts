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

    // ─── Quitar comillas dobles de un string SIN regex ────────────────────
    private quitarComillas(valor: string): string {
        let resultado = '';
        for (let i = 0; i < valor.length; i++) {
            if (valor[i] !== '"') {
                resultado += valor[i];
            }
        }
        return resultado;
    }

    // ─── Resolver contenido de un nodo texto a string ─────────────────────
    // nodo.contenido puede ser: string, number, boolean, u objeto AST
    private resolverContenido(contenido: any): string {
        if (contenido === null || contenido === undefined) return '';

        // Ya es string limpio (STRING_LIT ya procesado por la gramática)
        if (typeof contenido === 'string') {
            return this.quitarComillas(contenido);
        }

        // Número o booleano: convertir directo
        if (typeof contenido === 'number' || typeof contenido === 'boolean') {
            return String(contenido);
        }

        // Es un nodo de expresión del AST
        if (typeof contenido === 'object') {
            return this.evaluarExpresionATexto(contenido);
        }

        return '';
    }

    // ─── Evalúa un nodo expresión del AST y devuelve string ───────────────
    private evaluarExpresionATexto(nodo: any): string {
        if (nodo === null || nodo === undefined) return '';

        // Variable: { tipo:'var', nombre:'x' }
        if (nodo.tipo === 'var') {
            const val = this.tabla.get(nodo.nombre);
            if (val === undefined || val === null) return '';
            return String(val);
        }

        // Identificador: { tipo:'ident', nombre:'x' }
        if (nodo.tipo === 'ident') {
            const val = this.tabla.get(nodo.nombre);
            if (val === undefined || val === null) return nodo.nombre;
            return String(val);
        }

        // Acceso a array: { tipo:'array_acc', nombre:'arr', indice: expr }
        if (nodo.tipo === 'array_acc') {
            const arr = this.tabla.get(nodo.nombre);
            const idx = this.evaluador.evaluar(nodo.indice);
            if (Array.isArray(arr) && idx !== undefined) {
                const val = arr[idx];
                return val !== undefined && val !== null ? String(val) : '';
            }
            return '';
        }

        // Operación con izq y der: +, -, *, /, %
        if (nodo.op !== undefined && nodo.izq !== undefined && nodo.der !== undefined) {
            const izqStr = this.evaluarExpresionATexto(nodo.izq);
            const derStr = this.evaluarExpresionATexto(nodo.der);

            // Suma / concatenación
            if (nodo.op === '+') {
                // Intentar suma numérica primero
                const izqNum = Number(izqStr);
                const derNum = Number(derStr);
                if (!isNaN(izqNum) && !isNaN(derNum)) {
                    return String(izqNum + derNum);
                }
                // Si alguno no es número → concatenar como texto
                return izqStr + derStr;
            }

            // Operaciones puramente numéricas
            const a = Number(izqStr);
            const b = Number(derStr);
            if (!isNaN(a) && !isNaN(b)) {
                if (nodo.op === '-') return String(a - b);
                if (nodo.op === '*') return String(a * b);
                if (nodo.op === '/') return b !== 0 ? String(a / b) : 'ERR:DIV/0';
                if (nodo.op === '%') return String(a % b);
            }

            // Fallback: devolver como texto legible
            return izqStr + ' ' + nodo.op + ' ' + derStr;
        }

        // Negación unaria: { op:'neg', val: expr }
        if (nodo.op === 'neg' && nodo.val !== undefined) {
            const v = Number(this.evaluarExpresionATexto(nodo.val));
            return isNaN(v) ? '-' + this.evaluarExpresionATexto(nodo.val) : String(-v);
        }

        // Primitivo que llegó envuelto en objeto (por si acaso)
        if (typeof nodo === 'string')  return this.quitarComillas(nodo);
        if (typeof nodo === 'number')  return String(nodo);
        if (typeof nodo === 'boolean') return String(nodo);

        return '';
    }


    // ─── Invocar componente ───────────────────────────────────────────────
    invocar(nodo: any): string {
        const comp = this.componentes.get(nodo.nombre);
        if (!comp) {
            console.warn('[Render] Componente no encontrado:', nodo.nombre);
            return '<!-- componente no encontrado: ' + nodo.nombre + ' -->';
        }

        const scopeAnterior = this.tabla.clonar();

        const params: any[] = comp.params || [];
        const args: any[]   = nodo.args   || [];
        params.forEach((param: any, i: number) => {
            const valorArg = args[i] !== undefined
                ? this.evaluador.evaluar(args[i])
                : null;
            this.tabla.set(param.nombre, param.tipo, valorArg);
        });

        const html = this.renderElementos(comp.elementos || []);
        this.tabla.restaurar(scopeAnterior);

        return '<div class="comp-' + nodo.nombre + '">' + html + '</div>';
    }


    // ─── Render lista de elementos ────────────────────────────────────────
    renderElementos(elementos: any[]): string {
        if (!Array.isArray(elementos)) return '';
        return elementos.map(e => this.renderElemento(e)).join('');
    }


    private renderElemento(nodo: any): string {
        if (!nodo) return '';
        switch (nodo.tipo) {
            case 'seccion':   return this.renderSeccion(nodo);
            case 'tabla':     return this.renderTabla(nodo);
            case 'texto':     return this.renderTexto(nodo);
            case 'imagen':    return this.renderImagen(nodo);
            case 'form':      return this.renderForm(nodo);
            case 'for_each':
            case 'for':       return this.renderFor(nodo);
            case 'if':        return this.renderIf(nodo);
            case 'switch':    return this.renderSwitch(nodo);
            default:
                console.warn('[Render] Elemento desconocido:', nodo.tipo);
                return '';
        }
    }


    // ─── Sección ──────────────────────────────────────────────────────────
    private renderSeccion(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const hijos  = this.renderElementos(nodo.hijos || []);
        return clases
            ? '<div class="' + clases + '">' + hijos + '</div>'
            : '<div>' + hijos + '</div>';
    }


    // ─── Tabla ────────────────────────────────────────────────────────────
    private renderTabla(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const filasHTML = (nodo.filas || []).map((fila: any) => {
            const celdasHTML = (fila.celdas || []).map((celda: any) =>
                '<td style="border:1px solid #ccc;padding:6px;">' +
                this.renderElementos(celda.contenido || []) +
                '</td>'
            ).join('');
            return '<tr>' + celdasHTML + '</tr>';
        }).join('');

        const atributos = clases ? ' class="' + clases + '"' : '';
        return '<table' + atributos + ' style="border-collapse:collapse;width:100%">' +
               filasHTML + '</table>';
    }


    // ─── Texto  ← AQUÍ ESTABA EL BUG ─────────────────────────────────────
    // Antes: evaluador.interpolarTexto(nodo.contenido) donde contenido podía
    // ser un objeto AST { op:'+', izq:..., der:... } y reventaba con
    // "texto.replace is not a function"
    private renderTexto(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);

        // 1. Resolver el contenido (string, número, bool u objeto AST)
        const textoResuelto = this.resolverContenido(nodo.contenido);

        // 2. Interpolar variables $var que queden como texto (ej: en STRING_LIT)
        const textoFinal = this.evaluador.interpolarTexto(textoResuelto);

        return clases
            ? '<p class="' + clases + '">' + textoFinal + '</p>'
            : '<p>' + textoFinal + '</p>';
    }


    // ─── Imagen ───────────────────────────────────────────────────────────
    private renderImagen(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const urls   = this.resolverUrls(nodo.urls || []);

        if (urls.length === 0) return '';

        if (urls.length === 1) {
            const cls = clases ? ' class="' + clases + '"' : '';
            return '<img src="' + urls[0] + '"' + cls + ' style="max-width:100%" />';
        }

        // Carrusel Bootstrap
        const id    = 'car-' + this.generarId();
        const items = urls.map((url, i) =>
            '<div class="carousel-item' + (i === 0 ? ' active' : '') + '">' +
            '<img src="' + url + '" style="width:100%;max-height:400px;object-fit:cover" />' +
            '</div>'
        ).join('');

        const claseExtra = clases ? ' ' + clases : '';
        return '<div id="' + id + '" class="carousel slide' + claseExtra + '" data-bs-ride="carousel">' +
            '<div class="carousel-inner">' + items + '</div>' +
            '<button class="carousel-control-prev" type="button" data-bs-target="#' + id + '" data-bs-slide="prev">' +
            '<span class="carousel-control-prev-icon"></span></button>' +
            '<button class="carousel-control-next" type="button" data-bs-target="#' + id + '" data-bs-slide="next">' +
            '<span class="carousel-control-next-icon"></span></button>' +
            '</div>';
    }

    // Genera un id corto sin Math.random ni toString(36) para mantenerlo simple
    private generarId(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }


    // ─── Formulario ───────────────────────────────────────────────────────
    private renderForm(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const inputs = (nodo.inputs || []).map((i: any) => this.renderInput(i)).join('');
        const submit = nodo.submit ? this.renderSubmit(nodo.submit) : '';
        const cls    = clases ? ' class="' + clases + '"' : '';
        return '<form' + cls + ' onsubmit="return false">' + inputs + submit + '</form>';
    }

    private renderInput(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const props  = nodo.props || {};

        // id y label siempre son strings simples (ya procesados por la gramática)
        const id    = this.quitarComillas(String(props.id    || ''));
        const label = this.quitarComillas(String(props.label || ''));

        // value puede ser string, número, booleano o variable
        const valueRaw   = props.value !== undefined ? props.value : '';
        const valueStr   = this.quitarComillas(String(valueRaw));
        const valueEval  = this.evaluador.interpolarTexto(valueStr);

        const claseInput = clases ? ' ' + clases : '';

        switch (nodo.tipo) {
            case 'input_text':
                return '<div class="mb-2">' +
                    '<label for="' + id + '">' + label + '</label>' +
                    '<input type="text" id="' + id + '" name="' + id + '" value="' + valueEval + '"' +
                    ' class="form-control' + claseInput + '" />' +
                    '</div>';

            case 'input_number':
                return '<div class="mb-2">' +
                    '<label for="' + id + '">' + label + '</label>' +
                    '<input type="number" id="' + id + '" name="' + id + '" value="' + valueEval + '"' +
                    ' class="form-control' + claseInput + '" />' +
                    '</div>';

            case 'input_bool': {
                const checked = valueEval === 'true' ? ' checked' : '';
                return '<div class="mb-2 form-check">' +
                    '<input type="checkbox" id="' + id + '" name="' + id + '"' +
                    ' class="form-check-input' + claseInput + '"' + checked + ' />' +
                    '<label class="form-check-label" for="' + id + '">' + label + '</label>' +
                    '</div>';
            }

            default: return '';
        }
    }

    private renderSubmit(nodo: any): string {
        const clases = this.resolverClases(nodo.estilos);
        const label  = nodo.props?.label
            ? this.quitarComillas(String(nodo.props.label))
            : 'Enviar';
        const cls = clases ? ' ' + clases : '';
        return '<button type="submit" class="btn btn-primary' + cls + '">' + label + '</button>';
    }


    // ─── For / For each ───────────────────────────────────────────────────
    private renderFor(nodo: any): string {
        // Resolver el nombre del array — puede venir como string '$arr' u objeto
        let nombreArray: string;
        if (typeof nodo.array === 'string') {
            // Quitar el $ inicial si existe
            nombreArray = nodo.array.startsWith('$')
                ? nodo.array.substring(1)
                : nodo.array;
        } else if (nodo.array && nodo.array.tipo === 'var') {
            nombreArray = nodo.array.nombre;
        } else if (nodo.array && nodo.array.tipo === 'ident') {
            nombreArray = nodo.array.nombre;
        } else {
            nombreArray = String(nodo.array || nodo.arrays?.[0] || '');
            if (nombreArray.startsWith('$')) nombreArray = nombreArray.substring(1);
        }

        const array = this.tabla.get(nombreArray);

        if (!Array.isArray(array) || array.length === 0) {
            return nodo.vacio ? this.renderElementos(nodo.vacio) : '';
        }

        // Resolver nombre de la variable iteradora
        let itemKey: string;
        if (typeof nodo.item === 'string') {
            itemKey = nodo.item.startsWith('$')
                ? nodo.item.substring(1)
                : nodo.item;
        } else {
            itemKey = String(nodo.item || nodo.items?.[0] || 'item');
            if (itemKey.startsWith('$')) itemKey = itemKey.substring(1);
        }

        let html = '';
        array.forEach((item: any, index: number) => {
            this.tabla.set(itemKey, 'auto', item);
            if (nodo.track) {
                const trackKey = nodo.track.startsWith('$')
                    ? nodo.track.substring(1)
                    : nodo.track;
                this.tabla.set(trackKey, 'int', index);
            }
            html += this.renderElementos(nodo.cuerpo || []);
        });
        return html;
    }


    // ─── If ───────────────────────────────────────────────────────────────
    private renderIf(nodo: any): string {
        // Soportar tanto nodo.cond como nodo.condicion (según la gramática)
        const condicion = nodo.condicion !== undefined ? nodo.condicion : nodo.cond;
        const entonces  = nodo.entonces  !== undefined ? nodo.entonces  : nodo.then;

        if (this.evaluador.evaluar(condicion)) {
            return this.renderElementos(entonces || []);
        }

        // Ramas else if
        for (const rama of (nodo.sino_si || nodo.ramas || [])) {
            const condRama = rama.condicion !== undefined ? rama.condicion : rama.cond;
            if (rama.tipo === 'else_if' && this.evaluador.evaluar(condRama)) {
                return this.renderElementos(rama.cuerpo || []);
            }
        }

        // Else final
        const sino = nodo.sino !== undefined ? nodo.sino : null;
        if (sino) return this.renderElementos(sino);

        // Buscar rama tipo 'else' en el array
        const ramaElse = (nodo.sino_si || nodo.ramas || [])
            .find((r: any) => r.tipo === 'else');
        if (ramaElse) return this.renderElementos(ramaElse.cuerpo || []);

        return '';
    }


    // ─── Switch ───────────────────────────────────────────────────────────
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


    // ─── Helpers ──────────────────────────────────────────────────────────
    private resolverClases(estilos: any): string {
        if (!Array.isArray(estilos)) return '';
        return estilos.join(' ');
    }

    private resolverUrls(urls: any[]): string[] {
        const resultado: string[] = [];
        for (const u of urls) {
            if (typeof u === 'string') {
                const limpia = this.quitarComillas(u);
                if (limpia) resultado.push(limpia);
                continue;
            }
            if (u && u.tipo === 'var') {
                const val = this.tabla.get(u.nombre);
                const s   = this.quitarComillas(String(val ?? ''));
                if (s) resultado.push(s);
                continue;
            }
            if (u && u.tipo === 'array_acc') {
                const arr = this.tabla.get(u.nombre);
                const idx = this.evaluador.evaluar(u.indice);
                if (Array.isArray(arr) && idx !== undefined) {
                    const s = this.quitarComillas(String(arr[idx] ?? ''));
                    if (s) resultado.push(s);
                }
                continue;
            }
        }
        return resultado;
    }
}