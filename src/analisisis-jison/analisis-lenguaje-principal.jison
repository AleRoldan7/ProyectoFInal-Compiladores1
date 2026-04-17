%lex
%%

\s+                                 /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentario bloque */
"#"[^\n]*                           /* comentario linea */

/* PALABRAS RESERVADAS */
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
"else if"       return 'ELSE_IF';
"else"          return 'ELSE';
"switch"        return 'SWITCH';
"case"          return 'CASE';
"default"       return 'DEFAULT';
"break"         return 'BREAK';
"continue"      return 'CONTINUE';
"True"          return 'BOOL_TRUE';
"False"         return 'BOOL_FALSE';

/* OPERADORES */
"++"            return 'INCREMENT';
"=="            return 'EQ';
"!="            return 'NEQ';
">="            return 'GTE';
"<="            return 'LTE';
">"             return 'GT';
"<"             return 'LT';
"&&"            return 'AND';
"||"            return 'OR';
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

/* BACKTICK */
"`"[^`]*"`"     return 'BACKTICK_EXPR';

/* LITERALES */
\"[^\"]*\"      return 'STRING_LIT';
\'[^\']*\'      return 'CHAR_LIT';
[0-9]+\.[0-9]+  return 'DECIMAL';
[0-9]+          return 'ENTERO';
[a-zA-Z][a-zA-Z0-9_]* return 'IDENTIFICADOR';

<<EOF>> return 'EOF';
. { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column+1); }

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
        { return { imports:$1, declaraciones:$2, main:$3 }; }
    ;

/* IMPORTS */
lista_imports
    : lista_imports import_stmt { $$ = $1; $$.push($2); }
    | /* vacío */ { $$ = []; }
    ;

import_stmt
    : IMPORT STRING_LIT PUNTO_COMA { $$ = { path:$2 }; }
    ;

/* DECLARACIONES */
lista_declaraciones
    : lista_declaraciones declaracion_o_funcion { $$ = $1; $$.push($2); }
    | /* vacío */ { $$ = []; }
    ;

declaracion_o_funcion
    : declaracion_variable
    | declaracion_funcion
    ;

/* VARIABLES */
declaracion_variable
    : tipo_simple IDENTIFICADOR IGUAL expresion PUNTO_COMA
    | tipo_simple CORCH_A CORCH_C IDENTIFICADOR IGUAL LLAVE_A lista_valores LLAVE_C PUNTO_COMA
    | tipo_simple CORCH_A CORCH_C IDENTIFICADOR IGUAL EXECUTE BACKTICK_EXPR PUNTO_COMA
    ;

tipo_simple
    : T_INT | T_FLOAT | T_STRING | T_BOOL | T_CHAR
    ;

lista_valores
    : lista_valores COMA expresion { $$ = $1; $$.push($3); }
    | expresion { $$ = [$1]; }
    ;

/* FUNCIONES */
declaracion_funcion
    : FUNCTION IDENTIFICADOR PAREN_A lista_params_fn PAREN_C LLAVE_A cuerpo_funcion LLAVE_C
    | FUNCTION IDENTIFICADOR PAREN_A PAREN_C LLAVE_A cuerpo_funcion LLAVE_C
    ;

lista_params_fn
    : lista_params_fn COMA param_fn { $$ = $1; $$.push($3); }
    | param_fn { $$ = [$1]; }
    ;

param_fn
    : tipo_simple IDENTIFICADOR
    ;

cuerpo_funcion
    : cuerpo_funcion instruccion_fn { $$ = $1; $$.push($2); }
    | /* vacío */ { $$ = []; }
    ;

instruccion_fn
    : EXECUTE BACKTICK_EXPR PUNTO_COMA
    | LOAD IDENTIFICADOR PUNTO_COMA
    | LOAD STRING_LIT PUNTO_COMA
    ;

/* MAIN */
bloque_main
    : MAIN LLAVE_A lista_instrucciones LLAVE_C
    ;

lista_instrucciones
    : lista_instrucciones instruccion { $$ = $1; $$.push($2); }
    | /* vacío */ { $$ = []; }
    ;

instruccion
    : invocacion_componente PUNTO_COMA
    | asignacion PUNTO_COMA
    | ciclo_while
    | ciclo_for
    | condicional_if
    ;

/* INVOCACION */
invocacion_componente
    : ARROBA IDENTIFICADOR PAREN_A lista_args PAREN_C
    | ARROBA IDENTIFICADOR PAREN_A PAREN_C
    ;

lista_args
    : lista_args COMA expresion { $$ = $1; $$.push($3); }
    | expresion { $$ = [$1]; }
    ;

/* ASIGNACION */
asignacion
    : IDENTIFICADOR IGUAL expresion
    ;

/* WHILE */
ciclo_while
    : WHILE PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C
    ;

/* FOR  */
ciclo_for
    : FOR PAREN_A IDENTIFICADOR IGUAL expresion PUNTO_COMA condicion PUNTO_COMA update PAREN_C LLAVE_A lista_instrucciones LLAVE_C
    ;

update
    : IDENTIFICADOR IGUAL expresion
    ;

/* IF */
condicional_if
    : IF PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C
    | IF PAREN_A condicion PAREN_C LLAVE_A lista_instrucciones LLAVE_C ELSE LLAVE_A lista_instrucciones LLAVE_C
    ;

/* CONDICIONES */
condicion
    : expresion EQ expresion
    | expresion LT expresion
    | expresion GT expresion
    | condicion AND condicion
    | condicion OR condicion
    | NOT condicion
    | expresion
    ;

/* EXPRESIONES */
expresion
    : expresion MAS expresion
    | expresion MENOS expresion
    | expresion MULT expresion
    | expresion DIV expresion
    | MENOS expresion %prec UMENOS
    | IDENTIFICADOR INCREMENT  
        { $$ = { tipo:'post_inc', var:$1 }; }
    | PAREN_A expresion PAREN_C
    | ENTERO
    | DECIMAL
    | STRING_LIT
    | CHAR_LIT
    | BOOL_TRUE
    | BOOL_FALSE
    | IDENTIFICADOR
    ;