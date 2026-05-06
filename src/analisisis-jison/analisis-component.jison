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
"for each"       return 'FOR_EACH';
"to"            return 'TO';
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

/* CLAVES INPUT */
"id"            return 'KW_ID';
"label"         return 'KW_LABEL';
"value"         return 'KW_VALUE';

/* BOOLEANOS */
"true"          return 'BOOL_TRUE';
"false"         return 'BOOL_FALSE';

/* OPERADORES LOGICOS */
"=="            return 'EQ';
"!="            return 'NEQ';
">="            return 'GTE';
"<="            return 'LTE';

/* OPERADORES ARITMETICOS */
"+"             return 'MAS';
"-"             return 'MENOS';
"*"             return 'MULT';
"/"             return 'DIV';
"%"             return 'MOD';

/* DELIMITADORES TABLA - DEBEN IR ANTES que los simples */
"[["            return 'TABLA_A';
"]]"            return 'TABLA_C';

/* DELIMITADORES */
"["             return 'SECC_A';
"]"             return 'SECC_C';
"{"             return 'LLAVE_A';
"}"             return 'LLAVE_C';
"("             return 'PAREN_A';
")"             return 'PAREN_C';
/* ANGULARES — tokens propios, separados de GT/LT */
".."            return 'RANGO';
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
[a-zA-Z][a-zA-Z0-9_\-]*            return 'IDENTIFICADOR';

<<EOF>>     return 'EOF';
.   { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column+1); }

/lex

%left OR
%left AND
%right NOT
%left EQ NEQ
%left GTE LTE
%left MAS MENOS
%left MULT DIV MOD
%right UMENOS


%start inicio
%%

inicio
    : lista_componentes EOF   
    {
        console.log("Componentes parseados:", $1.length); 
        return $1; 
    }
    ;

lista_componentes
    : lista_componentes componente  { $$ = $1; $$.push($2); }
    | componente                    { $$ = [$1]; }
    ;

/* COMPONENTE */
componente
    : IDENTIFICADOR PAREN_A lista_params PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'componente', nombre:$1, params:$3, elementos:$6 }; }
    | IDENTIFICADOR PAREN_A PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'componente', nombre:$1, params:[], elementos:$5 }; }
    ;

lista_params
    : lista_params COMA param   { $$ = $1; $$.push($3); }
    | param                     { $$ = [$1]; }
    ;

param
    : tipo IDENTIFICADOR        
        { $$ = { tipo:$1, nombre:$2, esArray: false }; }
    | tipo VAR                  
        { $$ = { tipo:$1, nombre:$2.substring(1), esArray: false }; }
    | tipo SECC_A SECC_C IDENTIFICADOR   
        { $$ = { tipo:$1, nombre:$4, esArray: true }; }
    | tipo SECC_A SECC_C VAR             
        { $$ = { tipo:$1, nombre:$4.substring(1), esArray: true }; }
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
    : TABLA_A lista_celdas TABLA_C  { $$ = { celdas: $2 }; }
    ;

lista_celdas
    : lista_celdas celda    { $$ = $1; $$.push($2); }
    | celda                 { $$ = [$1]; }
    ;

celda
    : TABLA_A lista_elementos TABLA_C   { $$ = { contenido: $2 }; }
    ;

/* TEXTO */
texto
    : TEXTO lista_estilos_ang PAREN_A expresion PAREN_C
        { $$ = { tipo:'texto', estilos:$2, contenido:$4 }; }
    | TEXTO PAREN_A expresion PAREN_C
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
    | VAR           { $$ = { tipo:'var', nombre:$1 }; }
    | VAR SECC_A expresion SECC_C  { $$ = { tipo:'array_acc', nombre:$1, indice:$3 }; }
    ;

/* FORMULARIO */
formulario
    : FORM lista_estilos_ang LLAVE_A lista_inputs LLAVE_C SUBMIT lista_estilos_ang LLAVE_A props_submit LLAVE_C
        { $$ = { tipo:'form', estilos:$2, inputs:$4, submit:{ estilos:$7, props:$9 } }; }
    | FORM lista_estilos_ang LLAVE_A lista_inputs LLAVE_C SUBMIT LLAVE_A props_submit LLAVE_C
        { $$ = { tipo:'form', estilos:$2, inputs:$4, submit:{ estilos:[], props:$8 } }; }
    | FORM lista_estilos_ang LLAVE_A lista_inputs LLAVE_C
        { $$ = { tipo:'form', estilos:$2, inputs:$4, submit:null }; }
    | FORM LLAVE_A lista_inputs LLAVE_C SUBMIT lista_estilos_ang LLAVE_A props_submit LLAVE_C
        { $$ = { tipo:'form', estilos:[], inputs:$3, submit:{ estilos:$6, props:$8 } }; }
    | FORM LLAVE_A lista_inputs LLAVE_C SUBMIT LLAVE_A props_submit LLAVE_C
        { $$ = { tipo:'form', estilos:[], inputs:$3, submit:{ estilos:[], props:$7 } }; }
    | FORM LLAVE_A lista_inputs LLAVE_C
        { $$ = { tipo:'form', estilos:[], inputs:$3, submit:null }; }
    ;

lista_inputs
    : lista_inputs input_elemento   { $$ = $1; $$.push($2); }
    | /* vacío */                   { $$ = []; }
    ;

/* INPUT  */
input_elemento
    : INPUT_TEXT lista_estilos_ang LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_text', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_NUMBER lista_estilos_ang LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_number', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_BOOL lista_estilos_ang LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_bool', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_TEXT lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_text', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_NUMBER lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_number', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_BOOL lista_estilos_ang PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_bool', estilos:$2, props:Object.fromEntries($4.map(p=>[p.clave,p.valor])) }; }
    | INPUT_TEXT LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_text', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    | INPUT_NUMBER LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_number', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    | INPUT_BOOL LLAVE_A propiedades_input LLAVE_C
        { $$ = { tipo:'input_bool', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    | INPUT_TEXT PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_text', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    | INPUT_NUMBER PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_number', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    | INPUT_BOOL PAREN_A propiedades_input PAREN_C
        { $$ = { tipo:'input_bool', estilos:[], props:Object.fromEntries($3.map(p=>[p.clave,p.valor])) }; }
    ;

propiedades_input
    : propiedades_input prop_input  { $$ = $1; $$.push($2); }
    | prop_input                    { $$ = [$1]; }
    ;

prop_input
    : KW_ID DOS_PUNTOS STRING_LIT COMA      { $$ = { clave:'id', valor:$3.replace(/"/g,'') }; }
    | KW_LABEL DOS_PUNTOS STRING_LIT COMA   { $$ = { clave:'label', valor:$3.replace(/"/g,'') }; }
    | KW_VALUE DOS_PUNTOS valor_input COMA  { $$ = { clave:'value', valor:$3 }; }
    | KW_ID DOS_PUNTOS STRING_LIT           { $$ = { clave:'id', valor:$3.replace(/"/g,'') }; }
    | KW_LABEL DOS_PUNTOS STRING_LIT        { $$ = { clave:'label', valor:$3.replace(/"/g,'') }; }
    | KW_VALUE DOS_PUNTOS valor_input       { $$ = { clave:'value', valor:$3 }; }
    ;

valor_input
    : STRING_LIT    { $$ = $1.replace(/"/g,''); }
    | VAR           { $$ = $1; }
    | BOOL_TRUE     { $$ = true; }
    | BOOL_FALSE    { $$ = false; }
    | ENTERO        { $$ = parseInt($1); }
    | DECIMAL       { $$ = parseFloat($1); }
    ;

props_submit
    : KW_LABEL DOS_PUNTOS STRING_LIT
        { $$ = { label:$3.replace(/"/g,''), funcion:null }; }
    | KW_LABEL DOS_PUNTOS STRING_LIT T_FUNCTION DOS_PUNTOS llamada_funcion
        { $$ = { label:$3.replace(/"/g,''), funcion:$6 }; }
    ;

llamada_funcion
    : VAR PAREN_A lista_args_submit PAREN_C
        { $$ = { nombre:$1, args:$3 }; }
    | VAR PAREN_A PAREN_C
        { $$ = { nombre:$1, args:[] }; }
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
    : FOR_EACH PAREN_A VAR DOS_PUNTOS VAR PAREN_C 
      LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each', item:$3, array:{tipo:'var', nombre:$5.substring(1)}, 
                 cuerpo:$8, vacio:null }; }

    | FOR_EACH PAREN_A VAR DOS_PUNTOS IDENTIFICADOR PAREN_C 
      LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each', item:$3, array:{tipo:'ident', nombre:$5}, 
                 cuerpo:$8, vacio:null }; }

    | FOR_EACH PAREN_A VAR DOS_PUNTOS VAR PAREN_C 
      LLAVE_A lista_elementos LLAVE_C EMPTY LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each', item:$3, array:{tipo:'var', nombre:$5.substring(1)}, 
                 cuerpo:$8, vacio:$12 }; }

    | FOR_EACH PAREN_A VAR DOS_PUNTOS IDENTIFICADOR PAREN_C 
      LLAVE_A lista_elementos LLAVE_C EMPTY LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each', item:$3, array:{tipo:'ident', nombre:$5}, 
                 cuerpo:$8, vacio:$12 }; }
    ;

ciclo_for_complejo
    : FOR PAREN_A lista_pares VAR TRACK VAR PAREN_C LLAVE_A lista_elementos LLAVE_C EMPTY LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for_each_complejo', pares:$3, track:$6, cuerpo:$9, vacio:$13 }; }
    ;

lista_pares
    : lista_pares COMA par  { $$ = $1; $$.push($3); }
    | par                   { $$ = [$1]; }
    ;

par
    : VAR DOS_PUNTOS VAR    { $$ = { item:$1, array:$3 }; }
    ;

ciclo_for_comp
    : FOR PAREN_A IDENTIFICADOR IGUAL expresion PUNTO_COMA condicion PUNTO_COMA
      IDENTIFICADOR IGUAL expresion PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'for', init:{var:$3,val:$5}, cond:$7,
                 update:{var:$9,val:$11}, cuerpo:$14 }; }
    ;

condicional_if
    : if_simple
    | if_completo
    ;

rango
    : ENTERO PUNTO PUNTO expresion  { $$ = { desde:parseInt($1), hasta:$4, inclusivo:true }; }
    | ENTERO TO expresion           { $$ = { desde:parseInt($1), hasta:$3, inclusivo:false }; }
    ;
/* IF SIN ELSE */
if_simple
    : IF PAREN_A condicion PAREN_C LLAVE_A lista_elementos LLAVE_C
        {
          $$ = {
            tipo:'if',
            condicion:$3,
            entonces:$6,
            sino_si:[],
            sino:null
          };
        }
    ;

/* IF CON ELSE / ELSE IF */
if_completo
    : IF PAREN_A condicion PAREN_C LLAVE_A lista_elementos LLAVE_C lista_else
        {
          $$ = {
            tipo:'if',
            condicion:$3,
            entonces:$6,
            sino_si:$8.filter(r => r.tipo === 'else_if'),
            sino:($8.find(r => r.tipo === 'else') || {}).cuerpo || null
          };
        }
    ;

lista_else
    : lista_else rama_else  { $$ = $1; $$.push($2); }
    | rama_else             { $$ = [$1]; }
    ;

rama_else
    : ELSE IF PAREN_A condicion PAREN_C LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'else_if', condicion:$4, cuerpo:$7 }; }

    | ELSE LLAVE_A lista_elementos LLAVE_C
        { $$ = { tipo:'else', cuerpo:$3 }; }
    ;

switch_comp
    : SWITCH PAREN_A expresion PAREN_C LLAVE_A lista_casos LLAVE_C
        { $$ = { tipo:'switch', expr:$3, casos:$6 }; }
    ;

lista_casos
    : lista_casos COMA caso  { $$ = $1; $$.push($3); }
    | caso                   { $$ = [$1]; }
    ;

caso
    : CASE STRING_LIT LLAVE_A lista_elementos LLAVE_C
        { $$ = { valor:$2.replace(/"/g,''), cuerpo:$4 }; }
    | DEFAULT LLAVE_A lista_elementos LLAVE_C
        { $$ = { valor:'default', cuerpo:$3 }; }
    ;

/* ESTILOS — usa ANGLE_A y ANGLE_C, no GT/LT */
lista_estilos_ang
    : ANGLE_A lista_ids ANGLE_C   { $$ = $2; }
    ;

lista_ids
    : lista_ids COMA IDENTIFICADOR  { $$ = $1; $$.push($3); }
    | IDENTIFICADOR                 { $$ = [$1]; }
    ;

/* EXPRESIONES */
condicion
    : expresion ANGLE_A expresion { $$ = { op: '<', izq:$1, der:$3 }; }
    | expresion ANGLE_C expresion { $$ = { op: '>', izq:$1, der:$3 }; }
    | expresion EQ  expresion   { $$ = { op:'==', izq:$1, der:$3 }; }
    | expresion NEQ expresion   { $$ = { op:'!=', izq:$1, der:$3 }; }
    | expresion GTE expresion   { $$ = { op:'>=', izq:$1, der:$3 }; }
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
    | STRING_LIT        { $$ = $1.replace(/"/g,''); }
    | BOOL_TRUE         { $$ = true; }
    | BOOL_FALSE        { $$ = false; }
    | VAR               { $$ = { tipo:'var', nombre:$1.substring(1) }; }
    | VAR SECC_A expresion SECC_C   { $$ = { tipo:'array_acc', nombre:$1.substring(1), indice:$3 }; }
    | IDENTIFICADOR     { $$ = { tipo:'ident', nombre:$1 }; }
    ;