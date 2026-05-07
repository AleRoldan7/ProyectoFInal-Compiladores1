%lex
%%

\s+                                 /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentario bloque */
"#"[^\n]*                           /* comentario linea */

/* PALABRAS RESERVADAS — las de varias palabras PRIMERO */
"else if"       return 'ELSE_IF';
"import"        return 'IMPORT';
"int"           return 'T_INT';
"float"         return 'T_FLOAT';
"string"        return 'T_STRING';
"boolean"       return 'T_BOOL';
"char"          return 'T_CHAR';
"function"      return 'FUNCTION';
"main"          return 'MAIN';
"execute"       return 'EXECUTE';
"load"          return 'LOAD';
"while"         return 'WHILE';
"do"            return 'DO';
"for"           return 'FOR';
"if"            return 'IF';
"else"          return 'ELSE';
"switch"        return 'SWITCH';
"case"          return 'CASE';
"default"       return 'DEFAULT';
"break"         return 'BREAK';
"continue"      return 'CONTINUE';
"True"          return 'BOOL_TRUE';
"False"         return 'BOOL_FALSE';

/* OPERADORES — los de 2 chars PRIMERO */
"++"            return 'INCREMENT';
"=="            return 'EQ';
"!="            return 'NEQ';
">="            return 'GTE';
"<="            return 'LTE';
"&&"            return 'AND';
"||"            return 'OR';
">"             return 'GT';
"<"             return 'LT';
"!"             return 'NOT';
"+"             return 'MAS';
"-"             return 'MENOS';
"*"             return 'MULT';
"/"             return 'DIV';
"%"             return 'MOD';
"="             return 'IGUAL';

/* DELIMITADORES */
"{"             return 'LLAVE_A';
"}"             return 'LLAVE_C';
"("             return 'PAREN_A';
")"             return 'PAREN_C';
"["             return 'CORCH_A';
"]"             return 'CORCH_C';
";"             return 'PUNTO_COMA';
","             return 'COMA';
":"             return 'DOS_PUNTOS';
"@"             return 'ARROBA';
"."             return 'PUNTO';

"`"[^`]*"`"     return 'BACKTICK_EXPR';

/* LITERALES */
\"[^\"]*\"      return 'STRING_LIT';
\'[^\']*\'      return 'CHAR_LIT';
[0-9]+\.[0-9]+  return 'DECIMAL';
[0-9]+          return 'ENTERO';
"$"[a-zA-Z][a-zA-Z0-9_]*  return 'VAR';
[a-zA-Z][a-zA-Z0-9_]*     return 'IDENTIFICADOR';

<<EOF>> return 'EOF';
. { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column + 1); }

/lex

%left OR
%left AND
%right NOT
%left EQ NEQ
%left GT GTE LT LTE
%left MAS MENOS
%left MULT DIV MOD
%right UMENOS

%start inicio
%%

inicio
    : lista_imports lista_declaraciones bloque_main EOF
    {
        return {
            ast: { tipo:'programa', imports:$1, declaraciones:$2, main:$3 },
            tokens:  yy.manejador.getTokens(),
            errores: yy.manejador.getErrores()
        };
    }

    /* Error: falta el bloque main */
    | lista_imports lista_declaraciones error EOF
    {
        yy.manejador.errorMainAusente(@3.first_line, @3.first_column + 1);
        return {
            ast: { tipo:'programa', imports:$1, declaraciones:$2, main:[] },
            tokens:  yy.manejador.getTokens(),
            errores: yy.manejador.getErrores()
        };
    }
    ;

/* ─── IMPORTS ──────────────────────────────────────────────────── */

lista_imports
    : lista_imports import_stmt  { $$ = $1; $$.push($2); }
    | /* vacío */                { $$ = []; }
    ;

import_stmt
    : IMPORT STRING_LIT PUNTO_COMA
        { $$ = { tipo:'import', path:$2.replace(/"/g,'') }; }

    /* Error: import sin ';' al final */
    | IMPORT STRING_LIT error
    {
        yy.manejador.errorImportSinPuntoComa(@3.first_line, @3.first_column + 1);
        $$ = { tipo:'import', path:$2.replace(/"/g,'') };
    }

    /* Error: import sin ruta */
    | IMPORT error PUNTO_COMA
    {
        yy.manejador.errorImportMalFormado(yytext, @2.first_line, @2.first_column + 1);
        $$ = { tipo:'import', path:'' };
    }
    ;

/* ─── DECLARACIONES GLOBALES ───────────────────────────────────── */

lista_declaraciones
    : lista_declaraciones declaracion_o_funcion  { $$ = $1; $$.push($2); }
    | /* vacío */                                { $$ = []; }
    ;

declaracion_o_funcion
    : declaracion_variable
    | declaracion_funcion
    ;

/* ─── VARIABLES ────────────────────────────────────────────────── */

declaracion_variable
    : tipo_simple IDENTIFICADOR IGUAL expresion PUNTO_COMA
        { $$ = { tipo:'declaracion', tipo_dato:$1, nombre:$2, valor:$4 }; }

    | tipo_simple CORCH_A ENTERO CORCH_C IDENTIFICADOR PUNTO_COMA
        { $$ = { tipo:'declaracion_array', tipo_dato:$1, nombre:$5, tamano:parseInt($3), valor:null }; }

    | tipo_simple CORCH_A CORCH_C IDENTIFICADOR IGUAL CORCH_A ENTERO CORCH_C PUNTO_COMA
    {
        $$ = {
            tipo:'declaracion_array',
            tipo_dato:$1,
            nombre:$4,
            tamano:parseInt($7),
            valor:null
        };
    }

    | tipo_simple CORCH_A CORCH_C IDENTIFICADOR IGUAL LLAVE_A lista_valores LLAVE_C PUNTO_COMA
        { $$ = { tipo:'declaracion_array', tipo_dato:$1, nombre:$4, tamano:null, valor:$7 }; }

    | tipo_simple CORCH_A CORCH_C IDENTIFICADOR IGUAL EXECUTE BACKTICK_EXPR PUNTO_COMA
{
    $$ = {
        tipo:'declaracion_execute',
        tipo_dato:$1,
        nombre:$4,
        consulta:$7.replace(/`/g, '')
    };
}
    ;
tipo_simple
    : T_INT     { $$ = 'int'; }
    | T_FLOAT   { $$ = 'float'; }
    | T_STRING  { $$ = 'string'; }
    | T_BOOL    { $$ = 'boolean'; }
    | T_CHAR    { $$ = 'char'; }

    /* Error: tipo de dato desconocido */
    | error
    {
        yy.manejador.errorDeclaracionSinTipo(yytext, @1.first_line, @1.first_column + 1);
        $$ = 'unknown';
    }
    ;

lista_valores
    : lista_valores COMA expresion  { $$ = $1; $$.push($3); }
    | expresion                     { $$ = [$1]; }
    ;

/* ─── FUNCIONES ────────────────────────────────────────────────── */

declaracion_funcion
    : FUNCTION IDENTIFICADOR PAREN_A lista_params_fn PAREN_C LLAVE_A cuerpo_funcion LLAVE_C
        { $$ = { tipo:'funcion', nombre:$2, params:$4, cuerpo:$7 }; }
    | FUNCTION IDENTIFICADOR PAREN_A PAREN_C LLAVE_A cuerpo_funcion LLAVE_C
        { $$ = { tipo:'funcion', nombre:$2, params:[], cuerpo:$6 }; }

    /* Error: función sin '{' para abrir el cuerpo */
    | FUNCTION IDENTIFICADOR PAREN_A lista_params_fn PAREN_C error cuerpo_funcion LLAVE_C
    {
        yy.manejador.errorFuncionSinLlave($2, @6.first_line, @6.first_column + 1);
        $$ = { tipo:'funcion', nombre:$2, params:$4, cuerpo:$7 };
    }

    /* Error: función sin ')' para cerrar parámetros */
    | FUNCTION IDENTIFICADOR PAREN_A lista_params_fn error LLAVE_A cuerpo_funcion LLAVE_C
    {
        yy.manejador.errorSintactico(
            $2, @5.first_line, @5.first_column + 1,
            "Función '" + $2 + "': se esperaba ')' para cerrar los parámetros"
        );
        $$ = { tipo:'funcion', nombre:$2, params:$4, cuerpo:$7 };
    }
    ;

lista_params_fn
    : lista_params_fn COMA param_fn  { $$ = $1; $$.push($3); }
    | param_fn                       { $$ = [$1]; }
    ;

param_fn
    : tipo_simple IDENTIFICADOR  { $$ = { tipo:$1, nombre:$2 }; }
    ;

cuerpo_funcion
    : cuerpo_funcion instruccion_fn  { $$ = $1; $$.push($2); }
    | /* vacío */                    { $$ = []; }
    ;

instruccion_fn
    : EXECUTE BACKTICK_EXPR PUNTO_COMA
        { $$ = { tipo:'execute_fn', consulta:$2 }; }
    | LOAD IDENTIFICADOR PUNTO_COMA
        { $$ = { tipo:'load', destino:$2 }; }
    | LOAD STRING_LIT PUNTO_COMA
        { $$ = { tipo:'load', destino:$2.replace(/"/g,'') }; }

    /* Error: instrucción inválida dentro de función */
    | error PUNTO_COMA
    {
        yy.manejador.errorSintactico(
            yytext, @1.first_line, @1.first_column + 1,
            "Instrucción no válida dentro de función. Solo se permiten execute y load"
        );
        $$ = null;
    }
    ;

/* ─── MAIN ─────────────────────────────────────────────────────── */

bloque_main
    : MAIN LLAVE_A lista_instrucciones LLAVE_C
        { $$ = $3; }

    /* Error: main sin '{' */
    | MAIN error lista_instrucciones LLAVE_C
    {
        yy.manejador.errorFuncionSinLlave('main', @2.first_line, @2.first_column + 1);
        $$ = $3;
    }

    /* Error: main sin '}' de cierre */
    | MAIN LLAVE_A lista_instrucciones error
    {
        yy.manejador.errorLlaveNoTerminada(@4.first_line, @4.first_column + 1);
        $$ = $3;
    }
    ;

/* ─── INSTRUCCIONES ────────────────────────────────────────────── */

lista_instrucciones
    : lista_instrucciones instruccion  { $$ = $1; $$.push($2); }
    | /* vacío */                      { $$ = []; }
    ;

instruccion
    : invocacion_componente PUNTO_COMA
        { $$ = $1; }
    | declaracion_variable
        { $$ = $1; }
    | asignacion PUNTO_COMA
        { $$ = $1; }
    | ciclo_while
        { $$ = $1; }
    | ciclo_do_while
        { $$ = $1; }
    | ciclo_for
        { $$ = $1; }
    | condicional_if
        { $$ = $1; }
    | ciclo_switch
        { $$ = $1; }
    | BREAK PUNTO_COMA
        { $$ = { tipo:'break' }; }
    | CONTINUE PUNTO_COMA
        { $$ = { tipo:'continue' }; }
    | EXECUTE BACKTICK_EXPR PUNTO_COMA
    { $$ = { tipo:'execute', consulta:$2 }; }
    /* Error: instrucción no reconocida — recuperar hasta ';' */
    | error PUNTO_COMA
    {
        yy.manejador.errorSintactico(
            yytext, @1.first_line, @1.first_column + 1,
            "Instrucción no reconocida: '" + yytext + "'"
        );
        $$ = null;
    }
    ;

/* ─── INVOCACIÓN DE COMPONENTE ─────────────────────────────────── */

invocacion_componente
    : ARROBA IDENTIFICADOR PAREN_A lista_args PAREN_C
        { $$ = { tipo:'invocacion', nombre:$2, args:$4 }; }
    | ARROBA IDENTIFICADOR PAREN_A PAREN_C
        { $$ = { tipo:'invocacion', nombre:$2, args:[] }; }

    /* Error: '@' sin nombre de componente */
    | ARROBA error PAREN_C
    {
        yy.manejador.errorInvocacionSinArroba(yytext, @2.first_line, @2.first_column + 1);
        $$ = { tipo:'invocacion', nombre:'unknown', args:[] };
    }

    /* Error: componente invocado sin '@' */
    | IDENTIFICADOR PAREN_A lista_args PAREN_C
    {
        yy.manejador.errorInvocacionSinArroba($1, @1.first_line, @1.first_column + 1);
        $$ = { tipo:'invocacion', nombre:$1, args:$3 };
    }
    ;

lista_args
    : lista_args COMA expresion  { $$ = $1; $$.push($3); }
    | expresion                  { $$ = [$1]; }
    ;

/* ─── ASIGNACIÓN ───────────────────────────────────────────────── */

asignacion
    : IDENTIFICADOR IGUAL expresion
        { $$ = { tipo:'asignacion', nombre:$1, valor:$3 }; }
    | IDENTIFICADOR CORCH_A expresion CORCH_C IGUAL expresion
        { $$ = { tipo:'asignacion_array', nombre:$1, indice:$3, valor:$6 }; }

    /* Error: asignación sin '=' */
    | IDENTIFICADOR error expresion
    {
        yy.manejador.errorDeclaracionSinIgual($1, @2.first_line, @2.first_column + 1);
        $$ = { tipo:'asignacion', nombre:$1, valor:$3 };
    }
    ;

/* ─── WHILE ────────────────────────────────────────────────────── */

ciclo_while
    : WHILE PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C
        { $$ = { tipo:'while', condicion:$3, cuerpo:$6 }; }

    /* Error: while sin condición válida */
    | WHILE error LLAVE_A lista_instrucciones LLAVE_C
    {
        yy.manejador.errorWhileSinCondicion(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'while', condicion:null, cuerpo:$4 };
    }

    /* Error: while sin cuerpo '{' */
    | WHILE PAREN_A condicion PAREN_C error lista_instrucciones LLAVE_C
    {
        yy.manejador.errorLlaveNoTerminada(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'while', condicion:$3, cuerpo:$6 };
    }
    ;

/* ─── DO-WHILE ─────────────────────────────────────────────────── */

ciclo_do_while
    : DO LLAVE_A lista_instrucciones LLAVE_C WHILE PAREN_A condicion PAREN_C
        { $$ = { tipo:'do_while', cuerpo:$3, condicion:$7 }; }

    /* Error: do-while sin 'while' al final */
    | DO LLAVE_A lista_instrucciones LLAVE_C error
    {
        yy.manejador.errorDoWhileSinWhile(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'do_while', cuerpo:$3, condicion:null };
    }
    ;

/* ─── FOR ──────────────────────────────────────────────────────── */

ciclo_for
    : FOR PAREN_A IDENTIFICADOR IGUAL expresion PUNTO_COMA condicion PUNTO_COMA update PAREN_C LLAVE_A lista_instrucciones LLAVE_C
        { $$ = { tipo:'for', init:{nombre:$3, valor:$5}, condicion:$7, update:$9, cuerpo:$12 }; }

    /* Error: sintaxis incorrecta en for */
    | FOR error LLAVE_A lista_instrucciones LLAVE_C
    {
        yy.manejador.errorForSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'for', init:null, condicion:null, update:null, cuerpo:$4 };
    }
    ;

update
    : IDENTIFICADOR IGUAL expresion
        { $$ = { nombre:$1, valor:$3 }; }
    | IDENTIFICADOR INCREMENT
        { $$ = { nombre:$1, valor:{ op:'+', izq:$1, der:1 } }; }
    ;

/* ─── IF ───────────────────────────────────────────────────────── */

condicional_if
    : IF PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C lista_else_ramas
        { $$ = { tipo:'if', condicion:$3, entonces:$6, ramas:$8 }; }

    /* Error: if sin condición válida */
    | IF error LLAVE_A lista_instrucciones LLAVE_C lista_else_ramas
    {
        yy.manejador.errorCondicionNoBooleana(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'if', condicion:null, entonces:$4, ramas:$6 };
    }
    ;

lista_else_ramas
    : lista_else_ramas else_rama  { $$ = $1; $$.push($2); }
    | /* vacío */                 { $$ = []; }
    ;

else_rama
    : ELSE_IF PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C
        { $$ = { tipo:'else_if', condicion:$3, cuerpo:$6 }; }
    | ELSE IF PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C
        { $$ = { tipo:'else_if', condicion:$4, cuerpo:$7 }; }
    | ELSE LLAVE_A lista_instrucciones LLAVE_C
        { $$ = { tipo:'else', cuerpo:$3 }; }

    /* Error: else/else-if sin bloque */
    | ELSE error LLAVE_C
    {
        yy.manejador.errorLlaveNoTerminada(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'else', cuerpo:[] };
    }
    ;

/* ─── SWITCH ───────────────────────────────────────────────────── */

ciclo_switch
    : SWITCH PAREN_A expresion PAREN_C LLAVE_A lista_casos_switch LLAVE_C
        { $$ = { tipo:'switch', expr:$3, casos:$6 }; }

    /* Error: switch sin expresión válida */
    | SWITCH error LLAVE_A lista_casos_switch LLAVE_C
    {
        yy.manejador.errorSwitchSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'switch', expr:null, casos:$4 };
    }
    ;

lista_casos_switch
    : lista_casos_switch caso_switch  { $$ = $1; $$.push($2); }
    | /* vacío */                     { $$ = []; }
    ;

caso_switch
    : CASE expresion DOS_PUNTOS lista_instrucciones BREAK PUNTO_COMA
        { $$ = { tipo:'case', valor:$2, cuerpo:$4 }; }
    | DEFAULT DOS_PUNTOS lista_instrucciones BREAK PUNTO_COMA
        { $$ = { tipo:'default', cuerpo:$3 }; }

    /* Error: case sin 'break' al final */
    | CASE expresion DOS_PUNTOS lista_instrucciones error PUNTO_COMA
    {
        yy.manejador.errorBreakFueraDeLoop(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'case', valor:$2, cuerpo:$4 };
    }

    /* Error: case malformado */
    | CASE error DOS_PUNTOS lista_instrucciones BREAK PUNTO_COMA
    {
        yy.manejador.errorSwitchSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'case', valor:'error', cuerpo:$4 };
    }
    ;

/* ─── CONDICIONES ──────────────────────────────────────────────── */

condicion
    : expresion EQ  expresion  { $$ = { op:'==', izq:$1, der:$3 }; }
    | expresion NEQ expresion  { $$ = { op:'!=', izq:$1, der:$3 }; }
    | expresion LT  expresion  { $$ = { op:'<',  izq:$1, der:$3 }; }
    | expresion GT  expresion  { $$ = { op:'>',  izq:$1, der:$3 }; }
    | expresion LTE expresion  { $$ = { op:'<=', izq:$1, der:$3 }; }
    | expresion GTE expresion  { $$ = { op:'>=', izq:$1, der:$3 }; }
    | condicion AND condicion  { $$ = { op:'&&', izq:$1, der:$3 }; }
    | condicion OR  condicion  { $$ = { op:'||', izq:$1, der:$3 }; }
    | NOT condicion            { $$ = { op:'!',  val:$2 }; }
    | expresion                { $$ = $1; }
    ;

/* ─── EXPRESIONES ──────────────────────────────────────────────── */

expresion
    : expresion MAS   expresion     { $$ = { op:'+', izq:$1, der:$3 }; }
    | expresion MENOS expresion     { $$ = { op:'-', izq:$1, der:$3 }; }
    | expresion MULT  expresion     { $$ = { op:'*', izq:$1, der:$3 }; }
    | expresion DIV   expresion     { $$ = { op:'/', izq:$1, der:$3 }; }
    | expresion MOD   expresion     { $$ = { op:'%', izq:$1, der:$3 }; }
    | MENOS expresion %prec UMENOS  { $$ = { op:'neg', val:$2 }; }
    | IDENTIFICADOR INCREMENT       { $$ = { op:'+', izq:$1, der:1 }; }
    | PAREN_A expresion PAREN_C     { $$ = $2; }
    | ENTERO        { $$ = parseInt($1); }
    | DECIMAL       { $$ = parseFloat($1); }
    | STRING_LIT    { $$ = $1.replace(/"/g,''); }
    | CHAR_LIT      { $$ = $1.replace(/'/g,''); }
    | BOOL_TRUE     { $$ = true; }
    | BOOL_FALSE    { $$ = false; }
    | VAR           { $$ = { tipo:'var', nombre:$1.substring(1) }; }
    | VAR CORCH_A expresion CORCH_C
        { $$ = { tipo:'array_acc', nombre:$1.substring(1), indice:$3 }; }
    | IDENTIFICADOR CORCH_A expresion CORCH_C
        { $$ = { tipo:'array_acc', nombre:$1, indice:$3 }; }
    | IDENTIFICADOR { $$ = { tipo:'ident', nombre:$1 }; }
    ;