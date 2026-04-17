%lex
%%

\s+                                 /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentarios */

/* TIPOS DE DATOS */
"int"           return 'T_INT';
"float"         return 'T_FLOAT';
"string"        return 'T_STRING';
"boolean"       return 'T_BOOL';
"char"          return 'T_CHAR';
"function"      return 'T_FUNCTION';

/* PALABRAS RESERVADAS */
"for each"      return 'FOR_EACH';
"for"           return 'FOR';
"if"            return 'IF';
"else"          return 'ELSE';
"Switch"        return 'SWITCH';
"case"          return 'CASE';
"default"       return 'DEFAULT';
"empty"         return 'EMPTY';
"track"         return 'TRACK';

/* ELEMENTOS VISUALES */
"FORM"          return 'FORM';
"INPUT_TEXT"    return 'INPUT_TEXT';
"INPUT_NUMBER"  return 'INPUT_NUMBER';
"INPUT_BOOL"    return 'INPUT_BOOL';
"SUBMIT"        return 'SUBMIT';
"IMG"           return 'IMG';
"T"             return 'TEXTO';

/* CLAVES INPUT*/
"id"            return 'KW_ID';
"label"         return 'KW_LABEL';
"value"         return 'KW_VALUE';
"function"      return 'KW_FUNCTION';

/* BOOLEANOS */
"true"          return 'BOOL_TRUE';
"false"         return 'BOOL_FALSE';

/* OPERADORES LOGICOS */
"=="            return 'EQ';
"!="            return 'NEQ';
">="            return 'GTE';
"<="            return 'LTE';
">"             return 'GT';
"<"             return 'LT';
"&&"            return 'AND';
"||"            return 'OR';
"!"             return 'NOT';

/* OPERADORES ARITMETICOS */
"+"             return 'MAS';
"-"             return 'MENOS';
"*"             return 'MULT';
"/"             return 'DIV';
"%"             return 'MOD';

/* DELIMITADORES TABLA */
"[["            return 'TABLA_A';
"]]"            return 'TABLA_C';

/* DELIMITADORES */
"["             return 'SECC_A';
"]"             return 'SECC_C';
"{"             return 'LLAVE_A';
"}"             return 'LLAVE_C';
"("             return 'PAREN_A';
")"             return 'PAREN_C';
"<"             return 'ANGLE_A';  
">"             return 'ANGLE_C';
","             return 'COMA';
";"             return 'PUNTO_COMA';
":"             return 'DOS_PUNTOS';
"."             return 'PUNTO';
"="             return 'IGUAL';
"`"             return 'BACKTICK';

/* LITERALES */
\"[^\"]*\"                          return 'STRING_LIT';
\'[^\']*\'                          return 'CHAR_LIT';
[0-9]+\.[0-9]+                      return 'DECIMAL';
[0-9]+                              return 'ENTERO';
"$"[a-zA-Z][a-zA-Z0-9_]*           return 'VAR';
"@"[a-zA-Z][a-zA-Z0-9_]*           return 'INPUT_REF';
[a-zA-Z][a-zA-Z0-9_]*              return 'IDENTIFICADOR';

"@"             return 'ARROBA';

<<EOF>>     return 'EOF';
.   { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column+1); }

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
    : lista_componentes EOF   { return $1; }
    ;

lista_componentes
    : lista_componentes componente  { $$ = $1; $$.push($2); }
    | componente                    { $$ = [$1]; }
    ;

/* COMPONENTE */
componente
    : IDENTIFICADOR PAREN_A lista_params PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { nombre:$1, params:$3, elementos:$6 }; }
    | IDENTIFICADOR PAREN_A PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { nombre:$1, params:[], elementos:$5 }; }
    ;

lista_params
    : lista_params COMA param   { $$ = $1; $$.push($3); }
    | param                     { $$ = [$1]; }
    ;

param
    : tipo IDENTIFICADOR        { $$ = { tipo:$1, nombre:$2 }; }
    | tipo VAR                  { $$ = { tipo:$1, nombre:$2 }; }
    ;

tipo
    : T_INT      { $$ = 'int'; }
    | T_FLOAT    { $$ = 'float'; }
    | T_STRING   { $$ = 'string'; }
    | T_BOOL     { $$ = 'boolean'; }
    | T_CHAR     { $$ = 'char'; }
    | T_FUNCTION { $$ = 'function'; }
    ;

/* ELEMENTOS */
lista_elementos
    : lista_elementos elemento  { $$ = $1; $$.push($2); }
    | /* vacío */               { $$ = []; }
    ;

elemento
    : seccion
    | tabla
    | texto
    | imagen
    | formulario
    | ciclo_for_comp
    | ciclo_for_each
    | condicional_if
    | switch_comp
    ;

/* SECCION */
seccion
    : lista_estilos_ang SECC_A lista_elementos SECC_C
        { $$ = { tipo:'seccion', estilos:$1, hijos:$3 }; }
    | SECC_A lista_elementos SECC_C
        { $$ = { tipo:'seccion', estilos:[], hijos:$2 }; }
    ;

/* TABLA */
tabla
    : lista_estilos_ang TABLA_A lista_filas TABLA_C
        { $$ = { tipo:'tabla', estilos:$1, filas:$3 }; }
    | TABLA_A lista_filas TABLA_C
        { $$ = { tipo:'tabla', estilos:[], filas:$2 }; }
    ;

lista_filas
    : lista_filas fila  { $$ = $1; $$.push($2); }
    | fila              { $$ = [$1]; }
    ;

fila
    : TABLA_A lista_celdas TABLA_C  { $$ = $2; }
    ;

lista_celdas
    : lista_celdas celda    { $$ = $1; $$.push($2); }
    | celda                 { $$ = [$1]; }
    ;

celda
    : TABLA_A lista_elementos TABLA_C   { $$ = $2; }
    ;

/* TEXTO */
texto
    : TEXTO lista_estilos_ang PAREN_A STRING_LIT PAREN_C
        { $$ = { tipo:'texto', estilos:$2, contenido:$4 }; }
    | TEXTO PAREN_A STRING_LIT PAREN_C
        { $$ = { tipo:'texto', estilos:[], contenido:$3 }; }
    ;

/* IMAGEN */
imagen
    : IMG lista_estilos_ang PAREN_A lista_urls PAREN_C
        { $$ = { tipo:'imagen', estilos:$2, urls:$4 }; }
    | IMG PAREN_A lista_urls PAREN_C
        { $$ = { tipo:'imagen', estilos:[], urls:$3 }; }
    ;

lista_urls
    : lista_urls COMA url_val   { $$ = $1; $$.push($3); }
    | url_val                   { $$ = [$1]; }
    ;

url_val
    : STRING_LIT    { $$ = $1; }
    | VAR           { $$ = $1; }
    | VAR SECC_A expresion SECC_C  { $$ = { array:$1, indice:$3 }; }
    ;

/* FORMULARIO */
formulario
    : FORM lista_estilos_ang LLAVE_A lista_inputs bloque_submit LLAVE_C
        { $$ = { tipo:'form', estilos:$2, inputs:$4, submit:$5 }; }
    | FORM lista_estilos_ang LLAVE_A lista_inputs LLAVE_C
        { $$ = { tipo:'form', estilos:$2, inputs:$4, submit:null }; }
    | FORM LLAVE_A lista_inputs bloque_submit LLAVE_C
        { $$ = { tipo:'form', estilos:[], inputs:$3, submit:$4 }; }
    | FORM LLAVE_A lista_inputs LLAVE_C
        { $$ = { tipo:'form', estilos:[], inputs:$3, submit:null }; }
    ;

lista_inputs
    : lista_inputs input_elemento   { $$ = $1; $$.push($2); }
    | /* vacío */                   { $$ = []; }
    ;

input_elemento
    : INPUT_TEXT lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_text', estilos:$2, props:$4 }; }
    | INPUT_NUMBER lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_number', estilos:$2, props:$4 }; }
    | INPUT_BOOL lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_bool', estilos:$2, props:$4 }; }
    | INPUT_TEXT PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_text', estilos:[], props:$3 }; }
    | INPUT_NUMBER PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_number', estilos:[], props:$3 }; }
    | INPUT_BOOL PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_bool', estilos:[], props:$3 }; }
    ;

propiedades_input
    : propiedades_input prop_input  { $$ = $1; $$.push($2); }
    | prop_input                    { $$ = [$1]; }
    ;

prop_input
    : KW_ID DOS_PUNTOS STRING_LIT COMA      { $$ = { clave:'id', valor:$3 }; }
    | KW_LABEL DOS_PUNTOS STRING_LIT COMA   { $$ = { clave:'label', valor:$3 }; }
    | KW_VALUE DOS_PUNTOS valor_input COMA  { $$ = { clave:'value', valor:$3 }; }
    | KW_ID DOS_PUNTOS STRING_LIT           { $$ = { clave:'id', valor:$3 }; }
    | KW_LABEL DOS_PUNTOS STRING_LIT        { $$ = { clave:'label', valor:$3 }; }
    | KW_VALUE DOS_PUNTOS valor_input       { $$ = { clave:'value', valor:$3 }; }
    ;

valor_input
    : STRING_LIT    { $$ = $1; }
    | VAR           { $$ = $1; }
    | BOOL_TRUE     { $$ = true; }
    | BOOL_FALSE    { $$ = false; }
    | ENTERO        { $$ = parseInt($1); }
    | DECIMAL       { $$ = parseFloat($1); }
    ;

bloque_submit
    : LLAVE_C SUBMIT lista_estilos_ang LLAVE_A props_submit
        { $$ = { estilos:$3, props:$5 }; }
    | LLAVE_C SUBMIT LLAVE_A props_submit
        { $$ = { estilos:[], props:$4 }; }
    ;

props_submit
    : KW_LABEL DOS_PUNTOS STRING_LIT T_FUNCTION DOS_PUNTOS llamada_funcion
        { $$ = { label:$3, funcion:$6 }; }
    ;

llamada_funcion
    : VAR PAREN_A lista_args_submit PAREN_C
        { $$ = { nombre:$1, args:$3 }; }
    ;

lista_args_submit
    : lista_args_submit COMA arg_submit { $$ = $1; $$.push($3); }
    | arg_submit                        { $$ = [$1]; }
    ;

arg_submit
    : INPUT_REF     { $$ = { tipo:'input_ref', nombre:$1 }; }
    | VAR           { $$ = { tipo:'var', nombre:$1 }; }
    ;

/* CICLOS Y CONDICIONALES */

ciclo_for_each
    : FOR_EACH PAREN_A VAR DOS_PUNTOS VAR PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each', item:$3, array:$5, cuerpo:$8, vacio:null }; }
    | FOR PAREN_A VAR DOS_PUNTOS VAR COMA VAR DOS_PUNTOS VAR PAREN_C TRACK VAR
      LLAVE_A lista_elementos LLAVE_C EMPTY LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each_complejo', items:[$3,$7], arrays:[$5,$9],
                 track:$12, cuerpo:$14, vacio:$18 }; }
    ;

ciclo_for_comp
    : FOR PAREN_A IDENTIFICADOR IGUAL expresion PUNTO_COMA condicion PUNTO_COMA
      IDENTIFICADOR IGUAL expresion PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for', init:{var:$3,val:$5}, cond:$7,
                 update:{var:$9,val:$11}, cuerpo:$14 }; }
    ;

condicional_if
    : IF PAREN_A condicion PAREN_C LLAVE_A lista_elementos LLAVE_C lista_else
        { $$ = { tipo:'if', cond:$3, then:$6, ramas:$8 }; }
    ;

lista_else
    : lista_else rama_else  { $$ = $1; $$.push($2); }
    | /* vacío */           { $$ = []; }
    ;

rama_else
    : ELSE PAREN_A condicion PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'else_if', cond:$3, cuerpo:$6 }; }
    | ELSE LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'else', cuerpo:$3 }; }
    ;

switch_comp
    : SWITCH PAREN_A expresion PAREN_C LLAVE_A lista_casos LLAVE_C
        { $$ = { tipo:'switch', expr:$3, casos:$6 }; }
    ;

lista_casos
    : lista_casos caso  { $$ = $1; $$.push($2); }
    | caso              { $$ = [$1]; }
    ;

caso
    : CASE STRING_LIT LLAVE_A lista_elementos LLAVE_C COMA
        { $$ = { valor:$2, cuerpo:$4 }; }
    | DEFAULT LLAVE_A lista_elementos LLAVE_C
        { $$ = { valor:'default', cuerpo:$3 }; }
    ;

/* ESTILOS─ */
lista_estilos_ang
    : LT lista_ids GT   { $$ = $2; }
    ;

lista_ids
    : lista_ids COMA IDENTIFICADOR  { $$ = $1; $$.push($3); }
    | IDENTIFICADOR                 { $$ = [$1]; }
    ;

/* EXPRESIONES */
condicion
    : expresion EQ  expresion   { $$ = { op:'==', izq:$1, der:$3 }; }
    | expresion NEQ expresion   { $$ = { op:'!=', izq:$1, der:$3 }; }
    | expresion GT  expresion   { $$ = { op:'>',  izq:$1, der:$3 }; }
    | expresion GTE expresion   { $$ = { op:'>=', izq:$1, der:$3 }; }
    | expresion LT  expresion   { $$ = { op:'<',  izq:$1, der:$3 }; }
    | expresion LTE expresion   { $$ = { op:'<=', izq:$1, der:$3 }; }
    | condicion AND condicion   { $$ = { op:'&&', izq:$1, der:$3 }; }
    | condicion OR  condicion   { $$ = { op:'||', izq:$1, der:$3 }; }
    | NOT condicion             { $$ = { op:'!',  val:$2 }; }
    | expresion                 { $$ = $1; }
    ;

expresion
    : expresion MAS   expresion     { $$ = { op:'+', izq:$1, der:$3 }; }
    | expresion MENOS expresion     { $$ = { op:'-', izq:$1, der:$3 }; }
    | expresion MULT  expresion     { $$ = { op:'*', izq:$1, der:$3 }; }
    | expresion DIV   expresion     { $$ = { op:'/', izq:$1, der:$3 }; }
    | expresion MOD   expresion     { $$ = { op:'%', izq:$1, der:$3 }; }
    | MENOS expresion %prec UMENOS  { $$ = { op:'neg', val:$2 }; }
    | PAREN_A expresion PAREN_C     { $$ = $2; }
    | ENTERO            { $$ = parseInt($1); }
    | DECIMAL           { $$ = parseFloat($1); }
    | STRING_LIT        { $$ = $1; }
    | BOOL_TRUE         { $$ = true; }
    | BOOL_FALSE        { $$ = false; }
    | VAR               { $$ = { tipo:'var', nombre:$1 }; }
    | VAR SECC_A expresion SECC_C   { $$ = { tipo:'array_acc', nombre:$1, indice:$3 }; }
    | IDENTIFICADOR     { $$ = { tipo:'ident', nombre:$1 }; }
    ;