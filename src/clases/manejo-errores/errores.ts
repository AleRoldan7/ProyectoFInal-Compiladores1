import { Token } from './token';

export enum TipoError {
  LEXICO     = 'Léxico',
  SINTACTICO = 'Sintáctico',
  SEMANTICO  = 'Semántico'
}

export class ManejoErrores {

  private tokens:  Token[] = [];
  private errores: Token[] = [];

  reset() { this.tokens = []; this.errores = []; }

  agregarToken(lexema: string, linea: number, columna: number, descripcion: string, tipo: string) {
    this.tokens.push(new Token(lexema, linea, columna, descripcion, tipo));
  }

  getTokens()  { return this.tokens; }
  getErrores() { return this.errores; }

  private agregar(lexema: string, linea: number, col: number, desc: string, tipo: TipoError) {
    this.errores.push(new Token(lexema, linea, col, desc, tipo));
  }


  errorLexico(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Carácter no reconocido: '${lexema}'`, TipoError.LEXICO);
  }

  errorStringNoTerminado(linea: number, col: number) {
    this.agregar('"', linea, col,
      'String no terminado: falta comilla de cierre', TipoError.LEXICO);
  }

  errorComentarioNoTerminado(linea: number, col: number) {
    this.agregar('/*', linea, col,
      'Comentario de bloque no terminado: falta */', TipoError.LEXICO);
  }

  errorNumeroMalFormado(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Número mal formado: '${lexema}'`, TipoError.LEXICO);
  }

  errorCaracterNoTerminado(linea: number, col: number) {
    this.agregar("'", linea, col,
      "Literal de char no terminado: falta comilla simple de cierre", TipoError.LEXICO);
  }

  errorCaracterMultiple(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Char solo admite un carácter: '${lexema}'`, TipoError.LEXICO);
  }

  // ══════════════════════════════════════════════════════════════════
  //  ERRORES SINTÁCTICOS — generales
  // ══════════════════════════════════════════════════════════════════

  errorSintactico(lexema: string, linea: number, col: number, descripcion: string) {
    this.agregar(lexema, linea, col, descripcion, TipoError.SINTACTICO);
  }

  errorTokenEsperado(esperado: string, encontrado: string, linea: number, col: number) {
    this.agregar(encontrado, linea, col,
      `Se esperaba '${esperado}' pero se encontró '${encontrado}'`, TipoError.SINTACTICO);
  }

  errorLlaveNoTerminada(linea: number, col: number) {
    this.agregar('{', linea, col,
      'Bloque no cerrado: falta }', TipoError.SINTACTICO);
  }

  errorPuntoComa(linea: number, col: number) {
    this.agregar(';', linea, col,
      "Se esperaba ';' al final de la instrucción", TipoError.SINTACTICO);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LENGUAJE .styles
  // ══════════════════════════════════════════════════════════════════

  // Léxico .styles
  errorPropiedadDesconocida(prop: string, linea: number, col: number) {
    this.agregar(prop, linea, col,
      `Propiedad de estilo desconocida: '${prop}'`, TipoError.LEXICO);
  }

  errorColorInvalido(color: string, linea: number, col: number) {
    this.agregar(color, linea, col,
      `Valor de color no reconocido: '${color}'`, TipoError.LEXICO);
  }

  errorUnidadInvalida(unidad: string, linea: number, col: number) {
    this.agregar(unidad, linea, col,
      `Unidad de medida no válida: '${unidad}'. Use números (px) o porcentaje (%)`, TipoError.LEXICO);
  }

  // Sintáctico .styles
  errorEstiloSinLlave(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Definición de estilo '${nombre}' sin '{': se esperaba apertura de bloque`, TipoError.SINTACTICO);
  }

  errorForStyleSintaxis(linea: number, col: number) {
    this.agregar('@for', linea, col,
      "Sintaxis incorrecta del @for. Formato: @for $var from N to/through M { ... }", TipoError.SINTACTICO);
  }

  errorExtendsSinNombre(linea: number, col: number) {
    this.agregar('extends', linea, col,
      "Se esperaba el nombre del estilo padre después de 'extends'", TipoError.SINTACTICO);
  }

  errorAsignacionSinIgual(prop: string, linea: number, col: number) {
    this.agregar(prop, linea, col,
      `Se esperaba '=' después de la propiedad '${prop}'`, TipoError.SINTACTICO);
  }

  // Semántico .styles
  errorEstiloNoDefinido(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `El estilo '${nombre}' referenciado en 'extends' no está definido`, TipoError.SEMANTICO);
  }

  errorForStyleVariableForRange(variable: string, linea: number, col: number) {
    this.agregar(variable, linea, col,
      `El valor de '${variable}' en @for debe ser entero positivo`, TipoError.SEMANTICO);
  }

  errorForStyleAnidado(linea: number, col: number) {
    this.agregar('@for', linea, col,
      'Los bucles @for no se pueden anidar en el lenguaje de estilos', TipoError.SEMANTICO);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LENGUAJE .comp
  // ══════════════════════════════════════════════════════════════════

  // Léxico .comp
  errorTokenDesconocidoComp(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Token no reconocido en componente: '${lexema}'`, TipoError.LEXICO);
  }

  // Sintáctico .comp
  errorComponenteSinParentesis(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Componente '${nombre}': se esperaba '(' para la lista de parámetros`, TipoError.SINTACTICO);
  }

  errorSeccionSinCierre(linea: number, col: number) {
    this.agregar('[', linea, col,
      'Sección no cerrada: falta ]', TipoError.SINTACTICO);
  }

  errorTablaSinCierre(linea: number, col: number) {
    this.agregar('[[', linea, col,
      'Tabla no cerrada: falta ]]', TipoError.SINTACTICO);
  }

  errorTextoSinParentesis(linea: number, col: number) {
    this.agregar('T', linea, col,
      "Texto T: se esperaba '(' después del elemento de texto", TipoError.SINTACTICO);
  }

  errorFormSinLlave(linea: number, col: number) {
    this.agregar('FORM', linea, col,
      "FORM: se esperaba '{' para abrir el cuerpo del formulario", TipoError.SINTACTICO);
  }

  errorInputSinProps(tipo: string, linea: number, col: number) {
    this.agregar(tipo, linea, col,
      `${tipo}: propiedades id, label y value son requeridas`, TipoError.SINTACTICO);
  }

  errorSubmitConElementos(linea: number, col: number) {
    this.agregar('SUBMIT', linea, col,
      'SUBMIT no puede contener otros elementos aparte de label y function', TipoError.SINTACTICO);
  }

  errorForCompSintaxis(linea: number, col: number) {
    this.agregar('for', linea, col,
      "for each: sintaxis incorrecta. Formato: for each ($elem : $array) { ... }", TipoError.SINTACTICO);
  }

  errorSwitchSinDefault(linea: number, col: number) {
    this.agregar('Switch', linea, col,
      "Switch sin casos: debe tener al menos un 'case'", TipoError.SINTACTICO);
  }

  // Semántico .comp
  errorComponenteDuplicado(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Componente '${nombre}' ya fue definido. Los nombres de componentes no se pueden repetir`, TipoError.SEMANTICO);
  }

  errorEstiloNoExisteEnComp(estilo: string, linea: number, col: number) {
    this.agregar(estilo, linea, col,
      `El estilo '${estilo}' no está definido en ningún archivo .styles importado`, TipoError.SEMANTICO);
  }

  errorVariableNoDeclaradaComp(variable: string, linea: number, col: number) {
    this.agregar(variable, linea, col,
      `Variable '$${variable}' no está declarada como parámetro del componente`, TipoError.SEMANTICO);
  }

  errorTipoParametroInvalido(tipo: string, linea: number, col: number) {
    this.agregar(tipo, linea, col,
      `Tipo de parámetro desconocido: '${tipo}'. Tipos válidos: int, float, string, boolean, char, function`, TipoError.SEMANTICO);
  }

  errorCondicionNoBooleana(linea: number, col: number) {
    this.agregar('if/while', linea, col,
      'La condición debe ser de tipo booleano', TipoError.SEMANTICO);
  }

  errorSwitchTipoInvalido(tipo: string, linea: number, col: number) {
    this.agregar('Switch', linea, col,
      `Switch solo acepta variables de tipo int o string, se recibió: ${tipo}`, TipoError.SEMANTICO);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LENGUAJE PRINCIPAL .y
  // ══════════════════════════════════════════════════════════════════

  // Léxico .y
  errorImportMalFormado(ruta: string, linea: number, col: number) {
    this.agregar(ruta, linea, col,
      `Import mal formado: '${ruta}'. La ruta debe ser relativa entre comillas`, TipoError.LEXICO);
  }

  // Sintáctico .y
  errorImportSinPuntoComa(linea: number, col: number) {
    this.agregar('import', linea, col,
      "import: se esperaba ';' al final de la declaración", TipoError.SINTACTICO);
  }

  errorDeclaracionSinTipo(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Declaración de variable sin tipo válido: '${lexema}'`, TipoError.SINTACTICO);
  }

  errorDeclaracionSinIgual(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Variable '${nombre}': se esperaba '=' para asignar el valor inicial`, TipoError.SINTACTICO);
  }

  errorFuncionSinLlave(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Función '${nombre}': se esperaba '{' para abrir el cuerpo`, TipoError.SINTACTICO);
  }

  errorMainAusente(linea: number, col: number) {
    this.agregar('main', linea, col,
      "Falta el bloque 'main { }' que es obligatorio en el archivo principal", TipoError.SINTACTICO);
  }

  errorWhileSinCondicion(linea: number, col: number) {
    this.agregar('while', linea, col,
      "while: se esperaba condición entre paréntesis", TipoError.SINTACTICO);
  }

  errorForSintaxis(linea: number, col: number) {
    this.agregar('for', linea, col,
      "for: sintaxis incorrecta. Formato: for(init; cond; incr) { ... }", TipoError.SINTACTICO);
  }

  errorDoWhileSinWhile(linea: number, col: number) {
    this.agregar('do', linea, col,
      "do-while: falta 'while(condición)' al final del bloque", TipoError.SINTACTICO);
  }

  errorSwitchSintaxis(linea: number, col: number) {
    this.agregar('switch', linea, col,
      "switch: sintaxis incorrecta. Formato: switch(var) { case 'x': break; }", TipoError.SINTACTICO);
  }

  errorBreakFueraDeLoop(linea: number, col: number) {
    this.agregar('break', linea, col,
      "'break' usado fuera de un ciclo o switch", TipoError.SINTACTICO);
  }

  errorContinueFueraDeLoop(linea: number, col: number) {
    this.agregar('continue', linea, col,
      "'continue' usado fuera de un ciclo", TipoError.SINTACTICO);
  }

  errorInvocacionSinArroba(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Invocación de componente sin '@': use @${nombre}()`, TipoError.SINTACTICO);
  }

  // Semántico .y
  errorImportNoEncontrado(ruta: string, linea: number, col: number) {
    this.agregar(ruta, linea, col,
      `No se encontró el archivo importado: '${ruta}'`, TipoError.SEMANTICO);
  }

  errorImportExtensionInvalida(ruta: string, linea: number, col: number) {
    this.agregar(ruta, linea, col,
      `Extensión de archivo no válida en import: '${ruta}'. Use .comp o .styles`, TipoError.SEMANTICO);
  }

  errorVariableNoDeclarada(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Variable '${nombre}' usada pero no declarada`, TipoError.SEMANTICO);
  }

  errorVariableYaDeclarada(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Variable '${nombre}' ya fue declarada en este ámbito`, TipoError.SEMANTICO);
  }

  errorTipoIncompatible(esperado: string, recibido: string, linea: number, col: number) {
    this.agregar('=', linea, col,
      `Tipo incompatible: se esperaba '${esperado}' pero se asignó '${recibido}'`, TipoError.SEMANTICO);
  }

  errorFuncionNoDeclarada(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Función '${nombre}' usada pero no declarada`, TipoError.SEMANTICO);
  }

  errorFuncionDentroFuncion(linea: number, col: number) {
    this.agregar('function', linea, col,
      'No se pueden definir funciones dentro de otras funciones', TipoError.SEMANTICO);
  }

  errorComponenteNoImportado(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `Componente '@${nombre}' no está importado ni definido`, TipoError.SEMANTICO);
  }

  errorArgsInsuficientes(comp: string, esperados: number, recibidos: number, linea: number, col: number) {
    this.agregar(comp, linea, col,
      `Componente '@${comp}' espera ${esperados} argumento(s) pero recibió ${recibidos}`, TipoError.SEMANTICO);
  }

  errorArregloUnaDimension(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `El arreglo '${nombre}' solo puede ser de una dimensión`, TipoError.SEMANTICO);
  }

  errorExecuteSoloEnFuncion(linea: number, col: number) {
    this.agregar('execute', linea, col,
      "'execute' solo puede usarse dentro de una función", TipoError.SEMANTICO);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LENGUAJE .dba (base de datos)
  // ══════════════════════════════════════════════════════════════════

  // Léxico .dba
  errorTokenDBA(lexema: string, linea: number, col: number) {
    this.agregar(lexema, linea, col,
      `Token no reconocido en consola DBA: '${lexema}'`, TipoError.LEXICO);
  }

  // Sintáctico .dba
  errorTablaCreacionSintaxis(linea: number, col: number) {
    this.agregar('TABLE', linea, col,
      "Sintaxis de creación: TABLE nombre COLUMNS col=tipo, col2=tipo;", TipoError.SINTACTICO);
  }

  errorSeleccionSintaxis(linea: number, col: number) {
    this.agregar('.', linea, col,
      "Sintaxis de selección: tabla.columna;", TipoError.SINTACTICO);
  }

  errorInsertSintaxis(linea: number, col: number) {
    this.agregar('[', linea, col,
      "Sintaxis de inserción: tabla[col=valor, col2=valor]", TipoError.SINTACTICO);
  }

  errorUpdateSintaxis(linea: number, col: number) {
    this.agregar('IN', linea, col,
      "Sintaxis de actualización: tabla[col=valor] IN id;", TipoError.SINTACTICO);
  }

  errorDeleteSintaxis(linea: number, col: number) {
    this.agregar('DELETE', linea, col,
      "Sintaxis de eliminación: tabla DELETE id;", TipoError.SINTACTICO);
  }

  errorDBANoPuntoComa(linea: number, col: number) {
    this.agregar(';', linea, col,
      "Instrucción DBA sin ';' al final", TipoError.SINTACTICO);
  }

  // Semántico .dba
  errorTablaNoExiste(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `La tabla '${nombre}' no existe. Créala con TABLE ${nombre} COLUMNS ...;`, TipoError.SEMANTICO);
  }

  errorTablaYaExiste(nombre: string, linea: number, col: number) {
    this.agregar(nombre, linea, col,
      `La tabla '${nombre}' ya fue creada`, TipoError.SEMANTICO);
  }

  errorColumnaNoExiste(columna: string, tabla: string, linea: number, col: number) {
    this.agregar(columna, linea, col,
      `La columna '${columna}' no existe en la tabla '${tabla}'`, TipoError.SEMANTICO);
  }

  errorTipoColumnaIncompatible(columna: string, esperado: string, recibido: string, linea: number, col: number) {
    this.agregar(columna, linea, col,
      `Tipo incompatible en columna '${columna}': se esperaba ${esperado} pero se recibió ${recibido}`, TipoError.SEMANTICO);
  }

  errorJoinsNoPermitidos(linea: number, col: number) {
    this.agregar('JOIN', linea, col,
      'El lenguaje DBA no permite JOINs. Solo se permiten operaciones CRUD en tablas simples', TipoError.SEMANTICO);
  }

  errorIdReservado(linea: number, col: number) {
    this.agregar('id', linea, col,
      "'id' es una columna reservada (llave primaria) y no puede ser definida manualmente", TipoError.SEMANTICO);
  }

  errorIdNoNumerico(valor: any, linea: number, col: number) {
    this.agregar(String(valor), linea, col,
      `El id de condición debe ser un entero positivo, se recibió: '${valor}'`, TipoError.SEMANTICO);
  }
}