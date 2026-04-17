// test-parser.js
const parser = require('./analizador-style.js').parser;  
const parserComponent = require('./analizador-component.js').parser;
const parserPrincipal = require('./analizador-lenguaje-principal.js').parser;
const parserDBA = require('./analizador-dba.js').parser;

console.log("PRUEBAS JISON");

const codigoPrueba = `
hola-TODO { 
    height = 10px; 
    width = 10px; 
    background color = lightgray; 
    color = red; 
    min-width  = 10;

    text align = center;
    text size = 10;
    text font = arial;

    padding = 10;
    padding left = 10;
    padding top = 10;
    padding right = 10;
    padding bottom = 10;

    margin = 10;
    margin left = 10;
    margin top = 10;
    margin right = 10;
    margin bottom = 10;

    border = 2 solid red; /*abreviatura para el width style y color */
}
`;

const prueba = `
updatePkmComponent(
function functionUpdatePokemon, string currentName, int $currentPP
){
FORM<estilo>{
/*
dentro del cuerpo del formulario pueden ir los demás elementos,
no sólo los inputs
Los textos deben soportar variables con $var
y también operaciones con 
*/
INPUT_TEXT<estilo>(
id: "name",
label: "Ingresa un nombre nuevo",
value: "name"
)
INPUT_NUMBER<estilo>(
id: "pp",
label : "Ingresa un pp",
value : $currentPP
)
/* el input tipo booleano representa un checkbox */
INPUT_BOOL<estilo>(
id : "valid",
label: "Es válido?",
value: true
)
} SUBMIT<estilo> {
/*
esto es opcional, crea un botón al final para enviar el formulario,
Dentro de esta sección no pueden haber otros elementos
*/
label: "enviar formulario"
/*se pueden pasarle los valores de los inputs del usuario usando el id*/
function: $functionUpdatePokemon(@valid, @name)

}
}
`;

const principal = `
import "./carpeta1/misComponentes.comp ";
import "./carpeta2/misEstilos.styles ";
/*
definicion de variables
*/
int variableEntera = 2;
float variableConDecimales = 10.0;
string variableDeTexto = "Holaaa";
boolean variableBooleana = True; /* or False */
char variableDeUnSoloCaracter = 'a'; /* o cualquier código ASCII*/
# los arreglos pueden ser de cualquier tipo,
# limitados a que solo pueden ser de una dimensión
string[] pokemons = {"Bulbasaur", "Togepy", "Eevee" }; /* arreglo de 3 dimensiones
ya inicializado*/
# es posible consultar la base de datos y asignarle un valor a la variable

function updatePokemon(int pp, int atack, int id, string goTo){
# permite ejecutar instrucciones para la base de datos
# si ocurre un error se debe dejar por defecto que se muestre
# una alerta en el navegador y detener la ejecución de lo siguiente
# recarga la ejecución de un archivo, en este caso de una variable
load goTo;
}
function goTo(){
# recarga la ejecución de todo el archivo principal
# no se pueden usar funciones dentro de funciones
load "./main.y";
}
/*
Esta es la función principal que se encarga de cargar componentes
*/
main {
@header(); # los componentes se pueden invocar
while(variableEntera < 10){
@lineForStyle();
variableEntera = variableEntera + 1;
}
for(i = 0; i < 10; i = i ++){

}

@footer();
}
`;

const dba = `
/*
Crear una tabla,
los tipos que se manejan son los mismos que los del lenguaje principal
*/
TABLE table_name COLUMNS column_name=type, column2_name=type;
/*
Seleccionar todas las columnas de una tabla particular,
esto devuelve un array del tipo de la columna
*/
table_name.column_name;
/*
Crea un registro
*/
table_name[column_name="value", column2_name=0.0]
/*
Actualiza un registro,
la condición es obligatoria y siempre compara con el id
*/
table_name[column_name="new value", column2_name=10.10] IN 1;
/*
Elimina un registro de una tabla,
la condición es obligatoria y siempre compara con el id
*/
table_name DELETE 1;
`;

try {
    const resultado = parserDBA.parse(dba);
    console.log("Análisis exitoso");
    console.log(JSON.stringify(resultado, null, 2));
} catch (error) {
    console.log("Error de sintaxis:");
    console.log(error.message);
}