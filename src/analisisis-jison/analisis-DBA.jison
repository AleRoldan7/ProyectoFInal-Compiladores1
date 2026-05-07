%lex
%%

\s+                                 /* ignorar */
"/*"[\s\S]*?"*/"                    /* comentarios */

"TABLE"         return 'TABLE';
"COLUMNS"       return 'COLUMNS';
"DELETE"        return 'DELETE';
"IN"            return 'IN';

\"[^\"]*\"      return 'STRING_LIT';
[0-9]+\.[0-9]+  return 'DECIMAL';
[0-9]+          return 'ENTERO';

"["             return 'CORCH_A';
"]"             return 'CORCH_C';
"."             return 'PUNTO';
","             return 'COMA';
"="             return 'IGUAL';
";"             return 'PUNTO_COMA';

[a-zA-Z][a-zA-Z0-9_]*  return 'IDENTIFICADOR';

<<EOF>>     return 'EOF';
. { yy.manejador.errorLexico(yytext, yylloc.first_line, yylloc.first_column + 1); }

/lex

%start inicio
%%

inicio
    : lista_sentencias EOF
    {
        return {
            ast:     $1,
            tokens:  yy.manejador.getTokens(),
            errores: yy.manejador.getErrores()
        };
    }

    /* Error estructural general */
    | error EOF
    {
        yy.manejador.errorSintactico(
            yytext, @1.first_line, @1.first_column + 1,
            'Error estructural: no se pudo reconocer ninguna sentencia DBA válida'
        );
        return {
            ast:     [],
            tokens:  yy.manejador.getTokens(),
            errores: yy.manejador.getErrores()
        };
    }
    ;

lista_sentencias
    : lista_sentencias sentencia  { $$ = $1; $$.push($2); }
    | sentencia                   { $$ = [$1]; }
    ;

sentencia
    : crear_tabla
    | seleccionar
    | insertar
    | actualizar
    | eliminar

    /* Error: sentencia no reconocida — recuperar hasta ';' */
    | error PUNTO_COMA
    {
        yy.manejador.errorSintactico(
            yytext, @1.first_line, @1.first_column + 1,
            "Sentencia DBA no reconocida: '" + yytext + "'"
        );
        $$ = null;
    }
    ;

/* ─── CREATE TABLE ─────────────────────────────────────────────── */

crear_tabla
    : TABLE IDENTIFICADOR COLUMNS lista_columnas PUNTO_COMA
        { $$ = { tipo:'create', tabla:$2, columnas:$4 }; }

    /* Error: TABLE sin nombre de tabla */
    | TABLE error COLUMNS lista_columnas PUNTO_COMA
    {
        yy.manejador.errorTablaCreacionSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'create', tabla:'unknown', columnas:$4 };
    }

    /* Error: TABLE sin COLUMNS */
    | TABLE IDENTIFICADOR error lista_columnas PUNTO_COMA
    {
        yy.manejador.errorTablaCreacionSintaxis(@3.first_line, @3.first_column + 1);
        $$ = { tipo:'create', tabla:$2, columnas:$4 };
    }

    /* Error: TABLE sin ';' al final */
    | TABLE IDENTIFICADOR COLUMNS lista_columnas error
    {
        yy.manejador.errorDBANoPuntoComa(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'create', tabla:$2, columnas:$4 };
    }
    ;

lista_columnas
    : lista_columnas COMA columna_def  { $$ = $1; $$.push($3); }
    | columna_def                      { $$ = [$1]; }
    ;

columna_def
    : IDENTIFICADOR IGUAL tipo_columna
        { $$ = { nombre:$1, tipo:$3 }; }

    /* Error: columna sin '=' */
    | IDENTIFICADOR error tipo_columna
    {
        yy.manejador.errorSintactico(
            $1, @2.first_line, @2.first_column + 1,
            "Se esperaba '=' en la definición de columna '" + $1 + "'"
        );
        $$ = { nombre:$1, tipo:$3 };
    }
    ;

tipo_columna
    : IDENTIFICADOR  { $$ = $1; }
    ;

/* ─── SELECT ───────────────────────────────────────────────────── */

seleccionar
    : IDENTIFICADOR PUNTO IDENTIFICADOR PUNTO_COMA
        { $$ = { tipo:'select', tabla:$1, columna:$3 }; }

    /* Error: select sin '.' separador */
    | IDENTIFICADOR error IDENTIFICADOR PUNTO_COMA
    {
        yy.manejador.errorSeleccionSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'select', tabla:$1, columna:$3 };
    }

    /* Error: select sin ';' al final */
    | IDENTIFICADOR PUNTO IDENTIFICADOR error
    {
        yy.manejador.errorDBANoPuntoComa(@4.first_line, @4.first_column + 1);
        $$ = { tipo:'select', tabla:$1, columna:$3 };
    }
    ;

/* ─── INSERT ───────────────────────────────────────────────────── */

insertar
    : IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C PUNTO_COMA
        { $$ = { tipo:'insert', tabla:$1, valores:$3 }; }

    /* Error: insert sin '[' */
    | IDENTIFICADOR error lista_asignaciones_db CORCH_C PUNTO_COMA
    {
        yy.manejador.errorInsertSintaxis(@2.first_line, @2.first_column + 1);
        $$ = { tipo:'insert', tabla:$1, valores:$3 };
    }

    /* Error: insert sin ']' de cierre */
    | IDENTIFICADOR CORCH_A lista_asignaciones_db error PUNTO_COMA
    {
        yy.manejador.errorInsertSintaxis(@4.first_line, @4.first_column + 1);
        $$ = { tipo:'insert', tabla:$1, valores:$3 };
    }

    /* Error: insert sin ';' */
    | IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C error
    {
        yy.manejador.errorDBANoPuntoComa(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'insert', tabla:$1, valores:$3 };
    }
    ;

/* ─── UPDATE ───────────────────────────────────────────────────── */

actualizar
    : IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C IN valor_id PUNTO_COMA
        { $$ = { tipo:'update', tabla:$1, valores:$3, id:$6 }; }

    /* Error: update sin 'IN' */
    | IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C error valor_id PUNTO_COMA
    {
        yy.manejador.errorUpdateSintaxis(@5.first_line, @5.first_column + 1);
        $$ = { tipo:'update', tabla:$1, valores:$3, id:$6 };
    }

    /* Error: update sin id numérico válido */
    | IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C IN error PUNTO_COMA
    {
        yy.manejador.errorIdNoNumerico(yytext, @6.first_line, @6.first_column + 1);
        $$ = { tipo:'update', tabla:$1, valores:$3, id:0 };
    }

    /* Error: update sin ';' */
    | IDENTIFICADOR CORCH_A lista_asignaciones_db CORCH_C IN valor_id error
    {
        yy.manejador.errorDBANoPuntoComa(@7.first_line, @7.first_column + 1);
        $$ = { tipo:'update', tabla:$1, valores:$3, id:$6 };
    }
    ;

/* ─── DELETE ───────────────────────────────────────────────────── */

eliminar
    : IDENTIFICADOR DELETE valor_id PUNTO_COMA
        { $$ = { tipo:'delete', tabla:$1, id:$3 }; }

    /* Error: delete sin id válido */
    | IDENTIFICADOR DELETE error PUNTO_COMA
    {
        yy.manejador.errorDeleteSintaxis(@3.first_line, @3.first_column + 1);
        $$ = { tipo:'delete', tabla:$1, id:0 };
    }

    /* Error: delete sin ';' */
    | IDENTIFICADOR DELETE valor_id error
    {
        yy.manejador.errorDBANoPuntoComa(@4.first_line, @4.first_column + 1);
        $$ = { tipo:'delete', tabla:$1, id:$3 };
    }
    ;

/* ─── ASIGNACIONES ─────────────────────────────────────────────── */

lista_asignaciones_db
    : lista_asignaciones_db COMA asignacion_db  { $$ = $1; $$.push($3); }
    | asignacion_db                             { $$ = [$1]; }
    ;

asignacion_db
    : IDENTIFICADOR IGUAL STRING_LIT
        { $$ = { col:$1, val:$3.replace(/"/g,'') }; }
    | IDENTIFICADOR IGUAL DECIMAL
        { $$ = { col:$1, val:parseFloat($3) }; }
    | IDENTIFICADOR IGUAL ENTERO
        { $$ = { col:$1, val:parseInt($3) }; }
    | IDENTIFICADOR IGUAL IDENTIFICADOR
        { $$ = { col:$1, val:$3 }; }

    /* Error: asignación DBA sin '=' */
    | IDENTIFICADOR error
    {
        yy.manejador.errorSintactico(
            $1, @2.first_line, @2.first_column + 1,
            "Se esperaba '=' después de la columna '" + $1 + "'"
        );
        $$ = { col:$1, val:null };
    }
    ;

/* ─── VALOR ID ─────────────────────────────────────────────────── */

valor_id
    : ENTERO    { $$ = parseInt($1); }
    | DECIMAL   { $$ = parseFloat($1); }
    ;