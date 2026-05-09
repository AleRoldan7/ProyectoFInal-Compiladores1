import { ManejoErrores } from './errores';


type TipoDato = 'int' | 'float' | 'string' | 'boolean' | 'char' | 'function' | 'desconocido';

interface InfoVariable {
    nombre: string;
    tipo: TipoDato;
    esArray: boolean;
    linea: number;
    col: number;
}

interface InfoFuncion {
    nombre: string;
    params: { tipo: TipoDato; nombre: string }[];
    linea: number;
    col: number;
}

interface InfoComponente {
    nombre: string;
    params: { tipo: TipoDato; nombre: string }[];
}

class TablaSimbolos {
    private ambitos: Array<Map<string, InfoVariable>> = [];
    private ambito_actual = 'global';

    constructor() {
        this.ambitos.push(new Map());
    }

    entrar(nombre: string) {
        this.ambito_actual = nombre;
        this.ambitos.push(new Map());
    }

    salir() {
        this.ambitos.pop();
        this.ambito_actual = 'global';
    }

    declarar(info: InfoVariable): boolean {
        const tabla = this.ambitos[this.ambitos.length - 1];
        if (tabla.has(info.nombre)) return false;
        tabla.set(info.nombre, info);
        return true;
    }

    buscar(nombre: string): InfoVariable | null {
        for (let i = this.ambitos.length - 1; i >= 0; i--) {
            if (this.ambitos[i].has(nombre)) return this.ambitos[i].get(nombre)!;
        }
        return null;
    }

    ambito() { return this.ambito_actual; }
}


export class AnalizadorSemantico {

    private err: ManejoErrores;
    private simbolos: TablaSimbolos = new TablaSimbolos();
    private funciones: Map<string, InfoFuncion> = new Map();
    private componentes: Map<string, InfoComponente> = new Map();

    private readonly TIPOS_NUMERICOS = new Set<TipoDato>(['int', 'float']);

    private readonly PROPS_NO_NEGATIVAS = new Set([
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
        'border-width', 'border-radius',
    ]);

    constructor(manejador: ManejoErrores) {
        this.err = manejador;
    }

    analizar(ast: any, componentesImportados: InfoComponente[] = []): void {
        if (!ast) return;

        componentesImportados.forEach(c => this.componentes.set(c.nombre, c));
        this.registrarFunciones(ast.declaraciones ?? []);

        this.analizarImports(ast.imports ?? []);

        this.analizarDeclaraciones(ast.declaraciones ?? []);

        this.simbolos.entrar('main');
        this.analizarInstrucciones(ast.main ?? [], false);
        this.simbolos.salir();
    }


    private analizarImports(imports: any[]) {
        const vistos = new Set<string>();
        for (const imp of imports) {
            if (!imp?.path) continue;
            const ruta: string = imp.path;

            if (!ruta.endsWith('.comp') && !ruta.endsWith('.styles')) {
                this.err.errorImportExtensionInvalida(ruta, imp.linea ?? 0, imp.col ?? 0);
            }
            if (vistos.has(ruta)) {
                this.err.errorSintactico(ruta, imp.linea ?? 0, imp.col ?? 0,
                    `Import duplicado: '${ruta}' ya fue importado`);
            }
            vistos.add(ruta);
        }
    }

    private registrarFunciones(decls: any[]) {
        for (const d of decls) {
            if (d?.tipo !== 'funcion') continue;
            const info: InfoFuncion = {
                nombre: d.nombre,
                params: (d.params ?? []).map((p: any) => ({
                    tipo: (p.tipo ?? 'desconocido') as TipoDato,
                    nombre: p.nombre,
                })),
                linea: d.linea ?? 0,
                col: d.col ?? 0,
            };
            if (this.funciones.has(d.nombre)) {
                this.err.errorVariableYaDeclarada(d.nombre, d.linea ?? 0, d.col ?? 0);
            } else {
                this.funciones.set(d.nombre, info);
            }
        }
    }


    private analizarDeclaraciones(decls: any[]) {
        for (const d of decls) {
            if (!d) continue;
            switch (d.tipo) {
                case 'declaracion': this.analizarDeclaracionVar(d, false); break;
                case 'declaracion_array': this.analizarDeclaracionArray(d); break;
                case 'declaracion_execute': this.analizarDeclaracionExecute(d, true); break;
                case 'funcion': this.analizarFuncion(d); break;
            }
        }
    }


    private analizarDeclaracionVar(d: any, enMain: boolean) {
        const tipo = (d.tipo_dato ?? 'desconocido') as TipoDato;
        const nombre: string = d.nombre;
        const linea = d.linea ?? 0;
        const col = d.col ?? 0;

        const ok = this.simbolos.declarar({ nombre, tipo, esArray: false, linea, col });
        if (!ok) this.err.errorVariableYaDeclarada(nombre, linea, col);

        if (d.valor !== null && d.valor !== undefined) {
            const tipoValor = this.tipoExpresion(d.valor, linea, col);

            if (tipoValor !== 'desconocido' && !this.tiposCompatibles(tipo, tipoValor)) {
                this.err.errorTipoIncompatible(tipo, tipoValor, linea, col);
            }

            if (tipo === 'char') {
                const val = d.valor;
                if (typeof val === 'string' && val.length !== 1) {
                    this.err.errorCaracterMultiple(val, linea, col);
                }
            }

            this.verificarNegativo(d.valor, tipo, linea, col);
        }
    }


    private analizarDeclaracionArray(d: any) {
        const tipo = (d.tipo_dato ?? 'desconocido') as TipoDato;
        const nombre: string = d.nombre;
        const linea = d.linea ?? 0;
        const col = d.col ?? 0;

        const ok = this.simbolos.declarar({ nombre, tipo, esArray: true, linea, col });
        if (!ok) this.err.errorVariableYaDeclarada(nombre, linea, col);

        if (d.tamano !== null && d.tamano !== undefined) {
            if (typeof d.tamano === 'number' && d.tamano <= 0) {
                this.err.errorSintactico(nombre, linea, col,
                    `El tamaño del arreglo '${nombre}' debe ser un entero positivo, se recibió: ${d.tamano}`);
            }
        }

        if (Array.isArray(d.valor)) {
            for (const elem of d.valor) {
                const te = this.tipoExpresion(elem, linea, col);
                if (te !== 'desconocido' && !this.tiposCompatibles(tipo, te)) {
                    this.err.errorTipoIncompatible(tipo, te, linea, col);
                }
                this.verificarNegativo(elem, tipo, linea, col);
            }
        }
    }


    private analizarDeclaracionExecute(d: any, esGlobal: boolean) {
        const tipo = (d.tipo_dato ?? 'desconocido') as TipoDato;
        const nombre: string = d.nombre;
        const linea = d.linea ?? 0;
        const col = d.col ?? 0;

        const ok = this.simbolos.declarar({ nombre, tipo, esArray: true, linea, col });
        if (!ok) this.err.errorVariableYaDeclarada(nombre, linea, col);

        const consulta: string = (d.consulta ?? '').replace(/^`|`$/g, '').trim();
        this.validarConsultaExecute(consulta, linea, col, 'declaracion');
    }


    private analizarFuncion(d: any) {
        const nombre: string = d.nombre;
        const linea = d.linea ?? 0;
        const col = d.col ?? 0;

        this.simbolos.entrar(`funcion:${nombre}`);

        for (const p of (d.params ?? [])) {
            const tipo = (p.tipo ?? 'desconocido') as TipoDato;
            this.simbolos.declarar({
                nombre: p.nombre,
                tipo,
                esArray: false,
                linea, col,
            });
        }

        for (const inst of (d.cuerpo ?? [])) {
            if (!inst) continue;
            if (inst.tipo === 'execute_fn') {
                const consulta = (inst.consulta ?? '').replace(/^`|`$/g, '').trim();
                this.validarConsultaExecute(consulta, linea, col, 'funcion');
                this.validarVariablesEnConsulta(consulta, linea, col);
            }
        }

        this.simbolos.salir();
    }


    private analizarInstrucciones(instrucciones: any[], enFuncion: boolean) {
        for (const inst of instrucciones) {
            if (!inst) continue;
            this.analizarInstruccion(inst, enFuncion);
        }
    }

    private analizarInstruccion(inst: any, enFuncion: boolean) {
        switch (inst.tipo) {
            case 'declaracion':
                this.analizarDeclaracionVar(inst, true);
                break;

            case 'declaracion_array':
                this.analizarDeclaracionArray(inst);
                break;

            case 'declaracion_execute':
                this.analizarDeclaracionExecute(inst, false);
                break;

            case 'execute_fn': {
                const consulta = (inst.consulta ?? '').replace(/^`|`$/g, '').trim();
                this.validarConsultaExecute(consulta, inst.linea ?? 0, inst.col ?? 0, 'main');
                break;
            }

            case 'asignacion':
                this.analizarAsignacion(inst);
                break;

            case 'asignacion_array':
                this.analizarAsignacionArray(inst);
                break;

            case 'invocacion':
                this.analizarInvocacion(inst);
                break;

            case 'while':
                this.analizarWhile(inst);
                break;

            case 'do_while':
                this.analizarDoWhile(inst);
                break;

            case 'for':
                this.analizarFor(inst);
                break;

            case 'if':
                this.analizarIf(inst);
                break;

            case 'switch':
                this.analizarSwitch(inst);
                break;
        }
    }

    private analizarAsignacion(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;
        const nombre: string = inst.nombre;

        const info = this.simbolos.buscar(nombre);
        if (!info) {
            this.err.errorVariableNoDeclarada(nombre, linea, col);
            return;
        }
        if (info.esArray) {
            this.err.errorSintactico(nombre, linea, col,
                `'${nombre}' es un arreglo; para asignar un elemento use ${nombre}[i] = valor`);
            return;
        }

        const tipoValor = this.tipoExpresion(inst.valor, linea, col);
        if (tipoValor !== 'desconocido' && !this.tiposCompatibles(info.tipo, tipoValor)) {
            this.err.errorTipoIncompatible(info.tipo, tipoValor, linea, col);
        }
        this.verificarNegativo(inst.valor, info.tipo, linea, col);
    }

    private analizarAsignacionArray(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;
        const nombre: string = inst.nombre;

        const info = this.simbolos.buscar(nombre);
        if (!info) {
            this.err.errorVariableNoDeclarada(nombre, linea, col);
            return;
        }
        if (!info.esArray) {
            this.err.errorSintactico(nombre, linea, col,
                `'${nombre}' no es un arreglo; no se puede indexar con []`);
        }

        this.verificarIndiceNegativo(inst.indice, nombre, linea, col);

        const tipoValor = this.tipoExpresion(inst.valor, linea, col);
        if (tipoValor !== 'desconocido' && !this.tiposCompatibles(info.tipo, tipoValor)) {
            this.err.errorTipoIncompatible(info.tipo, tipoValor, linea, col);
        }
    }


    private analizarInvocacion(inst: any) {
        const nombre: string = inst.nombre;
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;
        const args: any[] = inst.args ?? [];

        const comp = this.componentes.get(nombre);
        if (!comp) {
            this.err.errorComponenteNoImportado(nombre, linea, col);
            return;
        }

        const esperados = comp.params.length;
        const recibidos = args.length;

        if (recibidos !== esperados) {
            this.err.errorArgsInsuficientes(nombre, esperados, recibidos, linea, col);
            return;
        }

        for (let i = 0; i < esperados; i++) {
            const paramTipo = comp.params[i].tipo;
            const argTipo = this.tipoExpresion(args[i], linea, col);
            if (argTipo !== 'desconocido' && !this.tiposCompatibles(paramTipo, argTipo)) {
                this.err.errorTipoIncompatible(
                    paramTipo, argTipo, linea, col
                );
            }
        }
    }


    private analizarWhile(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;
        this.verificarCondicion(inst.condicion, linea, col);
        this.simbolos.entrar('while');
        this.analizarInstrucciones(inst.cuerpo ?? [], false);
        this.simbolos.salir();
    }



    private analizarDoWhile(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;
        this.simbolos.entrar('do_while');
        this.analizarInstrucciones(inst.cuerpo ?? [], false);
        this.simbolos.salir();
        this.verificarCondicion(inst.condicion, linea, col);
    }


    private analizarFor(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;

        this.simbolos.entrar('for');

        if (inst.init) {
            const nombreCtrl: string = inst.init.nombre;
            if (!this.simbolos.buscar(nombreCtrl)) {
                this.simbolos.declarar({
                    nombre: nombreCtrl,
                    tipo: 'int',
                    esArray: false,
                    linea, col,
                });
            }

            const tipoInit = this.tipoExpresion(inst.init.valor, linea, col);
            if (!this.tiposCompatibles('int', tipoInit) && tipoInit !== 'desconocido') {
                this.err.errorTipoIncompatible('int', tipoInit, linea, col);
            }
        }

        this.verificarCondicion(inst.condicion, linea, col);

        if (inst.update) {
            const nombreUpd: string = inst.update.nombre;
            const info = this.simbolos.buscar(nombreUpd);
            if (!info) {
                this.err.errorVariableNoDeclarada(nombreUpd, linea, col);
            }
        }

        this.analizarInstrucciones(inst.cuerpo ?? [], false);
        this.simbolos.salir();
    }


    private analizarIf(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;

        this.verificarCondicion(inst.condicion, linea, col);

        this.simbolos.entrar('if');
        this.analizarInstrucciones(inst.entonces ?? [], false);
        this.simbolos.salir();

        for (const rama of (inst.ramas ?? [])) {
            if (rama.tipo === 'else_if') {
                this.verificarCondicion(rama.condicion, linea, col);
                this.simbolos.entrar('else_if');
                this.analizarInstrucciones(rama.cuerpo ?? [], false);
                this.simbolos.salir();
            } else if (rama.tipo === 'else') {
                this.simbolos.entrar('else');
                this.analizarInstrucciones(rama.cuerpo ?? [], false);
                this.simbolos.salir();
            }
        }
    }


    private analizarSwitch(inst: any) {
        const linea = inst.linea ?? 0;
        const col = inst.col ?? 0;

        const tipoExpr = this.tipoExpresion(inst.expr, linea, col);
        if (tipoExpr !== 'desconocido' && tipoExpr !== 'int' && tipoExpr !== 'string') {
            this.err.errorSwitchTipoInvalido(tipoExpr, linea, col);
        }

        if (!inst.casos || inst.casos.length === 0) {
            this.err.errorSwitchSinDefault(linea, col);
        }

        const valoresVistos = new Set<any>();
        let tieneDefault = false;

        for (const caso of (inst.casos ?? [])) {
            if (caso.tipo === 'default') {
                if (tieneDefault) {
                    this.err.errorSintactico('default', linea, col,
                        'El switch tiene más de un bloque default');
                }
                tieneDefault = true;
            } else {
                if (valoresVistos.has(caso.valor)) {
                    this.err.errorSintactico(String(caso.valor), linea, col,
                        `Case duplicado: el valor '${caso.valor}' ya fue definido en este switch`);
                }
                valoresVistos.add(caso.valor);

                const tipoCaso = typeof caso.valor === 'number' ? 'int' : 'string';
                if (tipoExpr !== 'desconocido' && !this.tiposCompatibles(tipoExpr, tipoCaso as TipoDato)) {
                    this.err.errorTipoIncompatible(tipoExpr, tipoCaso, linea, col);
                }
            }

            this.simbolos.entrar(`case`);
            this.analizarInstrucciones(caso.cuerpo ?? [], false);
            this.simbolos.salir();
        }
    }


    private verificarCondicion(cond: any, linea: number, col: number) {
        if (!cond) return;

        if (cond.op === undefined) {
            const tipo = this.tipoExpresion(cond, linea, col);
            if (tipo !== 'boolean' && tipo !== 'desconocido') {
                this.err.errorCondicionNoBooleana(linea, col);
            }
        }
        this.verificarExpresion(cond, linea, col);
    }


    private verificarExpresion(expr: any, linea: number, col: number) {
        if (!expr || typeof expr !== 'object') return;

        if (expr.tipo === 'var' || expr.tipo === 'ident') {

            if (expr.nombre === 'true' || expr.nombre === 'false') {
                return;
            }

            const nombre: string = expr.nombre;
            if (!this.simbolos.buscar(nombre) && !this.funciones.has(nombre)) {
                this.err.errorVariableNoDeclarada(nombre, linea, col);
            }
        }

        if (expr.tipo === 'array_acc') {
            const nombre: string = expr.nombre;
            const info = this.simbolos.buscar(nombre);
            if (!info) {
                this.err.errorVariableNoDeclarada(nombre, linea, col);
            } else if (!info.esArray) {
                this.err.errorSintactico(nombre, linea, col,
                    `'${nombre}' no es un arreglo; no se puede acceder con []`);
            }
            this.verificarIndiceNegativo(expr.indice, nombre, linea, col);
            this.verificarExpresion(expr.indice, linea, col);
            return;
        }

        if (expr.izq) this.verificarExpresion(expr.izq, linea, col);
        if (expr.der) this.verificarExpresion(expr.der, linea, col);
        if (expr.val) this.verificarExpresion(expr.val, linea, col);
    }


    private tipoExpresion(expr: any, linea: number, col: number): TipoDato {
        if (expr === null || expr === undefined) return 'desconocido';

        if (typeof expr === 'number') {
            return Number.isInteger(expr) ? 'int' : 'float';
        }
        if (typeof expr === 'boolean') return 'boolean';
        if (typeof expr === 'string') {
            return expr.length === 1 ? 'char' : 'string';
        }

        if (typeof expr !== 'object') return 'desconocido';

        switch (expr.tipo) {
            case 'var':
            case 'ident': {

                if (expr.nombre === 'true' || expr.nombre === 'false') {
                    return 'boolean';
                }

                const info = this.simbolos.buscar(expr.nombre);
                if (!info) {
                    if (this.funciones.has(expr.nombre)) return 'function';
                    this.err.errorVariableNoDeclarada(expr.nombre, linea, col);
                    return 'desconocido';
                }
                return info.tipo;
            }

            case 'array_acc': {
                const info = this.simbolos.buscar(expr.nombre);
                if (!info) return 'desconocido';
                if (!info.esArray) {
                    this.err.errorSintactico(expr.nombre, linea, col,
                        `'${expr.nombre}' no es un arreglo`);
                    return 'desconocido';
                }
                return info.tipo;
            }

            default:
                break;
        }

        if (expr.op) {
            switch (expr.op) {
                case '+': case '-': case '*': case '/': case '%': {
                    const ti = this.tipoExpresion(expr.izq, linea, col);
                    const td = this.tipoExpresion(expr.der, linea, col);
                    if (ti === 'float' || td === 'float') return 'float';
                    if (ti === 'int' || td === 'int') return 'int';
                    return 'desconocido';
                }
                case 'neg':
                    return this.tipoExpresion(expr.val, linea, col);
                case '==': case '!=': case '<': case '>':
                case '<=': case '>=': case '&&': case '||': case '!':
                    return 'boolean';
                default:
                    return 'desconocido';
            }
        }

        return 'desconocido';
    }


    private tiposCompatibles(esperado: TipoDato, recibido: TipoDato): boolean {
        if (esperado === recibido) return true;
        if (esperado === 'float' && recibido === 'int') return true;
        if (esperado === 'string' && recibido === 'char') return true;
        return false;
    }


    private verificarNegativo(expr: any, tipo: TipoDato, linea: number, col: number) {
        if (!expr || typeof expr !== 'object') return;

        if (expr.op === 'neg') {
            if (tipo === 'boolean') {
                this.err.errorSintactico('neg', linea, col,
                    'No se puede asignar un valor negativo a una variable boolean');
            }
            if (tipo === 'char') {
                this.err.errorSintactico('neg', linea, col,
                    'No se puede asignar un valor negativo a una variable char');
            }
            if (tipo === 'string') {
                this.err.errorSintactico('neg', linea, col,
                    'No se puede asignar un valor negativo a una variable string');
            }
        }

        if (typeof expr === 'number' && expr < 0) {
            if (!this.TIPOS_NUMERICOS.has(tipo)) {
                this.err.errorSintactico(String(expr), linea, col,
                    `Valor negativo ${expr} no es válido para el tipo '${tipo}'`);
            }
        }
    }

    private verificarIndiceNegativo(indice: any, nombre: string, linea: number, col: number) {
        if (indice === null || indice === undefined) return;
        if (typeof indice === 'number' && indice < 0) {
            this.err.errorSintactico(String(indice), linea, col,
                `Índice negativo (${indice}) en el arreglo '${nombre}': los índices deben ser ≥ 0`);
        }
        if (indice?.op === 'neg') {
            this.err.errorSintactico('neg', linea, col,
                `Índice negativo en el arreglo '${nombre}': los índices deben ser ≥ 0`);
        }
    }

    private validarConsultaExecute(
        consulta: string,
        linea: number,
        col: number,
        contexto: 'declaracion' | 'funcion' | 'main'
    ) {
        if (!consulta) return;

        const consultaSinVars = consulta.replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, '0');

        const esCreate = /^\s*TABLE\s+[a-zA-Z_][a-zA-Z0-9_]*\s+COLUMNS\s+.+/i.test(consultaSinVars);
        const esSelect = /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(consulta);
        const esDelete = /\bDELETE\b/.test(consulta);
        const esUpdate = /\bIN\b/.test(consulta) && /\[/.test(consulta);
        const esInsert = /\[/.test(consulta) && !esDelete && !esUpdate;

        if (contexto === 'declaracion' && !esSelect) {
            this.err.errorSintactico('execute', linea, col,
                `En una declaración de arreglo solo se permite SELECT (tabla.columna), no INSERT/UPDATE/DELETE`);
            return;
        }

        if (!esSelect && !esCreate && !esDelete && !esUpdate && !esInsert) {
            this.err.errorSintactico('execute', linea, col,
                `Consulta execute no reconocida: '${consulta}'. ` +
                `Formatos válidos: tabla.col | TABLE nombre COLUMNS col=tipo | ` +
                `tabla[col=val] | tabla[col=val] IN id | tabla DELETE id`);
            return;
        }

        if (esDelete) {
            const m = consulta.match(/DELETE\s+(.+)$/i);
            if (m) {
                const id = m[1].trim();
                const esNumero = /^\d+$/.test(id);
                const esVar = /^\$[a-zA-Z][a-zA-Z0-9_]*$/.test(id);
                if (!esNumero && !esVar) {
                    this.err.errorIdNoNumerico(id, linea, col);
                }
                if (esNumero && parseInt(id) <= 0) {
                    this.err.errorSintactico(id, linea, col,
                        `El id en DELETE debe ser un entero positivo, se recibió: ${id}`);
                }
            }
        }

        if (esUpdate) {
            const m = consulta.match(/IN\s+(\S+)\s*$/i);
            if (m) {
                const id = m[1].trim();
                const esNumero = /^\d+$/.test(id);
                const esVar = /^\$[a-zA-Z][a-zA-Z0-9_]*$/.test(id);
                if (!esNumero && !esVar) {
                    this.err.errorIdNoNumerico(id, linea, col);
                }
                if (esNumero && parseInt(id) <= 0) {
                    this.err.errorSintactico(id, linea, col,
                        `El id en UPDATE IN debe ser un entero positivo, se recibió: ${id}`);
                }
            }
        }
    }

    private validarVariablesEnConsulta(consulta: string, linea: number, col: number) {
        const vars = consulta.match(/\$[a-zA-Z][a-zA-Z0-9_]*/g) ?? [];
        for (const v of vars) {
            const nombre = v.substring(1);
            if (!this.simbolos.buscar(nombre)) {
                this.err.errorVariableNoDeclarada(nombre, linea, col);
            }
        }
    }

    registrarComponente(
        nombre: string,
        params: { tipo: string; nombre: string }[],
        linea: number = 0,
        col: number = 0
    ) {

        if (this.componentes.has(nombre)) {

            this.err.errorSintactico(
                nombre,
                linea,
                col,
                `El componente '${nombre}' ya fue declarado`
            );

            return false;
        }

        this.componentes.set(nombre, {
            nombre,
            params: params.map(p => ({
                tipo: (p.tipo ?? 'desconocido') as TipoDato,
                nombre: p.nombre,
            })),
        });

        return true;
    }

}